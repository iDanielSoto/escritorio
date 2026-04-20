/**
 * Script de preload para Electron
 * Expone APIs seguras al renderer process
 */

const { contextBridge, ipcRenderer } = require('electron');

// Exponer APIs de forma segura al renderer
contextBridge.exposeInMainWorld('electronAPI', {
  // Información del sistema
  getSystemInfo: () => ipcRenderer.invoke('get-system-info'),
  getNetworkInfo: () => ipcRenderer.invoke('get-network-info'),
  onNetworkStatusChange: (callback) => ipcRenderer.on('network-status-change', (event, details) => callback(details)),
  removeNetworkStatusListener: () => ipcRenderer.removeAllListeners('network-status-change'),

  // Control de ventana
  minimizeWindow: () => ipcRenderer.send('minimize-window'),
  maximizeWindow: () => ipcRenderer.send('maximize-window'),
  closeWindow: () => ipcRenderer.send('close-window'),
  isMaximized: () => ipcRenderer.invoke('is-maximized'),

  // Token de autenticación para BiometricMiddleware
  getBiometricToken: () => ipcRenderer.invoke('get-biometric-token'),

  // SDK DigitalPersona
  checkDigitalPersonaSdk: () => ipcRenderer.invoke('check-digitalpersona-sdk'),

  // Gestión de configuración persistente
  configGet: (key) => ipcRenderer.invoke('config-get', key),
  configSet: (key, value) => ipcRenderer.invoke('config-set', key, value),
  configRemove: (key) => ipcRenderer.invoke('config-remove', key),

  // Reconocimiento Facial
  verificarUsuario: (descriptor) => ipcRenderer.invoke('verificar-usuario', descriptor),
  registrarDescriptorFacial: (empleadoId, descriptor) => ipcRenderer.invoke('registrar-descriptor-facial', empleadoId, descriptor),
  registrarAsistenciaFacial: (empleadoId) => ipcRenderer.invoke('registrar-asistencia-facial', empleadoId),

  // Reconocimiento de Huella Dactilar
  readFingerprintTemplate: (userId) => ipcRenderer.invoke('read-fingerprint-template', userId),

  // Detección de dispositivos USB
  detectUSBDevices: () => ipcRenderer.invoke('detect-usb-devices'),
  listAllUSBDevices: () => ipcRenderer.invoke('list-all-usb-devices'),
  checkBiometricServer: () => ipcRenderer.invoke('check-biometric-server'),
  // Listener en tiempo real para cambios de dispositivo USB (conectar/desconectar)
  // Retorna una función de cleanup que debe llamarse en el useEffect cleanup
  onUSBDeviceChange: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('usb-device-change', handler);
    return () => ipcRenderer.removeListener('usb-device-change', handler);
  },

  // Información del entorno
  isElectron: true,
  // platform: process.platform, // Eliminado por seguridad en sandbox
  // versions: process.versions, // Eliminado por seguridad en sandbox

  // ===== Sistema Offline-First =====
  offlineDB: {
    // Cola de asistencias
    saveAsistencia: (data) => ipcRenderer.invoke('offline-save-asistencia', data),
    getRegistrosHoy: (empleadoId) => ipcRenderer.invoke('offline-get-registros-hoy', empleadoId),
    getRegistrosRango: (empleadoId, fechaInicio, fechaFin) => ipcRenderer.invoke('offline-get-registros-rango', empleadoId, fechaInicio, fechaFin),
    getPendingCount: () => ipcRenderer.invoke('offline-pending-count'),
    getErrors: () => ipcRenderer.invoke('offline-get-errors'),

    // Caché de datos maestros
    getCredenciales: (empleadoId) => ipcRenderer.invoke('offline-get-credenciales', empleadoId),
    getAllCredenciales: () => ipcRenderer.invoke('offline-get-all-credenciales'),
    getHorario: (empleadoId) => ipcRenderer.invoke('offline-get-horario', empleadoId),
    getEmpleado: (empleadoId) => ipcRenderer.invoke('offline-get-empleado', empleadoId),
    getAllEmpleados: () => ipcRenderer.invoke('offline-get-all-empleados'),

    // Caché de escritorio y biométricos
    getEscritorioInfo: (escritorioId) => ipcRenderer.invoke('offline-get-escritorio-info', escritorioId),
    getBiometricosRegistrados: (escritorioId) => ipcRenderer.invoke('offline-get-biometricos-registrados', escritorioId),
  },

  // Control de sincronización
  syncManager: {
    getStatus: () => ipcRenderer.invoke('sync-status'),
    pullNow: () => ipcRenderer.invoke('sync-pull-now'),
    pushNow: () => ipcRenderer.invoke('sync-push-now'),
    setOnline: (online) => ipcRenderer.invoke('sync-set-online', online),
    updateToken: (token) => ipcRenderer.invoke('sync-update-token', token),
    onStatusUpdate: (callback) => {
      ipcRenderer.on('sync-status-update', (event, status) => callback(status));
    },
    removeStatusListener: () => {
      ipcRenderer.removeAllListeners('sync-status-update');
    },
  },

  // ===== New Raw Offline System =====
  rawOfflineDB: {
    savePunch: (data) => ipcRenderer.invoke('raw-offline-save-punch', data),
    getPendingCount: () => ipcRenderer.invoke('raw-offline-pending-count'),
    pushNow: () => ipcRenderer.invoke('raw-sync-push-now'),
  },

  // ===== Auto Updater =====
  updaterAPI: {
    onUpdateAvailable: (callback) => ipcRenderer.on('update-available', (event, info) => callback(info)),
    onDownloadProgress: (callback) => ipcRenderer.on('download-progress', (event, progressObj) => callback(progressObj)),
    onUpdateDownloaded: (callback) => ipcRenderer.on('update-downloaded', (event, info) => callback(info)),
    installUpdate: () => ipcRenderer.send('install-update')
  }
});
