import { useState, useEffect } from "react";
import { Camera, User, ClipboardList, Bell, Fingerprint } from "lucide-react";
import { formatTime, formatDate, formatDay } from "../utils/dateHelpers";
import { useAvisosGlobales } from "../hooks/useAvisosGlobales";
import PinModal from "../components/kiosk/PinModal";
import LoginModal from "../components/kiosk/LoginModal";
import BitacoraModal from "../components/kiosk/BitacoraModal";
import NoticeDetailModal from "../components/kiosk/NoticeDetailModal";
import SessionScreen from "./SessionScreen";
import { agregarEvento } from "../services/bitacoraService";
import { cerrarSesion } from "../services/biometricAuthService";
import { useConnectivity } from "../hooks/useConnectivity";
import { useSound } from "../context/SoundContext";
import { ConnectionStatusPanel } from "../components/common/ConnectionStatus";
import AsistenciaHuella from "../components/kiosk/AsistenciaHuella";
import AsistenciaFacial from "../components/kiosk/AsistenciaFacial";
import DynamicLoader from "../components/common/DynamicLoader";

import { useKioskConfiguration } from "../hooks/useKioskConfiguration";
import { useInactivityTimer } from "../hooks/useInactivityTimer";
import { useGlobalDeviceStatus } from "../context/DeviceMonitoringContext";

