// share-url.js - Sistema de compartir datos vía URL (sin backend)
// Los datos se comprimen, CIFRAN (AES-GCM), y codifican en base64 en la URL
// La clave de cifrado va en el hash (#) de la URL, que NO se envía al servidor

import { logger } from './utils.js';

// ==================== CIFRADO AES-GCM ====================

/**
 * Genera una clave AES-GCM de 256 bits
 */
async function generateEncryptionKey() {
  return await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true, // exportable
    ['encrypt', 'decrypt']
  );
}

/**
 * Exporta una CryptoKey a formato base64 URL-safe
 */
async function exportKey(key) {
  const rawKey = await crypto.subtle.exportKey('raw', key);
  return arrayToBase64(new Uint8Array(rawKey));
}

/**
 * Importa una clave desde base64 URL-safe
 */
async function importKey(base64Key) {
  const rawKey = base64ToArray(base64Key);
  return await crypto.subtle.importKey(
    'raw',
    rawKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );
}

/**
 * Cifra datos con AES-GCM
 * @returns {Object} { iv, ciphertext } - IV y datos cifrados
 */
async function encryptData(data, key) {
  const iv = crypto.getRandomValues(new Uint8Array(12)); // 96 bits IV para GCM
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    data
  );
  return {
    iv,
    ciphertext: new Uint8Array(ciphertext)
  };
}

/**
 * Descifra datos con AES-GCM
 */
async function decryptData(ciphertext, key, iv) {
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext
  );
  return new Uint8Array(plaintext);
}

// ==================== COMPRESIÓN ====================

/**
 * Comprime datos usando CompressionStream (si está disponible) o fallback
 */
async function compressData(data) {
  const jsonString = JSON.stringify(data);

  // Intentar usar CompressionStream (API moderna)
  if ('CompressionStream' in window) {
    try {
      const blob = new Blob([jsonString]);
      const stream = blob.stream().pipeThrough(new CompressionStream('gzip'));
      const compressedBlob = await new Response(stream).blob();
      const arrayBuffer = await compressedBlob.arrayBuffer();
      return new Uint8Array(arrayBuffer);
    } catch (error) {
      logger.warn('[ShareURL] CompressionStream falló, usando fallback:', error);
    }
  }

  // Fallback: simplemente convertir a bytes UTF-8
  const encoder = new TextEncoder();
  return encoder.encode(jsonString);
}

/**
 * Descomprime datos
 */
async function decompressData(uint8Array) {
  // Intentar usar DecompressionStream
  if ('DecompressionStream' in window) {
    try {
      const blob = new Blob([uint8Array]);
      const stream = blob.stream().pipeThrough(new DecompressionStream('gzip'));
      const decompressedBlob = await new Response(stream).blob();
      const text = await decompressedBlob.text();
      return JSON.parse(text);
    } catch (error) {
      logger.warn('[ShareURL] DecompressionStream falló, usando fallback:', error);
    }
  }

  // Fallback: decodificar UTF-8 directamente
  const decoder = new TextDecoder();
  const text = decoder.decode(uint8Array);
  return JSON.parse(text);
}

// ==================== UTILIDADES BASE64 ====================

/**
 * Convierte Uint8Array a string base64 URL-safe
 */
