import React, { useState } from "react";
import {
    Settings,
    Smartphone,
    Sliders,
    ChevronRight,
    User,
    Mail,
    LogOut,
    ShieldOff,
    Briefcase,
    Building2,
    FileText,
    Bell,
    Calendar,
    Fingerprint,
    Camera,
    HeartPulse,
} from "lucide-react";
import GeneralNodoModal from "./GeneralNodoModal";
import DispositivosModal from "./DispositivosModal";
import PreferenciasModal from "./PreferenciasModal";
import BiometriaModal from "./BiometriaModal";
import EmployeeInfo from "./EmployeeInfo";

export default function AdminDashboard({
    escritorioId,
    datosCompletos,
    departamentos = [],
    onLogout,
    // Employee-specific props
    time,
    notices = [],
    loadingEmpleado,
    userHorario,
    readerConnected,
    isCameraConnected = false,
    isOnline,
    onShowHorario,
    onShowHistorial,
    onShowBiometric,
    onShowRegisterFace,
    onSelectNotice,
}) {
    const userName = datosCompletos?.nombre || "Usuario";
    const userEmail = datosCompletos?.correo || datosCompletos?.email || "N/A";
    const userPhone = datosCompletos?.telefono || "N/A";
    const userUsername = datosCompletos?.usuario || datosCompletos?.username || "N/A";
    const userDepartamento = datosCompletos?.departamento || datosCompletos?.departamento_nombre ||
        (departamentos.length > 0 ? departamentos.map(d => d.nombre || d).join(', ') : null);
    const userRFC = datosCompletos?.rfc;
    const userNSS = datosCompletos?.nss;

    const isAdmin = !!datosCompletos?.esAdmin || !!datosCompletos?.es_admin ||
        (Array.isArray(datosCompletos?.roles) && datosCompletos.roles.some(r => r.es_admin));
    const isEmployee = !!datosCompletos?.es_empleado || !!(datosCompletos?.rfc && datosCompletos?.nss);

    // Default section: employees see "empleado", admins see "general"
    const [activeSection, setActiveSection] = useState(
        isEmployee ? "empleado" : isAdmin ? "general" : "empleado"
    );
    const [showDeptPopover, setShowDeptPopover] = useState(false);

    // Config items for admin users
    const configItems = [
        { id: "general", title: "General del Nodo", icon: Settings },
        { id: "dispositivos", title: "Dispositivos", icon: Smartphone },
        { id: "preferencias", title: "Preferencias", icon: Sliders },
        { id: "biometria", title: "Gestión Biométrica", icon: Fingerprint },
    ];

    return (
        <>
            <div className="flex h-full rounded-2xl shadow-lg border border-border-subtle overflow-hidden">
                {/* ===== SIDEBAR ===== */}
                <aside className="w-14 lg:w-[240px] xl:w-[280px] 2xl:w-[340px] bg-bg-secondary border-r border-border-subtle flex flex-col flex-shrink-0 transition-all duration-300">

                    {/* Profile Card - Compact */}
                    <div className="p-2 lg:p-4">
                        <div className="flex items-center gap-3 mb-0 lg:mb-3">
                            <div className="relative flex-shrink-0">
                                <div className="absolute inset-0 bg-[#1976D2] rounded-full p-[2px]">
                                    <div className="w-full h-full bg-bg-primary rounded-full" />
                                </div>
                                {datosCompletos?.foto ? (
                                    <img
                                        src={datosCompletos.foto}
                                        alt={userName}
                                        className="relative w-10 h-10 lg:w-12 lg:h-12 2xl:w-16 2xl:h-16 rounded-full object-cover border-[3px] border-transparent"
                                        style={{ background: "none" }}
                                    />
                                ) : (
                                    <div className="relative w-10 h-10 lg:w-12 lg:h-12 2xl:w-16 2xl:h-16 bg-[#E3F2FD] dark:bg-[#1565C0]/20 rounded-full flex items-center justify-center shadow-md border-2 border-[#1976D2]">
                                        <User className="w-5 h-5 lg:w-6 lg:h-6 2xl:w-8 2xl:h-8 text-[#1976D2] dark:text-[#42A5F5]" />
                                    </div>
                                )}
                            </div>

                            <div className="flex-col overflow-hidden hidden lg:flex">
                                <h1 className="text-base 2xl:text-lg font-bold text-text-primary leading-tight">
                                    {userName}
                                </h1>
                            </div>
                        </div>

                        {/* Info rows - hidden on small sidebar */}
                        <div className="hidden lg:grid grid-cols-2 gap-x-3 gap-y-3 text-xs mt-2">
                            <div className="col-span-2 flex items-center gap-2 overflow-hidden">
                                <div className="p-1.5 bg-[#E3F2FD] dark:bg-[#1565C0]/10 rounded-lg flex-shrink-0">
                                    <User className="w-4 h-4 text-[#1976D2]" />
                                </div>
                                <div className="overflow-hidden">
                                    <p className="text-text-tertiary text-[10px] 2xl:text-xs font-bold uppercase leading-none mb-1">Usuario</p>
                                    <p className="text-text-primary font-bold truncate text-xs 2xl:text-sm">{userUsername}</p>
                                </div>
                            </div>
                            <div className="col-span-2 flex items-center gap-2 overflow-hidden">
                                <div className="p-1.5 bg-[#E3F2FD] dark:bg-[#1565C0]/10 rounded-lg flex-shrink-0">
                                    <Mail className="w-4 h-4 text-[#1976D2]" />
                                </div>
                                <div className="overflow-hidden flex-1 min-w-0">
                                    <p className="text-text-tertiary text-[10px] 2xl:text-xs font-bold uppercase leading-none mb-1">Email</p>
                                    <p className="text-text-primary font-bold truncate text-xs 2xl:text-sm">{userEmail}</p>
                                </div>
                            </div>

                            {userDepartamento && (
                                <div className="col-span-2 flex items-center gap-2 overflow-hidden">
                                    <div className="p-1.5 bg-[#E3F2FD] dark:bg-[#1565C0]/10 rounded-lg flex-shrink-0">
                                        <Building2 className="w-4 h-4 text-[#1976D2]" />
                                    </div>
                                    <div className="overflow-hidden flex-1 min-w-0">
                                        <p className="text-text-tertiary text-[10px] 2xl:text-xs font-bold uppercase leading-none mb-1">Departamento</p>
                                        <div className="flex items-center gap-1.5">
                                            <p className="text-text-primary font-bold truncate text-xs 2xl:text-sm">
                                                {departamentos.length > 0
                                                    ? (departamentos[0]?.nombre || departamentos[0])
                                                    : (typeof userDepartamento === 'object' ? userDepartamento.nombre : userDepartamento)
                                                }
                                            </p>
                                            {departamentos.length > 1 && (
                                                <button
                                                    onClick={() => setShowDeptPopover(!showDeptPopover)}
                                                    className="px-2 py-0.5 bg-[#1976D2] text-white text-[10px] 2xl:text-xs font-bold rounded-lg hover:bg-[#1565C0] transition-colors flex-shrink-0"
                                                >
                                                    +{departamentos.length - 1}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                            {userRFC && (
                                <div className="col-span-2 flex items-center gap-2 overflow-hidden">
                                    <div className="p-1.5 bg-[#E3F2FD] dark:bg-[#1565C0]/10 rounded-lg flex-shrink-0">
                                        <FileText className="w-4 h-4 text-[#1976D2]" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-text-tertiary text-[10px] 2xl:text-xs font-bold uppercase leading-none mb-1">RFC</p>
                                        <p className="text-text-primary font-bold text-xs 2xl:text-sm">{userRFC}</p>
                                    </div>
                                </div>
                            )}
                            {userNSS && (
                                <div className="col-span-2 flex items-center gap-2 overflow-hidden">
                                    <div className="p-1.5 bg-[#E3F2FD] dark:bg-[#1565C0]/10 rounded-lg flex-shrink-0">
                                        <HeartPulse className="w-4 h-4 text-[#1976D2]" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-text-tertiary text-[10px] 2xl:text-xs font-bold uppercase leading-none mb-1">NSS</p>
                                        <p className="text-text-primary font-bold text-xs 2xl:text-sm">{userNSS}</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Employee Menu Item - Above divider */}
                    {isEmployee && (
                        <div className="p-2 lg:p-3 pb-0">
                            {(() => {
                                const Icon = Briefcase;
                                const isActive = activeSection === "empleado";
                                return (
                                    <button
                                        onClick={() => setActiveSection("empleado")}
                                        className={`w-full flex items-center gap-3 px-2 lg:px-3 py-2.5 lg:py-3 rounded-xl transition-all text-left ${isActive
                                            ? "bg-[#1976D2] text-white shadow-md"
                                            : "text-text-secondary hover:bg-bg-primary"
                                            } justify-center lg:justify-start`}
                                        title="Información del Empleado"
                                    >
                                        <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? "text-white" : "text-[#1976D2]"}`} />
                                        <span className={`font-semibold text-sm hidden lg:inline ${isActive ? "text-white" : "text-text-primary"}`}>
                                            Información del Empleado
                                        </span>
                                        {isActive && <ChevronRight className="w-4 h-4 ml-auto opacity-70 hidden lg:block" />}
                                    </button>
                                );
                            })()}
                        </div>
                    )}

                    {/* Config Menu Items - Below divider */}
                    {isAdmin && (
                        <div className={`flex-1 p-2 lg:p-3 space-y-1 overflow-y-auto ${isEmployee ? 'border-t border-border-subtle mt-2 pt-3' : ''}`}>
                            <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider px-2 lg:px-3 mb-2 hidden lg:block">
                                Configuración del sistema
                            </p>
                            {configItems.map((item) => {
                                const Icon = item.icon;
                                const isActive = activeSection === item.id;
                                return (
                                    <button
                                        key={item.id}
                                        onClick={() => setActiveSection(item.id)}
                                        className={`w-full flex items-center gap-3 px-2 lg:px-3 py-2.5 lg:py-3 rounded-xl transition-all text-left justify-center lg:justify-start ${isActive
                                            ? "bg-[#1976D2] text-white shadow-md"
                                            : "text-text-secondary hover:bg-bg-primary"
                                            }`}
                                        title={item.title}
                                    >
                                        <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? "text-white" : "text-[#1976D2]"}`} />
                                        <span className={`font-semibold text-sm hidden lg:inline ${isActive ? "text-white" : "text-text-primary"}`}>
                                            {item.title}
                                        </span>
                                        {isActive && <ChevronRight className="w-4 h-4 ml-auto opacity-70 hidden lg:block" />}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                    {!isAdmin && <div className="flex-1" />}

                    {/* Logout */}
                    <div className="p-2 lg:p-3 2xl:p-4 border-t border-border-subtle">
                        <button
                            onClick={onLogout}
                            className="w-full flex items-center justify-center gap-2 px-2 lg:px-4 py-2.5 lg:py-3 2xl:py-4 bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600 text-white rounded-xl font-bold transition-all shadow-md hover:shadow-lg text-xs lg:text-sm 2xl:text-base"
                        >
                            <LogOut className="w-4 h-4 2xl:w-5 2xl:h-5" />
                            <span className="hidden lg:inline">Cerrar Sesión</span>
                        </button>
                    </div>
                </aside>

                {/* ===== CONTENT AREA ===== */}
                <main className="flex-1 bg-bg-primary overflow-y-auto">
                    {/* Employee Info Section */}
                    {activeSection === "empleado" && isEmployee && (
                        <div className="p-3 sm:p-5 h-full flex flex-col gap-3 sm:gap-4 overflow-y-auto">
                            {/* Top Row - Schedule + Notices side by side */}
                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-4 flex-1 min-h-0">
                                {/* Left: Schedule Card + Stats */}
                                <div className="col-span-1 lg:col-span-7 flex flex-col gap-3 overflow-y-auto">
                                    <EmployeeInfo
                                        time={time}
                                        empleado={datosCompletos}
                                        horario={userHorario}
                                        loading={loadingEmpleado}
                                    />
                                </div>

                                {/* Right: Personal Notices */}
                                <div className="col-span-1 lg:col-span-5 bg-bg-secondary rounded-2xl shadow-lg p-4 border border-border-subtle flex flex-col min-h-0">
                                    <div className="flex items-center justify-center mb-5 flex-shrink-0">
                                        <h2 className="text-base font-bold text-text-primary text-center">
                                            Avisos Personales
                                        </h2>
                                    </div>
                                    <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pt-2">
                                        {notices.length > 0 ? notices.slice(0, 6).map((notice, index) => (
                                            <div
                                                key={index}
                                                onClick={() => onSelectNotice?.(notice)}
                                                className="bg-bg-primary rounded-xl p-3 border border-border-subtle cursor-pointer hover:shadow-md hover:-translate-y-0.5 hover:border-[#1976D2]/40 transition-all duration-300 ease-out"
                                            >
                                                <div className="flex flex-col gap-1">
                                                    <div className="flex items-center justify-between">
                                                        <p className="text-[9px] font-bold text-[#1976D2] uppercase tracking-wider">
                                                            {notice.date}
                                                        </p>
                                                        <p className="text-[9px] font-medium text-text-tertiary">
                                                            {notice.time}
                                                        </p>
                                                    </div>
                                                    <h4 className="font-bold text-text-primary text-xs leading-snug">
                                                        {notice.subject}
                                                    </h4>
                                                </div>
                                            </div>
                                        )) : (
                                            <div className="flex flex-col items-center justify-center py-8 text-center">
                                                <Bell className="w-6 h-6 text-text-tertiary mb-2" />
                                                <p className="text-text-tertiary text-sm">Sin avisos recientes</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className={`grid grid-cols-2 gap-3 flex-shrink-0`}>
                                <button
                                    onClick={onShowHorario}
                                    className="bg-bg-secondary hover:bg-bg-tertiary rounded-2xl shadow-sm p-4 transition-all hover:shadow-md flex flex-col items-center justify-center border border-border-subtle text-[#1976D2] dark:text-[#42A5F5]"
                                >
                                    <Calendar className="w-8 h-8 mb-2" />
                                    <h3 className="text-sm font-bold text-text-primary mb-0.5">Ver Horario</h3>
                                    <p className="text-[10px] text-text-secondary">Lunes a Domingo</p>
                                </button>

                                <button
                                    onClick={isOnline ? onShowHistorial : undefined}
                                    disabled={!isOnline}
                                    title={!isOnline ? "No disponible sin conexión" : "Ver historial de asistencia"}
                                    className={`rounded-2xl shadow-sm p-4 transition-all flex flex-col items-center justify-center border ${
                                        isOnline
                                            ? "bg-bg-secondary hover:bg-bg-tertiary hover:shadow-md border-border-subtle text-[#1976D2] dark:text-[#42A5F5] cursor-pointer"
                                            : "bg-bg-secondary/50 border-border-subtle opacity-40 cursor-not-allowed text-text-disabled"
                                    }`}
                                >
                                    <Calendar className="w-8 h-8 mb-2" />
                                    <h3 className="text-sm font-bold text-text-primary mb-0.5">Historial</h3>
                                    <p className="text-[10px] text-text-secondary">
                                        {isOnline ? "Días anteriores" : "Sin conexión"}
                                    </p>
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Config Sections - Admin only */}
                    {activeSection === "general" && isAdmin && (
                        <GeneralNodoModal inline isAdminProp={isAdmin} />
                    )}
                    {activeSection === "dispositivos" && isAdmin && (
                        <DispositivosModal inline escritorioId={escritorioId} />
                    )}
                    {activeSection === "preferencias" && isAdmin && (
                        <PreferenciasModal inline />
                    )}
                    {activeSection === "biometria" && isAdmin && (
                        <BiometriaModal
                            inline
                            readerConnected={readerConnected}
                            isOnline={isOnline}
                            isCameraConnected={isCameraConnected}
                            onShowBiometric={onShowBiometric}
                            onShowRegisterFace={onShowRegisterFace}
                        />
                    )}

                    {/* No access message */}
                    {!isEmployee && !isAdmin && (
                        <div className="flex flex-col items-center justify-center h-full text-center px-8">
                            <div className="w-20 h-20 bg-bg-secondary rounded-2xl flex items-center justify-center mb-5">
                                <ShieldOff className="w-10 h-10 text-text-tertiary" />
                            </div>
                            <h3 className="text-xl font-bold text-text-primary mb-2">Información no disponible</h3>
                            <p className="text-text-secondary text-sm max-w-md">
                                No tienes permisos de administrador para acceder a las configuraciones del sistema.
                            </p>
                        </div>
                    )}
                </main>
            </div>

            {/* Department Popover - Fixed position to avoid overflow clipping */}
            {
                showDeptPopover && departamentos.length > 1 && (
                    <>
                        <div className="fixed inset-0 z-[60] bg-black/20" onClick={() => setShowDeptPopover(false)} />
                        <div className="fixed z-[70] top-1/2 left-[140px] -translate-y-1/2 bg-bg-primary border border-border-subtle rounded-xl shadow-2xl p-3 min-w-[220px] max-w-[280px]">
                            <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider px-2 mb-2">
                                Todos los departamentos ({departamentos.length})
                            </p>
                            <div className="space-y-1">
                                {departamentos.map((dep, i) => (
                                    <div key={i} className="flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-bg-secondary transition-colors">
                                        <Building2 className="w-4 h-4 text-[#1976D2] flex-shrink-0" />
                                        <span className="text-text-primary font-medium text-sm truncate">{dep?.nombre || dep}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </>
                )}
        </>
    );
}
