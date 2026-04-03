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
