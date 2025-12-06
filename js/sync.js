// sync.js - Sistema de sincronización con Supabase mejorado

import { getSupabaseConfig, SYNC_STATUS, TIMINGS } from './constants.js';
import { hashObject, randomToken, isOnline, logger } from './utils.js';
import toast from './toast.js';

// Configuración de reintentos
const MAX_RETRIES = 3;
const BASE_RETRY_DELAY = 2000; // 2 segundos base

class SyncManager {
  constructor() {
    this.shareId = null;
    this.shareKey = null;
    this.lastHash = null;
    this.lastSyncedAt = null;
    this.status = SYNC_STATUS.IDLE;
    this.pollTimer = null;
    this.saveTimer = null;
    this.retryTimer = null;
    this.retryCount = 0;
    this.isApplyingRemote = false;
    this.config = getSupabaseConfig();
    this.onStateChange = null; // Callback cuando cambia el estado remoto
    this.onStatusChange = null; // Callback cuando cambia el status de sync
  }

  /**
   * Calcula el delay con exponential backoff
   */
  getRetryDelay() {
    return Math.min(BASE_RETRY_DELAY * Math.pow(2, this.retryCount), 30000); // máximo 30s
  }

  /**
   * Resetea el contador de reintentos
   */
  resetRetries() {
    this.retryCount = 0;
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
  }

  /**
   * Verifica si está habilitado Supabase
   */
  get isEnabled() {
    return this.config.enabled;
  }

  /**
   * Verifica si hay una sesión compartida activa
   */
  get isSharing() {
    return Boolean(this.shareId && this.shareKey);
  }

  /**
   * Construye headers para requests de Supabase
   */
  buildHeaders(options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      'apikey': this.config.anonKey,
      'Authorization': `Bearer ${this.config.anonKey}`,
    };

    if (options.prefer) {
      headers['Prefer'] = options.prefer;
    }

    // Header personalizado para validación
    if (this.shareKey) {
      headers['X-Share-Key'] = this.shareKey;
    }

