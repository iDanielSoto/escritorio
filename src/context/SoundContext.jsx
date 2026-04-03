import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';

const SoundContext = createContext();

// Definición de tonos por tipo de sonido
const SOUND_TYPES = {
    success: { frequencies: [880, 1100], duration: 0.12, gap: 0.08 },
    error: { frequencies: [220, 180], duration: 0.2, gap: 0.1 },
    notification: { frequencies: [440], duration: 0.15, gap: 0 },
};

export const SoundProvider = ({ children }) => {
    const [soundEnabled, setSoundEnabledState] = useState(() => {
        try {
            const saved = localStorage.getItem('userPreferences');
            if (saved) {
                const parsed = JSON.parse(saved);
                return parsed.soundEnabled ?? true;
            }
        } catch {
            // Ignorar errores de parsing
        }
        return true;
    });

    const audioContextRef = useRef(null);

    // Inicializar AudioContext de forma lazy (requiere interacción del usuario)
    const getAudioContext = useCallback(() => {
        if (!audioContextRef.current) {
            audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
        }
        // Reanudar si está suspendido (política de autoplay del navegador)
        if (audioContextRef.current.state === 'suspended') {
            audioContextRef.current.resume();
        }
        return audioContextRef.current;
    }, []);

    // Setter que también persiste en localStorage
    const setSoundEnabled = useCallback((enabled) => {
        setSoundEnabledState(enabled);
        try {
            const saved = localStorage.getItem('userPreferences');
            const prefs = saved ? JSON.parse(saved) : {};
            prefs.soundEnabled = enabled;
            localStorage.setItem('userPreferences', JSON.stringify(prefs));
        } catch {
            // Ignorar errores
        }
    }, []);

    // Escuchar cambios externos en localStorage (otras pestañas)
    useEffect(() => {
        const handleStorage = (e) => {
            if (e.key === 'userPreferences') {
                try {
                    const parsed = JSON.parse(e.newValue);
                    if (typeof parsed.soundEnabled === 'boolean') {
                        setSoundEnabledState(parsed.soundEnabled);
                    }
                } catch {
                    // Ignorar
                }
            }
        };
        window.addEventListener('storage', handleStorage);
        return () => window.removeEventListener('storage', handleStorage);
    }, []);

    // Reproducir sonido sintético usando Web Audio API
    const playSound = useCallback((type = 'notification') => {
        if (!soundEnabled) return;

        const config = SOUND_TYPES[type] || SOUND_TYPES.notification;

        try {
            const ctx = getAudioContext();
            let startTime = ctx.currentTime;

            config.frequencies.forEach((freq) => {
                const oscillator = ctx.createOscillator();
                const gainNode = ctx.createGain();

                oscillator.connect(gainNode);
                gainNode.connect(ctx.destination);

                oscillator.type = 'sine';
                oscillator.frequency.setValueAtTime(freq, startTime);

                // Envolvente suave para evitar clicks
                gainNode.gain.setValueAtTime(0, startTime);
                gainNode.gain.linearRampToValueAtTime(0.3, startTime + 0.01);
                gainNode.gain.linearRampToValueAtTime(0, startTime + config.duration);

                oscillator.start(startTime);
                oscillator.stop(startTime + config.duration);

                startTime += config.duration + config.gap;
            });
        } catch (err) {
            console.warn('Error al reproducir sonido:', err);
        }
    }, [soundEnabled, getAudioContext]);

    // Hablar texto usando SpeechSynthesis (respeta soundEnabled)
    const speak = useCallback((text, options = {}) => {
        if (!soundEnabled) return;

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = options.lang || 'es-MX';
        utterance.rate = options.rate || 0.9;
        utterance.volume = options.volume || 1;
        window.speechSynthesis.speak(utterance);
    }, [soundEnabled]);

    // Limpiar AudioContext al desmontar
    useEffect(() => {
        return () => {
            if (audioContextRef.current) {
                audioContextRef.current.close();
                audioContextRef.current = null;
            }
        };
    }, []);

    return (
        <SoundContext.Provider value={{ soundEnabled, setSoundEnabled, playSound, speak }}>
            {children}
        </SoundContext.Provider>
    );
};

export const useSound = () => {
    const context = useContext(SoundContext);
    if (!context) {
        throw new Error('useSound debe ser usado dentro de un SoundProvider');
    }
    return context;
};
