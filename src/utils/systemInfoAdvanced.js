/**
 * Detección avanzada de información del sistema
 * Combina múltiples métodos para obtener la información más precisa
 */

import { getLocalIP, getMACAddress, getOperatingSystem } from './systemInfo';
import { isElectron as checkIsElectron, getElectronSystemInfo as getElectronInfo } from './electronHelper';

/**
 * Detecta si la aplicación está corriendo en Electron
 * @returns {boolean} true si está en Electron
 */
export const isElectron = checkIsElectron;

/**
 * Obtiene la IP pública usando ipify.org API
 * @returns {Promise<string>} IP pública
 */
export const getPublicIP = async () => {
  try {
    const response = await fetch('https://api.ipify.org?format=json', {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Error al obtener IP pública');
    }

    const data = await response.json();
    return data.ip || 'No detectada';
  } catch (error) {
    console.error('Error obteniendo IP pública:', error);
    return 'No detectada';
  }
};

/**
 * Obtiene información del sistema desde Electron (si está disponible)
 * Re-exporta la función de electronHelper para mantener la API consistente
 * @returns {Promise<Object|null>} Información del sistema o null si no es Electron
 */
export const getElectronSystemInfo = getElectronInfo;

/**
 * Obtiene la IP local usando múltiples métodos
 * @returns {Promise<string>} IP local detectada
 */
export const getLocalIPAdvanced = async () => {
  // Si estamos en Electron, usar la API nativa primero
  if (isElectron() && window.electronAPI) {
    try {
      const systemInfo = await window.electronAPI.getSystemInfo();
      if (systemInfo && systemInfo.ipAddress && systemInfo.ipAddress !== 'No detectada') {
        return systemInfo.ipAddress;
      }
    } catch (error) {
      console.error('Error obteniendo IP desde Electron API:', error);
    }
  }

  // Fallback a WebRTC
  const webrtcIP = await getLocalIP();
  if (webrtcIP && webrtcIP !== 'No detectada') {
    return webrtcIP;
  }

  return 'No detectada';
};

/**
 * Obtiene la MAC address real si está en Electron
 * @returns {Promise<string>} MAC address o identificador único
 */
export const getMACAddressAdvanced = async () => {
  if (isElectron() && window.electronAPI) {
    try {
      const systemInfo = await window.electronAPI.getSystemInfo();
      if (systemInfo && systemInfo.macAddress && systemInfo.macAddress !== 'No detectada') {
        return systemInfo.macAddress;
      }
    } catch (error) {
      console.error('Error obteniendo MAC desde Electron:', error);
    }
  }

  // Fallback al método del navegador
  return getMACAddress();
};

/**
 * Obtiene información detallada del sistema operativo
 * @returns {Promise<string>} Sistema operativo con versión
 */
export const getOperatingSystemAdvanced = async () => {
  if (isElectron() && window.electronAPI) {
    try {
      const systemInfo = await window.electronAPI.getSystemInfo();
      if (systemInfo && systemInfo.operatingSystem) {
        return systemInfo.operatingSystem;
      }
    } catch (error) {
      console.error('Error obteniendo SO desde Electron API:', error);
    }
  }

  // Fallback al método del navegador
  return getOperatingSystem();
};

/**
 * Obtiene información completa del sistema usando todos los métodos disponibles
 * @returns {Promise<Object>} Información completa del sistema
 */
export const getSystemInfoAdvanced = async () => {
  const isElectronApp = isElectron();

  // Ejecutar todas las detecciones en paralelo
  const [ipLocal, macAddress, operatingSystem, publicIP] = await Promise.all([
    getLocalIPAdvanced(),
    getMACAddressAdvanced(),
    getOperatingSystemAdvanced(),
    getPublicIP(),
  ]);

  return {
    ipAddress: ipLocal,
    macAddress: macAddress,
    operatingSystem: operatingSystem,
    publicIP: publicIP,
    isElectron: isElectronApp,
    userAgent: navigator.userAgent,
    platform: navigator.userAgentData?.platform || navigator.platform || 'No detectada',
    language: navigator.language,
    cores: navigator.hardwareConcurrency || 'No disponible',
    memory: navigator.deviceMemory ? `${navigator.deviceMemory} GB` : 'No disponible',
  };
};

/**
 * Formatea la información del sistema para mostrar
 * @param {Object} systemInfo - Información del sistema
 * @returns {Object} Información formateada
 */
export const formatSystemInfo = (systemInfo) => {
  return {
    'IP Local': systemInfo.ipAddress || 'No detectada',
    'IP Pública': systemInfo.publicIP || 'No detectada',
    'MAC Address': systemInfo.macAddress || 'No detectada',
    'Sistema Operativo': systemInfo.operatingSystem || 'No detectado',
    'Plataforma': systemInfo.platform || 'No detectada',
    'Idioma': systemInfo.language || 'No detectado',
    'Núcleos CPU': systemInfo.cores,
    'Memoria RAM': systemInfo.memory,
    'Entorno': systemInfo.isElectron ? 'Electron (Desktop)' : 'Navegador Web',
  };
};