export default function KioskScreen() {

  // Hook de conectividad
  const { isInternetConnected, isDatabaseConnected } = useConnectivity();
  const { playSound, speak } = useSound();

  const [time, setTime] = useState(new Date());
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [usuarioActual, setUsuarioActual] = useState(null); // Almacenar datos del usuario
  const [selectedNotice, setSelectedNotice] = useState(null);
  const [showPinModal, setShowPinModal] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showBitacora, setShowBitacora] = useState(false);
  const [showBiometricReader, setShowBiometricReader] = useState(false);
  const [showAsistenciaFacial, setShowAsistenciaFacial] = useState(false);
  const [activeNoticeIndex, setActiveNoticeIndex] = useState(0); // Índice del aviso activo en el carrusel

  const { ordenCredenciales, loadingCredenciales, activeMethods, cargarCredenciales } = useKioskConfiguration(isLoggedIn);
  useInactivityTimer();

  // Consumir el estado GLOBAL y la funcion para forzar chequeo de dispositivos
  const { devices, checkNow } = useGlobalDeviceStatus();

  // Forzar escaneo de dispositivos si venimos de una afiliación nueva
  useEffect(() => {
    if (localStorage.getItem("pendingDeviceSync") === "true") {
      console.log("Primera vez en kiosko después de afiliación. Forzando sincronización de dispositivos...");
      checkNow();
      localStorage.removeItem("pendingDeviceSync"); // Limpiar la bandera para que no se repita
    }
  }, [checkNow]);

  // Calcular estado de cámaras basado en dispositivos registrados / configurados
  const registeredCameras = devices.filter(d => d.tipo === "facial" && d.es_activo);
  const hasCameraRegistered = activeMethods.includes('facial');
  const isCameraConnected = registeredCameras.some(d => d.estado === "conectado");

  // Calcular estado del lector de huellas basado en dispositivos registrados
  const registeredReaders = devices.filter(d => d.tipo === "dactilar" && d.es_activo);
  const isReaderConnected = registeredReaders.some(d => d.estado === "conectado");

  useEffect(() => {
    console.log("🏢 ID de empresa en localStorage al cargar Kiosko:", localStorage.getItem("empresa_id"));
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Avisos globales con polling en tiempo real (se pausa al estar en sesión)
  const { notices, loading: loadingNotices } = useAvisosGlobales({ pausado: isLoggedIn });

  // Rotación automática del aviso destacado cada 6 segundos
  useEffect(() => {
    if (notices.length === 0) return;
    const noticeTimer = setInterval(() => {
      setActiveNoticeIndex((prevIndex) => (prevIndex + 1) % notices.length);
    }, 6000);
    return () => clearInterval(noticeTimer);
  }, [notices.length]);



  // Manejar login exitoso
  const handleLoginSuccess = (usuario) => {
    console.log("Login exitoso:", usuario);

    // IMPORTANTE: Cerrar TODOS los modales antes de cambiar el estado de login
    setShowLoginModal(false);
    setShowBiometricReader(false);
    setShowPinModal(false);
    setShowAsistenciaFacial(false);

    setUsuarioActual(usuario);
    setIsLoggedIn(true);

    // Mensaje de bienvenida con el nombre del usuario
    playSound('success');
    speak(`Bienvenido, ${usuario.nombre || usuario.username}`);
  };

  // Manejar logout
  const handleLogout = async () => {
    console.log("Cerrando sesion");
    // IMPORTANTE: Cerrar todos los modales para evitar que queden abiertos
    setShowLoginModal(false);
    setShowBiometricReader(false);
    setShowPinModal(false);
    setShowBitacora(false);
    setShowAsistenciaFacial(false);

    // Limpiar estado de React
    setIsLoggedIn(false);
    setUsuarioActual(null);
    // Limpiar localStorage para evitar restauración automática de sesión
    try {
      await cerrarSesion(usuarioActual?.id);
    } catch (error) {
      console.error("Error al cerrar sesión:", error);
      // Limpiar storage para evitar que recargue la sesión un usuario
      // que se quedó logueado antes en el kiosco, PERO mantenemos el auth_token
      // para las llamadas API a DevTunnels.
      localStorage.removeItem("usuarioActual");
      localStorage.removeItem("ultimoLogin");
      // localStorage.removeItem("auth_token"); // REMOVED to persist DevTunnels connection
      localStorage.removeItem("metodoAutenticacion");
    }
  };

  // Manejadores para cada método de checado
  const handleFacialCheck = () => {
    setShowAsistenciaFacial(true);
  };

  const handleFingerprintCheck = () => {
    setShowBiometricReader(true);
  };

  const handleUserLoginCheck = () => {
    setShowPinModal(true);
  };

  // Manejar registro exitoso de huella
  const handleFingerprintSuccess = async (data) => {
    console.log("✅ Asistencia registrada con huella:", data);

    agregarEvento({
      user: data.nombre || "Empleado",
      action: "Registro de asistencia exitoso - Huella digital",
      type: "success",
    });

    const tipo = data.tipo_movimiento === 'SALIDA' ? 'salida' : 'entrada';
    playSound('success');
    speak(`Registro ${tipo} exitoso`);
  };

  // Manejar solicitud de login desde el modal de asistencia
  const handleFingerprintLoginRequest = (usuarioCompleto) => {
    console.log(
      "Inicio de sesion desde huella - Datos completos:",
      usuarioCompleto,
    );

    // IMPORTANTE: Cerrar TODOS los modales para evitar conflictos
    setShowBiometricReader(false);
    setShowLoginModal(false);
    setShowPinModal(false);
    setShowAsistenciaFacial(false);

    // Mensaje de bienvenida
    const nombreUsuario =
      usuarioCompleto?.nombre || usuarioCompleto?.username || "Usuario";
    playSound('success');
    speak(`Bienvenido ${nombreUsuario}`);

    // Establecer usuario y abrir sesión (datos ya vienen completos del API)
    setUsuarioActual(usuarioCompleto);
    setIsLoggedIn(true);

    agregarEvento({
      user: nombreUsuario,
      action: "Inicio de sesión exitoso - Huella digital",
      type: "success",
    });
  };

  // Manejar registro exitoso de facial
  const handleFacialSuccess = async (data) => {
    console.log("Asistencia registrada con facial:", data);

    agregarEvento({
      user: data.empleado?.nombre || "Empleado",
      action: `${data.tipo_movimiento === "SALIDA" ? "Salida" : "Entrada"} registrada - Reconocimiento facial`,
      type: "success",
    });
  };

  // Manejar solicitud de login desde el modal de asistencia facial
  const handleFacialLoginRequest = (usuarioCompleto) => {
    console.log(
      "Inicio de sesion desde facial - Datos completos:",
      usuarioCompleto,
    );

    // Cerrar todos los modales
    setShowAsistenciaFacial(false);
    setShowBiometricReader(false);
    setShowLoginModal(false);
    setShowPinModal(false);

    // Mensaje de bienvenida
    const nombreUsuario =
      usuarioCompleto?.nombre || usuarioCompleto?.username || "Usuario";
    playSound('success');
    speak(`Bienvenido ${nombreUsuario}`);

    // Establecer usuario y abrir sesion
    setUsuarioActual(usuarioCompleto);
    setIsLoggedIn(true);

    agregarEvento({
      user: nombreUsuario,
      action: "Inicio de sesion exitoso - Reconocimiento facial",
      type: "success",
    });
  };

  // Obtener información del método (claves del backend)
  const getMethodInfo = (methodKey) => {
    const info = {
      facial: {
        icon: Camera,
        label: "Reconocimiento Facial",
        color: (hasCameraRegistered && isCameraConnected)
          ? "from-[#1976D2] to-[#001A70] dark:from-slate-700 dark:to-slate-800"
          : "from-gray-400 to-gray-500 dark:from-gray-600 dark:to-gray-700",
        hoverColor: (hasCameraRegistered && isCameraConnected)
          ? "hover:from-[#1565C0] hover:to-[#001A70] dark:hover:from-slate-600 dark:hover:to-slate-700"
          : "",
        handler: (hasCameraRegistered && isCameraConnected) ? handleFacialCheck : null,
        isDisabled: !(hasCameraRegistered && isCameraConnected),
        disabledMessage: !hasCameraRegistered ? "Sin cámara registrada" : "Cámara desconectada",
      },
      dactilar: {
        icon: Fingerprint,
        label: "Huella Digital",
        color: isReaderConnected
          ? "from-[#1976D2] to-[#001A70] dark:from-slate-700 dark:to-slate-800"
          : "from-gray-400 to-gray-500 dark:from-gray-600 dark:to-gray-700",
        hoverColor: "", // Sin hover porque es solo visual
        handler: null, // Solo visual, el lector está siempre activo en background
        isVisualOnly: true,
        isDisabled: !isReaderConnected, // Deshabilitar si el lector no está conectado
        disabledMessage: "Lector desconectado",
      },
      pin: {
        icon: User,
        label: "Usuario/Correo",
        color:
          "from-[#1976D2] to-[#001A70] dark:from-slate-700 dark:to-slate-800",
        hoverColor:
          "hover:from-[#1565C0] hover:to-[#001A70] dark:hover:from-slate-600 dark:hover:to-slate-700",
        handler: handleUserLoginCheck,
      },
    };
    return info[methodKey];
  };

  // Determinar el orden visual de los métodos: priorizar los conectados manteniendo su jerarquía original
  const methodsAvailable = activeMethods.filter(methodKey => !getMethodInfo(methodKey).isDisabled);
  const methodsDisabled = activeMethods.filter(methodKey => getMethodInfo(methodKey).isDisabled);

  const visualActiveMethods = [...methodsAvailable, ...methodsDisabled];

  // Si está logueado, mostrar SessionScreen
  if (isLoggedIn) {
    return <SessionScreen onLogout={handleLogout} usuario={usuarioActual} isReaderConnected={isReaderConnected} />;
  }

  return (
    <div className="h-screen bg-bg-secondary flex overflow-hidden p-2 sm:p-4 2xl:p-6">
      {/* Barra lateral izquierda - Estilo "Burbuja" / Flotante */}
      <div className="w-16 sm:w-24 2xl:w-36 bg-bg-primary shadow-xl rounded-2xl flex flex-col items-center py-6 2xl:py-10 gap-4 2xl:gap-8 flex-shrink-0 border border-border-subtle transition-all duration-300">
        <button
          onClick={() => setShowLoginModal(true)}
          disabled={!isInternetConnected || !isDatabaseConnected}
          className={`flex flex-col items-center gap-2 p-2 rounded-xl transition-all w-12 sm:w-20 ${!isInternetConnected || !isDatabaseConnected
            ? "text-gray-400 cursor-not-allowed opacity-50"
            : "text-[#1976D2] hover:bg-bg-secondary"
            }`}
        >
          <User className="w-5 h-5 sm:w-6 sm:h-6 2xl:w-8 2xl:h-8" />
          <span className="text-[10px] sm:text-xs 2xl:text-base font-bold hidden sm:block">Usuario</span>
        </button>

        <button
          onClick={() => setShowBitacora(true)}
          className="flex flex-col items-center gap-2 text-[#1976D2] hover:bg-bg-secondary p-2 rounded-xl transition-all w-12 sm:w-20"
        >
          <ClipboardList className="w-5 h-5 sm:w-6 sm:h-6 2xl:w-8 2xl:h-8" />
          <span className="text-[10px] sm:text-xs 2xl:text-base font-bold hidden sm:block">Bitácora</span>
        </button>

        <div className="flex-1"></div>

        <ConnectionStatusPanel
          isInternetConnected={isInternetConnected}
          isDatabaseConnected={isDatabaseConnected}
          isCameraConnected={ordenCredenciales?.facial?.activo && hasCameraRegistered ? isCameraConnected : null}
          isReaderConnected={ordenCredenciales?.dactilar?.activo ? isReaderConnected : null}
        />
      </div>

      {/* Contenido principal */}
      <div className="flex-1 flex flex-col px-2 sm:px-4 2xl:px-8 overflow-hidden gap-2 sm:gap-3 2xl:gap-6">
        {/* Tarjeta principal de registro */}
        <div className="flex-[7] min-h-0">
          {loadingCredenciales ? (
            <div className="bg-bg-primary rounded-3xl shadow-2xl h-full flex flex-col items-center justify-center p-8 border border-border-subtle">
              <DynamicLoader text="Cargando configuración..." size="large" />
            </div>
          ) : visualActiveMethods.length === 0 ? (
            /* Sin métodos activos */
            <div className="bg-bg-primary rounded-3xl shadow-2xl h-full flex flex-col items-center justify-center p-8 border border-border-subtle">
              <h2 className="text-2xl font-bold text-text-primary mb-4">
                No hay métodos de checado configurados
              </h2>
              <p className="text-text-secondary text-center">
                Configura al menos un método de checado en Configuración →
                Preferencias
              </p>
            </div>
          ) : visualActiveMethods.length === 1 ? (
            /* Un solo método - Botón grande */
            (() => {
              const method = getMethodInfo(visualActiveMethods[0]);
              const Icon = method.icon;
              const isDisabled = method.isDisabled;
              const isClickable = method.handler && !method.isVisualOnly && !isDisabled;
              return (
                <div
                  onClick={isClickable ? method.handler : undefined}
                  title={isDisabled ? method.disabledMessage : ""}
                  className={`bg-gradient-to-br ${method.color} rounded-3xl shadow-2xl h-full text-white text-center transition-all flex flex-col items-center justify-center p-8 ${isDisabled
                    ? "opacity-60 cursor-not-allowed"
                    : isClickable
                      ? `${method.hoverColor} cursor-pointer hover:shadow-3xl hover:scale-[1.01]`
                      : "cursor-default"
                    }`}
                >
                  <h2 className="text-3xl sm:text-4xl lg:text-5xl 2xl:text-8xl font-bold mb-10 sm:mb-12 2xl:mb-20 tracking-tight">
                    Registrar Asistencia
                  </h2>

                  <div className="flex justify-center mb-8 sm:mb-12 2xl:mb-16">
                    <Icon className={`w-24 h-24 sm:w-32 sm:h-32 lg:w-36 lg:h-36 2xl:w-56 2xl:h-56 ${isDisabled ? "text-gray-300" : "text-white"}`} strokeWidth={1.2} />
                  </div>

                  <div className="mt-auto flex flex-col items-center w-full">
                    <div
                      className="text-6xl sm:text-7xl lg:text-8xl 2xl:text-[10rem] font-bold mb-4 tracking-tighter"
                    >
                      {formatTime(time).toLowerCase()}
                    </div>
                    <div className="text-2xl sm:text-3xl 2xl:text-5xl font-bold opacity-100 tracking-tight">
                      {formatDate(time)}
                    </div>
                    <div className="text-xl sm:text-2xl 2xl:text-4xl font-medium opacity-70 mt-2">
                      {formatDay(time).charAt(0).toUpperCase() + formatDay(time).slice(1)}
                    </div>
                  </div>

                  {isDisabled && (
                    <p className="text-sm sm:text-lg 2xl:text-2xl text-gray-300 bg-black/30 px-6 py-2 rounded-full backdrop-blur-sm mt-8">
                      {method.disabledMessage}
                    </p>
                  )}
                </div>
              );
            })()
          ) : (
            /* Múltiples métodos / Prioridades aplicadas */
            (() => {
              const methodKey = visualActiveMethods[0];
              const method = getMethodInfo(methodKey);
              const Icon = method.icon;
              const isClickable = method.handler && !method.isVisualOnly && !method.isDisabled;
              const isDisabled = method.isDisabled;

              return (
                <div
                  onClick={isClickable ? method.handler : undefined}
                  title={isDisabled ? method.disabledMessage : ""}
                  className={`relative bg-gradient-to-br from-[#1976D2] to-[#001A70] dark:from-slate-700 dark:to-slate-800 rounded-3xl shadow-2xl h-full text-white text-center flex flex-col items-center justify-center p-4 sm:p-8 transition-all ${isDisabled
                    ? "opacity-60 cursor-not-allowed"
                    : isClickable
                      ? "cursor-pointer hover:shadow-3xl hover:scale-[1.005]"
                      : "cursor-default"
                    }`}
                >
                  {/* Registrar Asistencia arriba */}
                  <h2 className="text-2xl sm:text-4xl 2xl:text-6xl font-bold mb-4 sm:mb-8 tracking-tight pointer-events-none">
                    Registrar Asistencia
                  </h2>

                  {/* Icono Central */}
                  <div className="flex-1 w-full max-w-sm flex flex-col items-center justify-center min-h-0 pointer-events-none">
                    <Icon
                      className={`w-32 h-32 sm:w-44 sm:h-44 lg:w-52 lg:h-52 ${isDisabled ? "text-gray-300 dark:text-gray-400" : "text-white"}`}
                      strokeWidth={1.2}
                    />
                    {isDisabled && (
                      <span className="text-xs sm:text-sm text-gray-300 dark:text-gray-400 bg-black/30 px-3 py-1 rounded-full backdrop-blur-sm mt-1 font-medium">
                        {method.disabledMessage}
                      </span>
                    )}
                  </div>

                  {/* Reloj abajo */}
                  <div className="mt-6 sm:mt-10 flex flex-col items-center w-full pointer-events-none">
                    <div
                      className="text-4xl sm:text-6xl lg:text-7xl 2xl:text-[8rem] font-bold mb-2 tracking-tighter"
                    >
                      {formatTime(time).toLowerCase()}
                    </div>
                    <div className="text-lg sm:text-2xl 2xl:text-4xl font-bold opacity-100 tracking-tight">
                      {formatDate(time)}
                    </div>
                    <div className="text-base sm:text-xl 2xl:text-3xl font-medium opacity-70 mt-1">
                      {formatDay(time).charAt(0).toUpperCase() + formatDay(time).slice(1)}
                    </div>
                  </div>

                  {/* Botones Secundarios Overlay - Detener propagación para no activar el botón principal */}
                  <div
                    className="absolute bottom-4 right-4 sm:bottom-8 sm:right-8 flex flex-row justify-end gap-3 sm:gap-4 z-20"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {visualActiveMethods.slice(1).map((mKey) => {
                      const mInfo = getMethodInfo(mKey);
                      const MIcon = mInfo.icon;
                      const mIsClickable = mInfo.handler && !mInfo.isVisualOnly && !mInfo.isDisabled;
                      const mIsDisabled = mInfo.isDisabled;
                      return (
                        <div
                          key={mKey}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (mIsClickable) mInfo.handler();
                          }}
                          title={mIsDisabled ? mInfo.disabledMessage : ""}
                          className={`backdrop-blur-md border rounded-2xl shadow-lg transition-all flex flex-row items-center justify-center px-3 sm:px-5 py-2 sm:py-3 gap-2 sm:gap-3 ${mIsDisabled
                            ? "bg-gray-500/30 dark:bg-gray-600/30 border-gray-400/30 dark:border-gray-500/30 opacity-60 cursor-not-allowed"
                            : "bg-white/15 dark:bg-black/20 border-white/20 dark:border-white/10"
                            } ${mIsClickable && !mIsDisabled
                              ? "hover:bg-white/25 dark:hover:bg-white/10 hover:shadow-xl hover:-translate-y-1 cursor-pointer"
                              : !mIsDisabled
                                ? "cursor-default"
                                : ""
                            }`}
                        >
                          <MIcon
                            className={`w-5 h-5 sm:w-6 sm:h-6 ${mIsDisabled ? "text-gray-300 dark:text-gray-400" : "text-white"}`}
                            strokeWidth={2}
                          />
                          <span className={`text-xs sm:text-sm font-bold whitespace-nowrap ${mIsDisabled ? "text-gray-300 dark:text-gray-400" : "text-white"}`}>
                            {mInfo.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()
          )}
        </div>

        {/* Sección de avisos - Compacta */}
        <div className="flex-[3] flex flex-col min-h-[130px]">
          <div className="animated-border bg-bg-primary rounded-2xl shadow-sm px-3 py-2 sm:p-4 h-full flex flex-col border border-border-subtle">
            <h3 className="text-sm sm:text-lg font-bold text-text-primary mb-1 sm:mb-3 flex-shrink-0 text-center">
              Avisos Generales
            </h3>

            <div
              className="flex-1 flex items-center overflow-hidden cursor-grab active:cursor-grabbing relative"
              onMouseDown={(e) => {
                const startX = e.clientX;
                const handleMouseMove = (moveEvent) => {
                  const diff = moveEvent.clientX - startX;
                  if (Math.abs(diff) > 50) {
                    if (diff > 0) {
                      setActiveNoticeIndex((prev) => (prev - 1 + notices.length) % notices.length);
                    } else {
                      setActiveNoticeIndex((prev) => (prev + 1) % notices.length);
                    }
                    document.removeEventListener('mousemove', handleMouseMove);
                    document.removeEventListener('mouseup', handleMouseUp);
                  }
                };
                const handleMouseUp = () => {
                  document.removeEventListener('mousemove', handleMouseMove);
                  document.removeEventListener('mouseup', handleMouseUp);
                };
                document.addEventListener('mousemove', handleMouseMove);
                document.addEventListener('mouseup', handleMouseUp);
              }}
              onTouchStart={(e) => {
                const startX = e.touches[0].clientX;
                const handleTouchMove = (moveEvent) => {
                  const diff = moveEvent.touches[0].clientX - startX;
                  if (Math.abs(diff) > 50) {
                    if (diff > 0) {
                      setActiveNoticeIndex((prev) => (prev - 1 + notices.length) % notices.length);
                    } else {
                      setActiveNoticeIndex((prev) => (prev + 1) % notices.length);
                    }
                    document.removeEventListener('touchmove', handleTouchMove);
                    document.removeEventListener('touchend', handleTouchEnd);
                  }
                };
                const handleTouchEnd = () => {
                  document.removeEventListener('touchmove', handleTouchMove);
                  document.removeEventListener('touchend', handleTouchEnd);
                };
                document.addEventListener('touchmove', handleTouchMove);
                document.addEventListener('touchend', handleTouchEnd);
              }}
            >
              <div
                className="flex gap-3 items-center transition-transform duration-500 ease-in-out absolute"
                style={{
                  left: '50%',
                  transform: `translateX(calc(-${(notices.length + activeNoticeIndex) * 172 + 112}px))`
                }}
              >
                {/* Crear array infinito: avisos originales duplicados para efecto continuo */}
                {[...notices, ...notices, ...notices].map((notice, index) => {
                  // Calcular el índice real considerando el array triplicado
                  const realIndex = index % notices.length;
                  // La tarjeta central es la que coincide con activeNoticeIndex en el grupo del medio
                  const isCenterCard = index === (activeNoticeIndex + notices.length);

                  return (
                    <div
                      key={index}
                      onClick={() => setSelectedNotice(notice)}
                      className={`flex-shrink-0 rounded-lg transition-all duration-500 ease-in-out p-3 cursor-pointer select-none ${isCenterCard
                        ? "w-56 bg-gradient-to-br from-[#E3F2FD] to-[#BBDEFB] dark:from-blue-900/40 dark:to-blue-800/20 scale-105 shadow-xl z-10 ring-2 ring-[#42A5F5]/50"
                        : "w-40 bg-bg-secondary border border-border-subtle hover:shadow-md hover:bg-bg-tertiary scale-90 opacity-60"
                        }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className={`font-bold ${isCenterCard ? "text-[#1976D2] dark:text-blue-400 text-xs" : "text-text-secondary text-[10px]"}`}>
                          {notice.date} • {notice.time}
                        </span>
                      </div>
                      <h4 className={`font-bold leading-tight ${isCenterCard
                        ? "text-[#001A70] dark:text-blue-200 text-base line-clamp-2"
                        : "text-text-primary text-sm line-clamp-2"
                        }`}>
                        {notice.subject || notice.message.substring(0, 50)}
                      </h4>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modales */}
      {selectedNotice && (
        <NoticeDetailModal
          notice={selectedNotice}
          onClose={() => setSelectedNotice(null)}
        />
      )}

      {showPinModal && (
        <PinModal
          onClose={() => setShowPinModal(false)}
          onSuccess={(data) => {
            console.log("✅ Asistencia registrada con PIN:", data);
            agregarEvento({
              user: data.empleado?.nombre || "Empleado",
              action: `${data.tipo_movimiento === "SALIDA" ? "Salida" : "Entrada"} registrada - PIN`,
              type: "success",
            });
          }}
          onLoginRequest={(usuarioData) => {
            // Login directo con los datos del usuario autenticado
            console.log("🔐 Login directo desde PIN:", usuarioData);
            setShowPinModal(false);
            // Llamar directamente a handleLoginSuccess con los datos del usuario
            handleLoginSuccess(usuarioData);
          }}
        />
      )}

      {showLoginModal && (
        <LoginModal
          onClose={() => setShowLoginModal(false)}
          onFacialLogin={() => {
            setShowLoginModal(false);
            setShowAsistenciaFacial(true);
          }}
          onLoginSuccess={handleLoginSuccess}
          ordenCredenciales={ordenCredenciales}
          isReaderConnected={isReaderConnected}
          isCameraConnected={hasCameraRegistered && isCameraConnected}
        />
      )}

      {showBitacora && <BitacoraModal onClose={() => setShowBitacora(false)} />}

      {/* Modal de AsistenciaHuella para registro de asistencia con huella */}
      {/* En modo background: siempre activo escuchando, modal aparece al detectar huella */}
      {/* En modo normal: aparece solo cuando showBiometricReader es true */}
      {ordenCredenciales?.dactilar?.activo && !isLoggedIn && isReaderConnected && (
        <AsistenciaHuella
          isOpen={showBiometricReader}
          backgroundMode={!showBiometricReader} // Si no está abierto manualmente, usar modo background
          onClose={() => setShowBiometricReader(false)}
          onSuccess={handleFingerprintSuccess}
          onLoginRequest={handleFingerprintLoginRequest}
          onReaderStatusChange={() => { }} // Ahora usamos el estado global isReaderConnected
        />
      )}

      {/* Modal de AsistenciaFacial para registro de asistencia con reconocimiento facial */}
      {showAsistenciaFacial && hasCameraRegistered && (
        <AsistenciaFacial
          isOpen={showAsistenciaFacial}
          onClose={() => setShowAsistenciaFacial(false)}
          onSuccess={handleFacialSuccess}
          onLoginRequest={handleFacialLoginRequest}
        />
      )}
    </div>
  );
}
