// utils.js - Funciones de utilidad

/**
 * Logger condicional que solo muestra mensajes en desarrollo
 */
const isDev = ['localhost', '127.0.0.1'].includes(location?.hostname) ||
  location?.hostname?.startsWith('192.168.');

export const logger = {
  log: (...args) => isDev && console.log(...args),
  warn: (...args) => isDev && console.warn(...args),
  error: (...args) => console.error(...args), // Errores siempre visibles
  info: (...args) => isDev && console.info(...args),
};

/**
 * Formatea un número como moneda EUR
 */
export const formatMoney = (amount) => {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

/**
 * Formatea un número como porcentaje
 */
export const formatPercent = (value) => {
  return new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
};

/**
 * Redondea a 2 decimales evitando errores de punto flotante
 */
export const round2 = (value) => {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
};

/**
 * Calcula la proporción de ingresos para reparto
 * @param {number} income1 - Primer ingreso
 * @param {number} income2 - Segundo ingreso
 * @returns {number} Proporción del primer ingreso (entre 0 y 1)
 */
export const calculateProportion = (income1, income2) => {
  const total = income1 + income2;
  if (total <= 0) return 0.5;
  return Math.min(1, Math.max(0, income1 / total));
};

/**
 * Escapa HTML para prevenir XSS
 */
export const escapeHtml = (str) => {
  const escapeMap = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return String(str ?? '').replace(/[&<>"']/g, (ch) => escapeMap[ch] || ch);
};

/**
 * Obtiene la fecha actual en formato ISO (YYYY-MM-DD)
 */
export const todayISO = () => {
  return new Date().toISOString().slice(0, 10);
};

/**
 * Genera un UUID v4 con crypto.randomUUID o fallback
 */
export const generateUUID = () => {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }
  // Fallback robusto
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

/**
 * Genera un token aleatorio de longitud específica
 */
export const randomToken = (length = 22) => {
  const alphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const array = new Uint32Array(length);

  if (window.crypto?.getRandomValues) {
    window.crypto.getRandomValues(array);
  } else {
    // Fallback menos seguro
    for (let i = 0; i < length; i++) {
      array[i] = Math.floor(Math.random() * alphabet.length);
    }
  }

  return Array.from(array, (num) => alphabet[num % alphabet.length]).join('');
};

/**
 * Cache de elementos del DOM para mejorar performance
 */
const elementCache = new Map();

export const getElement = (id) => {
  if (!elementCache.has(id)) {
    const element = document.getElementById(id);
    if (element) {
      elementCache.set(id, element);
    }
    return element;
  }
  return elementCache.get(id);
};

/**
 * Limpia la cache de elementos (útil si se reconstruye el DOM)
 */
export const clearElementCache = () => {
  elementCache.clear();
};

/**
 * Lee un valor numérico de un input, con validación
 */
export const readNumber = (elementId, options = {}) => {
  const { allowNegative = false, defaultValue = 0 } = options;
  const element = getElement(elementId);

  if (!element) return defaultValue;

  let value = String(element.value ?? '').replace(',', '.');
  value = parseFloat(value);

  if (Number.isNaN(value)) return defaultValue;
  if (!allowNegative) value = Math.max(0, value);

  return value;
};

/**
 * Debounce: retrasa la ejecución de una función
 */
export const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

/**
 * Copia texto al portapapeles
 */
export const copyToClipboard = async (text) => {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    // Fallback para navegadores antiguos
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const success = document.execCommand('copy');
    document.body.removeChild(textarea);
    return success;
  } catch (error) {
    console.error('Error copiando al portapapeles:', error);
    return false;
  }
};

/**
 * Comprueba si el usuario está online
 */
export const isOnline = () => {
  return navigator.onLine;
};

/**
 * Hash simple de un objeto para detectar cambios
 */
export const hashObject = (obj) => {
  try {
    return JSON.stringify(obj ?? {});
  } catch {
    return '';
  }
};

/**
 * Formatea fecha y hora
 */
export const formatDateTime = (isoDateTime) => {
  try {
    const date = new Date(isoDateTime);
    return new Intl.DateTimeFormat('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  } catch {
    return isoDateTime;
  }
};

/**
 * Manejo seguro de localStorage con try-catch
 */
export const storage = {
  get(key, defaultValue = null) {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
      console.error(`Error leyendo localStorage[${key}]:`, error);
      return defaultValue;
    }
  },

  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error(`Error escribiendo localStorage[${key}]:`, error);
      return false;
    }
  },

  remove(key) {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      console.error(`Error eliminando localStorage[${key}]:`, error);
      return false;
    }
  },

  clear() {
    try {
      localStorage.clear();
      return true;
    } catch (error) {
      console.error('Error limpiando localStorage:', error);
      return false;
    }
  },
};
