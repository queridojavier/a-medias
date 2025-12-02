// constants.js - Configuración y constantes de la aplicación

export const APP_VERSION = '2.0.0';

// Timings (en milisegundos)
export const TIMINGS = {
  SYNC_POLL_INTERVAL: 8000,        // Polling para sincronización remota
  SYNC_DEBOUNCE: 300,              // Debounce para guardar cambios
  CALC_DEBOUNCE: 80,               // Debounce para recalcular
  TOAST_DURATION: 4000,            // Duración de notificaciones
  RETRY_DELAY: 5000,               // Delay para reintentar tras error
};

// Storage keys
export const STORAGE_KEYS = {
  CALC_STATE: 'a_medias_calc_state',
  REIMBURSEMENTS: 'a_medias_reimbursements',
  ACTIVE_TAB: 'a_medias_active_tab',
  STATE_VERSION: 'a_medias_state_version',
};

// Estado de sincronización
export const SYNC_STATUS = {
  IDLE: 'idle',
  LOADING: 'loading',
  SAVING: 'saving',
  SYNCED: 'synced',
  ERROR: 'error',
};

// Tipos de notificación
export const TOAST_TYPES = {
  INFO: 'info',
  SUCCESS: 'success',
  WARNING: 'warning',
  ERROR: 'error',
};

// Modos de reparto
export const SPLIT_MODES = {
  PROPORTIONAL: 'prop',
  EQUAL: 'eq',
};

// Tabs de la aplicación
export const TABS = {
  CALC: 'calc',
  REIMBURSE: 'reimburse',
  SPLIT: 'split',
};

// Estado de data version para migraciones
export const DATA_VERSION = 2;

// Valores por defecto
export const DEFAULTS = {
  nomina1: 1800,
  nomina2: 1500,
  fondoComun: 1200,
  ajuste: 0,
  mode: SPLIT_MODES.PROPORTIONAL,
  installments: 5,
  splitCount: 2,
  splitTotal: 60,
};

// Configuración de Supabase (se carga desde config.js)
export const getSupabaseConfig = () => {
  const config = window.__A_MEDIAS_CONFIG__ || {};
  return {
    url: config.supabaseUrl || '',
    anonKey: config.supabaseAnonKey || '',
    table: config.supabaseTable || 'a_medias_shares',
    enabled: Boolean(config.supabaseUrl && config.supabaseAnonKey),
  };
};
