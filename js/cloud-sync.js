// cloud-sync.js - Sincronización end-to-end-cifrada con backend minimal (Netlify Blobs)
//
// El servidor solo ve un blob opaco por sesión. La clave de descifrado vive en el
// fragment (#) del URL y nunca sale del navegador.
//
// - sessionId: UUID random generado en el cliente (22 chars). Viaja en la query string.
// - key: AES-GCM 256 bits, exportada a base64 URL-safe. Viaja en el hash (#). Se guarda
//   localmente para sobrevivir a recargas, pero quien quiera acceder desde otro dispositivo
//   necesita el URL completo (id + key).
//
// Flujo Level 0: sin sesión cloud, todo local.
// Flujo Level 1: "Sincroniza mis dispositivos" crea una sesión y muestra el URL/QR.
// Flujo Level 2: "Compartir con pareja" reutiliza la sesión (o la crea) y muestra el URL
//                tras aceptar un aviso.

import { logger } from './utils.js';
import localStorage from './storage-local.js';

const SESSION_STORE_KEY = 'a_medias_cloud_session';
const SYNC_ENDPOINT = '/.netlify/functions/sync';
const POLL_INTERVAL_MS = 25_000;
const PUSH_DEBOUNCE_MS = 1_200;

// ==================== base64 URL-safe ====================

function toUrlSafeBase64(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromUrlSafeBase64(str) {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// ==================== Crypto ====================

async function generateKey() {
  return await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}

async function exportKey(key) {
  const raw = await crypto.subtle.exportKey('raw', key);
  return toUrlSafeBase64(new Uint8Array(raw));
}

async function importKey(keyBase64) {
  const raw = fromUrlSafeBase64(keyBase64);
  return await crypto.subtle.importKey(
    'raw',
    raw,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}

async function encryptJSON(state, key) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(state));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);
  return {
    data: toUrlSafeBase64(new Uint8Array(ciphertext)),
    iv: toUrlSafeBase64(iv),
  };
}

async function decryptJSON({ data, iv }, key) {
  const cipher = fromUrlSafeBase64(data);
  const ivBytes = fromUrlSafeBase64(iv);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: ivBytes }, key, cipher);
  return JSON.parse(new TextDecoder().decode(plain));
}

function generateSessionId() {
  return toUrlSafeBase64(crypto.getRandomValues(new Uint8Array(16)));
}

// ==================== Manager ====================

export const CLOUD_STATUS = {
  IDLE: 'idle',
  SAVING: 'saving',
  SYNCED: 'synced',
  OFFLINE: 'offline',
  ERROR: 'error',
};

class CloudSyncManager {
  constructor() {
    this.sessionId = null;
    this.key = null;
    this.keyBase64 = null;
    this.lastKnownVersion = 0;
    this.lastSyncedAt = null;
    this.pushTimer = null;
    this.pollTimer = null;
    this.visibilityHandler = null;
    this.status = CLOUD_STATUS.IDLE;

    this.onRemoteState = null;
    this.onStatusChange = null;
  }

  /**
   * Inicializa: adopta sesión desde URL si la hay, o desde localStorage si existe.
   * Retorna true si quedó con una sesión activa.
   */
  async init() {
    const url = new URL(window.location.href);
    const urlId = url.searchParams.get('s');
    const urlKey = url.hash.slice(1);

    if (urlId && urlKey) {
      try {
        await this.adoptSession(urlId, urlKey);
        // Limpiar fragment para que no quede "colgando" en la barra de direcciones,
        // pero conservamos el "?s=..." como guiño visible.
        url.hash = '';
        history.replaceState({}, '', url.toString());
        return true;
      } catch (err) {
        logger.error('[CloudSync] Error adoptando sesión desde URL:', err);
      }
    }

    const saved = await localStorage.load(SESSION_STORE_KEY);
    if (saved && saved.sessionId && saved.keyBase64) {
      try {
        this.sessionId = saved.sessionId;
        this.keyBase64 = saved.keyBase64;
        this.key = await importKey(saved.keyBase64);
        this.lastKnownVersion = saved.lastKnownVersion || 0;
        this.startPolling();
        // Intentar pull inmediato para traer cambios que llegaron mientras no estábamos
        this.pull();
        return true;
      } catch (err) {
        logger.error('[CloudSync] Error restaurando sesión local:', err);
        await localStorage.remove(SESSION_STORE_KEY);
      }
    }

    return false;
  }

  isActive() {
    return !!(this.sessionId && this.key);
  }

  /**
   * Crea una sesión nueva y sube el estado actual. Arranca polling.
   */
  async createSession(currentState) {
    this.sessionId = generateSessionId();
    this.key = await generateKey();
    this.keyBase64 = await exportKey(this.key);
    this.lastKnownVersion = 0;
    await this.persistSession();
    await this.push(currentState, { force: true });
    this.startPolling();
    return this.getShareURL();
  }

  /**
   * Adopta una sesión existente (otro dispositivo) y descarga su estado.
   * Dispara onRemoteState con lo recibido.
   */
  async adoptSession(sessionId, keyBase64) {
    this.sessionId = sessionId;
    this.keyBase64 = keyBase64;
    this.key = await importKey(keyBase64);
    this.lastKnownVersion = 0;
    await this.persistSession();
    await this.pull();
    this.startPolling();
  }

