/**
 * Utilidades para obtener información del sistema automáticamente
 */

/**
 * Obtiene la dirección IP local del dispositivo
 * @returns {Promise<string>} Dirección IP
 */
export const getLocalIP = async () => {
  try {
    // Usar WebRTC para obtener la IP local
    const peerConnection = new RTCPeerConnection({
      iceServers: []
    });

    // Crear un canal de datos dummy
    peerConnection.createDataChannel('');

    // Crear oferta y establecer descripción local
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    return new Promise((resolve) => {
      peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          const candidate = event.candidate.candidate;
          const ipRegex = /([0-9]{1,3}(\.[0-9]{1,3}){3})/;
          const match = ipRegex.exec(candidate);

          if (match && match[1]) {
            peerConnection.close();
            resolve(match[1]);
          }
        }
      };

      // Timeout de 3 segundos si no se encuentra IP
      setTimeout(() => {
        peerConnection.close();
        resolve('No detectada');
      }, 3000);
    });
  } catch (error) {
    console.error('Error al obtener IP:', error);
    return 'No detectada';
  }
};

/**
 * Obtiene información aproximada de la dirección MAC
 * Nota: Los navegadores modernos no permiten acceso directo a la MAC por seguridad
 * Esta función genera un identificador único basado en características del navegador
 * @returns {Promise<string>} Identificador único similar a MAC
 */
export const getMACAddress = () => {
  try {
    // Generar identificador único basado en características del navegador
    // Los navegadores no permiten acceso directo a la MAC por seguridad
    const fingerprint = generateDeviceFingerprint();
    return formatAsMAC(fingerprint);
  } catch (error) {
    console.error('Error al generar identificador MAC:', error);
    // Fallback: generar un MAC aleatorio
    const randomHash = Math.random().toString(16).substring(2, 14).padStart(12, '0').toUpperCase();
    return formatAsMAC(randomHash);
  }
};

/**
 * Genera un fingerprint único del dispositivo
 * @returns {string} Hash único del dispositivo
 */
const generateDeviceFingerprint = () => {
  // Componentes estables que no cambian entre sesiones
  const components = [
    navigator.userAgent,
    navigator.language,
    navigator.platform,
    screen.colorDepth.toString(),
    screen.width + 'x' + screen.height,
    new Date().getTimezoneOffset().toString(),
    (navigator.hardwareConcurrency || 0).toString(),
    (navigator.deviceMemory || 0).toString(),
    navigator.vendor || '',
    // NO usar Date.now() para mantener consistencia
  ];

  const fingerprint = components.join('|');

  // Generar hash simple pero robusto y consistente
  let hash = 0;
  for (let i = 0; i < fingerprint.length; i++) {
    const char = fingerprint.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convertir a entero de 32 bits
  }

  // Convertir a hexadecimal positivo y asegurar 12 caracteres
  const hexHash = Math.abs(hash).toString(16).padStart(12, '0');
  return hexHash.substring(0, 12).toUpperCase();
};

/**
 * Formatea un hash como dirección MAC
 * @param {string} hash - Hash hexadecimal
 * @returns {string} Formato XX:XX:XX:XX:XX:XX
 */
const formatAsMAC = (hash) => {
  const mac = hash.match(/.{1,2}/g) || [];
  return mac.join(':').toUpperCase();
};

/**
 * Detecta el sistema operativo del dispositivo de forma más precisa
 * @returns {string} Nombre del sistema operativo
 */
