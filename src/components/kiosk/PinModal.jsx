import { User, Lock, X, CheckCircle2, AlertCircle, Loader2, Fingerprint, Eye, EyeOff } from "lucide-react";
import { useAttendanceRegistration } from "../../hooks/useAttendanceRegistration";
import { useEffect } from "react";

export default function PinModal({ onClose, onSuccess, onLoginRequest }) {
  const {
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
    handleLoginRequest
  } = useAttendanceRegistration(onClose, onSuccess, onLoginRequest);

  // Focus manual para el input si es necesario
  useEffect(() => {
    setUsuarioOCorreo("");
  }, [setUsuarioOCorreo]);

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-backdrop">
      <div className="bg-bg-primary rounded-lg shadow-2xl max-w-md sm:max-w-lg w-full overflow-hidden border border-border-subtle animate-zoom-in">
        {/* Main Content */}
        <div className="p-6 sm:p-8">
          {/* Header Minimalista */}
          <div className="text-center mb-6 relative">
            <button
              onClick={onClose}
              className="absolute -top-2 -right-2 text-text-tertiary hover:text-text-primary hover:bg-bg-secondary rounded-md p-2 transition-all"
            >
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-2xl font-bold text-text-primary tracking-tight">Registro con PIN</h2>
            <p className="text-text-tertiary text-xs mt-1 opacity-80 uppercase tracking-widest font-medium">Acceso Seguro</p>
          </div>

          {!result ? (
            <div className="space-y-6">
              {/* Contenedor de Formulario */}
              <div className="space-y-6">
                {/* Input de Usuario */}
                <div className="space-y-3">
                  <label className="text-[11px] font-bold text-text-tertiary uppercase tracking-widest ml-1">
                    Usuario o Correo
                  </label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none transition-colors group-focus-within:text-accent">
                      <User className="w-5 h-5 text-text-disabled" />
                    </div>
                    <input
                      type="text"
                      value={usuarioOCorreo}
                      onChange={(e) => setUsuarioOCorreo(e.target.value)}
                      placeholder="Tu usuario o correo"
                      disabled={loading}
                      className="w-full pl-14 pr-5 py-3.5 bg-bg-secondary/40 border border-border-subtle rounded-md text-text-primary placeholder:text-text-disabled/60 focus:ring-2 focus:ring-accent/10 focus:border-accent transition-all outline-none text-base"
                    />
                  </div>
                </div>

                {/* Input de PIN */}
                <div className="space-y-3">
                  <label className="text-[11px] font-bold text-text-tertiary uppercase tracking-widest ml-1">
                    Código PIN
                  </label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none transition-colors group-focus-within:text-accent">
                      <Lock className="w-5 h-5 text-text-disabled" />
                    </div>
                    <input
                      type={showPassword ? "text" : "password"}
                      value={pin}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                        setPin(value);
                      }}
                      placeholder="••••••"
                      maxLength={6}
                      inputMode="numeric"
                      disabled={loading}
                      className="w-full pl-14 pr-12 py-3.5 bg-bg-secondary/40 border border-border-subtle rounded-md text-text-primary placeholder:text-text-disabled/60 focus:ring-2 focus:ring-accent/10 focus:border-accent transition-all outline-none text-base tracking-widest"
                    />
                    <button
                      type="button"
                      onClick={togglePasswordVisibility}
                      className="absolute inset-y-0 right-0 pr-4 flex items-center text-text-tertiary hover:text-text-primary transition-colors"
                    >
                      {showPassword ? (
                        <EyeOff className="w-5 h-5" />
                      ) : (
                        <Eye className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {errorMessage && (
                <div className="bg-error/5 border border-error/20 rounded-md p-4 text-center animate-in fade-in slide-in-from-top-2">
                  <p className="text-error text-sm font-medium">{errorMessage}</p>
                </div>
              )}

              <div className="pt-4">
                <button
                  onClick={handleSubmit}
                  disabled={loading || pin.length < 4}
                  className="w-full py-5 bg-accent hover:bg-accent-hover disabled:bg-bg-tertiary disabled:text-text-disabled text-white rounded-md font-bold text-lg shadow-lg shadow-accent/10 transition-all flex items-center justify-center gap-3 group"
                >
                  {loading ? (
                    <Loader2 className="w-6 h-6 animate-spin" />
                  ) : (
                    <span>Registrar Asistencia</span>
                  )}
                </button>
              </div>
            </div>
          ) : (
            /* Pantalla de Resultado */
            <div className="animate-in fade-in zoom-in duration-300">
              <div className={`rounded-xl p-6 text-center border ${result.success
                ? "bg-success/5 border-success/20"
                : "bg-error/5 border-error/20"
                }`}>
                {result.success ? (
                  <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-success" />
                ) : (
                  <AlertCircle className="w-12 h-12 mx-auto mb-3 text-error" />
                )}

                <h3 className={`text-lg font-bold mb-1 ${result.success ? "text-success" : "text-error"
                  }`}>
                  {result.message || (result.success ? "Registro Exitoso" : "Error en Registro")}
                </h3>

                {result.empleado?.nombre && (
                  <p className="text-text-primary text-base font-semibold mb-1">
                    {result.empleado.nombre}
                  </p>
                )}

                {result.success && !result.pendiente && result.hora && (
                  <p className="text-text-tertiary text-xs">
                    {result.tipoMovimiento === "ENTRADA" ? "Entrada" : "Salida"} registrada a las <span className="text-text-primary font-bold">{result.hora}</span>
                  </p>
                )}

                <div className="mt-4 pt-4 border-t border-border-subtle flex flex-col items-center gap-3">
                  <div className="flex items-center gap-2 text-[9px] font-bold text-text-disabled uppercase tracking-widest">
                    <Loader2 className="w-2.5 h-2.5 animate-spin" />
                    Cerrando en {countdown}s
                  </div>

                  {onLoginRequest && (result.success || result.usuario || result.empleado) && (
                    <button
                      onClick={() => handleLoginRequest()}
                      className="w-full py-2.5 bg-bg-secondary hover:bg-bg-tertiary text-text-primary border border-border-subtle rounded-md font-bold text-xs transition-all flex items-center justify-center ring-1 ring-border-subtle shadow-sm"
                    >
                      Iniciar sesión
                    </button>
                  )}

                  {!result.success && (
                    <button
                      onClick={handleRetry}
                      className="text-accent font-bold text-sm hover:underline"
                    >
                      Intentar de nuevo
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