  /**
   * Sale de la sesión cloud. Los datos siguen guardados localmente.
   */
  async leaveSession() {
    this.stopPolling();
    if (this.pushTimer) {
      clearTimeout(this.pushTimer);
      this.pushTimer = null;
    }
    this.sessionId = null;
    this.key = null;
    this.keyBase64 = null;
    this.lastKnownVersion = 0;
    this.lastSyncedAt = null;
    await localStorage.remove(SESSION_STORE_KEY);

    const url = new URL(window.location.href);
    url.searchParams.delete('s');
    url.hash = '';
    history.replaceState({}, '', url.toString());

    this.setStatus(CLOUD_STATUS.IDLE);
  }

  getShareURL() {
    if (!this.isActive()) return null;
    const url = new URL(window.location.origin + window.location.pathname);
    url.searchParams.set('s', this.sessionId);
    url.hash = this.keyBase64;
    return url.toString();
  }

  getInfo() {
    return {
      active: this.isActive(),
      sessionId: this.sessionId,
      version: this.lastKnownVersion,
      lastSyncedAt: this.lastSyncedAt,
      status: this.status,
      shareUrl: this.getShareURL(),
    };
  }

  async persistSession() {
    if (!this.isActive()) return;
    await localStorage.save(SESSION_STORE_KEY, {
      sessionId: this.sessionId,
      keyBase64: this.keyBase64,
      lastKnownVersion: this.lastKnownVersion,
    });
  }

  // -------- push / pull --------

  /**
   * Sube el estado cifrado al backend. Debounced para no saturar.
   */
  pushDebounced(state) {
    if (!this.isActive()) return;
    if (this.pushTimer) clearTimeout(this.pushTimer);
    this.pushTimer = setTimeout(() => {
      this.pushTimer = null;
      this.push(state);
    }, PUSH_DEBOUNCE_MS);
  }

  async push(state, { force = false } = {}) {
    if (!this.isActive()) return false;
    if (!navigator.onLine) {
      this.setStatus(CLOUD_STATUS.OFFLINE);
      return false;
    }

    try {
      this.setStatus(CLOUD_STATUS.SAVING);
      const { data, iv } = await encryptJSON(state, this.key);
      const response = await fetch(`${SYNC_ENDPOINT}?id=${encodeURIComponent(this.sessionId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data, iv }),
      });

      if (!response.ok) {
        logger.warn('[CloudSync] push respuesta no-ok:', response.status);
        this.setStatus(CLOUD_STATUS.ERROR);
        return false;
      }

      const record = await response.json();
      this.lastKnownVersion = record.version;
      this.lastSyncedAt = record.updatedAt;
      await this.persistSession();
      this.setStatus(CLOUD_STATUS.SYNCED);
      return true;
    } catch (err) {
      logger.error('[CloudSync] push error:', err);
      this.setStatus(navigator.onLine ? CLOUD_STATUS.ERROR : CLOUD_STATUS.OFFLINE);
      return false;
    }
  }

  async pull() {
    if (!this.isActive()) return null;
    if (!navigator.onLine) {
      this.setStatus(CLOUD_STATUS.OFFLINE);
      return null;
    }

    try {
      const response = await fetch(`${SYNC_ENDPOINT}?id=${encodeURIComponent(this.sessionId)}`, {
        method: 'GET',
        cache: 'no-store',
      });

      if (response.status === 404) {
        // Sesión nueva: el servidor aún no tiene nada
        this.setStatus(CLOUD_STATUS.SYNCED);
        return null;
      }

      if (!response.ok) {
        this.setStatus(CLOUD_STATUS.ERROR);
        return null;
      }

      const record = await response.json();
      if (!record || typeof record.data !== 'string') return null;

      if (record.version <= this.lastKnownVersion) {
        this.setStatus(CLOUD_STATUS.SYNCED);
        return null;
      }

      const state = await decryptJSON({ data: record.data, iv: record.iv }, this.key);
      this.lastKnownVersion = record.version;
      this.lastSyncedAt = record.updatedAt;
      await this.persistSession();
      this.setStatus(CLOUD_STATUS.SYNCED);

      if (this.onRemoteState) {
        this.onRemoteState(state);
      }
      return state;
    } catch (err) {
      logger.error('[CloudSync] pull error:', err);
      this.setStatus(navigator.onLine ? CLOUD_STATUS.ERROR : CLOUD_STATUS.OFFLINE);
      return null;
    }
  }

  startPolling() {
    this.stopPolling();
    this.pollTimer = setInterval(() => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        this.pull();
      }
    }, POLL_INTERVAL_MS);

    this.visibilityHandler = () => {
      if (document.visibilityState === 'visible' && this.isActive() && navigator.onLine) {
        this.pull();
      }
    };
    document.addEventListener('visibilitychange', this.visibilityHandler);
    window.addEventListener('online', this.visibilityHandler);
  }

  stopPolling() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    if (this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      window.removeEventListener('online', this.visibilityHandler);
      this.visibilityHandler = null;
    }
  }

  setStatus(status) {
    if (this.status === status) return;
    this.status = status;
    if (this.onStatusChange) this.onStatusChange(status);
  }
}

const cloudSync = new CloudSyncManager();
export default cloudSync;