export const getOperatingSystem = () => {
  const userAgent = navigator.userAgent.toLowerCase();
  const platform = navigator.userAgentData?.platform || navigator.platform || '';

  // Detectar usando la nueva API userAgentData si está disponible
  if (navigator.userAgentData) {
    const platformLower = platform.toLowerCase();

    if (platformLower.includes('win')) return 'Windows 10/11';
    if (platformLower.includes('mac')) return 'macOS';
    if (platformLower.includes('linux')) return 'Linux';
    if (platformLower.includes('android')) return 'Android';
  }

  // Fallback a detección por userAgent
  // Windows
  if (userAgent.includes('win')) {
    if (userAgent.includes('windows nt 10') || userAgent.includes('windows nt 11')) {
      return 'Windows 10/11';
    }
    if (userAgent.includes('windows nt 6.3')) return 'Windows 8.1';
    if (userAgent.includes('windows nt 6.2')) return 'Windows 8';
    if (userAgent.includes('windows nt 6.1')) return 'Windows 7';
    return 'Windows';
  }

  // macOS
  if (userAgent.includes('mac')) {
    // Detectar versión de macOS
    const versionMatch = userAgent.match(/mac os x (\d+)[._](\d+)/);
    if (versionMatch) {
      const major = parseInt(versionMatch[1]);
      // Nombres de versiones recientes de macOS
      const versionNames = {
        14: 'Sonoma',
        13: 'Ventura',
        12: 'Monterey',
        11: 'Big Sur',
        10: 'Catalina'
      };
      const versionName = versionNames[major] || '';
      return versionName ? `macOS ${versionName}` : `macOS ${major}.${versionMatch[2]}`;
    }
    return 'macOS';
  }

  // Linux (antes de Android para evitar falsos positivos)
  if (userAgent.includes('linux') && !userAgent.includes('android')) {
    if (userAgent.includes('ubuntu')) return 'Ubuntu Linux';
    if (userAgent.includes('debian')) return 'Debian Linux';
    if (userAgent.includes('fedora')) return 'Fedora Linux';
    if (userAgent.includes('mint')) return 'Linux Mint';
    if (userAgent.includes('arch')) return 'Arch Linux';
    return 'Linux';
  }

  // Android
  if (userAgent.includes('android')) {
    const versionMatch = userAgent.match(/android (\d+(\.\d+)?)/);
    if (versionMatch) {
      return `Android ${versionMatch[1]}`;
    }
    return 'Android';
  }

  // iOS
  if (userAgent.includes('iphone') || userAgent.includes('ipad') || userAgent.includes('ipod')) {
    const versionMatch = userAgent.match(/os (\d+)[._](\d+)/);
    if (versionMatch) {
      return `iOS ${versionMatch[1]}.${versionMatch[2]}`;
    }
    return 'iOS';
  }

  // Chrome OS
  if (userAgent.includes('cros')) {
    return 'Chrome OS';
  }

  return 'Sistema no detectado';
};

/**
 * Obtiene toda la información del sistema de una vez
 * @returns {Promise<Object>} Objeto con IP, MAC y SO
 */
export const getSystemInfo = async () => {
  // Si estamos en Electron, usar las APIs nativas
  if (window.electronAPI && window.electronAPI.getSystemInfo) {
    try {
      const systemInfo = await window.electronAPI.getSystemInfo();

      return {
        ipAddress: systemInfo.ipAddress || await getLocalIP(),
        macAddress: systemInfo.macAddress || getMACAddress(),
        operatingSystem: systemInfo.operatingSystem || getOperatingSystem()
      };
    } catch (error) {
      console.error('Error al obtener info de Electron:', error);
    }
  }

  // Fallback para navegador web
  const ip = await getLocalIP();
  const mac = getMACAddress();
  const os = getOperatingSystem();

  return {
    ipAddress: ip,
    macAddress: mac,
    operatingSystem: os
  };
};

/**
 * Obtiene información adicional del hardware
 * @returns {Object} Información del hardware
 */
export const getHardwareInfo = () => {
  return {
    cores: navigator.hardwareConcurrency || 'No disponible',
    memory: navigator.deviceMemory ? `${navigator.deviceMemory} GB` : 'No disponible',
    platform: navigator.platform || 'No disponible',
    vendor: navigator.vendor || 'No disponible',
    language: navigator.language || 'No disponible',
  };
};
