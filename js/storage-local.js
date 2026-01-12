// storage-local.js - Sistema de almacenamiento Local First con IndexedDB
// Este sistema NO requiere backend y funciona 100% offline

import { logger } from './utils.js';

const DB_NAME = 'a_medias_db';
const DB_VERSION = 1;
const STORE_NAME = 'app_state';

class LocalStorage {
  constructor() {
    this.db = null;
    this.ready = false;
    this.initPromise = this.initDB();
  }

  /**
   * Inicializa IndexedDB
   */
  async initDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        logger.error('[LocalStorage] Error abriendo IndexedDB:', request.error);
        // Fallback a localStorage si IndexedDB falla
        this.useFallback = true;
        resolve();
      };

      request.onsuccess = () => {
        this.db = request.result;
        this.ready = true;
        logger.log('[LocalStorage] IndexedDB inicializado');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Crear object store si no existe
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'key' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          logger.log('[LocalStorage] Object store creado');
        }
      };
    });
  }

  /**
   * Espera a que la DB esté lista
   */
  async waitReady() {
    if (this.ready) return;
    await this.initPromise;
  }

  /**
   * Guarda datos en IndexedDB
   */
  async save(key, data) {
    await this.waitReady();

    // Fallback a localStorage
    if (this.useFallback) {
      try {
        localStorage.setItem(key, JSON.stringify(data));
        return true;
      } catch (error) {
        logger.error('[LocalStorage] Error guardando en localStorage:', error);
        return false;
      }
    }

    return new Promise((resolve) => {
      try {
        const transaction = this.db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);

        const record = {
          key,
          data,
          timestamp: Date.now()
        };

        const request = store.put(record);

        request.onsuccess = () => {
          logger.log(`[LocalStorage] Guardado: ${key}`);
          resolve(true);
        };

        request.onerror = () => {
          logger.error('[LocalStorage] Error guardando:', request.error);
          resolve(false);
        };
      } catch (error) {
        logger.error('[LocalStorage] Error en save:', error);
        resolve(false);
      }
    });
  }

  /**
   * Lee datos de IndexedDB
   */
  async load(key, defaultValue = null) {
    await this.waitReady();

    // Fallback a localStorage
    if (this.useFallback) {
      try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : defaultValue;
      } catch (error) {
        logger.error('[LocalStorage] Error leyendo de localStorage:', error);
        return defaultValue;
      }
    }

    return new Promise((resolve) => {
      try {
        const transaction = this.db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(key);

        request.onsuccess = () => {
          const result = request.result;
          resolve(result ? result.data : defaultValue);
        };

        request.onerror = () => {
          logger.error('[LocalStorage] Error leyendo:', request.error);
          resolve(defaultValue);
        };
      } catch (error) {
        logger.error('[LocalStorage] Error en load:', error);
        resolve(defaultValue);
      }
    });
  }

  /**
   * Elimina datos de IndexedDB
   */
  async remove(key) {
    await this.waitReady();

    // Fallback a localStorage
    if (this.useFallback) {
      try {
        localStorage.removeItem(key);
        return true;
      } catch (error) {
        logger.error('[LocalStorage] Error eliminando de localStorage:', error);
        return false;
      }
    }

    return new Promise((resolve) => {
      try {
        const transaction = this.db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(key);

        request.onsuccess = () => {
          logger.log(`[LocalStorage] Eliminado: ${key}`);
          resolve(true);
        };

        request.onerror = () => {
          logger.error('[LocalStorage] Error eliminando:', request.error);
          resolve(false);
        };
      } catch (error) {
        logger.error('[LocalStorage] Error en remove:', error);
        resolve(false);
      }
    });
  }

  /**
   * Lista todas las keys almacenadas
   */
  async listKeys() {
    await this.waitReady();

    // Fallback a localStorage
    if (this.useFallback) {
      return Object.keys(localStorage);
    }

    return new Promise((resolve) => {
      try {
        const transaction = this.db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAllKeys();

        request.onsuccess = () => {
          resolve(request.result || []);
        };

        request.onerror = () => {
          logger.error('[LocalStorage] Error listando keys:', request.error);
          resolve([]);
        };
      } catch (error) {
        logger.error('[LocalStorage] Error en listKeys:', error);
        resolve([]);
      }
    });
  }

  /**
   * Limpia todos los datos
   */
  async clear() {
    await this.waitReady();

    // Fallback a localStorage
    if (this.useFallback) {
      try {
        localStorage.clear();
        return true;
      } catch (error) {
        logger.error('[LocalStorage] Error limpiando localStorage:', error);
        return false;
      }
    }

    return new Promise((resolve) => {
      try {
        const transaction = this.db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.clear();

        request.onsuccess = () => {
          logger.log('[LocalStorage] Base de datos limpiada');
          resolve(true);
        };

        request.onerror = () => {
          logger.error('[LocalStorage] Error limpiando:', request.error);
          resolve(false);
        };
      } catch (error) {
        logger.error('[LocalStorage] Error en clear:', error);
        resolve(false);
      }
    });
  }

  /**
   * Obtiene estadísticas de almacenamiento
   */
  async getStats() {
    await this.waitReady();

    if (this.useFallback) {
      return {
        backend: 'localStorage',
        itemCount: Object.keys(localStorage).length,
        estimatedSize: new Blob([JSON.stringify(localStorage)]).size
      };
    }

    const keys = await this.listKeys();
    return {
      backend: 'IndexedDB',
      itemCount: keys.length,
      dbName: DB_NAME,
      version: DB_VERSION
    };
  }
}

// Exportar instancia singleton
const localStorage = new LocalStorage();

export default localStorage;
