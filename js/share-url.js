// share-url.js - Sistema de compartir datos vía URL (sin backend)
// Los datos se comprimen, codifican en base64 y se incluyen en la URL

import { logger } from './utils.js';

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
 * Genera un hash simple de los datos (para verificación)
 */
function simpleHash(data) {
  const str = JSON.stringify(data);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

class URLShareManager {
  constructor() {
    this.maxUrlLength = 8000; // Límite seguro para URLs
  }

  /**
   * Crea una URL compartible con los datos
   */
  async createShareURL(data) {
    try {
      // Comprimir datos
      const compressed = await compressData(data);
      const base64 = arrayToBase64(compressed);

      // Generar hash para verificación
      const hash = simpleHash(data);

      // Construir URL
      const baseUrl = window.location.origin + window.location.pathname;
      const url = new URL(baseUrl);
      url.searchParams.set('d', base64);
      url.searchParams.set('h', hash);
      url.searchParams.set('v', '1'); // versión del formato

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

      logger.log('[ShareURL] URL creada:', finalUrl.length, 'caracteres');

      return {
        success: true,
        url: finalUrl,
        size: finalUrl.length,
        compressed: true
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
   * Lee datos de URL compartida
   */
  async readShareURL(url = window.location.href) {
    try {
      const urlObj = new URL(url);
      const base64 = urlObj.searchParams.get('d');
      const hash = urlObj.searchParams.get('h');
      const version = urlObj.searchParams.get('v');

      if (!base64) {
        return {
          success: false,
          error: 'no_data',
          message: 'No hay datos en la URL'
        };
      }

      // Decodificar y descomprimir
      const compressed = base64ToArray(base64);
      const data = await decompressData(compressed);

      // Verificar hash si existe
      if (hash) {
        const expectedHash = simpleHash(data);
        if (hash !== expectedHash) {
          logger.warn('[ShareURL] Hash no coincide, datos posiblemente corruptos');
        }
      }

      logger.log('[ShareURL] Datos leídos desde URL, versión:', version);

      return {
        success: true,
        data,
        version: version || '1'
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
    history.replaceState({}, '', url);
  }

  /**
   * Genera un código QR (data URL) para compartir fácilmente
   * Usa una API pública gratuita
   */
  generateQRCode(url, size = 300) {
    const encoded = encodeURIComponent(url);
    return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encoded}`;
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