    return headers;
  }

  /**
   * Construye la URL del endpoint de Supabase
   */
  buildUrl(filters = {}) {
    const url = new URL(`${this.config.url}/rest/v1/${this.config.table}`);

    Object.entries(filters).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });

    return url.toString();
  }

  /**
   * Actualiza el estado interno
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
   * Inicializa desde URL (si hay parámetros share y key)
   */
  async initFromUrl() {
    if (!this.isEnabled) return false;

    const params = new URLSearchParams(window.location.search);
    const shareId = params.get('share');
    const shareKey = params.get('key');

    if (shareId && shareKey) {
      this.shareId = shareId;
      this.shareKey = shareKey;
      this.setStatus(SYNC_STATUS.LOADING);

      try {
        await this.fetchRemoteState();
        this.startPolling();
        this.updateUrl();
        toast.success('Conectado al enlace compartido');
        return true;
      } catch (error) {
        logger.error('[Sync] Error inicializando desde URL:', error);
        toast.error('No se pudo cargar el enlace compartido');
        this.clearShare();
        return false;
      }
    }

    return false;
  }

  /**
   * Crea un nuevo enlace compartido con los datos actuales
   */
  async createShare(currentState) {
    if (!this.isEnabled) {
      toast.warning('Configura Supabase para activar la sincronización');
      return false;
    }

    if (this.isSharing) {
      toast.info('Ya tienes un enlace compartido activo');
      return false;
    }

    this.setStatus(SYNC_STATUS.LOADING);

    const shareId = randomToken(16);
    const shareKey = randomToken(32);

    try {
      const response = await fetch(this.buildUrl(), {
        method: 'POST',
        headers: this.buildHeaders({ prefer: 'return=representation' }),
        body: JSON.stringify({
          share_id: shareId,
          share_key: shareKey,
          payload: currentState,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Supabase respondió ${response.status}: ${errorText}`);
      }

      const data = await response.json();

      this.shareId = shareId;
      this.shareKey = shareKey;
      this.lastHash = hashObject(currentState);
      this.lastSyncedAt = data?.[0]?.updated_at ? new Date(data[0].updated_at) : new Date();
      this.setStatus(SYNC_STATUS.SYNCED);

      this.updateUrl();
      this.startPolling();

      toast.success('Enlace compartido creado correctamente');
      return this.buildShareLink();
    } catch (error) {
      logger.error('[Sync] Error creando share:', error);
      this.setStatus(SYNC_STATUS.ERROR);
      toast.error('No se pudo crear el enlace. Verifica tu configuración de Supabase');
      return false;
    }
  }

  /**
   * Obtiene el estado remoto de Supabase
   */
  async fetchRemoteState(silent = false) {
    if (!this.isEnabled || !this.isSharing) return null;

    if (!isOnline()) {
      if (!silent) {
        toast.warning('Sin conexión a internet');
      }
      return null;
    }

    if (!silent) {
      this.setStatus(SYNC_STATUS.LOADING);
    }

    try {
      const url = this.buildUrl({
        select: 'payload,updated_at',
        share_id: `eq.${this.shareId}`,
        share_key: `eq.${this.shareKey}`,
        limit: '1',
      });

      const response = await fetch(url, {
        method: 'GET',
        headers: this.buildHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Supabase respondió ${response.status}`);
      }

      const rows = await response.json();

      if (!Array.isArray(rows) || rows.length === 0) {
        throw new Error('No se encontró el enlace compartido');
      }

      const row = rows[0];
      const payload = row?.payload || {};
      const incomingHash = hashObject(payload);

      // Solo aplicar si hay cambios
      if (this.lastHash !== incomingHash) {
        this.lastHash = incomingHash;
        this.lastSyncedAt = row?.updated_at ? new Date(row.updated_at) : new Date();

        // Llamar al callback para aplicar el estado
        if (this.onStateChange && !this.isApplyingRemote) {
          this.isApplyingRemote = true;
          try {
            await this.onStateChange(payload);
          } finally {
            this.isApplyingRemote = false;
          }
        }

        if (!silent) {
          toast.success('Datos sincronizados');
        }
      } else if (row?.updated_at) {
        this.lastSyncedAt = new Date(row.updated_at);
      }

      this.setStatus(SYNC_STATUS.SYNCED);
      this.resetRetries();
      return payload;
    } catch (error) {
      logger.error('[Sync] Error fetching remote state:', error);
      this.setStatus(SYNC_STATUS.ERROR);

      // Reintentar con exponential backoff hasta MAX_RETRIES
      if (this.retryCount < MAX_RETRIES) {
        const delay = this.getRetryDelay();
        this.retryCount++;

        if (!silent) {
          toast.error(`Error al sincronizar. Reintentando en ${Math.round(delay / 1000)}s...`);
        }

        this.retryTimer = setTimeout(() => {
          this.retryTimer = null;
          if (this.status === SYNC_STATUS.ERROR) {
            this.fetchRemoteState(true);
          }
        }, delay);
      } else {
        if (!silent) {
          toast.error('No se pudo sincronizar después de varios intentos');
        }
        this.resetRetries();
      }

      return null;
    }
  }

  /**
   * Guarda el estado actual en Supabase
   */
  async saveRemoteState(currentState) {
    if (!this.isEnabled || !this.isSharing || this.isApplyingRemote) {
      return false;
    }

    if (!isOnline()) {
      toast.warning('Sin conexión. Los cambios se guardarán cuando vuelvas online');
      return false;
    }

    this.setStatus(SYNC_STATUS.SAVING);

    try {
      const url = this.buildUrl({
        share_id: `eq.${this.shareId}`,
        share_key: `eq.${this.shareKey}`,
      });

      const response = await fetch(url, {
        method: 'PATCH',
        headers: this.buildHeaders({ prefer: 'return=representation' }),
        body: JSON.stringify({
          payload: currentState,
          updated_at: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Supabase respondió ${response.status}: ${errorText}`);
      }

      const data = await response.json();

      this.lastHash = hashObject(currentState);
      this.lastSyncedAt = data?.[0]?.updated_at ? new Date(data[0].updated_at) : new Date();
      this.setStatus(SYNC_STATUS.SYNCED);
      this.resetRetries();

      return true;
    } catch (error) {
      logger.error('[Sync] Error guardando estado remoto:', error);
      this.setStatus(SYNC_STATUS.ERROR);

      // Reintentar con exponential backoff hasta MAX_RETRIES
      if (this.retryCount < MAX_RETRIES) {
        const delay = this.getRetryDelay();
        this.retryCount++;

        this.retryTimer = setTimeout(() => {
          this.retryTimer = null;
          if (this.status === SYNC_STATUS.ERROR) {
            this.queueSave(currentState);
          }
        }, delay);
      } else {
        toast.error('No se pudieron guardar los cambios. Verifica tu conexión');
        this.resetRetries();
      }

      return false;
    }
  }

  /**
   * Encola un guardado con debounce
   */
  queueSave(currentState) {
    if (!this.isEnabled || !this.isSharing || this.isApplyingRemote) {
      return;
    }

    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
    }

    this.setStatus(SYNC_STATUS.SAVING);

    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      this.saveRemoteState(currentState);
    }, TIMINGS.SYNC_DEBOUNCE);
  }

  /**
   * Inicia el polling para obtener cambios remotos
   */
  startPolling() {
    this.stopPolling();

    if (!this.isSharing) return;

    this.pollTimer = setInterval(() => {
      this.fetchRemoteState(true);
    }, TIMINGS.SYNC_POLL_INTERVAL);
  }

  /**
   * Detiene el polling
   */
  stopPolling() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  /**
   * Construye el enlace compartible
   */
  buildShareLink() {
    if (!this.isSharing) return null;

    const url = new URL(window.location.href);
    url.searchParams.set('share', this.shareId);
    url.searchParams.set('key', this.shareKey);
    url.hash = '';
    return url.toString();
  }

  /**
   * Actualiza la URL del navegador con los parámetros de share
   */
  updateUrl() {
    if (!this.isSharing) return;

    const url = new URL(window.location.href);
    url.searchParams.set('share', this.shareId);
    url.searchParams.set('key', this.shareKey);
    url.hash = '';
    history.replaceState({}, '', url);
  }

  /**
   * Limpia los parámetros de share de la URL
   */
  clearUrlParams() {
    const url = new URL(window.location.href);
    url.searchParams.delete('share');
    url.searchParams.delete('key');
    history.replaceState({}, '', url);
  }

  /**
   * Sale del enlace compartido
   */
  leaveShare() {
    const confirmed = window.confirm(
      'Dejarás de sincronizar este enlace. Los datos seguirán guardados localmente. ¿Continuar?'
    );

    if (!confirmed) return false;

    this.clearShare();
    toast.info('Has salido del enlace compartido');
    return true;
  }

  /**
   * Limpia el estado de compartición
   */
  clearShare() {
    this.stopPolling();
    this.shareId = null;
    this.shareKey = null;
    this.lastHash = null;
    this.lastSyncedAt = null;
    this.setStatus(SYNC_STATUS.IDLE);
    this.clearUrlParams();
  }

  /**
   * Obtiene información sobre el estado de sincronización
   */
  getSyncInfo() {
    return {
      isSharing: this.isSharing,
      status: this.status,
      lastSyncedAt: this.lastSyncedAt,
      shareLink: this.buildShareLink(),
    };
  }
}

// Exportar instancia singleton
const syncManager = new SyncManager();

export default syncManager;