function arrayToBase64(array) {
  let binary = '';
  const len = array.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(array[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Convierte string base64 URL-safe a Uint8Array
 */
function base64ToArray(base64) {
  const binary = atob(
    base64
      .replace(/-/g, '+')
      .replace(/_/g, '/')
  );
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Genera hash SHA-256 para verificación de integridad
 */
async function sha256Hash(data) {
  const msgBuffer = new TextEncoder().encode(JSON.stringify(data));
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = new Uint8Array(hashBuffer);
  // Retornar solo los primeros 8 bytes en base64 (suficiente para verificación)
  return arrayToBase64(hashArray.slice(0, 8));
}

class URLShareManager {
  constructor() {
    this.maxUrlLength = 8000; // Límite seguro para URLs
  }

  /**
   * Crea una URL compartible con los datos CIFRADOS
   * La clave va en el hash (#) de la URL, que NO se envía al servidor
   */
  async createShareURL(data) {
    try {
      // 1. Comprimir datos
      const compressed = await compressData(data);

      // 2. Generar clave de cifrado
      const key = await generateEncryptionKey();
      const keyBase64 = await exportKey(key);

      // 3. Cifrar datos comprimidos
      const { iv, ciphertext } = await encryptData(compressed, key);

      // 4. Combinar IV + ciphertext
      const combined = new Uint8Array(iv.length + ciphertext.length);
      combined.set(iv, 0);
      combined.set(ciphertext, iv.length);
      const encryptedBase64 = arrayToBase64(combined);

      // 5. Generar hash para verificación de integridad
      const hash = await sha256Hash(data);

      // 6. Construir URL
      const baseUrl = window.location.origin + window.location.pathname;
      const url = new URL(baseUrl);
      url.searchParams.set('d', encryptedBase64);
      url.searchParams.set('h', hash);
      url.searchParams.set('v', '2'); // versión 2 = cifrado

      // La clave va en el hash (#) - NO se envía al servidor
      url.hash = keyBase64;

      const finalUrl = url.toString();

      // Verificar longitud
      if (finalUrl.length > this.maxUrlLength) {
        logger.warn('[ShareURL] URL muy larga:', finalUrl.length);
        return {
          success: false,
          error: 'too_large',
          message: 'Los datos son demasiado grandes para compartir vía URL',
          size: finalUrl.length,
          maxSize: this.maxUrlLength
        };
      }

      logger.log('[ShareURL] URL cifrada creada:', finalUrl.length, 'caracteres');

      return {
        success: true,
        url: finalUrl,
        size: finalUrl.length,
        encrypted: true
      };
    } catch (error) {
      logger.error('[ShareURL] Error creando URL:', error);
      return {
        success: false,
        error: 'encode_failed',
        message: 'Error al codificar los datos',
        details: error.message
      };
    }
  }

  /**
   * Lee datos de URL compartida (soporta v1 sin cifrar y v2 cifrada)
   */
  async readShareURL(url = window.location.href) {
    try {
      const urlObj = new URL(url);
      const base64 = urlObj.searchParams.get('d');
      const hash = urlObj.searchParams.get('h');
      const version = urlObj.searchParams.get('v') || '1';
      const keyBase64 = urlObj.hash.slice(1); // Quitar el # inicial

      if (!base64) {
        return {
          success: false,
          error: 'no_data',
          message: 'No hay datos en la URL'
        };
      }

      let data;

      // Versión 2: datos cifrados
      if (version === '2') {
        if (!keyBase64) {
          return {
            success: false,
            error: 'no_key',
            message: 'Falta la clave de descifrado en la URL'
          };
        }

        // Decodificar e importar clave
        const key = await importKey(keyBase64);

        // Separar IV (12 bytes) y ciphertext
        const combined = base64ToArray(base64);
        const iv = combined.slice(0, 12);
        const ciphertext = combined.slice(12);

        // Descifrar
        const decrypted = await decryptData(ciphertext, key, iv);

        // Descomprimir
        data = await decompressData(decrypted);

        logger.log('[ShareURL] Datos descifrados desde URL v2');
      } else {
        // Versión 1 (legacy): datos solo comprimidos
        const compressed = base64ToArray(base64);
        data = await decompressData(compressed);

        logger.log('[ShareURL] Datos leídos desde URL v1 (legacy, sin cifrar)');
      }

      // Verificar hash si existe
      if (hash) {
        const expectedHash = version === '2'
          ? await sha256Hash(data)
          : this._legacyHash(data);
        if (hash !== expectedHash) {
          logger.warn('[ShareURL] Hash no coincide, datos posiblemente corruptos');
        }
      }

      return {
        success: true,
        data,
        version,
        encrypted: version === '2'
      };
    } catch (error) {
      logger.error('[ShareURL] Error leyendo URL:', error);
      return {
        success: false,
        error: 'decode_failed',
        message: 'Error al decodificar los datos de la URL',
        details: error.message
      };
    }
  }

  /**
   * Hash legacy para compatibilidad con v1
   */
  _legacyHash(data) {
    const str = JSON.stringify(data);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Verifica si la URL actual contiene datos compartidos
   */
  hasSharedData(url = window.location.href) {
    try {
      const urlObj = new URL(url);
      return urlObj.searchParams.has('d');
    } catch (error) {
      return false;
    }
  }

  /**
   * Limpia los parámetros de compartir de la URL
   */
  clearShareParams() {
    const url = new URL(window.location.href);
    url.searchParams.delete('d');
    url.searchParams.delete('h');
    url.searchParams.delete('v');
    url.hash = ''; // Limpiar también la clave de cifrado
    history.replaceState({}, '', url);
  }

  /**
   * Genera un código QR localmente usando Canvas
   * No envía datos a ningún servidor externo
   * @returns {Promise<string>} Data URL de la imagen QR
   */
  async generateQRCode(url, size = 300) {
    try {
      // Usar librería QR Code Generator local (si está disponible)
      if (typeof QRCode !== 'undefined') {
        const canvas = document.createElement('canvas');
        await QRCode.toCanvas(canvas, url, { width: size, margin: 2 });
        return canvas.toDataURL('image/png');
      }

      // Fallback: Generar QR simple con Canvas API
      // Nota: Esta es una implementación básica, para producción usar librería qrcode
      logger.warn('[ShareURL] QRCode library not found, QR generation disabled');
      return null;
    } catch (error) {
      logger.error('[ShareURL] Error generando QR:', error);
      return null;
    }
  }

  /**
   * Estima el tamaño de los datos antes de crear URL
   */
  async estimateSize(data) {
    try {
      const compressed = await compressData(data);
      const base64 = arrayToBase64(compressed);
      const estimatedUrlLength = window.location.origin.length +
        window.location.pathname.length +
        base64.length + 100; // + parámetros

      return {
        compressed: compressed.length,
        base64: base64.length,
        estimatedUrl: estimatedUrlLength,
        canShare: estimatedUrlLength <= this.maxUrlLength,
        compressionRatio: (compressed.length / JSON.stringify(data).length * 100).toFixed(1) + '%'
      };
    } catch (error) {
      logger.error('[ShareURL] Error estimando tamaño:', error);
      return null;
    }
  }
}

// Exportar instancia singleton
const urlShareManager = new URLShareManager();

export default urlShareManager;
