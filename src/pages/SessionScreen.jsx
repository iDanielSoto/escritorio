import React, { useState, useEffect } from "react";
import {
  User,
  LogOut,
  Clock,
  Calendar,
  AlertCircle,
  AlertTriangle,
  Timer,
  Bell,
  X,
  Settings,
  Briefcase,
  Building2,
  Fingerprint,
  Camera,
  FileText,
} from "lucide-react";
import {
  formatTime,
  formatDateShort,
  formatDay,
  getDaysInMonth,
  formatDateKey,
} from "../utils/dateHelpers";
import { getAvisosDeEmpleado } from "../services/avisosService";
import HistorialModal from "../components/session/HistorialModal";
import ConfigModal from "../components/session/ConfigModal";
import GeneralNodoModal from "../components/session/GeneralNodoModal";
import DispositivosModal from "../components/session/DispositivosModal";
import PreferenciasModal from "../components/session/PreferenciasModal";
import HorarioModal from "../components/session/HorarioModal";
import EmployeeInfo from "../components/session/EmployeeInfo";
import NoEmployeeInfo from "../components/session/NoEmployeeInfo";
import AdminDashboard from "../components/session/AdminDashboard";
import BiometricEnroll from "../components/kiosk/BiometricEnroll";
import RegisterFaceModal from "../components/kiosk/RegisterFaceModal";
import EmployeeSelectionModal from "../components/session/EmployeeSelectionModal";
import NoticeDetailModal from "../components/kiosk/NoticeDetailModal";

// Hooks
import { useEmployeeData } from "../hooks/useEmployeeData";
import { useGlobalDeviceStatus } from "../context/DeviceMonitoringContext";

