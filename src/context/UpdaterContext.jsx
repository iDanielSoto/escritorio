import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

/**
 * UpdaterContext
 * Estado global del ciclo de vida de las actualizaciones de la app.
 *
 * Desacopla la lógica de IPC del UpdaterOverlay para que cualquier
 * componente (ej. GeneralNodoModal, KioskScreen) pueda leer el estado
 * y que solo los administradores puedan iniciar descargas/instalaciones.
 */

const UpdaterContext = createContext(null);

export function UpdaterProvider({ children }) {
    const [status, setStatus] = useState('idle');
    // 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'error' | 'latest'
    const [updateInfo, setUpdateInfo] = useState(null); // { version, releaseDate, releaseNotes }
    const [progress, setProgress] = useState(null);     // { percent, transferred, total, bytesPerSecond }
    const [errorMsg, setErrorMsg] = useState('');

    // ── Suscripciones IPC ─────────────────────────────────────────────────
    useEffect(() => {
        if (!window.electronAPI?.updater) return;

        const cleanupStatus = window.electronAPI.updater.onStatus((data) => {
            switch (data.status) {
                case 'checking':
                    setStatus('checking');
                    break;
                case 'available':
                    setStatus('available');
                    setUpdateInfo({
                        version: data.version,
                        releaseDate: data.releaseDate,
                        releaseNotes: data.releaseNotes || null,
                    });
                    break;
                case 'latest':
                    setStatus('latest');
                    setTimeout(() => setStatus('idle'), 4000);
                    break;
                case 'downloaded':
                    setStatus('downloaded');
                    setUpdateInfo((prev) => ({ ...prev, version: data.version }));
                    break;
                case 'error':
                    setStatus('error');
                    setErrorMsg(data.message || 'Error desconocido en el actualizador.');
                    setTimeout(() => setStatus('idle'), 8000);
                    break;
                default:
                    break;
            }
        });

        const cleanupProgress = window.electronAPI.updater.onProgress((data) => {
            setStatus('downloading');
            setProgress(data);
        });

        return () => {
            cleanupStatus();
            cleanupProgress();
        };
    }, []);

    // ── Acciones públicas ─────────────────────────────────────────────────

    /** Fuerza una verificación manual. */
    const checkForUpdates = useCallback(async () => {
        if (!window.electronAPI?.updater) return;
        await window.electronAPI.updater.check();
    }, []);

    /** Inicia la descarga (solo debe ser llamado por un administrador). */
    const startDownload = useCallback(async () => {
        if (!window.electronAPI?.updater) return;
        setStatus('downloading');
        await window.electronAPI.updater.download();
    }, []);

    /** Cierra la app e instala la actualización descargada. */
    const installUpdate = useCallback(async () => {
        if (!window.electronAPI?.updater) return;
        await window.electronAPI.updater.install();
    }, []);

    // ── Helpers ───────────────────────────────────────────────────────────

    /** true cuando hay una actualización disponible o lista para instalar */
    const hasUpdate = status === 'available' || status === 'downloaded';

    const fmtBytes = (bytes) => {
        if (!bytes) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
    };

    const fmtSpeed = (bps) => `${fmtBytes(bps)}/s`;

    const fmtDate = (iso) => {
        if (!iso) return '';
        try {
            return new Date(iso).toLocaleDateString('es-MX', {
                year: 'numeric', month: 'long', day: 'numeric',
            });
        } catch {
            return '';
        }
    };

    const value = {
        status,
        updateInfo,
        progress,
        errorMsg,
        hasUpdate,
        checkForUpdates,
        startDownload,
        installUpdate,
        fmtBytes,
        fmtSpeed,
        fmtDate,
    };

    return (
        <UpdaterContext.Provider value={value}>
            {children}
        </UpdaterContext.Provider>
    );
}

export function useUpdater() {
    const ctx = useContext(UpdaterContext);
    if (!ctx) {
        // Fuera de Electron o del provider — devuelve estado vacío seguro
        return {
            status: 'idle',
            updateInfo: null,
            progress: null,
            errorMsg: '',
            hasUpdate: false,
            checkForUpdates: () => {},
            startDownload: () => {},
            installUpdate: () => {},
            fmtBytes: () => '0 B',
            fmtSpeed: () => '0 B/s',
            fmtDate: () => '',
        };
    }
    return ctx;
}
