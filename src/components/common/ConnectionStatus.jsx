/**
 * Componente para mostrar el estado de conexión con iconos dinámicos
 */

import { Wifi, WifiOff, Database, Fingerprint, Camera } from 'lucide-react';

/**
 * Icono de WiFi con estado dinámico
 */
export function WifiStatus({ isConnected, className = "" }) {
  if (isConnected) {
    return (
      <div className={`flex flex-col items-center gap-1 text-green-600 p-2 ${className}`}>
        <Wifi className="w-5 h-5" />
        <span className="text-xs font-semibold">WiFi</span>
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-center gap-1 text-red-600 p-2 ${className}`}>
      <WifiOff className="w-5 h-5" />
      <span className="text-xs font-semibold">WiFi</span>
    </div>
  );
}

/**
 * Icono de Base de Datos con estado dinámico
 */
export function DatabaseStatus({ isConnected, className = "" }) {
  const iconColor = isConnected ? 'text-green-600' : 'text-red-600';

  return (
    <div className={`flex flex-col items-center gap-1 ${iconColor} p-2 ${className}`}>
      <div className="relative">
        <Database className="w-5 h-5" />
        {!isConnected && (
          <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-600 rounded-full animate-pulse"></div>
        )}
      </div>
      <span className="text-xs font-semibold">BD</span>
    </div>
  );
}

/**
 * Icono de Lector Biométrico con estado dinámico
 */
export function ReaderStatus({ isConnected, className = "" }) {
  const iconColor = isConnected ? 'text-green-600' : 'text-gray-400';

  return (
    <div className={`flex flex-col items-center gap-1 ${iconColor} p-2 ${className}`} title={isConnected ? "Lector conectado" : "Lector desconectado"}>
      <div className="relative">
        <Fingerprint className="w-5 h-5" />
        {!isConnected && (
          <div className="absolute -top-1 -right-1 w-2 h-2 bg-gray-400 rounded-full"></div>
        )}
      </div>
      <span className="text-xs font-semibold">Lector</span>
    </div>
  );
}

/**
 * Icono de Cámara con estado dinámico
 */
export function CameraStatus({ isConnected, className = "" }) {
  const iconColor = isConnected ? 'text-green-600' : 'text-gray-400';

  return (
    <div className={`flex flex-col items-center gap-1 ${iconColor} p-2 ${className}`} title={isConnected ? "Cámara conectada" : "Cámara desconectada"}>
      <div className="relative">
        <Camera className="w-5 h-5" />
        {!isConnected && (
          <div className="absolute -top-1 -right-1 w-2 h-2 bg-gray-400 rounded-full"></div>
        )}
      </div>
      <span className="text-xs font-semibold">Cámara</span>
    </div>
  );
}

/**
 * Componente compuesto que muestra ambos estados
 */
export function ConnectionStatusPanel({ isInternetConnected, isDatabaseConnected, isReaderConnected = null, isCameraConnected = null }) {
  return (
    <>
      <WifiStatus isConnected={isInternetConnected} />
      <DatabaseStatus isConnected={isDatabaseConnected} />
      {isCameraConnected !== null && (
        <CameraStatus isConnected={isCameraConnected} />
      )}
      {isReaderConnected !== null && (
        <ReaderStatus isConnected={isReaderConnected} />
      )}
    </>
  );
}

export default ConnectionStatusPanel;

