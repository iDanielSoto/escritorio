/**
 * useOfflineSync — Hook de React para estado de sincronización offline
 * Proporciona estado en tiempo real de la sincronización y conteo de pendientes.
 */

import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Hook para monitorear el estado de sincronización offline
 * @returns {Object} estado de sync y funciones de control
 */
export const useOfflineSync = () => {
  const [syncStatus, setSyncStatus] = useState({
    state: 'idle',      // 'idle' | 'pulling' | 'pushing' | 'error' | 'offline'
    isOnline: true,
    lastSync: null,
    lastError: null,
    pending: 0,
    errors: 0,
  });

  const [isAvailable, setIsAvailable] = useState(false);
  const mounted = useRef(true);

  // Verificar disponibilidad
  useEffect(() => {
    const available = !!(window.electronAPI && window.electronAPI.syncManager);
    setIsAvailable(available);

    if (!available) return;

    // Obtener estado inicial
    window.electronAPI.syncManager.getStatus().then((status) => {
      if (mounted.current && status) {
        setSyncStatus(prev => ({ ...prev, ...status }));
      }
    });

    // Escuchar actualizaciones en tiempo real desde el main process
    window.electronAPI.syncManager.onStatusUpdate((status) => {
      if (mounted.current && status) {
        setSyncStatus(prev => ({ ...prev, ...status }));
      }
    });

    return () => {
      mounted.current = false;
      if (window.electronAPI?.syncManager?.removeStatusListener) {
        window.electronAPI.syncManager.removeStatusListener();
      }
    };
  }, []);

  /**
   * Forzar Pull inmediato de datos maestros
   */
  const forcePull = useCallback(async () => {
    if (!isAvailable) return null;
    try {
      return await window.electronAPI.syncManager.pullNow();
    } catch (error) {
      console.error('[useOfflineSync] Error en forcePull:', error);
      return null;
    }
  }, [isAvailable]);

  /**
   * Forzar Push inmediato de registros pendientes
   */
  const forcePush = useCallback(async () => {
    if (!isAvailable) return null;
    try {
      return await window.electronAPI.syncManager.pushNow();
    } catch (error) {
      console.error('[useOfflineSync] Error en forcePush:', error);
      return null;
    }
  }, [isAvailable]);

  /**
   * Notificar cambio de conectividad al SyncManager
   */
  const setOnline = useCallback(async (online) => {
    if (!isAvailable) return;
    try {
      await window.electronAPI.syncManager.setOnline(online);
      setSyncStatus(prev => ({ ...prev, isOnline: online }));
    } catch (error) {
      console.error('[useOfflineSync] Error notificando estado de red:', error);
    }
  }, [isAvailable]);

  /**
   * Actualizar token de autenticación tras login
   */
  const updateToken = useCallback(async (token) => {
    if (!isAvailable) return;
    try {
      await window.electronAPI.syncManager.updateToken(token);
    } catch (error) {
      console.error('[useOfflineSync] Error actualizando token:', error);
    }
  }, [isAvailable]);

  /**
   * Obtener conteo de pendientes actualizado
   */
  const refreshPendingCount = useCallback(async () => {
    if (!isAvailable || !window.electronAPI.offlineDB) return;
    try {
      const counts = await window.electronAPI.offlineDB.getPendingCount();
      if (mounted.current && counts) {
        setSyncStatus(prev => ({
          ...prev,
          pending: counts.pending || 0,
          errors: counts.errors || 0,
        }));
      }
    } catch (error) {
      // Silenciar errores
    }
  }, [isAvailable]);

  return {
    // Estado
    isAvailable,
    syncState: syncStatus.state,
    isOnline: syncStatus.isOnline,
    isSyncing: syncStatus.state === 'pulling' || syncStatus.state === 'pushing',
    isOffline: !syncStatus.isOnline,
    lastSync: syncStatus.lastSync,
    lastError: syncStatus.lastError,
    pendingCount: syncStatus.pending,
    errorCount: syncStatus.errors,

    // Acciones
    forcePull,
    forcePush,
    setOnline,
    updateToken,
    refreshPendingCount,
  };
};

export default useOfflineSync;
