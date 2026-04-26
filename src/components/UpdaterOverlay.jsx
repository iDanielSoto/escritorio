import React from 'react';
import { useUpdater } from '../context/UpdaterContext';

/**
 * UpdaterOverlay
 * Visor pasivo del ciclo de actualización.
 *
 * YA NO inicia descargas por cuenta propia. Solo muestra:
 *  - Toast "Buscando actualizaciones..." (checking)
 *  - Toast de error (error)
 *  - Overlay bloqueante con barra de progreso (downloading)
 *  - Overlay "Lista para instalar" con botón de reinicio (downloaded)
 *
 * El inicio de descarga e instalación es responsabilidad del administrador
 * desde GeneralNodoModal → panel de Actualización del Sistema.
 */
export default function UpdaterOverlay() {
    const { status, updateInfo, progress, errorMsg, installUpdate, fmtBytes, fmtSpeed, fmtDate } = useUpdater();

    // ── Toast: buscando actualizaciones ──────────────────────────────────
    if (status === 'checking') {
        return (
            <div style={styles.toast}>
                <div style={styles.toastSpinner} />
                <span style={styles.toastText}>Buscando actualizaciones…</span>
            </div>
        );
    }

    // ── Toast: error ─────────────────────────────────────────────────────
    if (status === 'error') {
        return (
            <div style={{ ...styles.toast, ...styles.toastError }}>
                <span style={styles.toastIcon}>⚠</span>
                <span style={styles.toastText}>Actualización: {errorMsg}</span>
            </div>
        );
    }

    // ── Sin overlay en idle / latest / available ──────────────────────────
    // 'available' ya no bloquea: es responsabilidad del admin desde GeneralNodoModal
    if (status === 'idle' || status === 'latest' || status === 'available') return null;

    // ── Overlay de pantalla completa (descarga activa o lista) ────────────
    return (
        <div style={styles.overlay}>
            <div style={styles.card}>

                {/* Ícono / animación central */}
                <div style={styles.iconWrap}>
                    {status === 'downloading' ? (
                        <DownloadAnimation percent={progress?.percent ?? 0} />
                    ) : (
                        <span style={styles.iconEmoji}>✅</span>
                    )}
                </div>

                {/* Título */}
                <h1 style={styles.title}>
                    {status === 'downloading' && 'Descargando actualización…'}
                    {status === 'downloaded' && 'Actualización lista'}
                </h1>

                {/* Versión */}
                {updateInfo?.version && (
                    <p style={styles.version}>
                        v{updateInfo.version}
                        {updateInfo.releaseDate && ` · ${fmtDate(updateInfo.releaseDate)}`}
                    </p>
                )}

                {/* Barra de progreso */}
                {status === 'downloading' && progress && (
                    <div style={styles.progressWrap}>
                        <div style={styles.progressBar}>
                            <div
                                style={{
                                    ...styles.progressFill,
                                    width: `${progress.percent}%`,
                                }}
                            />
                        </div>
                        <div style={styles.progressMeta}>
                            <span>{progress.percent}%</span>
                            <span>{fmtBytes(progress.transferred)} / {fmtBytes(progress.total)}</span>
                            <span>{fmtSpeed(progress.bytesPerSecond)}</span>
                        </div>
                    </div>
                )}

                {/* Descripción */}
                <p style={styles.description}>
                    {status === 'downloading' &&
                        'Por favor espera. No apagues el equipo durante la descarga.'}
                    {status === 'downloaded' &&
                        'La actualización fue descargada. Haz clic en "Reiniciar e Instalar" para aplicar los cambios.'}
                </p>

                {/* Acción: solo en estado downloaded */}
                {status === 'downloaded' && (
                    <div style={styles.actions}>
                        <button style={styles.btnSuccess} onClick={installUpdate}>
                            🔄 Reiniciar e Instalar
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────
//  Sub-componente: animación de descarga circular
// ─────────────────────────────────────────────
function DownloadAnimation({ percent }) {
    const size = 80;
    const strokeWidth = 6;
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (percent / 100) * circumference;

    return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth={strokeWidth} />
            <circle
                cx={size / 2} cy={size / 2} r={radius} fill="none"
                stroke="#60a5fa" strokeWidth={strokeWidth}
                strokeDasharray={circumference} strokeDashoffset={offset}
                strokeLinecap="round"
                transform={`rotate(-90 ${size / 2} ${size / 2})`}
                style={{ transition: 'stroke-dashoffset 0.4s ease' }}
            />
            <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle"
                fill="#e2e8f0" fontSize="14" fontWeight="700"
                fontFamily="Inter, system-ui, sans-serif">
                {percent}%
            </text>
        </svg>
    );
}

// ─────────────────────────────────────────────
//  Estilos
// ─────────────────────────────────────────────
const styles = {
    overlay: {
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'radial-gradient(ellipse at 50% 30%, #1e293b 0%, #0f172a 70%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backdropFilter: 'blur(4px)',
    },
    card: {
        background: 'linear-gradient(135deg, rgba(30,41,59,0.98) 0%, rgba(15,23,42,0.99) 100%)',
        border: '1px solid rgba(255,255,255,0.08)', borderRadius: '20px',
        padding: '48px 56px', maxWidth: '520px', width: '90%', textAlign: 'center',
        boxShadow: '0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px',
    },
    iconWrap: { display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '4px' },
    iconEmoji: { fontSize: '56px', lineHeight: 1 },
    title: {
        margin: 0, fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: '22px', fontWeight: 700, color: '#f1f5f9', letterSpacing: '-0.3px',
    },
    version: {
        margin: 0, fontFamily: 'Inter, monospace, sans-serif', fontSize: '13px',
        color: '#60a5fa', background: 'rgba(96,165,250,0.1)',
        padding: '4px 14px', borderRadius: '20px', border: '1px solid rgba(96,165,250,0.2)',
    },
    description: {
        margin: 0, fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: '14px', color: '#94a3b8', lineHeight: 1.6, maxWidth: '380px',
    },
    progressWrap: { width: '100%', display: 'flex', flexDirection: 'column', gap: '8px' },
    progressBar: { width: '100%', height: '8px', background: 'rgba(255,255,255,0.08)', borderRadius: '99px', overflow: 'hidden' },
    progressFill: {
        height: '100%', background: 'linear-gradient(90deg, #3b82f6, #818cf8)',
        borderRadius: '99px', transition: 'width 0.4s ease', boxShadow: '0 0 10px rgba(99,102,241,0.6)',
    },
    progressMeta: {
        display: 'flex', justifyContent: 'space-between',
        fontFamily: 'monospace, Inter, sans-serif', fontSize: '11px', color: '#64748b',
    },
    actions: { display: 'flex', flexDirection: 'column', gap: '10px', width: '100%', marginTop: '4px' },
    btnSuccess: {
        padding: '13px 24px',
        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
        border: 'none', borderRadius: '12px', color: '#fff',
        fontFamily: 'Inter, system-ui, sans-serif', fontSize: '15px', fontWeight: 600,
        cursor: 'pointer', boxShadow: '0 4px 20px rgba(16,185,129,0.35)', transition: 'opacity 0.2s',
    },
    toast: {
        position: 'fixed', bottom: '20px', right: '20px', zIndex: 9999,
        display: 'flex', alignItems: 'center', gap: '10px',
        padding: '10px 18px', background: 'rgba(15,23,42,0.9)',
        border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px',
        boxShadow: '0 8px 30px rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)',
    },
    toastError: { borderColor: 'rgba(239,68,68,0.4)', background: 'rgba(127,29,29,0.85)' },
    toastSpinner: {
        width: '14px', height: '14px',
        border: '2px solid rgba(255,255,255,0.2)', borderTop: '2px solid #60a5fa',
        borderRadius: '50%', animation: 'spin 0.8s linear infinite',
    },
    toastIcon: { fontSize: '16px' },
    toastText: { fontFamily: 'Inter, system-ui, sans-serif', fontSize: '13px', color: '#cbd5e1' },
};
