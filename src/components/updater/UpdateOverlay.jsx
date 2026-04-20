import React, { useState, useEffect } from 'react';
import { DownloadCloud, CheckCircle, RefreshCcw } from 'lucide-react';

const UpdateOverlay = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [status, setStatus] = useState('idle'); // idle, downloading, downloaded
  const [progress, setProgress] = useState({ percent: 0, transferred: 0, total: 0 });
  const [version, setVersion] = useState('');

  useEffect(() => {
    // Escuchar eventos si la API de electron está disponible
    if (!window.electronAPI || !window.electronAPI.updaterAPI) return;

    const updater = window.electronAPI.updaterAPI;

    updater.onUpdateAvailable((info) => {
      setVersion(info.version);
      setStatus('downloading');
      setIsVisible(true);
    });

    updater.onDownloadProgress((prog) => {
      setProgress({
        percent: Math.round(prog.percent),
        transferred: prog.transferred,
        total: prog.total
      });
      setStatus('downloading');
      setIsVisible(true); // Asegurar que sea visible
    });

    updater.onUpdateDownloaded((info) => {
      setVersion(info.version);
      setStatus('downloaded');
      setProgress({ percent: 100, transferred: 100, total: 100 });
      setIsVisible(true);
    });

  }, []);

  const handleInstall = () => {
    if (window.electronAPI && window.electronAPI.updaterAPI) {
      window.electronAPI.updaterAPI.installUpdate();
    }
  };

  const formatBytes = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-black bg-opacity-90 flex flex-col items-center justify-center backdrop-blur-sm transition-all duration-500">
      <div className="bg-gray-900 border border-gray-800 rounded-3xl p-10 max-w-xl w-full mx-4 shadow-2xl flex flex-col items-center text-center transform transition-all">
        
        {status === 'downloading' && (
          <>
            <div className="relative mb-6">
              <div className="absolute inset-0 bg-blue-500 rounded-full blur-xl opacity-20 animate-pulse"></div>
              <div className="bg-blue-600/20 p-5 rounded-full border border-blue-500/30 relative z-10">
                <DownloadCloud className="w-16 h-16 text-blue-400 animate-bounce" />
              </div>
            </div>
            
            <h2 className="text-3xl font-extrabold text-white mb-2 tracking-tight">Actualizando Sistema</h2>
            <p className="text-gray-400 mb-8 text-lg">
              Descargando versión {version} de Kiosko
            </p>

            <div className="w-full bg-gray-800 rounded-full h-4 mb-4 overflow-hidden border border-gray-700">
              <div 
                className="bg-gradient-to-r from-blue-600 to-indigo-500 h-4 rounded-full transition-all duration-300 relative overflow-hidden" 
                style={{ width: `${progress.percent}%` }}
              >
                <div className="absolute top-0 left-0 bottom-0 right-0 bg-white/20 w-full animate-[shimmer_2s_infinite]"></div>
              </div>
            </div>

            <div className="flex justify-between w-full text-sm font-medium">
              <span className="text-blue-400">{progress.percent}% Completado</span>
              <span className="text-gray-500">
                {formatBytes(progress.transferred)} / {formatBytes(progress.total)}
              </span>
            </div>
            
            <p className="mt-8 text-sm text-gray-500 flex items-center gap-2">
              <RefreshCcw className="w-4 h-4 animate-spin" />
              El equipo está temporalmente bloqueado
            </p>
          </>
        )}

        {status === 'downloaded' && (
          <>
            <div className="relative mb-6">
              <div className="absolute inset-0 bg-emerald-500 rounded-full blur-xl opacity-20 animate-pulse"></div>
              <div className="bg-emerald-600/20 p-5 rounded-full border border-emerald-500/30 relative z-10">
                <CheckCircle className="w-16 h-16 text-emerald-400" />
              </div>
            </div>
            
            <h2 className="text-3xl font-extrabold text-white mb-2 tracking-tight">Descarga Completada</h2>
            <p className="text-gray-400 mb-8 text-lg">
              La versión {version} está lista para instalarse
            </p>

            <button 
              onClick={handleInstall}
              className="w-full py-4 px-6 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white text-lg font-bold rounded-xl shadow-lg shadow-emerald-500/30 transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-3"
            >
              <RefreshCcw className="w-6 h-6" />
              Instalar y Reiniciar Kiosko
            </button>
            <p className="mt-6 text-sm text-gray-500">
              Esto reiniciará el equipo de inmediato
            </p>
          </>
        )}
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}} />
    </div>
  );
};

export default UpdateOverlay;
