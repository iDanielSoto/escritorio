import React, { useState, useEffect, useCallback, useRef } from "react";
import { X, Smartphone, Plus, Trash2, Save, Loader2, AlertCircle, RefreshCw, Search, CheckCircle2, Usb, Camera } from "lucide-react";
import { getApiEndpoint } from "../../config/apiEndPoint";
import { deviceDetectionService } from "../../services/deviceDetectionService";
import { useGlobalDeviceStatus } from "../../context/DeviceMonitoringContext";
import DynamicLoader from "../common/DynamicLoader";

const API_URL = getApiEndpoint("/api");

export default function DispositivosModal({ onClose, onBack, escritorioId, inline = false }) {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [showSaveMessage, setShowSaveMessage] = useState(false);
  const [showErrorMessage, setShowErrorMessage] = useState(false);

  // IDs de dispositivos existentes en BD marcados para borrado diferido
  const [pendingDeletes, setPendingDeletes] = useState([]);

  // Auto-detección de dispositivos
  const [isDetecting, setIsDetecting] = useState(false);
  const [detectionStatus, setDetectionStatus] = useState(null);

  // Obtener token de autenticación
  const getAuthToken = () => {
    return localStorage.getItem("auth_token");
  };

  // Cargar dispositivos desde la BD
  const fetchDevices = async () => {
    if (!escritorioId) {
      setError("No se ha especificado el ID del escritorio");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const token = getAuthToken();
      const response = await fetch(`${API_URL}/biometrico/escritorio/${escritorioId}`, {
        headers: {
          "Content-Type": "application/json",
          ...(token && { Authorization: `Bearer ${token}` }),
        },
      });

      if (!response.ok) {
        throw new Error("Error al cargar los dispositivos");
      }

      const result = await response.json();
      const data = result.data || result;

      // Mapear los datos de la BD a la estructura del componente y omitir inactivos
      const mappedDevices = Array.isArray(data)
        ? data
          .filter(d => d.es_activo === true || d.es_activo === 1 || d.es_activo === undefined)
          .map(d => ({
            id: d.id,
            nombre: d.nombre || "",
            tipo: d.tipo || "facial",
            puerto: d.puerto || "",
            ip: d.ip || "",
            estado: d.estado || "desconectado",
            es_activo: d.es_activo ?? true,
            device_id: d.device_id || null,
          }))
        : [];

      setDevices(mappedDevices);
    } catch (err) {
      console.error("Error al cargar dispositivos:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Detectar dispositivos automáticamente
  const detectDevices = useCallback(async () => {
    setIsDetecting(true);
    setDetectionStatus(null);

    try {
      const [usbDevices, webcams, biometricos] = await Promise.all([
        deviceDetectionService.detectUSBDevices(),
        deviceDetectionService.detectWebcams(),
        deviceDetectionService.detectBiometricDevices(),
      ]);

      const detectedDevices = deviceDetectionService.mergeDetectedDevices(usbDevices, webcams).concat(biometricos);

      // Mapear del formato del hook (name, type, deviceId, instanceId) al del modal (nombre, tipo, device_id)
      const mappedDetected = detectedDevices.map(d => ({
        nombre: d.name || "",
        tipo: d.type || "facial",
        puerto: d.port || "",
        ip: d.ip || "",
        device_id: d.deviceId || d.instanceId || null,
        estado: "desconectado",
        es_activo: true,
        isNew: true,
        _key: (d.name || "").toLowerCase(),
      }));

      // Usar updater funcional para evitar dependencia en 'devices'
      let addedCount = 0;
      setDevices(prev => {
        const newDevices = mappedDetected.filter(detected =>
          !prev.some(existing => {
            // 1. Validar por identificador único de hardware
            if (existing.device_id && detected.device_id && existing.device_id === detected.device_id) {
              return true;
            }
            // 2. Fallback por nombre normalizado (para los que no tienen ID físico)
            return (existing.nombre || "").toLowerCase() === detected._key;
          })
        );
        addedCount = newDevices.length;
        if (newDevices.length === 0) return prev;

        const withIds = newDevices.map((d, i) => {
          const { _key, ...rest } = d;
          return { ...rest, id: `NEW_${Date.now()}_${i}` };
        });
        return [...prev, ...withIds];
      });

      const hasElectronAPI = !!(window.electronAPI && window.electronAPI.detectUSBDevices);
      const statusMessage = deviceDetectionService.getDetectionStatusMessage(
        detectedDevices,
        { length: addedCount },
        hasElectronAPI,
        webcams.length,
      );
      setDetectionStatus(statusMessage);
    } catch (error) {
      console.error("Error detectando dispositivos:", error);
      setDetectionStatus({
        type: "error",
        message: "Error al detectar dispositivos: " + error.message,
      });
    } finally {
      setIsDetecting(false);
    }
  }, []); // Sin dependencias — usa functional updater

  useEffect(() => {
    fetchDevices();
  }, [escritorioId]);

  // Consumir el contexto global para conocer el estado en tiempo real (evitar doble monitoreo)
  const { devices: globalDevices } = useGlobalDeviceStatus();

  const addDevice = () => {
    setDevices([
      ...devices,
      {
        id: `NEW_${Date.now()}`,
        nombre: "",
        tipo: "facial",
        puerto: "",
        ip: "",
        estado: "desconectado",
        es_activo: true,
        isNew: true,
      },
    ]);
  };

  const updateDevice = (id, field, value) => {
    setDevices(devices.map((dev) => (dev.id === id ? { ...dev, [field]: value } : dev)));
  };

  const removeDevice = (id) => {
    const device = devices.find((dev) => dev.id === id);
    if (device && !device.isNew) {
      // Dispositivo existente en BD → marcar para borrado diferido
      setPendingDeletes((prev) => [...prev, id]);
    }
    // Siempre quitar de la vista
    setDevices((prev) => prev.filter((dev) => dev.id !== id));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const token = getAuthToken();
      const headers = {
        "Content-Type": "application/json",
        ...(token && { Authorization: `Bearer ${token}` }),
      };
      const allDeviceIds = [];

      // 1. Borrado diferido: desactivar (es_activo=false) dispositivos marcados
      for (const deletedId of pendingDeletes) {
        await fetch(`${API_URL}/biometrico/${deletedId}`, {
          method: "DELETE",
          headers,
        });
      }

      // 2. Guardar cambios en la BD
      for (const device of devices) {
        const payload = {
          nombre: device.nombre,
          tipo: device.tipo,
          puerto: device.puerto || null,
          ip: device.ip || null,
          device_id: device.device_id || null,
          estado: device.estado,
          es_activo: device.es_activo,
          escritorio_id: escritorioId,
        };

        if (device.isNew) {
          // Crear nuevo dispositivo
          const res = await fetch(`${API_URL}/biometrico`, {
            method: "POST",
            headers,
            body: JSON.stringify(payload),
          });
          const result = await res.json();
          if (result.data?.id) allDeviceIds.push(result.data.id);
        } else {
          // Actualizar dispositivo existente
          await fetch(`${API_URL}/biometrico/${device.id}`, {
            method: "PUT",
            headers,
            body: JSON.stringify(payload),
          });
          allDeviceIds.push(device.id);
        }
      }

      // Actualizar el JSON de dispositivos_biometricos en el escritorio
      if (allDeviceIds.length > 0 && escritorioId) {
        const headers = {
          "Content-Type": "application/json",
          ...(token && { Authorization: `Bearer ${token}` }),
        };
        await fetch(`${API_URL}/escritorio/${escritorioId}`, {
          method: "PUT",
          headers,
          body: JSON.stringify({
            dispositivos_biometricos: allDeviceIds,
          }),
        });
      }

      setShowSaveMessage(true);
      setTimeout(() => {
        setShowSaveMessage(false);
        onClose();
      }, 1500);
    } catch (err) {
      console.error("Error al guardar:", err);
      setShowErrorMessage(true);
      setTimeout(() => setShowErrorMessage(false), 3000);
    } finally {
      setSaving(false);
    }
  };

  const getEstadoColor = (estado) => {
    switch (estado) {
      case "conectado":
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
      case "desconectado":
        return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400";
      case "error":
        return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400";
    }
  };

  return (
    <div className={inline ? "w-full h-full flex flex-col" : "fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"}>
      {showSaveMessage && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-[60] bg-green-500 text-white px-6 py-3 rounded-xl shadow-lg flex items-center gap-2 animate-pulse">
          <Save className="w-5 h-5" />
          <span className="font-semibold">Dispositivos guardados exitosamente</span>
        </div>
      )}
      {showErrorMessage && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-[60] bg-red-500 text-white px-6 py-3 rounded-xl shadow-lg flex items-center gap-2 animate-pulse">
          <AlertCircle className="w-5 h-5" />
          <span className="font-semibold">Error al guardar los dispositivos</span>
        </div>
      )}
      <div className={inline ? "flex-1 flex flex-col overflow-hidden" : "relative bg-bg-primary rounded-xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col"}>
        {/* Header */}
        <div className={`bg-bg-primary p-6 border-b border-border-subtle flex-shrink-0 ${inline ? 'sticky top-0 z-10' : ''}`}>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <Smartphone className="w-8 h-8 text-[#1976D2]" />
              <div>
                <h3 className="text-2xl font-bold text-text-primary">
                  Dispositivos Biométricos
                </h3>
                <p className="text-text-secondary text-sm mt-1">
                  Gestiona los dispositivos vinculados a este nodo
                </p>
              </div>
              <button
                onClick={detectDevices}
                disabled={isDetecting || loading}
                className="px-3 py-1.5 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-xl hover:bg-gray-800 dark:hover:bg-gray-200 transition-all duration-200 text-sm font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md mr-2"
              >
                {isDetecting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
                {isDetecting ? "Detectando..." : "Detectar"}
              </button>
            </div>
            {!inline && (
              <button
                onClick={onClose}
                className="text-text-secondary hover:bg-bg-secondary rounded-lg p-2 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            )}
            {inline && (
              <button
                onClick={handleSave}
                disabled={saving || loading}
                className="px-5 py-2.5 text-sm bg-[#1976D2] text-white rounded-xl font-bold hover:bg-[#1565C0] transition-all flex items-center gap-2 disabled:opacity-50 shadow-md"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {saving ? "Guardando..." : "Guardar Cambios"}
              </button>
            )}
          </div>
        </div>

        {/* Body - Scrollable */}
        <div className="flex-1 overflow-y-auto p-6 min-h-0">
          {/* Mensaje de estado de detección */}
          {detectionStatus && (
            <div
              className={`mb-4 p-3 rounded-lg flex items-center gap-2 ${detectionStatus.type === "success"
                ? "bg-green-100 text-green-800 border border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800"
                : detectionStatus.type === "error"
                  ? "bg-red-100 text-red-800 border border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800"
                  : detectionStatus.type === "warning"
                    ? "bg-yellow-100 text-yellow-800 border border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800"
                    : "bg-blue-100 text-blue-800 border border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800"
                }`}
            >
              {detectionStatus.type === "success" && <CheckCircle2 className="w-5 h-5" />}
              {detectionStatus.type === "error" && <AlertCircle className="w-5 h-5" />}
              {detectionStatus.type === "warning" && <AlertCircle className="w-5 h-5" />}
              {detectionStatus.type === "info" && <Usb className="w-5 h-5" />}
              <span className="text-sm">{detectionStatus.message}</span>
              <button
                onClick={() => setDetectionStatus(null)}
                className="ml-auto text-current opacity-60 hover:opacity-100"
              >
                &times;
              </button>
            </div>
          )}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <DynamicLoader text="Cargando dispositivos..." size="medium" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12">
              <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
              <p className="text-red-500 mb-4">{error}</p>
              <button
                onClick={fetchDevices}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Reintentar
              </button>
            </div>
          ) : (
            <>
              <div className="space-y-4 mb-6">
                {devices.length === 0 ? (
                  <div className="text-center py-8 text-text-tertiary">
                    <Smartphone className="w-12 h-12 mx-auto mb-3 opacity-40" />
                    <p>No hay dispositivos registrados</p>
                  </div>
                ) : (
                  devices.map((device) => {
                    // Obtener estado en tiempo real desde el contexto global para dispositivos guardados
                    const globalDeviceMatch = globalDevices.find(gd => gd.id === device.id);
                    const realTimeEstado = device.isNew ? device.estado : (globalDeviceMatch ? globalDeviceMatch.estado : device.estado);

                    return (
                      <div
                        key={device.id}
                        className={`group relative bg-bg-secondary/40 border rounded-lg p-5 transition-all duration-300 hover:shadow-md ${
                          device.isNew ? "border-success/30 ring-1 ring-success/10" : "border-border-subtle"
                        }`}
                      >
                        {/* Device Badge / Header */}
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-2">
                            <div className={`p-2 rounded-lg ${realTimeEstado === 'conectado' ? 'bg-success/10 text-success' : 'bg-accent/5 text-accent'}`}>
                               {device.tipo === 'facial' ? <Camera className="w-4 h-4" /> : <Usb className="w-4 h-4" />}
                            </div>
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary block leading-none">
                                  {device.isNew ? "Detectado automáticamente" : "Configuración Guardada"}
                                </span>
                                <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-tighter flex items-center gap-1 ${getEstadoColor(realTimeEstado)}`}>
                                  {realTimeEstado === "conectado" && (
                                    <span className="relative flex h-1.5 w-1.5">
                                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500"></span>
                                    </span>
                                  )}
                                  {realTimeEstado}
                                </span>
                              </div>
                              <h4 className="font-semibold text-sm text-text-primary">{device.nombre || "Nuevo Dispositivo"}</h4>
                            </div>
                          </div>
                          <button
                            onClick={() => removeDevice(device.id)}
                            className="p-1.5 text-text-tertiary hover:text-error transition-all rounded-md hover:bg-error/5"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-[10px] font-bold text-text-tertiary uppercase mb-1.5 ml-1">Nombre</label>
                            <input
                              type="text"
                              value={device.nombre}
                              onChange={(e) => updateDevice(device.id, "nombre", e.target.value)}
                              placeholder="Ej. Cámara Sur"
                              className="w-full px-3 py-2 bg-bg-primary border border-border-subtle rounded-lg text-xs focus:ring-1 focus:ring-accent outline-none transition-all shadow-inner text-text-primary"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-text-tertiary uppercase mb-1.5 ml-1">Tipo</label>
                            <input
                              type="text"
                              readOnly
                              value={device.tipo === "facial" ? "Reconocimiento Facial" : "Lector de Huella"}
                              className="w-full px-3 py-2 bg-bg-primary/50 border border-border-subtle rounded-lg text-xs outline-none transition-all shadow-inner cursor-not-allowed text-text-tertiary"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-text-tertiary uppercase mb-1.5 ml-1">Puerto / Conexión</label>
                            <input
                              type="text"
                              value={device.puerto}
                              onChange={(e) => updateDevice(device.id, "puerto", e.target.value)}
                              placeholder="Ej. USB-001"
                              className="w-full px-3 py-2 bg-bg-primary border border-border-subtle rounded-lg text-xs font-mono focus:ring-1 focus:ring-accent outline-none transition-all shadow-inner text-text-primary"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-text-tertiary uppercase mb-1.5 ml-1">Dirección IP</label>
                            <input
                              type="text"
                              value={device.ip}
                              onChange={(e) => updateDevice(device.id, "ip", e.target.value)}
                              placeholder="192.168.1..."
                              className="w-full px-3 py-2 bg-bg-primary border border-border-subtle rounded-lg text-xs font-mono focus:ring-1 focus:ring-accent outline-none transition-all shadow-inner text-text-primary"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {!inline && (
          <div className="bg-bg-primary p-4 border-t border-border-subtle flex-shrink-0">
            <div className="flex gap-4">
              <button
                onClick={onBack || onClose}
                className="flex-1 px-6 py-3 bg-bg-primary border border-border-subtle text-text-secondary rounded-xl font-bold hover:bg-bg-secondary transition-colors"
              >
                {onBack ? "Volver" : "Cancelar"}
              </button>
              <button
                onClick={handleSave}
                disabled={saving || loading}
                className="flex-1 px-6 py-3 bg-[#1976D2] text-white rounded-xl font-bold hover:bg-[#1565C0] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Save className="w-5 h-5" />
                )}
                {saving ? "Guardando..." : "Guardar Dispositivos"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