export default function SessionScreen({ onLogout, usuario, isReaderConnected = false }) {
  const [time, setTime] = useState(new Date());
  const [selectedNotice, setSelectedNotice] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showHorarioModal, setShowHorarioModal] = useState(false);
  const [showHistorialModal, setShowHistorialModal] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showGeneralNodoModal, setShowGeneralNodoModal] = useState(false);
  const [showDispositivosModal, setShowDispositivosModal] = useState(false);
  const [showPreferenciasModal, setShowPreferenciasModal] = useState(false);
  const [showBiometricReader, setShowBiometricReader] = useState(false);
  const [showRegisterFace, setShowRegisterFace] = useState(false);
  const [showAllDepartamentos, setShowAllDepartamentos] = useState(false);
  const [showEmployeeSelectionModal, setShowEmployeeSelectionModal] = useState(false);
  const [selectedBiometricType, setSelectedBiometricType] = useState('huella');
  const [targetEmployeeId, setTargetEmployeeId] = useState(null);
  const [timeLeft, setTimeLeft] = useState(15); // 15 segundos para cierre de sesión

  // Custom hook para datos del empleado
  const { datosCompletos, loadingEmpleado, departamentos, notices, setNotices } = useEmployeeData(usuario);

  // Consumir el estado GLOBAL de todos los dispositivos
  const { devices } = useGlobalDeviceStatus();

  // Obtener estado de cámara registrada y conectada
  const registeredCameras = devices.filter(d => d.tipo === "facial" && d.es_activo);
  const hasCameraRegistered = registeredCameras.length > 0;
  const isCameraConnected = registeredCameras.some(d => d.estado === 'conectado');

  const [nombreNodo, setNombreNodo] = useState("Entrada Principal");
  const [descripcionNodo, setDescripcionNodo] = useState(
    "Control de acceso principal del edificio A",
  );
  const [ipComputadora, setIpComputadora] = useState("192.168.1.100");
  const [direccionMAC, setDireccionMAC] = useState("00:1A:2B:3C:4D:5E");
  const [sistemaOperativo, setSistemaOperativo] = useState("Linux Debian 11");
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Monitor de estado online/offline
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const [dispositivos, setDispositivos] = useState([
    {
      id: 1,
      nombre: "Lector de Huella Digital",
      descripcion: "Sensor biométrico para control de acceso",
      tipo: "Biométrico",
      puerto: "USB-001",
    },
    {
      id: 2,
      nombre: "Cámara de Seguridad",
      descripcion: "Cámara HD de reconocimiento facial",
      tipo: "Cámara",
      puerto: "USB-002",
    },
  ]);

  // Datos del usuario desde la API
  const userName = datosCompletos?.nombre || "Usuario";
  const userId = datosCompletos?.id || "N/A";
  const userEmail = datosCompletos?.correo || datosCompletos?.email || "N/A";
  const userPhone = datosCompletos?.telefono || "N/A";
  const userUsername = datosCompletos?.usuario || datosCompletos?.username || "N/A";
  const userRFC = datosCompletos?.rfc;
  const userNSS = datosCompletos?.nss;
  const userDepartamento =
    datosCompletos?.departamento || datosCompletos?.departamento_nombre;
  const userHorario = datosCompletos?.horario;
  const userFechaRegistro = datosCompletos?.fecha_registro;

  // Verificar si es un empleado
  const isEmployee = datosCompletos?.es_empleado || (userRFC && userNSS);

  // Verificar si es administrador
  const isAdmin = !!datosCompletos?.esAdmin || !!datosCompletos?.es_admin ||
    (Array.isArray(datosCompletos?.roles) && datosCompletos.roles.some(r => r.es_admin));


  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Monitor de inactividad (15 segundos)
  const onLogoutRef = React.useRef(onLogout);

  // Actualizar la referencia siempre que la prop cambie
  useEffect(() => {
    onLogoutRef.current = onLogout;
  }, [onLogout]);

  useEffect(() => {
    // Suspendemos por completo el contador si estamos en medio de un proceso biométrico
    if (showBiometricReader || showRegisterFace) {
      return;
    }

    const INACTIVITY_TIMEOUT = 15;
    let lastActivityTime = Date.now();
    // Restablecer el tiempo visible cuando se (re)inicia el contador
    setTimeLeft(INACTIVITY_TIMEOUT);

    const updateActivity = () => {
      lastActivityTime = Date.now();
      setTimeLeft(INACTIVITY_TIMEOUT);
    };

    const activityEvents = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];

    // Registrar los listeners
    activityEvents.forEach(event => window.addEventListener(event, updateActivity));

    // Verificar inactividad cada segundo
    const verifyInactivity = setInterval(() => {
      const remaining = INACTIVITY_TIMEOUT - Math.floor((Date.now() - lastActivityTime) / 1000);

      if (remaining <= 0) {
        clearInterval(verifyInactivity);
        if (onLogoutRef.current) {
          console.log("Cerrando sesión por inactividad...");
          onLogoutRef.current();
        }
      } else {
        setTimeLeft(remaining);
      }
    }, 1000);

    return () => {
      clearInterval(verifyInactivity);
      activityEvents.forEach(event => window.removeEventListener(event, updateActivity));
    };
  }, [showBiometricReader, showRegisterFace]); // Se detiene o reinicia el timer según el estado de los modales biométricos

  const handleGuardarConfigNodo = () => {
    console.log({
      nombreNodo,
      descripcionNodo,
      ipComputadora,
      direccionMAC,
      sistemaOperativo,
    });
    setShowGeneralNodoModal(false);
    setShowConfigModal(false);
  };

  const handleEliminarDispositivo = (id) => {
    setDispositivos(dispositivos.filter((d) => d.id !== id));
  };

  const handleAgregarDispositivo = () => {
    const nuevoDispositivo = {
      id: dispositivos.length + 1,
      nombre: "Nuevo Dispositivo",
      descripcion: "",
      tipo: "Cámara",
      puerto: "",
    };
    setDispositivos([...dispositivos, nuevoDispositivo]);
  };

  const handleActualizarDispositivo = (id, campo, valor) => {
    setDispositivos(
      dispositivos.map((d) => (d.id === id ? { ...d, [campo]: valor } : d)),
    );
  };

  const handleOpenEmployeeSelection = (tipo) => {
    setSelectedBiometricType(tipo);
    setShowEmployeeSelectionModal(true);
  };

  const handleSelectEmployee = (empleadoId) => {
    setTargetEmployeeId(empleadoId);
    setShowEmployeeSelectionModal(false);
    if (selectedBiometricType === 'huella') {
      setShowBiometricReader(true);
    } else {
      setShowRegisterFace(true);
    }
  };

  return (
    <div className="h-screen bg-bg-secondary p-2 sm:p-4 overflow-hidden">
      <div className="max-w-[1600px] 2xl:max-w-[1920px] mx-auto h-full flex flex-col">
        {/* Sidebar Dashboard - All Users */}
        <div className="flex-1 min-h-0">
          <AdminDashboard
            escritorioId={localStorage.getItem("escritorio_id")}
            datosCompletos={datosCompletos}
            departamentos={departamentos}
            onLogout={onLogout}
            time={time}
            notices={notices}
            loadingEmpleado={loadingEmpleado}
            userHorario={userHorario}
            readerConnected={isReaderConnected}
            isCameraConnected={hasCameraRegistered && isCameraConnected}
            isOnline={isOnline}
            onShowHorario={() => setShowHorarioModal(true)}
            onShowHistorial={() => setShowHistorialModal(true)}
            onShowBiometric={() => handleOpenEmployeeSelection('huella')}
            onShowRegisterFace={() => handleOpenEmployeeSelection('rostro')}
            onSelectNotice={(notice) => setSelectedNotice(notice)}
          />
        </div>
      </div>

      {/* MODALES */}

      {/* Historial Modal */}
      {showHistorialModal && (
        <HistorialModal
          onClose={() => setShowHistorialModal(false)}
          usuario={usuario}
        />
      )}

      {/* Config Modal - Principal */}
      {showConfigModal && (
        <ConfigModal
          onClose={() => setShowConfigModal(false)}
          onSelectOption={(option) => {
            setShowConfigModal(false);
            if (option === "general") {
              setShowGeneralNodoModal(true);
            } else if (option === "dispositivos") {
              setShowDispositivosModal(true);
            } else if (option === "preferencias") {
              setShowPreferenciasModal(true);
            }
          }}
        />
      )}

      {/* General del Nodo Modal */}
      {showGeneralNodoModal && (
        <GeneralNodoModal
          onClose={() => {
            setShowGeneralNodoModal(false);
            setShowConfigModal(false);
          }}
          onBack={() => {
            setShowGeneralNodoModal(false);
            setShowConfigModal(true);
          }}
          isAdminProp={isAdmin}
          initialConfig={{
            nodeName: nombreNodo,
            nodeDescription: descripcionNodo,
            ipAddress: ipComputadora,
            macAddress: direccionMAC,
            operatingSystem: sistemaOperativo,
          }}
        />
      )}

      {/* Dispositivos Modal */}
      {showDispositivosModal && (
        <DispositivosModal
          onClose={() => {
            setShowDispositivosModal(false);
            setShowConfigModal(false);
          }}
          onBack={() => {
            setShowDispositivosModal(false);
            setShowConfigModal(true);
          }}
          escritorioId={localStorage.getItem("escritorio_id")}
        />
      )}

      {/* Preferencias Modal */}
      {showPreferenciasModal && (
        <PreferenciasModal
          onClose={() => {
            setShowPreferenciasModal(false);
            setShowConfigModal(false);
          }}
          onBack={() => {
            setShowPreferenciasModal(false);
            setShowConfigModal(true);
          }}
        />
      )}

      {/* Notice Detail Modal */}
      {selectedNotice && (
        <NoticeDetailModal
          notice={selectedNotice}
          onClose={() => setSelectedNotice(null)}
        />
      )}

      {/* Modal de registro de huella */}
      {showBiometricReader && (
        <BiometricEnroll
          isOpen={showBiometricReader}
          onClose={() => {
            setShowBiometricReader(false);
            setTargetEmployeeId(null);
          }}
          onEnrollmentSuccess={(data) => {
            console.log("✅ Huella registrada:", data);
            setShowBiometricReader(false);
            setTargetEmployeeId(null);
          }}
          idEmpleado={targetEmployeeId}
        />
      )}

      {/* Modal de RegisterFaceModal para registro facial */}
      {showRegisterFace && (
        <RegisterFaceModal
          onClose={() => {
            setShowRegisterFace(false);
            setTargetEmployeeId(null);
          }}
          empleadoId={targetEmployeeId}
        />
      )}

      {/* HORARIO MODAL */}
      {showHorarioModal && (
        <HorarioModal
          onClose={() => setShowHorarioModal(false)}
          usuario={datosCompletos}
        />
      )}

      {/* Modal de selección de empleado para biometría */}
      {showEmployeeSelectionModal && (
        <EmployeeSelectionModal
          biometriaTipo={selectedBiometricType}
          onClose={() => setShowEmployeeSelectionModal(false)}
          onSelect={handleSelectEmployee}
        />
      )}

      {/* Indicador de cierre de sesión inminente (Estilo Minimalista Afiliación) */}
      {timeLeft <= 5 && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-bg-primary/80 backdrop-blur-md p-4 animate-in fade-in duration-300">
          <div className="max-w-xl w-full px-6 py-12 animate-slide-up">
            <div className="bg-bg-secondary/40 border border-border-subtle rounded-lg p-12 text-center shadow-xl relative overflow-hidden group">
              <div className="relative z-10 flex flex-col items-center">
                <h2 className="text-xs font-semibold text-error uppercase tracking-[0.2em] mb-3">
                  Inactividad Detectada
                </h2>
                <h1 className="text-3xl font-light tracking-tight mb-4">
                  Cerrando <span className="font-semibold text-error/80">Sesión...</span>
                </h1>

                <p className="text-text-tertiary text-sm max-w-sm mb-8 leading-relaxed">
                  Por seguridad, la sesión finalizará automáticamente en <strong className="text-error font-bold">{timeLeft}s</strong>.
                </p>

                <button
                  className="group px-10 py-3.5 bg-bg-primary border border-border-subtle hover:border-text-secondary text-text-primary rounded-lg font-semibold transition-all duration-300 shadow-sm flex items-center gap-3 active:scale-95 cursor-pointer"
                >
                  Mantener sesión activa
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
