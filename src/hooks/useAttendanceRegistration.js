import { useState, useRef, useEffect } from "react";
import { API_CONFIG, fetchApi } from "../config/apiEndPoint";
import { agregarEvento } from "../services/bitacoraService";
import {
    obtenerInfoClasificacion,
} from "../services/asistenciaLogicService";
import { useConnectivity } from "./useConnectivity";

export const useAttendanceRegistration = (onClose, onSuccess, onLoginRequest) => {
    const [showPassword, setShowPassword] = useState(false);
    const [usuarioOCorreo, setUsuarioOCorreo] = useState("");
    const [pin, setPin] = useState("");
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [countdown, setCountdown] = useState(6);
    const [errorMessage, setErrorMessage] = useState("");

    // Conectividad global
    const { isDatabaseConnected } = useConnectivity();

    // Refs
    const countdownRef = useRef(null);
    const onCloseRef = useRef(onClose);
    const isSubmittingRef = useRef(false);

    // Mantener referencia actualizada de onClose
    useEffect(() => {
        onCloseRef.current = onClose;
    }, [onClose]);

    // Countdown para cierre automático
    useEffect(() => {
        if (countdownRef.current) {
            clearInterval(countdownRef.current);
            countdownRef.current = null;
        }

        if (result) {
            let count = 6;
            setCountdown(count);

            countdownRef.current = setInterval(() => {
                count -= 1;
                setCountdown(count);

                if (count <= 0) {
                    clearInterval(countdownRef.current);
                    countdownRef.current = null;
                    if (onCloseRef.current) {
                        onCloseRef.current();
                    }
                }
            }, 1000);
        }

        return () => {
            if (countdownRef.current) {
                clearInterval(countdownRef.current);
                countdownRef.current = null;
            }
        };
    }, [result?.success, result?.noPuedeRegistrar, result?.noEsEmpleado, result?.sinHorario]);

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (isSubmittingRef.current) {
            console.log("⚠️ Envío en proceso, ignorando click duplicado");
            return;
        }
        isSubmittingRef.current = true;

        let usuarioData = null;
        let token = null;
        let empleadoData = null;

        if (!usuarioOCorreo.trim() || !pin.trim()) {
            setErrorMessage("Por favor ingresa tu usuario/correo y PIN");
            isSubmittingRef.current = false;
            return;
        }

        setLoading(true);
        setErrorMessage("");

        try {
            let empleadoId = null;

            // ── PASO 1: IDENTIFICAR AL EMPLEADO ─────────────────────────────────
            // Con conexión → API (credenciales frescas, token actualizado).
            // Sin conexión → SQLite local en caché.
            if (isDatabaseConnected) {
                // ── Identificación ONLINE ──
                console.log("🔐 [OfflineFirst] Identificando via API...");
                const loginResponse = await fetch(
                    `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.CREDENCIALES}/pin/login`,
                    {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            usuario: usuarioOCorreo.trim(),
                            pin: pin.trim(),
                            empresa_id: localStorage.getItem("empresa_id")
                        }),
                    }
                );

                if (!loginResponse.ok) {
                    if (loginResponse.status >= 500) {
                        window.dispatchEvent(new CustomEvent("api-offline"));
                        const error = new Error(`Server Error: ${loginResponse.status}`);
                        error.isApiOffline = true;
                        throw error;
                    }
                    const errorData = await loginResponse.json().catch(() => ({}));
                    throw new Error(errorData.message || "Credenciales inválidas");
                }

                const loginData = await loginResponse.json();
                if (!loginData.success) {
                    throw new Error(loginData.message || "Error en la autenticación");
                }

                const responseData = loginData.data || loginData;
                usuarioData = responseData.usuario || responseData;
                token = responseData.token;

                // Preservar roles/permisos/admin desde responseData
                if (responseData.esAdmin !== undefined && usuarioData.esAdmin === undefined) usuarioData.esAdmin = responseData.esAdmin;
                if (responseData.es_admin !== undefined && usuarioData.es_admin === undefined) usuarioData.es_admin = responseData.es_admin;
                if (responseData.roles && !usuarioData.roles) usuarioData.roles = responseData.roles;
                if (responseData.permisos && !usuarioData.permisos) usuarioData.permisos = responseData.permisos;

                if (token) {
                    localStorage.setItem("auth_token", token);
                    if (window.electronAPI?.syncManager) {
                        try { window.electronAPI.syncManager.updateToken(token); } catch (_) {}
                    }
                }

                empleadoId = usuarioData?.empleado_id || responseData.empleado?.id;
                empleadoData = responseData.empleado;

                // Si la respuesta no trajo empleado completo, pedirlo a la API
                if (!empleadoData || !empleadoData.nombre) {
                    try {
                        const empResponse = await fetchApi(`${API_CONFIG.ENDPOINTS.EMPLEADOS}/${empleadoId}`);
                        empleadoData = empResponse.data || empResponse;
                    } catch (_) { /* usar lo que tengamos */ }
                }

            } else {
                // ── Identificación OFFLINE (SQLite) ──
                console.log("📴 [OfflineFirst] Sin conexión — identificando offline...");
                const { identificarPorPinOffline } = await import("../services/offlineAuthService");
                const empleadoIdentificado = await identificarPorPinOffline(
                    usuarioOCorreo.trim(),
                    pin.trim()
                );

                if (!empleadoIdentificado) {
                    throw new Error("Credenciales inválidas");
                }

                empleadoId = empleadoIdentificado.empleado_id;

                // Obtener datos completos de cache_empleados (tiene usuario, correo, foto)
                if (window.electronAPI?.offlineDB) {
                    empleadoData = await window.electronAPI.offlineDB.getEmpleado(empleadoId);
                }
                empleadoData = empleadoData || empleadoIdentificado;

                usuarioData = {
                    id: empleadoIdentificado.usuario_id,
                    nombre: empleadoData?.nombre || empleadoIdentificado.nombre,
                    usuario: empleadoData?.usuario || '',
                    correo: empleadoData?.correo || '',
                    foto: empleadoData?.foto || null,
                    es_empleado: true,
                    empleado_id: empleadoId,
                    offline: true,
                };
            }

            // Usuario no asociado a empleado
            if (!empleadoId) {
                agregarEvento({
                    user: usuarioData?.nombre || usuarioOCorreo,
                    action: "Intento de registro - Usuario no asociado a empleado",
                    type: "warning",
                });
                setResult({
                    success: false,
                    noEsEmpleado: true,
                    message: "Tu cuenta no está asociada a un empleado o no tiene credenciales",
                    usuario: usuarioData,
                    token: token,
                });
                return;
            }

            console.log("👤 Empleado identificado:", empleadoData?.nombre || empleadoId);

            // ── PASO 2 + 3: GUARDAR LOCAL Y SINCRONIZAR INMEDIATAMENTE ──────────
            // guardarYSincronizarAsistencia guarda en SQLite (offline-first garantizado)
            // y si hay conexión intenta push inmediato al servidor.
            console.log("💾 [EagerSync] Guardando y sincronizando asistencia...");
            const { guardarYSincronizarAsistencia } = await import("../services/offlineAuthService");
            const syncResult = await guardarYSincronizarAsistencia({
                empleadoId,
                metodoRegistro: "PIN",
                isDatabaseConnected,
            });

            // Hora actual para fallback
            const horaActual = new Date().toLocaleTimeString("es-MX", {
                hour: "2-digit",
                minute: "2-digit",
            });

            let resultPayload;

            if (syncResult.rechazado) {
                // ── Rechazado definitivamente por el servidor ──
                agregarEvento({
                    user: empleadoData?.nombre || usuarioOCorreo,
                    action: `Registro rechazado por el servidor: ${syncResult.errorServidor} - PIN`,
                    type: "error",
                });

                resultPayload = {
                    success: false,
                    message: syncResult.errorServidor,
                    empleado: empleadoData,
                    usuario: usuarioData,
                    token: token,
                    tipoMovimiento: null,
                    hora: horaActual,
                    rechazado: true,
                };

            } else if (!syncResult.pendiente) {
                // ── Resultado REAL del servidor ──
                const tipoMovimiento = syncResult.tipo === "salida" ? "SALIDA" : "ENTRADA";
                const { estadoTexto, tipoEvento } = obtenerInfoClasificacion(syncResult.estado, syncResult.tipo);

                const voiceMsg = syncResult.tipo === "salida"
                    ? "Salida registrada"
                    : "Entrada registrada";
                const utterance = new SpeechSynthesisUtterance(voiceMsg);
                utterance.lang = "es-MX";
                utterance.rate = 0.9;
                window.speechSynthesis.speak(utterance);

                agregarEvento({
                    user: empleadoData?.nombre || usuarioOCorreo,
                    action: `${tipoMovimiento} registrada (${estadoTexto}) - PIN`,
                    type: tipoEvento,
                });

                resultPayload = {
                    success: true,
                    message: "Asistencia registrada",
                    empleado: empleadoData,
                    usuario: usuarioData,
                    token: token,
                    tipoMovimiento,
                    hora: syncResult.hora || horaActual,
                    estado: syncResult.estado,
                    estadoTexto,
                    clasificacion: syncResult.estado,
                };

            } else { // ── Pendiente: sin red o push falló temporalmente ──
                const utterance = new SpeechSynthesisUtterance("Registro pendiente");
                utterance.lang = "es-MX";
                utterance.rate = 0.9;
                window.speechSynthesis.speak(utterance);

                agregarEvento({
                    user: empleadoData?.nombre || usuarioOCorreo,
                    action: "Asistencia guardada localmente (pendiente de sincronizar) - PIN",
                    type: "warning",
                });

                resultPayload = {
                    success: true,
                    message: "Registro pendiente",
                    empleado: empleadoData,
                    usuario: usuarioData,
                    token: token,
                    tipoMovimiento: "PENDIENTE",
                    hora: horaActual,
                    estado: "pendiente",
                    estadoTexto: "⏳ Asistencia pendiente",
                    clasificacion: "pendiente",
                    pendiente: true,
                };
            }

            setResult(resultPayload);


            if (onSuccess && resultPayload.success) {
                onSuccess({
                    empleado: empleadoData,
                    tipo_movimiento: resultPayload.tipoMovimiento,
                    hora: resultPayload.hora,
                    estado: resultPayload.estado,
                    clasificacion: resultPayload.clasificacion,
                    pendiente: resultPayload.pendiente || false,
                    dispositivo_origen: "escritorio",
                });
            }

        } catch (error) {
            console.error("❌ Error:", error);

            agregarEvento({
                user: usuarioOCorreo,
                action: `Error en registro con PIN - ${error.message}`,
                type: "error",
            });

            const responseData = error.responseData;
            const isBlockCompletedError = error.message && (
                (error.message.includes("bloque") && error.message.includes("completado")) ||
                (error.message.includes("jornada") && error.message.includes("completada"))
            );

            let finalErrorMessage = error.message || "Error al registrar asistencia";
            if (finalErrorMessage.includes("falta directa")) {
                finalErrorMessage = "Registro denegado: Se te ha registrado una falta directa en este turno. No puedes registrar asistencia.";
            }

            setErrorMessage(finalErrorMessage);
            setResult({
                success: false,
                message: finalErrorMessage,
                usuario: usuarioData,
                token: token,
                empleado: empleadoData,
                noPuedeRegistrar: responseData?.noPuedeRegistrar || isBlockCompletedError,
                estadoHorario: responseData?.estadoHorario || (isBlockCompletedError ? "completado" : undefined),
                minutosRestantes: responseData?.minutosRestantes,
            });
        } finally {
            setLoading(false);
            isSubmittingRef.current = false;
        }
    };

    const handleRetry = () => {
        setResult(null);
        setErrorMessage("");
        setPin("");
    };

    const togglePasswordVisibility = () => {
        setShowPassword(!showPassword);
    };

    const handleLoginRequest = async (userData) => {
        if (countdownRef.current) {
            clearInterval(countdownRef.current);
            countdownRef.current = null;
        }

        if (!userData && onLoginRequest && result) {
            const empleadoId = result.empleado?.id || result.empleado?.empleado_id || result.usuario?.empleado_id;
            const isOffline = result.offline || !navigator.onLine;

            // Solo llamar a /api/auth/biometric si hay conexión
            if (empleadoId && !isOffline) {
                try {
                    console.log("🔐 Obteniendo datos completos de sesión vía /api/auth/biometric...");
                    const authResponse = await fetch(
                        `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.AUTH}/biometric`,
                        {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ 
                                empleado_id: empleadoId,
                                empresa_id: localStorage.getItem("empresa_id")
                            }),
                        }
                    );

                    if (authResponse.ok) {
                        const authResult = await authResponse.json();
                        if (authResult.success && authResult.data) {
                            const { usuario, roles, permisos, esAdmin, token: authToken } = authResult.data;
                            if (authToken) localStorage.setItem("auth_token", authToken);
                            userData = {
                                ...usuario,
                                roles,
                                permisos,
                                esAdmin,
                                token: authToken,
                                metodoAutenticacion: "PIN",
                            };
                            console.log("✅ Datos completos obtenidos:", userData);
                        }
                    }
                } catch (error) {
                    console.error("❌ Error obteniendo datos completos:", error);
                }
            }

            // Fallback: construir desde result (offline o si falló)
            if (!userData) {
                userData = {
                    ...result.usuario,
                    rfc: result.empleado?.rfc || result.usuario?.rfc,
                    nss: result.empleado?.nss || result.usuario?.nss,
                    horario_id: result.empleado?.horario_id || result.usuario?.horario_id,
                    es_empleado: result.noEsEmpleado ? false : true,
                    empleado_id: empleadoId,
                    nombre: result.empleado?.nombre || result.usuario?.nombre || result.usuario?.username,
                    usuario: result.empleado?.usuario || result.usuario?.usuario || '',
                    correo: result.empleado?.correo || result.usuario?.correo || '',
                    foto: result.empleado?.foto || result.usuario?.foto || null,
                    token: result.token,
                };
            }
        }

        if (userData) {
            console.log("📤 Datos para sesión:", userData);
            onLoginRequest(userData);
            if (onCloseRef.current) onCloseRef.current();
        }
    };

    return {
        showPassword,
        usuarioOCorreo,
        setUsuarioOCorreo,
        pin,
        setPin,
        loading,
        result,
        errorMessage,
        countdown,
        handleSubmit,
        handleRetry,
        togglePasswordVisibility,
        handleLoginRequest,
    };
};
