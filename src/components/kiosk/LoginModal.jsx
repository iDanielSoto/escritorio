import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import BiometricAuth from "./BiometricAuth";
import FacialAuthModal from "./FacialAuthModal";
import { 
    User, Lock, Eye, EyeOff, Fingerprint, Camera, 
    X, CheckCircle2, ChevronRight, Info, LogIn
} from "lucide-react";

function LoginModal({ isOpen = true, onClose, onLoginSuccess, ordenCredenciales, isReaderConnected = false, isCameraConnected = false }) {
    // Verificar si los métodos biométricos están habilitados
    const isFingerprintEnabled = ordenCredenciales?.dactilar?.activo ?? false;
    const isFacialEnabled = ordenCredenciales?.facial?.activo ?? false;
    const { loginByPin, loginByFingerprint, loading, error: authError } = useAuth();
    const [formData, setFormData] = useState({
        usuario: '',
        contrasena: '',
    });
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [loginSuccess, setLoginSuccess] = useState(false);
    const [showBiometricModal, setShowBiometricModal] = useState(false);
    const [showFacialModal, setShowFacialModal] = useState(false);
    const [loggedInUser, setLoggedInUser] = useState(null);
    const [greeting, setGreeting] = useState("");

    // Ref para mantener el valor actual de showBiometricModal (evitar stale closure)
    const showBiometricModalRef = useRef(showBiometricModal);
    useEffect(() => {
        showBiometricModalRef.current = showBiometricModal;
    }, [showBiometricModal]);

    // Ref para mantener el valor actual de showFacialModal (evitar stale closure)
    const showFacialModalRef = useRef(showFacialModal);
    useEffect(() => {
        showFacialModalRef.current = showFacialModal;
    }, [showFacialModal]);

    // IMPORTANTE: Resetear el estado de los modales biometricos cuando el componente se monta
    // Esto previene que los modales queden activos de sesiones anteriores
    useEffect(() => {
        const hour = new Date().getHours();
        if (hour < 12) setGreeting("Buenos días");
        else if (hour < 18) setGreeting("Buenas tardes");
        else setGreeting("Buenas noches");

        // Siempre cerrar los modales al montar para evitar estados residuales
        setShowBiometricModal(false);
        setShowFacialModal(false);
        setLoginSuccess(false);
        setError('');
        setFormData({ usuario: '', contrasena: '' });
    }, []);

    // Tambien cerrar los modales biometricos cuando isOpen cambia a true (se abre el modal)
    useEffect(() => {
        if (isOpen) {
            setShowBiometricModal(false);
            setShowFacialModal(false);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value,
        }));
        if (error) setError('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.usuario.trim()) {
            setError('El usuario o correo es requerido');
            return;
        }

        if (!formData.contrasena) {
            setError('La contrasena es requerida');
            return;
        }

        if (formData.contrasena.length < 6) {
            setError('La contrasena debe tener al menos 6 caracteres');
            return;
        }

        setIsSubmitting(true);
        setError('');

        try {
            // Usar loginByPin para autenticar con usuario y PIN
            const result = await loginByPin(formData.usuario, formData.contrasena);

            if (result.success) {
                // Cerrar inmediatamente sin mostrar mensaje de confirmación
                if (onLoginSuccess) {
                    onLoginSuccess(result.usuario);
                }
                onClose();
            } else {
                setError(result.message || 'Error al iniciar sesion');
            }
        } catch (err) {
            setError('Error al conectar con el servidor');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleBackdropClick = (e) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    const handleBiometricLogin = () => {
        setShowBiometricModal(true);
    };

    const handleFacialLogin = () => {
        setShowFacialModal(true);
    };

    const handleFacialSuccess = async (empleadoData) => {
        // IMPORTANTE: Usar la ref para verificar el estado actual (evitar stale closure)
        // Solo procesar si el modal facial esta realmente abierto
        if (!showFacialModalRef.current) {
            console.warn("⚠️ LoginModal: Ignorando evento facial - modal no activo");
            return;
        }

        console.log("✅ Autenticacion facial exitosa:", empleadoData);

        // Usar loginByFingerprint para guardar la sesion correctamente en el contexto
        // (funciona igual para facial, solo guarda la sesion del usuario)
        const result = await loginByFingerprint(empleadoData);

        if (result.success) {
            setShowFacialModal(false);
            if (onLoginSuccess) {
                onLoginSuccess(result.usuario);
            }
            onClose();
        } else {
            console.error("Error en login facial:", result.message);
        }
    };

    const handleBiometricSuccess = async (empleadoData) => {
        // IMPORTANTE: Usar la ref para verificar el estado actual (evitar stale closure)
        // Solo procesar si el modal biométrico está realmente abierto
        if (!showBiometricModalRef.current) {
            console.warn("⚠️ LoginModal: Ignorando evento biométrico - modal no activo");
            return;
        }

        console.log("✅ Autenticación biométrica exitosa:", empleadoData);

        // Usar loginByFingerprint para guardar la sesión correctamente en el contexto
        const result = await loginByFingerprint(empleadoData);

        if (result.success) {
            // Cerrar modales inmediatamente y pasar al SessionScreen
            setShowBiometricModal(false);
            if (onLoginSuccess) {
                onLoginSuccess(result.usuario);
            }
            onClose();
        } else {
            console.error("Error en login biométrico:", result.message);
        }
    };

    return (
        <>
            <div
                className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-backdrop"
                onClick={handleBackdropClick}
            >
                <div className="bg-bg-primary rounded-lg w-full max-w-md overflow-hidden shadow-2xl border border-border-subtle animate-zoom-in">
                    {/* Header - Simple & Clean */}
                    <div className="px-8 pt-8 pb-6 relative text-center">
                        <button
                            onClick={onClose}
                            className="absolute top-4 right-4 p-2 text-text-tertiary hover:text-text-primary hover:bg-bg-secondary rounded-full transition-all"
                        >
                            <X className="w-5 h-5" />
                        </button>
                        
                        <div className="inline-flex items-center justify-center p-3 mb-4 bg-accent/5 rounded-lg border border-accent/10">
                            <img src="images/logo.ico" alt="Logo" className="w-8 h-8 object-contain" />
                        </div>
                        
                        <h2 className="text-xs font-semibold text-accent uppercase tracking-[0.2em] mb-1">
                            Control de Acceso
                        </h2>
                        <h1 className="text-2xl font-light tracking-tight text-text-primary">
                            {greeting}, <span className="font-semibold text-text-primary">Inicia Sesión</span>
                        </h1>
                    </div>

                    {/* Form & Content */}
                    <div className="px-8 pb-8">
                        {loginSuccess ? (
                            <div className="py-8 text-center animate-in fade-in slide-in-from-bottom-4 duration-300">
                                <div className="w-16 h-16 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-success/20">
                                    <CheckCircle2 className="w-8 h-8 text-success" />
                                </div>
                                <h2 className="text-xl font-semibold text-text-primary mb-1">
                                    ¡Bienvenido!
                                </h2>
                                <p className="text-text-secondary">
                                    {loggedInUser?.nombre || 'Usuario'}
                                </p>
                            </div>
                        ) : (
                            <>
                                {/* Error message */}
                                {(error || authError) && (
                                    <div className="mb-6 p-4 bg-red-500/5 border border-red-500/20 rounded-lg flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
                                        <Info className="w-5 h-5 text-red-500 shrink-0" />
                                        <p className="text-sm text-red-600 font-medium">{error || authError}</p>
                                    </div>
                                )}

                                <form onSubmit={handleSubmit} className="space-y-4">
                                    <div>
                                        <div className="relative group">
                                            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                                <User className="w-4.5 h-4.5 text-text-tertiary group-focus-within:text-accent transition-colors" />
                                            </div>
                                            <input
                                                type="text"
                                                id="usuario"
                                                name="usuario"
                                                value={formData.usuario}
                                                onChange={handleChange}
                                                className="w-full bg-bg-secondary/50 border border-border-subtle rounded-md py-3 pl-11 pr-4 text-sm text-text-primary placeholder:text-text-disabled focus:outline-none focus:border-accent/50 focus:ring-4 focus:ring-accent/5 transition-all"
                                                placeholder="Usuario o correo electrónico"
                                                autoComplete="username"
                                                autoFocus
                                                disabled={isSubmitting}
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <div className="relative group">
                                            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                                <Lock className="w-4.5 h-4.5 text-text-tertiary group-focus-within:text-accent transition-colors" />
                                            </div>
                                            <input
                                                type={showPassword ? 'text' : 'password'}
                                                id="contrasena"
                                                name="contrasena"
                                                value={formData.contrasena}
                                                onChange={handleChange}
                                                className="w-full bg-bg-secondary/50 border border-border-subtle rounded-xl py-3 pl-11 pr-12 text-sm text-text-primary placeholder:text-text-disabled focus:outline-none focus:border-accent/50 focus:ring-4 focus:ring-accent/5 transition-all"
                                                placeholder="Contraseña"
                                                autoComplete="current-password"
                                                disabled={isSubmitting}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword(!showPassword)}
                                                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-text-tertiary hover:text-text-primary transition-colors"
                                                tabIndex={-1}
                                            >
                                                {showPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                                            </button>
                                        </div>
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={isSubmitting || loading}
                                        className="w-full bg-accent hover:bg-accent-hover text-white py-3.5 rounded-lg font-semibold transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-accent/20 active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100"
                                    >
                                        {isSubmitting || loading ? (
                                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        ) : (
                                            <span>Iniciar Sesión</span>
                                        )}
                                    </button>
                                </form>

                                {/* Biometric Section */}
                                <div className="mt-8">
                                    <div className="relative flex items-center justify-center mb-6">
                                        <div className="absolute inset-0 flex items-center">
                                            <div className="w-full border-t border-border-subtle"></div>
                                        </div>
                                        <span className="relative px-4 bg-bg-primary text-[11px] font-bold text-text-tertiary uppercase tracking-widest">
                                            Acceso Rápido
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <button
                                            type="button"
                                            onClick={handleBiometricLogin}
                                            disabled={isSubmitting || loading || !isFingerprintEnabled || !isReaderConnected}
                                            className={`flex flex-col items-center justify-center p-4 rounded-lg border transition-all duration-200 group ${
                                                !isFingerprintEnabled || !isReaderConnected
                                                ? "bg-bg-secondary/30 border-border-subtle opacity-50 cursor-not-allowed"
                                                : "bg-bg-secondary/50 border-border-subtle hover:border-accent/40 hover:bg-bg-primary"
                                            }`}
                                        >
                                            <div className={`w-10 h-10 rounded-md flex items-center justify-center mb-3 transition-colors ${
                                                !isFingerprintEnabled || !isReaderConnected
                                                ? "bg-text-tertiary/10 text-text-tertiary"
                                                : "bg-accent/5 text-text-secondary group-hover:text-accent group-hover:bg-accent/10"
                                            }`}>
                                                <Fingerprint className="w-5 h-5" />
                                            </div>
                                            <span className="text-xs font-semibold text-text-primary mb-1">Huella</span>
                                            <span className="text-[10px] text-text-tertiary text-center leading-tight">
                                                {!isFingerprintEnabled ? "Inactivo" : !isReaderConnected ? "Desconectado" : "Lector listo"}
                                            </span>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={handleFacialLogin}
                                            disabled={isSubmitting || loading || !isFacialEnabled || !isCameraConnected}
                                            className={`flex flex-col items-center justify-center p-4 rounded-xl border transition-all duration-200 group ${
                                                !isFacialEnabled || !isCameraConnected
                                                ? "bg-bg-secondary/30 border-border-subtle opacity-50 cursor-not-allowed"
                                                : "bg-bg-secondary/50 border-border-subtle hover:border-accent/40 hover:bg-bg-primary"
                                            }`}
                                        >
                                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 transition-colors ${
                                                !isFacialEnabled || !isCameraConnected
                                                ? "bg-text-tertiary/10 text-text-tertiary"
                                                : "bg-accent/5 text-text-secondary group-hover:text-accent group-hover:bg-accent/10"
                                            }`}>
                                                <Camera className="w-5 h-5" />
                                            </div>
                                            <span className="text-xs font-semibold text-text-primary mb-1">Facial</span>
                                            <span className="text-[10px] text-text-tertiary text-center leading-tight">
                                                {!isFacialEnabled ? "Inactivo" : !isCameraConnected ? "Sin cámara" : "Cámara lista"}
                                            </span>
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="px-8 py-4 bg-bg-secondary/30 border-t border-border-subtle flex items-center justify-between">
                        <div className="flex items-center gap-1.5 grayscale opacity-70">
                            <span className="text-[10px] font-bold text-text-tertiary uppercase tracking-widest">FASITLAC</span>
                        </div>
                        <div className="text-[10px] font-medium text-text-disabled uppercase tracking-widest">
                            v2.0
                        </div>
                    </div>
                </div>
            </div>

            {/* Modal Biometrico */}
            {showBiometricModal && (
                <BiometricAuth
                    isOpen={showBiometricModal}
                    onClose={() => setShowBiometricModal(false)}
                    onAuthSuccess={handleBiometricSuccess}
                />
            )}

            {/* Modal Facial */}
            {showFacialModal && (
                <FacialAuthModal
                    onClose={() => setShowFacialModal(false)}
                    onAuthSuccess={handleFacialSuccess}
                />
            )}
        </>
    );
}

export default LoginModal;
