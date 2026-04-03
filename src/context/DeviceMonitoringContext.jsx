import React, { createContext, useState, useEffect, useRef, useCallback, useContext } from 'react';
import { deviceDetectionService } from '../services/deviceDetectionService';
import { getApiEndpoint, fetchApi, API_CONFIG } from '../config/apiEndPoint';

const DeviceMonitoringContext = createContext();

export const DeviceMonitoringProvider = ({ children }) => {
    const [devices, setDevices] = useState([]);
    const [isChecking, setIsChecking] = useState(false);
    const [lastChecked, setLastChecked] = useState(null);

    // Refs for stability
    const devicesRef = useRef(devices);
    const isCheckingRef = useRef(false);
    const isMountedRef = useRef(true);
    const intervalRef = useRef(null);
    const debounceTimeoutRef = useRef(null);
    const initialCheckDoneRef = useRef(false);

    useEffect(() => {
        devicesRef.current = devices;
    }, [devices]);

    const getAuthToken = useCallback(() => localStorage.getItem("auth_token"), []);
    const getEscritorioId = useCallback(() => localStorage.getItem("escritorio_id"), []);

    const normalizeName = useCallback((name) => {
        if (!name) return "";
        return name
            .toLowerCase()
            .replace(/[®™©]/g, "")
            .replace(/[-_]/g, " ")
            .replace(/\s+/g, " ")
            .replace(
                /\b(hd|camera|webcam|usb|web|integrated|built-in|truevision|general)\b/gi,
                ""
            )
            .trim();
    }, []);

    const checkDeviceStatuses = useCallback(async () => {
        const escritorioId = getEscritorioId();
        if (!escritorioId || isCheckingRef.current) return;

        isCheckingRef.current = true;
        setIsChecking(true);

        try {
            const isOnline = navigator.onLine;

            // 1. Escanear hardware físico (siempre, online u offline)
            const [usbDevices, webcams, biometricos] = await Promise.all([
                deviceDetectionService.detectUSBDevices(),
                deviceDetectionService.detectWebcams(),
                deviceDetectionService.detectBiometricDevices()
            ]);
            const localHardware = deviceDetectionService.mergeDetectedDevices(usbDevices, webcams).concat(biometricos);

            let finalDevicesState = [];
            let fetchedFromBackend = false;

            if (isOnline) {
                // ========== INTENTO ONLINE ==========
                const token = getAuthToken();
                const headers = {
                    "Content-Type": "application/json",
                    ...(token && { Authorization: `Bearer ${token}` }),
                };

                let registeredDevices = [];
                try {
                    const responseReg = await fetchApi(
                        `${API_CONFIG.ENDPOINTS.BIOMETRICO}?escritorio_id=${escritorioId}`,
                        { headers }
                    );
                    registeredDevices = Array.isArray(responseReg.data || responseReg)
                        ? (responseReg.data || responseReg)
                        : [];

                    fetchedFromBackend = true; // Éxito al consultar backend
                } catch (e) {
                    if (e.message && e.message.includes('401')) {
                        console.log("[DeviceMonitor] GET restringido (esperado en Kiosk sin auth_token)");
                        // Si es 401 por estar en Kiosco sin token de admin, asumimos "online" pero no podemos registrar nuevos.
                        // La validación se apoyará en la caché local para el kiosco.
                    } else {
                        console.warn("[DeviceMonitor] Error obteniendo dispositivos del backend (cayendo a modo offline local):", e.message);
                    }
                }

                if (fetchedFromBackend) {
                    // Match backend devices against local hardware
                    const nextDevicesState = [];

                    for (let regDevice of registeredDevices) {
                        if (!regDevice.es_activo) {
                            nextDevicesState.push(regDevice);
                            continue;
                        }

                        const regName = normalizeName(regDevice.nombre);

                        let foundInHardware = localHardware.find((hw) => {
                            const hwId = hw.deviceId || hw.instanceId || hw.device_id;

                            if (regDevice.device_id && hwId) {
                                return regDevice.device_id === hwId;
                            }

                            const hwName = normalizeName(hw.name);
                            if (!hwName || !regName) return false;

                            return (regName === hwName || regName.includes(hwName) || hwName.includes(regName));
                        });

                        const hwIdAttached = foundInHardware?.deviceId || foundInHardware?.instanceId || foundInHardware?.device_id;

                        // Auto-Vinculación
                        if (foundInHardware && !regDevice.device_id && hwIdAttached) {
                            try {
                                await fetchApi(`${API_CONFIG.ENDPOINTS.BIOMETRICO}/${regDevice.id}`, {
                                    method: 'PUT',
                                    headers,
                                    body: JSON.stringify({ device_id: hwIdAttached })
                                });
                                console.log(`[DeviceMonitor] Dispositivo vinculado automáticamente al hardware ID: ${hwIdAttached}`);
                                regDevice.device_id = hwIdAttached;
                            } catch (e) {
                                console.error("[DeviceMonitor] Error vinculando dispositivo:", e);
                            }
                        }

                        const newEstado = foundInHardware ? "conectado" : "desconectado";
                        nextDevicesState.push({ ...regDevice, estado: newEstado });
                    }

                    if (!isMountedRef.current) return;

                    const connectedDeviceIds = localHardware
                        .map(hw => hw.deviceId || hw.instanceId || hw.device_id)
                        .filter(Boolean);

                    finalDevicesState = nextDevicesState;

                    // Sync-status con backend
                    try {
                        const syncResponse = await fetchApi(`${API_CONFIG.ENDPOINTS.BIOMETRICO}/sync-status`, {
                            method: 'POST',
                            headers,
                            body: JSON.stringify({
                                escritorio_id: escritorioId,
                                device_ids: connectedDeviceIds
                            })
                        });

                        const authDevices = syncResponse?.data || [];

                        if (authDevices.length > 0) {
                            finalDevicesState = authDevices.map(dbDevice => ({
                                ...dbDevice,
                                estado: 'conectado'
                            }));
                        } else if (registeredDevices.length === 0) {
                            finalDevicesState = [];
                        }
                    } catch (e) {
                        console.error("[DeviceMonitor] Error sincronizando estado con el backend:", e);
                    }
                }
            }

            if (!fetchedFromBackend) {
                // ========== MODO OFFLINE (FALLBACK GARANTIZADO) ==========
                // Validar hardware contra caché SQLite
                let cachedBio = [];
                try {
                    cachedBio = await window.electronAPI?.offlineDB?.getBiometricosRegistrados(escritorioId) || [];
                } catch (cacheErr) {
                    console.warn("[DeviceMonitor] Error leyendo caché offline:", cacheErr);
                }

                if (cachedBio.length > 0) {
                    // Solo aceptar hardware que tenga device_id registrado en caché
                    const connected = cachedBio
                        .filter(cached => {
                            return localHardware.some(hw => {
                                const hwId = hw.deviceId || hw.instanceId || hw.device_id;
                                return hwId && cached.device_id && hwId === cached.device_id;
                            });
                        })
                        .map(cached => ({ ...cached, estado: 'conectado' }));

                    // Marcar los registrados pero no conectados como desconectados
                    const connectedIds = connected.map(d => d.id);
                    const disconnected = cachedBio
                        .filter(c => !connectedIds.includes(c.id))
                        .map(c => ({ ...c, estado: 'desconectado' }));

                    finalDevicesState = [...connected, ...disconnected];
                } else {
                    // Si no hay caché, no podemos autorizar nada offline
                    finalDevicesState = [];
                }

                console.log(`[DeviceMonitor] Modo OFFLINE: ${finalDevicesState.filter(d => d.estado === 'conectado').length}/${cachedBio.length} dispositivos válidos`);
            }

            if (JSON.stringify(finalDevicesState) !== JSON.stringify(devicesRef.current)) {
                setDevices(finalDevicesState);
            }

            // MANTENER RETROCOMPATIBILIDAD CON MODALES FACIALES BÁSADOS EN LOCALSTORAGE
            // Si hay alguna cámara facial registrada en la BD o conectada localmente
            const hasRegisteredCamera = finalDevicesState.some(
                d => d.tipo === 'facial' && (d.estado === 'conectado' || d.es_activo)
            );
            localStorage.setItem("cached_camera_registered", JSON.stringify(hasRegisteredCamera));

            setLastChecked(new Date());

        } catch (error) {
            console.error("[DeviceMonitor] Error in global monitoring logic:", error);
        } finally {
            isCheckingRef.current = false;
            if (isMountedRef.current) {
                setIsChecking(false);
            }
        }
    }, [getAuthToken, getEscritorioId, normalizeName]);

    const debouncedCheck = useCallback((delay = 300) => {
        if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
        debounceTimeoutRef.current = setTimeout(checkDeviceStatuses, delay);
    }, [checkDeviceStatuses]);

    // Initial Check
    useEffect(() => {
        if (!initialCheckDoneRef.current) {
            initialCheckDoneRef.current = true;
            const timeout = setTimeout(checkDeviceStatuses, 500);
            return () => clearTimeout(timeout);
        }
    }, [checkDeviceStatuses]);

    // Periodic Polling (Fallback)
    useEffect(() => {
        if (!intervalRef.current) {
            intervalRef.current = setInterval(checkDeviceStatuses, 10000);
        }
        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };
    }, [checkDeviceStatuses]);

    // Hardware Events Listener
    useEffect(() => {
        const handleDeviceChange = () => {
            console.log("[DeviceMonitor] Hot-Plug (Navigator MediaDevices)");
            debouncedCheck(300);
        };

        if (navigator.mediaDevices) {
            navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);
        }

        let removeElectronListener = null;
        if (window.electronAPI?.onUSBDeviceChange) {
            removeElectronListener = window.electronAPI.onUSBDeviceChange(() => {
                console.log("[DeviceMonitor] Hot-Plug (Electron USB)");
                debouncedCheck(300);
            });
        }

        return () => {
            if (navigator.mediaDevices) {
                navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
            }
            if (typeof removeElectronListener === 'function') {
                removeElectronListener();
            }
            if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
        };
    }, [debouncedCheck]);

    // Clean up on unmount
    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
        };
    }, []);

    return (
        <DeviceMonitoringContext.Provider value={{ devices, isChecking, lastChecked, checkNow: checkDeviceStatuses }}>
            {children}
        </DeviceMonitoringContext.Provider>
    );
};

export const useGlobalDeviceStatus = () => {
    const context = useContext(DeviceMonitoringContext);
    if (context === undefined) {
        throw new Error('useGlobalDeviceStatus must be used within a DeviceMonitoringProvider');
    }
    return context;
};
