import React, { useState, useEffect } from "react";
import { X, HardDrive, Save, RefreshCw, AlertCircle, Loader2, CheckCircle, Trash2, Power } from "lucide-react";
import { getSystemInfoAdvanced } from "../../utils/systemInfoAdvanced";
import {
  obtenerEscritorio,
  actualizarEscritorio,
  obtenerEscritorioIdGuardado,
  desactivarEscritorio,
} from "../../services/escritorioService";
import { useAuth } from "../../context/AuthContext";
import { deviceMonitorService } from "../../services/deviceMonitorService";
import DynamicLoader from "../common/DynamicLoader";

export default function GeneralNodoModal({ onClose, onBack, inline = false, isAdminProp }) {
  const { user, isAdmin: checkIsAdmin } = useAuth();
  const isAdmin = isAdminProp !== undefined ? isAdminProp : (typeof checkIsAdmin === "function" ? checkIsAdmin() : false);

  const [isDetecting, setIsDetecting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [escritorioId, setEscritorioId] = useState(null);
  const [toast, setToast] = useState({ show: false, message: "", type: "success" });
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [showConfirmShutdown, setShowConfirmShutdown] = useState(false);
  const [isShuttingDown, setIsShuttingDown] = useState(false);
  const [nodeConfig, setNodeConfig] = useState({
    nodeName: "",
    nodeDescription: "",
    ipAddress: "",
    macAddress: "",
    operatingSystem: "",
    esActivo: true,
  });

  const handleShutdown = () => {
    setShowConfirmShutdown(true);
  };

  const confirmShutdown = async () => {
    if (window.electronAPI && window.electronAPI.closeWindow) {
      setIsShuttingDown(true);
      try {
        await deviceMonitorService.setAllDevicesDisconnected();
        window.electronAPI.closeWindow();
      } catch (error) {
        console.error("Error al desconectar dispositivos antes de apagar:", error);
        showToast("Error al apagar el sistema correctamente", "error");
        setIsShuttingDown(false);
        setShowConfirmShutdown(false);
      }
    } else {
      setShowConfirmShutdown(false);
      showToast("La función de apagar sistema no está disponible en este entorno", "error");
    }
  };

  const handleResetNode = () => {
    setShowConfirmDelete(true);
  };

  const confirmResetNode = async () => {
    setShowConfirmDelete(false);
    setIsSaving(true);

    try {
      if (escritorioId) {
        await desactivarEscritorio(escritorioId);
      }

      localStorage.clear();
      if (window.electronAPI && window.electronAPI.configRemove) {
        window.electronAPI.configRemove("appConfigured");
      }

      showToast("Nodo y dispositivos biométricos eliminados correctamente. La aplicación se recargará.", "success");

      setTimeout(() => {
        window.location.reload();
      }, 1500);

    } catch (error) {
      console.error("Error al desactivar el escritorio o biométricos en el servidor:", error);
      showToast("Hubo un error al eliminar el nodo en el servidor.", "error");
      setIsSaving(false);
    }
  };

  // Cargar datos del escritorio al montar el componente
  useEffect(() => {
    cargarDatosEscritorio();
  }, []);

  // Auto-ocultar toast después de 3 segundos
  useEffect(() => {
    if (toast.show) {
      const timer = setTimeout(() => {
        setToast({ show: false, message: "", type: "success" });
        // Si fue éxito, cerrar el modal
        if (toast.type === "success") {
          onClose();
        }
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [toast.show, toast.type, onClose]);

  // Mostrar toast
  const showToast = (message, type = "success") => {
    setToast({ show: true, message, type });
  };

  const cargarDatosEscritorio = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const id = obtenerEscritorioIdGuardado();

      if (!id) {
        setError("No se encontró el ID del escritorio. Por favor, complete el proceso de afiliación primero.");
        setIsLoading(false);
        return;
      }

      setEscritorioId(id);
      const datos = await obtenerEscritorio(id);

      setNodeConfig({
        nodeName: datos.nombre || "",
        nodeDescription: datos.descripcion || "",
        ipAddress: datos.ip || "",
        macAddress: datos.mac || "",
        operatingSystem: datos.sistema_operativo || "",
        esActivo: datos.es_activo === true || datos.es_activo === 1,
      });

      console.log("✅ Datos del escritorio cargados:", datos);
    } catch (err) {
      console.error("❌ Error al cargar datos del escritorio:", err);
      setError(`Error al cargar los datos: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const detectSystemInfo = async () => {
    setIsDetecting(true);
    try {
      const systemInfo = await getSystemInfoAdvanced();

      setNodeConfig((prev) => ({
        ...prev,
        ipAddress: systemInfo.ipAddress || prev.ipAddress,
        macAddress: systemInfo.macAddress || prev.macAddress,
        operatingSystem: systemInfo.operatingSystem || prev.operatingSystem,
      }));

      console.log("✅ Información del sistema detectada:", {
        IP: systemInfo.ipAddress,
        MAC: systemInfo.macAddress,
        OS: systemInfo.operatingSystem,
      });
    } catch (error) {
      console.error("Error al detectar información del sistema:", error);
      showToast("Error al detectar la información del sistema", "error");
    } finally {
      setIsDetecting(false);
    }
  };

  const handleSave = async () => {
    if (!escritorioId) {
      showToast("No se puede guardar: ID del escritorio no disponible", "error");
      return;
    }

    setIsSaving(true);
    try {
      await actualizarEscritorio(escritorioId, {
        nombre: nodeConfig.nodeName,
        descripcion: nodeConfig.nodeDescription,
        ip: nodeConfig.ipAddress,
        mac: nodeConfig.macAddress,
        sistema_operativo: nodeConfig.operatingSystem,
        es_activo: nodeConfig.esActivo,
      });

      console.log("✅ Configuración del nodo guardada:", nodeConfig);
      showToast("Configuración guardada exitosamente", "success");
    } catch (err) {
      console.error("❌ Error al guardar:", err);
      showToast(`Error al guardar: ${err.message}`, "error");
    } finally {
      setIsSaving(false);
    }
  };


  // Mostrar error si no se pudo cargar
  if (error) {
    if (inline) {
      return (
        <div className="flex flex-col items-center justify-center gap-4 py-20 px-6">
          <AlertCircle className="w-10 h-10 text-red-500" />
          <p className="text-text-secondary text-center">{error}</p>
          <button onClick={cargarDatosEscritorio} className="px-4 py-2 text-sm bg-[#1976D2] text-white rounded-xl font-semibold hover:bg-[#1565C0] flex items-center gap-2">
            <RefreshCw className="w-4 h-4" /> Reintentar
          </button>
        </div>
      );
    }
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-bg-primary rounded-xl shadow-2xl max-w-2xl w-full overflow-hidden">
          <div className="bg-bg-primary p-6 border-b border-border-subtle">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-6 h-6 text-red-500" />
              <h3 className="text-lg font-bold text-text-primary">Error</h3>
            </div>
          </div>
          <div className="p-6">
            <p className="text-text-secondary mb-4">{error}</p>
            <div className="flex gap-3">
              <button
                onClick={cargarDatosEscritorio}
                className="flex-1 px-4 py-2 text-sm bg-[#1976D2] text-white rounded-xl font-semibold hover:bg-[#1565C0] transition-colors flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Reintentar
              </button>
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 text-sm bg-bg-secondary border border-border-subtle text-text-secondary rounded-xl font-semibold hover:bg-bg-primary transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={inline ? "w-full h-full flex flex-col" : "fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"}>
      {/* Toast de notificación */}
      {toast.show && (
        <div
          className={`fixed top-4 left-1/2 transform -translate-x-1/2 z-[80] px-6 py-3 rounded-xl shadow-lg flex items-center gap-2 animate-pulse ${toast.type === "success"
            ? "bg-green-500 text-white"
            : "bg-red-500 text-white"
            }`}
        >
          {toast.type === "success" ? (
            <CheckCircle className="w-5 h-5" />
          ) : (
            <AlertCircle className="w-5 h-5" />
          )}
          <span className="font-semibold">{toast.message}</span>
        </div>
      )}

      {/* Modal de Confirmación de Apagado */}
      {showConfirmShutdown && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[70] p-4">
          <div className="bg-bg-primary rounded-xl shadow-2xl max-w-md w-full overflow-hidden p-6 animate-in fade-in zoom-in duration-200">
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center mb-4">
                <Power className="w-8 h-8 text-orange-500" />
              </div>
              <h3 className="text-xl font-bold text-text-primary mb-2">
                ¿Apagar sistema?
              </h3>
              <p className="text-text-secondary text-sm mb-6">
                Esto cerrará la aplicación por completo. ¿Desea continuar?
              </p>

              <div className="flex gap-3 w-full">
                <button
                  type="button"
                  onClick={() => !isShuttingDown && setShowConfirmShutdown(false)}
                  disabled={isShuttingDown}
                  className={`flex-1 px-4 py-2.5 text-sm bg-bg-secondary border border-border-subtle text-text-secondary rounded-xl font-semibold hover:bg-bg-primary transition-colors ${isShuttingDown ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={confirmShutdown}
                  disabled={isShuttingDown}
                  className={`flex-1 px-4 py-2.5 text-sm bg-orange-500 text-white rounded-xl font-semibold hover:bg-orange-600 transition-colors flex items-center justify-center gap-2 shadow-md hover:shadow-lg ${isShuttingDown ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {isShuttingDown ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Apagando...</>
                  ) : (
                    <><Power className="w-4 h-4" /> Sí, apagar</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmación de Eliminación */}
      {showConfirmDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[70] p-4">
          <div className="bg-bg-primary rounded-xl shadow-2xl max-w-md w-full overflow-hidden p-6 animate-in fade-in zoom-in duration-200">
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-4">
                <AlertCircle className="w-8 h-8 text-red-500" />
              </div>
              <h3 className="text-xl font-bold text-text-primary mb-2">
                ¿Eliminar este nodo?
              </h3>
              <p className="text-text-secondary text-sm mb-6">
                Esto borrará toda la configuración local y deberá volver a afiliar el equipo. Esta acción no se puede deshacer.
              </p>

              <div className="flex gap-3 w-full">
                <button
                  type="button"
                  onClick={() => setShowConfirmDelete(false)}
                  className="flex-1 px-4 py-2.5 text-sm bg-bg-secondary border border-border-subtle text-text-secondary rounded-xl font-semibold hover:bg-bg-primary transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={confirmResetNode}
                  className="flex-1 px-4 py-2.5 text-sm bg-red-500 text-white rounded-xl font-semibold hover:bg-red-600 transition-colors flex items-center justify-center gap-2 shadow-md hover:shadow-lg"
                >
                  <Trash2 className="w-4 h-4" />
                  Sí, eliminar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className={inline ? "flex-1 flex flex-col overflow-y-auto" : "bg-bg-primary rounded-xl shadow-2xl max-w-2xl w-full overflow-hidden"}>
        {/* Header */}
        <div className={`bg-bg-primary p-6 border-b border-border-subtle ${inline ? 'sticky top-0 z-10 flex-shrink-0' : ''}`}>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <HardDrive className="w-8 h-8 text-[#1976D2]" />
              <div>
                <h3 className="text-2xl font-bold text-text-primary">General del Nodo</h3>
                <p className="text-text-secondary text-sm mt-1">
                  Configuración general del sistema y nodo de trabajo
                </p>
              </div>
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
                disabled={isSaving}
                className="px-5 py-2.5 text-sm bg-[#1976D2] text-white rounded-xl font-bold hover:bg-[#1565C0] transition-all flex items-center gap-2 disabled:opacity-50 shadow-md"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {isSaving ? "Guardando..." : "Guardar Cambios"}
              </button>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="p-3">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <DynamicLoader text="Cargando datos del escritorio..." size="medium" />
            </div>
          ) : (
            <>
              <div className="bg-bg-secondary border border-border-subtle rounded-xl p-3">
                <div className="relative flex items-center justify-center mb-4">
                  <h4 className="font-semibold text-text-primary text-sm">
                    Información del Nodo
                  </h4>
                  <button
                    type="button"
                    onClick={detectSystemInfo}
                    disabled={isDetecting}
                    className="absolute right-0 flex items-center gap-1.5 px-2.5 py-1 text-xs bg-[#1976D2]/10 dark:bg-blue-900/50 text-[#1976D2] dark:text-blue-300 rounded-lg hover:bg-[#1976D2]/20 dark:hover:bg-blue-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isDetecting ? "animate-spin" : ""}`} />
                    {isDetecting ? "Detectando..." : "Autodetectar"}
                  </button>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1.5">
                      Nombre del Nodo <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={nodeConfig.nodeName}
                      onChange={(e) =>
                        setNodeConfig({ ...nodeConfig, nodeName: e.target.value })
                      }
                      className="w-full px-3 py-1.5 text-sm bg-bg-primary border border-border-subtle rounded-lg focus:ring-2 focus:ring-[#1976D2] focus:border-transparent text-text-primary placeholder:text-text-disabled"
                      placeholder="Ej: Entrada Principal"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1.5">
                      Descripción
                    </label>
                    <textarea
                      value={nodeConfig.nodeDescription}
                      onChange={(e) =>
                        setNodeConfig({ ...nodeConfig, nodeDescription: e.target.value })
                      }
                      rows={2}
                      className="w-full px-3 py-1.5 text-sm bg-bg-primary border border-border-subtle rounded-lg focus:ring-2 focus:ring-[#1976D2] focus:border-transparent resize-none text-text-primary placeholder:text-text-disabled"
                      placeholder="Descripción del nodo de trabajo"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-text-secondary mb-1.5">
                        Dirección IP <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={nodeConfig.ipAddress}
                        disabled
                        className="w-full px-3 py-1.5 text-sm bg-bg-secondary border border-border-subtle rounded-lg text-text-secondary cursor-not-allowed"
                        placeholder="192.168.1.100"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-text-secondary mb-1.5">
                        Dirección MAC <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={nodeConfig.macAddress}
                        disabled
                        className="w-full px-3 py-1.5 text-sm bg-bg-secondary border border-border-subtle rounded-lg text-text-secondary cursor-not-allowed"
                        placeholder="00:1A:2B:3C:4D:5E"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1.5">
                      Sistema Operativo <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={nodeConfig.operatingSystem}
                      disabled
                      className="w-full px-3 py-1.5 text-sm bg-bg-secondary border border-border-subtle rounded-lg text-text-secondary cursor-not-allowed"
                      placeholder="Linux Debian 11"
                    />
                  </div>
                </div>
              </div>

              {/* Opciones de Administrador */}
              {isAdmin && (
                <div className="mt-6 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={handleShutdown}
                    className="px-4 py-2 text-sm text-orange-500 border border-orange-500/50 hover:bg-orange-50 dark:hover:bg-orange-500/10 hover:border-orange-500 rounded-lg font-medium transition-all flex items-center gap-2"
                  >
                    <Power className="w-4 h-4" />
                    Apagar sistema
                  </button>
                  <button
                    type="button"
                    onClick={handleResetNode}
                    className="px-4 py-2 text-sm text-red-500 border border-red-500/50 hover:bg-red-50 dark:hover:bg-red-500/10 hover:border-red-500 rounded-lg font-medium transition-all flex items-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    Eliminar Nodo
                  </button>
                </div>
              )}
            </>
          )}
        </div>

          {/* Botones */}
          {!inline && (
            <div className="flex gap-3 mt-3">
              <button
                onClick={onBack || onClose}
                className="flex-1 px-4 py-2 text-sm bg-bg-primary border border-border-subtle text-text-secondary rounded-xl font-semibold hover:bg-bg-secondary transition-colors"
              >
                {onBack ? "Volver" : "Cancelar"}
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex-1 px-4 py-2 text-sm bg-[#1976D2] text-white rounded-xl font-semibold hover:bg-[#1565C0] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Guardar Configuración
                  </>
                )}
              </button>
            </div>
          )}
      </div>
    </div>
  );
}
