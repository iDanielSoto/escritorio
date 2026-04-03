/**
 * Sistema de almacenamiento que funciona tanto en Electron como en navegador
 * En Electron usa archivos persistentes, en navegador usa localStorage
 */

const isElectron = () => {
  return window.electronAPI && window.electronAPI.isElectron;
};

export const storage = {
  /**
   * Obtener un valor del almacenamiento
   * @param {string} key - Clave a buscar
   * @returns {Promise<any>} Valor almacenado o null
   */
  async getItem(key) {
    if (isElectron()) {
      // Usar sistema de archivos de Electron
      return await window.electronAPI.configGet(key);
    } else {
      // Usar localStorage del navegador
      const value = localStorage.getItem(key);
      return value;
    }
  },

  /**
   * Guardar un valor en el almacenamiento
   * @param {string} key - Clave
   * @param {any} value - Valor a guardar
   * @returns {Promise<boolean>} true si se guardó correctamente
   */
  async setItem(key, value) {
    if (isElectron()) {
      // Usar sistema de archivos de Electron
      return await window.electronAPI.configSet(key, value);
    } else {
      // Usar localStorage del navegador
      try {
        localStorage.setItem(key, value);
        return true;
      } catch (error) {
        console.error('Error guardando en localStorage:', error);
        return false;
      }
    }
  },

  /**
   * Eliminar un valor del almacenamiento
   * @param {string} key - Clave a eliminar
   * @returns {Promise<boolean>} true si se eliminó correctamente
   */
  async removeItem(key) {
    if (isElectron()) {
      // Usar sistema de archivos de Electron
      return await window.electronAPI.configRemove(key);
    } else {
      // Usar localStorage del navegador
      try {
        localStorage.removeItem(key);
        return true;
      } catch (error) {
        console.error('Error eliminando de localStorage:', error);
        return false;
      }
    }
  },
};

export default storage;
