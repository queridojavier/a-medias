// sync-hybrid.js - Sistema híbrido que soporta Local First + Supabase opcional
// Prioriza Local First, pero mantiene compatibilidad con Supabase

import { SYNC_STATUS, TIMINGS, getSupabaseConfig } from './constants.js';
import { logger, isOnline } from './utils.js';
import toast from './toast.js';
import localStorage from './storage-local.js';
import urlShareManager from './share-url.js';

const STORAGE_KEY = 'a_medias_app_state';
const SHARE_MODE_KEY = 'a_medias_share_mode';

// Modos de compartir
const SHARE_MODES = {
  NONE: 'none',           // Solo local
  URL: 'url',             // Compartir vía URL
  SUPABASE: 'supabase'    // Compartir vía Supabase (legacy)
};

class HybridSyncManager {
  constructor() {
    this.status = SYNC_STATUS.IDLE;
    this.shareMode = SHARE_MODES.NONE;
    this.onStateChange = null;
    this.onStatusChange = null;
    this.autoSaveTimer = null;

    // Para Supabase (compatibilidad legacy)
    this.shareId = null;
    this.shareKey = null;
    this.supabaseConfig = getSupabaseConfig();
  }

  /**
   * Inicializa el sistema desde localStorage o URL
   */
  async init() {
    logger.log('[HybridSync] Inicializando sistema híbrido');

    // Restaurar modo de compartir
    this.shareMode = await localStorage.load(SHARE_MODE_KEY, SHARE_MODES.NONE);

    // Verificar si hay datos compartidos en URL
    if (urlShareManager.hasSharedData()) {
      return await this.loadFromURL();
    }

    // Verificar si hay parámetros de Supabase en URL (legacy)
    const params = new URLSearchParams(window.location.search);
    if (params.has('share') && params.has('key')) {
      logger.log('[HybridSync] Detectada URL de Supabase (legacy)');
      toast.info('Migrando enlace antiguo al nuevo sistema...');
      // TODO: Migrar de Supabase a Local First
    }

    // Cargar estado local
    const savedState = await localStorage.load(STORAGE_KEY);
    if (savedState) {
      logger.log('[HybridSync] Estado local cargado');
      if (this.onStateChange) {
        this.onStateChange(savedState);
      }
    }

    this.setStatus(SYNC_STATUS.IDLE);
    return true;
  }

  /**
   * Carga datos desde URL compartida
   */
  async loadFromURL() {
    this.setStatus(SYNC_STATUS.LOADING);

    const result = await urlShareManager.readShareURL();

    if (result.success) {
      this.shareMode = SHARE_MODES.URL;
      await localStorage.save(SHARE_MODE_KEY, SHARE_MODES.URL);

      // Guardar localmente
      await this.saveLocal(result.data);

      // Aplicar estado
      if (this.onStateChange) {
        this.onStateChange(result.data);
      }

      toast.success('Datos cargados desde enlace compartido');
      this.setStatus(SYNC_STATUS.SYNCED);
      return true;
    } else {
      toast.error(result.message || 'Error al cargar datos compartidos');
      this.setStatus(SYNC_STATUS.ERROR);
      return false;
    }
  }

  /**
   * Guarda estado localmente (IndexedDB)
   */
  async saveLocal(data) {
    const success = await localStorage.save(STORAGE_KEY, data);
    if (success) {
      logger.log('[HybridSync] Guardado local exitoso');
    }
    return success;
  }

  /**
   * Guarda estado con debounce automático
   */
  async saveState(data) {
    // Cancelar guardado previo
    if (this.autoSaveTimer) {
      clearTimeout(this.autoSaveTimer);
    }

    this.setStatus(SYNC_STATUS.SAVING);

    // Debounce: esperar a que el usuario termine de hacer cambios
    this.autoSaveTimer = setTimeout(async () => {
      await this.saveLocal(data);
      this.setStatus(SYNC_STATUS.SYNCED);
    }, TIMINGS.SYNC_DEBOUNCE);
  }

  /**
   * Crea un enlace compartido vía URL
   */
  async createShareURL(data) {
    if (this.shareMode !== SHARE_MODES.NONE) {
      toast.info('Ya tienes un enlace compartido activo');
      return this.getShareURL();
    }

    this.setStatus(SYNC_STATUS.LOADING);

    // Estimar tamaño primero
    const estimate = await urlShareManager.estimateSize(data);
    if (estimate && !estimate.canShare) {
      toast.error('Los datos son demasiado grandes para compartir vía URL');
      this.setStatus(SYNC_STATUS.ERROR);
      return null;
    }

    // Crear URL
    const result = await urlShareManager.createShareURL(data);

    if (result.success) {
      this.shareMode = SHARE_MODES.URL;
      await localStorage.save(SHARE_MODE_KEY, SHARE_MODES.URL);

      // Actualizar URL del navegador
      history.replaceState({}, '', result.url);

      toast.success('Enlace compartido creado');
      this.setStatus(SYNC_STATUS.SYNCED);

      return result.url;
    } else {
      toast.error(result.message || 'Error al crear enlace');
      this.setStatus(SYNC_STATUS.ERROR);
      return null;
    }
  }

