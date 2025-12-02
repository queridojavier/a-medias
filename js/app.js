// app.js - Punto de entrada principal de la aplicación

import { TABS, STORAGE_KEYS, SYNC_STATUS, DATA_VERSION } from './constants.js';
import { getElement, storage, copyToClipboard, isOnline, formatDateTime } from './utils.js';
import toast from './toast.js';
import syncManager from './sync.js';
import Calculator from './calculator.js';
import ReimbursementsManager from './reimbursements.js';
import SplitCalculator from './split.js';

class App {
  constructor() {
    this.activeTab = TABS.CALC;
    this.calculator = new Calculator();
    this.reimbursements = new ReimbursementsManager();
    this.splitCalculator = new SplitCalculator();
    this.elements = {};
  }

  async init() {
    console.log('[A Medias] Inicializando aplicación v2.0');

    // Migrar datos si es necesario
    this.migrateDataIfNeeded();

    // Cachear elementos de UI global
    this.cacheElements();

    // Configurar callbacks
    this.setupCallbacks();

    // Inicializar módulos
    this.calculator.init();
    this.reimbursements.init();
    this.splitCalculator.init();

    // Inicializar tabs
    this.setupTabs();

    // Inicializar compartición
    await this.initSharing();

    // Monitorear online/offline
    this.setupOnlineMonitoring();

    // Registrar Service Worker
    this.registerServiceWorker();

    console.log('[A Medias] Aplicación lista');
  }

  cacheElements() {
    this.elements = {
      // Share controls
      shareCreate: getElement('share-create'),
      shareCopy: getElement('share-copy'),
      shareCopySecondary: getElement('share-copy-secondary'),
      shareLeave: getElement('share-leave'),
      shareLinkWrapper: getElement('share-link-wrapper'),
      shareLinkInput: getElement('share-link-input'),
      shareStatus: getElement('share-status-text'),
      shareMissingConfig: getElement('share-missing-config'),
      shareDescription: getElement('share-card-description'),
      syncIndicator: getElement('sync-indicator'),
      offlineBanner: getElement('offline-banner'),
    };
  }

  setupCallbacks() {
    // Cuando cambia el estado de la calculadora o reembolsos, sincronizar
    this.calculator.onStateChange = () => this.handleLocalStateChange();
    this.reimbursements.onStateChange = () => this.handleLocalStateChange();

    // Cuando se recibe estado remoto, aplicarlo
    syncManager.onStateChange = (remoteState) => this.handleRemoteStateChange(remoteState);
    syncManager.onStatusChange = (status) => this.updateSyncUI(status);

    // Conectar calculadora con reembolsos para compartir ingresos
    this.reimbursements.getCalculatorIncomes = () => this.calculator.getIncomes();
  }

  /**
   * Migra datos de versiones anteriores si es necesario
   */
  migrateDataIfNeeded() {
    const currentVersion = storage.get(STORAGE_KEYS.STATE_VERSION, 1);

    if (currentVersion < DATA_VERSION) {
      console.log(`[A Medias] Migrando datos de v${currentVersion} a v${DATA_VERSION}`);

      // Migración de v1 a v2: renombrar key antigua
      if (currentVersion === 1) {
        const oldCalcState = storage.get('parejas_calc');
        if (oldCalcState) {
          storage.set(STORAGE_KEYS.CALC_STATE, oldCalcState);
          storage.remove('parejas_calc');
        }

        const oldReimbursements = storage.get('a_medias_reimbursements');
        if (oldReimbursements) {
          storage.set(STORAGE_KEYS.REIMBURSEMENTS, oldReimbursements);
        }
      }

      storage.set(STORAGE_KEYS.STATE_VERSION, DATA_VERSION);
      console.log('[A Medias] Migración completada');
    }
  }

