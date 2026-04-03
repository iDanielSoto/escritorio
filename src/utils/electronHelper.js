/**
 * Helper utilities para trabajar con Electron
 */

/**
 * Verifica si la aplicación está corriendo en Electron
 * @returns {boolean}
 */
export const isElectron = () => {
  // Método 1: Verificar si window.electronAPI existe (expuesto por preload)
  if (typeof window !== 'undefined' && window.electronAPI) {
    return true;
  }

  // Método 2: Verificar el user agent
  if (typeof navigator !== 'undefined' && navigator.userAgent.toLowerCase().includes('electron')) {
    return true;
  }

  // Método 3: Verificar process.type
  if (typeof window !== 'undefined' && window.process && window.process.type === 'renderer') {
    return true;
  }

  return false;
};

/**
 * Obtiene la versión de Electron si está disponible
 * @returns {string|null}
 */
export const getElectronVersion = () => {
  if (!isElectron()) return null;

  try {
    if (window.electronAPI && window.electronAPI.versions) {
      return window.electronAPI.versions.electron;
    }
    if (window.process && window.process.versions && window.process.versions.electron) {
      return window.process.versions.electron;
    }
  } catch (error) {
    console.error('Error obteniendo versión de Electron:', error);
  }

  return null;
};

/**
 * Obtiene la plataforma del sistema operativo
 * @returns {string}
 */
export const getPlatform = () => {
  if (isElectron() && window.electronAPI) {
    return window.electronAPI.platform || 'unknown';
  }

  if (typeof navigator !== 'undefined') {
    const platform = navigator.platform.toLowerCase();

    if (platform.includes('win')) return 'win32';
    if (platform.includes('mac')) return 'darwin';
    if (platform.includes('linux')) return 'linux';
  }

  return 'unknown';
};

/**
 * Minimiza la ventana de Electron
 */
export const minimizeWindow = () => {
  if (isElectron() && window.electronAPI) {
    window.electronAPI.minimizeWindow();
  }
};

/**
 * Maximiza/restaura la ventana de Electron
 */
export const maximizeWindow = () => {
  if (isElectron() && window.electronAPI) {
    window.electronAPI.maximizeWindow();
  }
};

/**
 * Cierra la ventana de Electron
 */
export const closeWindow = () => {
  if (isElectron() && window.electronAPI) {
    window.electronAPI.closeWindow();
  }
};

/**
 * Verifica si la ventana está maximizada
 * @returns {Promise<boolean>}
 */
export const isMaximized = async () => {
  if (isElectron() && window.electronAPI) {
    return await window.electronAPI.isMaximized();
  }
  return false;
};

/**
 * Obtiene información completa del sistema desde Electron
 * @returns {Promise<Object|null>}
 */
export const getElectronSystemInfo = async () => {
  if (!isElectron() || !window.electronAPI) {
    return null;
  }

  try {
    const systemInfo = await window.electronAPI.getSystemInfo();
    return systemInfo;
  } catch (error) {
    console.error('Error obteniendo información del sistema desde Electron:', error);
    return null;
  }
};

/**
 * Obtiene información detallada de red desde Electron
 * @returns {Promise<Array|null>}
 */
export const getElectronNetworkInfo = async () => {
  if (!isElectron() || !window.electronAPI) {
    return null;
  }

  try {
    const networkInfo = await window.electronAPI.getNetworkInfo();
    return networkInfo;
  } catch (error) {
    console.error('Error obteniendo información de red desde Electron:', error);
    return null;
  }
};

/**
 * Muestra un badge o indicador de que la app está en Electron
 * @returns {Object} Información para mostrar en la UI
 */
export const getEnvironmentInfo = () => {
  const inElectron = isElectron();
  const electronVersion = getElectronVersion();
  const platform = getPlatform();

  return {
    isElectron: inElectron,
    version: electronVersion,
    platform: platform,
    displayName: inElectron ? 'Aplicación de Escritorio' : 'Aplicación Web',
    icon: inElectron ? '🖥️' : '🌐',
  };
};

/**
 * Muestra notificación nativa del sistema (si está en Electron)
 * @param {string} title - Título de la notificación
 * @param {string} body - Cuerpo de la notificación
 */
export const showNotification = (title, body) => {
  if (!('Notification' in window)) {
    console.warn('Este navegador no soporta notificaciones');
    return;
  }

  if (Notification.permission === 'granted') {
    new Notification(title, { body });
  } else if (Notification.permission !== 'denied') {
    Notification.requestPermission().then((permission) => {
      if (permission === 'granted') {
        new Notification(title, { body });
      }
    });
  }
};