  /**
   * Obtiene la URL actual de compartir (si existe)
   */
  getShareURL() {
    if (this.shareMode === SHARE_MODES.URL && urlShareManager.hasSharedData()) {
      return window.location.href;
    }
    return null;
  }

  /**
   * Actualiza el enlace compartido con nuevos datos
   */
  async updateShareURL(data) {
    if (this.shareMode !== SHARE_MODES.URL) {
      return false;
    }

    this.setStatus(SYNC_STATUS.SAVING);

    const result = await urlShareManager.createShareURL(data);

    if (result.success) {
      // Actualizar URL del navegador
      history.replaceState({}, '', result.url);
      this.setStatus(SYNC_STATUS.SYNCED);
      return true;
    } else {
      toast.error('Error al actualizar enlace compartido');
      this.setStatus(SYNC_STATUS.ERROR);
      return false;
    }
  }

  /**
   * Genera código QR del enlace compartido
   */
  generateQRCode(size = 300) {
    const url = this.getShareURL();
    if (!url) {
      toast.warning('No hay enlace compartido activo');
      return null;
    }
    return urlShareManager.generateQRCode(url, size);
  }

  /**
   * Deja de compartir (vuelve a modo local)
   */
  async leaveShare() {
    if (this.shareMode === SHARE_MODES.NONE) {
      toast.info('No estás compartiendo');
      return false;
    }

    const confirmed = window.confirm(
      '¿Dejar de compartir? Los datos seguirán guardados localmente en este dispositivo.'
    );

    if (!confirmed) return false;

    // Limpiar URL
    urlShareManager.clearShareParams();

    // Resetear modo
    this.shareMode = SHARE_MODES.NONE;
    await localStorage.save(SHARE_MODE_KEY, SHARE_MODES.NONE);

    toast.info('Has dejado de compartir');
    this.setStatus(SYNC_STATUS.IDLE);

    return true;
  }

  /**
   * Actualiza el estado de sincronización
   */
  setStatus(newStatus) {
    if (this.status !== newStatus) {
      this.status = newStatus;
      if (this.onStatusChange) {
        this.onStatusChange(newStatus);
      }
    }
  }

  /**
   * Obtiene información del estado de sincronización
   */
  getSyncInfo() {
    return {
      mode: this.shareMode,
      status: this.status,
      isSharing: this.shareMode !== SHARE_MODES.NONE,
      shareUrl: this.getShareURL(),
      backend: this.shareMode === SHARE_MODES.URL ? 'URL (Local First)' :
               this.shareMode === SHARE_MODES.SUPABASE ? 'Supabase (Legacy)' :
               'Local Only'
    };
  }

  /**
   * Verifica si Supabase está configurado
   */
  get hasSupabaseConfig() {
    return this.supabaseConfig.enabled;
  }

  /**
   * Exporta todos los datos locales (para backup)
   */
  async exportAllData() {
    const state = await localStorage.load(STORAGE_KEY);
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `a-medias-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();

    URL.revokeObjectURL(url);
    toast.success('Backup descargado');
  }

  /**
   * Importa datos desde un archivo backup
   */
  async importData(file) {
    try {
      const text = await file.text();
      const data = JSON.parse(text);

      await this.saveLocal(data);

      if (this.onStateChange) {
        this.onStateChange(data);
      }

      toast.success('Datos importados correctamente');
      return true;
    } catch (error) {
      logger.error('[HybridSync] Error importando datos:', error);
      toast.error('Error al importar datos');
      return false;
    }
  }

  /**
   * Limpia todos los datos (reset completo)
   */
  async clearAllData() {
    const confirmed = window.confirm(
      '¿Estás seguro? Esto eliminará TODOS tus datos permanentemente.'
    );

    if (!confirmed) return false;

    await localStorage.clear();
    this.shareMode = SHARE_MODES.NONE;
    urlShareManager.clearShareParams();

    toast.success('Datos eliminados');
    window.location.reload();

    return true;
  }
}

// Exportar instancia singleton
const hybridSync = new HybridSyncManager();

export default hybridSync;
export { SHARE_MODES };