  /**
   * Configura el sistema de tabs
   */
  setupTabs() {
    const buttons = document.querySelectorAll('[data-tab-target]');
    if (!buttons.length) return;

    buttons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const tabId = btn.dataset.tabTarget;
        this.setActiveTab(tabId);
      });
    });

    // Restaurar tab activo desde localStorage
    const storedTab = storage.get(STORAGE_KEYS.ACTIVE_TAB, TABS.CALC);
    const validTab = document.querySelector(`[data-tab-section="${storedTab}"]`);
    this.setActiveTab(validTab ? storedTab : TABS.CALC);
  }

  setActiveTab(tabId) {
    this.activeTab = tabId;

    document.querySelectorAll('[data-tab-section]').forEach((section) => {
      const isActive = section.dataset.tabSection === tabId;
      section.classList.toggle('hidden', !isActive);
    });

    document.querySelectorAll('[data-tab-target]').forEach((btn) => {
      const isActive = btn.dataset.tabTarget === tabId;
      btn.classList.toggle('tab-button-active', isActive);
      btn.classList.toggle('text-slate-900', isActive);
      btn.classList.toggle('text-slate-600', !isActive);
    });

    storage.set(STORAGE_KEYS.ACTIVE_TAB, tabId);
    this.handleLocalStateChange();
  }

  /**
   * Inicializa el sistema de compartición
   */
  async initSharing() {
    this.updateShareUI();

    // Event listeners para botones de compartir
    const { shareCreate, shareCopy, shareCopySecondary, shareLeave, shareLinkInput } = this.elements;

    if (shareCreate) {
      shareCreate.addEventListener('click', () => this.createShare());
    }

    if (shareCopy) {
      shareCopy.addEventListener('click', () => this.copyShareLink());
    }

    if (shareCopySecondary) {
      shareCopySecondary.addEventListener('click', () => this.copyShareLink());
    }

    if (shareLeave) {
      shareLeave.addEventListener('click', () => this.leaveShare());
    }

    if (shareLinkInput) {
      shareLinkInput.addEventListener('focus', () => shareLinkInput.select());
    }

    // Intentar inicializar desde URL si hay parámetros
    await syncManager.initFromUrl();
  }

  /**
   * Crea un enlace compartido
   */
  async createShare() {
    const currentState = this.exportAppState();
    const link = await syncManager.createShare(currentState);

    if (link) {
      this.updateShareUI();
    }
  }

  /**
   * Copia el enlace compartido al portapapeles
   */
  async copyShareLink() {
    const link = syncManager.buildShareLink();
    if (!link) return;

    const success = await copyToClipboard(link);
    if (success) {
      toast.success('Enlace copiado al portapapeles');
    } else {
      toast.warning('Selecciona y copia el enlace manualmente');
      const input = this.elements.shareLinkInput;
      if (input) {
        input.focus();
        input.select();
      }
    }
  }

  /**
   * Sale del enlace compartido
   */
  leaveShare() {
    const success = syncManager.leaveShare();
    if (success) {
      this.updateShareUI();
    }
  }

  /**
   * Actualiza la UI del estado de compartición
   */
  updateShareUI() {
    const {
      shareCreate,
      shareCopy,
      shareCopySecondary,
      shareLeave,
      shareLinkWrapper,
      shareLinkInput,
      shareStatus,
      shareMissingConfig,
    } = this.elements;

    if (!shareCreate || !shareStatus) return;

    const hasConfig = syncManager.isEnabled;
    const isSharing = syncManager.isSharing;

    // Mostrar/ocultar elementos según configuración
    if (!hasConfig) {
      shareCreate.disabled = true;
      shareCreate.classList.add('opacity-60', 'cursor-not-allowed');
      shareCopy?.classList.add('hidden');
      shareCopySecondary?.classList.add('hidden');
      shareLeave?.classList.add('hidden');
      shareLinkWrapper?.classList.add('hidden');
      shareStatus.textContent = 'Guardado solo en este dispositivo.';
      shareMissingConfig?.classList.remove('hidden');
      return;
    }

    shareMissingConfig?.classList.add('hidden');
    shareCreate.classList.remove('opacity-60', 'cursor-not-allowed');

    // Mostrar/ocultar elementos según si está compartiendo
    shareCreate.classList.toggle('hidden', isSharing);
    shareCreate.disabled = isSharing;
    shareCopy?.classList.toggle('hidden', !isSharing);
    shareCopySecondary?.classList.toggle('hidden', !isSharing);
    shareLeave?.classList.toggle('hidden', !isSharing);
    shareLinkWrapper?.classList.toggle('hidden', !isSharing);

    // Actualizar texto de status
    if (!isSharing) {
      shareStatus.textContent = 'Guardado solo en este dispositivo.';
    } else {
      const syncInfo = syncManager.getSyncInfo();
      if (syncInfo.lastSyncedAt) {
        shareStatus.textContent = `Sincronizado. Última actualización: ${formatDateTime(syncInfo.lastSyncedAt)}`;
      } else {
        shareStatus.textContent = 'Sincronizado con Supabase.';
      }
    }

    // Actualizar input del enlace
    if (isSharing && shareLinkInput) {
      shareLinkInput.value = syncManager.buildShareLink() || '';
    }
  }

  /**
   * Actualiza el indicador de sincronización
   */
  updateSyncUI(status) {
    const indicator = this.elements.syncIndicator;
    if (!indicator) return;

    // Limpiar clases previas
    indicator.className = 'sync-indicator';

    // Añadir clase según estado
    indicator.classList.add(status);

    let text = '';
    let showSpinner = false;

    switch (status) {
      case SYNC_STATUS.SYNCED:
        text = 'Sincronizado';
        break;
      case SYNC_STATUS.SAVING:
        text = 'Guardando...';
        showSpinner = true;
        break;
      case SYNC_STATUS.LOADING:
        text = 'Cargando...';
        showSpinner = true;
        break;
      case SYNC_STATUS.ERROR:
        text = 'Error de sincronización';
        break;
      case SYNC_STATUS.IDLE:
      default:
        text = 'Local';
        break;
    }

    indicator.innerHTML = showSpinner
      ? `<div class="spinner"></div><span>${text}</span>`
      : `<span>${text}</span>`;

    // Actualizar también la UI de share
    this.updateShareUI();
  }

  /**
   * Exporta el estado completo de la app
   */
  exportAppState() {
    return {
      version: DATA_VERSION,
      activeTab: this.activeTab,
      calc: this.calculator.getState(),
      reimbursements: this.reimbursements.getState(),
    };
  }

  /**
   * Maneja cambios locales para sincronizar
   */
  handleLocalStateChange() {
    if (syncManager.isSharing && !syncManager.isApplyingRemote) {
      const currentState = this.exportAppState();
      syncManager.queueSave(currentState);
    }
  }

  /**
   * Maneja cambios remotos recibidos
   */
  handleRemoteStateChange(remoteState) {
    if (!remoteState || typeof remoteState !== 'object') return;

    console.log('[A Medias] Aplicando estado remoto');

    // Restaurar estado de calculadora
    if (remoteState.calc) {
      this.calculator.restoreState(remoteState.calc);
    }

    // Restaurar reembolsos
    if (Array.isArray(remoteState.reimbursements)) {
      this.reimbursements.restoreState(remoteState.reimbursements);
    }

    // Cambiar de tab si es necesario
    if (remoteState.activeTab && remoteState.activeTab !== this.activeTab) {
      this.setActiveTab(remoteState.activeTab);
    }
  }

  /**
   * Configura monitoreo de estado online/offline
   */
  setupOnlineMonitoring() {
    const banner = this.elements.offlineBanner;

    const updateOnlineStatus = () => {
      if (!banner) return;

      if (isOnline()) {
        banner.classList.remove('show');
      } else {
        banner.classList.add('show');
      }
    };

    window.addEventListener('online', () => {
      updateOnlineStatus();
      toast.success('Conexión restaurada');
      // Intentar sincronizar
      if (syncManager.isSharing) {
        syncManager.fetchRemoteState(true);
      }
    });

    window.addEventListener('offline', () => {
      updateOnlineStatus();
      toast.warning('Sin conexión a internet');
    });

    updateOnlineStatus();
  }

  /**
   * Registra el Service Worker
   */
  registerServiceWorker() {
    const isDevHost = ['localhost', '127.0.0.1'].includes(location.hostname) ||
      location.hostname.startsWith('192.168.');

    if ('serviceWorker' in navigator && !isDevHost) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
          .then(() => console.log('[A Medias] Service Worker registrado'))
          .catch((err) => console.error('[A Medias] Error registrando SW:', err));
      });
    } else if (isDevHost) {
      // En desarrollo, desregistrar SWs previos
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations()
          .then((regs) => regs.forEach((r) => r.unregister()));
      }
      if ('caches' in window) {
        caches.keys().then((keys) => keys.forEach((k) => caches.delete(k)));
      }
    }
  }
}

// Inicializar app cuando el DOM esté listo
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    const app = new App();
    app.init();
  });
} else {
  const app = new App();
  app.init();
}

export default App;
