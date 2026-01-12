// app-hybrid.js - Versión híbrida con Local First + Supabase opcional
// Reemplaza app.js para usar el nuevo sistema de almacenamiento

import { TABS, STORAGE_KEYS, SYNC_STATUS, DATA_VERSION } from './constants.js';
import { getElement, copyToClipboard, isOnline, formatDateTime, logger } from './utils.js';
import toast from './toast.js';
import hybridSync from './sync-hybrid.js';
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
    logger.log('[A Medias] Inicializando aplicación v3.0 (Local First)');

    // Cachear elementos de UI global
    this.cacheElements();

    // Configurar callbacks
    this.setupCallbacks();

    // Inicializar sistema híbrido de sync
    await hybridSync.init();

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

    logger.log('[A Medias] Aplicación lista');
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

      // Nuevos elementos para Local First
      shareQRCode: getElement('share-qr-code'),
      exportBackup: getElement('export-backup'),
      importBackup: getElement('import-backup'),
    };
  }

  setupCallbacks() {
    // Cuando cambia el estado de la calculadora o reembolsos, guardar localmente
    this.calculator.onStateChange = () => this.handleLocalStateChange();
    this.reimbursements.onStateChange = () => this.handleLocalStateChange();

    // Cuando se recibe estado remoto (desde URL compartida), aplicarlo
    hybridSync.onStateChange = (remoteState) => this.handleRemoteStateChange(remoteState);
    hybridSync.onStatusChange = (status) => this.updateSyncUI(status);

    // Conectar calculadora con reembolsos para compartir ingresos
    this.reimbursements.getCalculatorIncomes = () => this.calculator.getIncomes();
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

    // Restaurar tab activo desde estado guardado
    const savedTab = this.activeTab || TABS.CALC;
    const validTab = document.querySelector(`[data-tab-section="${savedTab}"]`);
    this.setActiveTab(validTab ? savedTab : TABS.CALC);
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

    this.handleLocalStateChange();
  }

  /**
   * Inicializa el sistema de compartición
   */
  async initSharing() {
    this.updateShareUI();

    // Event listeners para botones de compartir
    const {
      shareCreate,
      shareCopy,
      shareCopySecondary,
      shareLeave,
      shareLinkInput,
      exportBackup,
      importBackup
    } = this.elements;

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

    if (exportBackup) {
      exportBackup.addEventListener('click', () => hybridSync.exportAllData());
    }

    if (importBackup) {
      importBackup.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          hybridSync.importData(file);
        }
      });
    }
  }

  /**
   * Crea un enlace compartido (vía URL)
   */
  async createShare() {
    const currentState = this.exportAppState();
    const url = await hybridSync.createShareURL(currentState);

    if (url) {
      this.updateShareUI();

      // Mostrar código QR si existe el elemento
      const qrCodeEl = this.elements.shareQRCode;
      if (qrCodeEl) {
        const qrUrl = hybridSync.generateQRCode();
        if (qrUrl) {
          qrCodeEl.src = qrUrl;
          qrCodeEl.classList.remove('hidden');
        }
      }
    }
  }

  /**
   * Copia el enlace compartido al portapapeles
   */
  async copyShareLink() {
    const link = hybridSync.getShareURL();
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
  async leaveShare() {
    const success = await hybridSync.leaveShare();
    if (success) {
      this.updateShareUI();

      // Ocultar QR code
      const qrCodeEl = this.elements.shareQRCode;
      if (qrCodeEl) {
        qrCodeEl.classList.add('hidden');
      }
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
      shareDescription,
    } = this.elements;

    if (!shareCreate || !shareStatus) return;

    const syncInfo = hybridSync.getSyncInfo();
    const isSharing = syncInfo.isSharing;

    // Ocultar mensaje de "config faltante" - ya no es necesario con Local First
    shareMissingConfig?.classList.add('hidden');

    // Actualizar descripción
    if (shareDescription) {
      shareDescription.textContent = 'Comparte un enlace para sincronizar con otro dispositivo. No requiere registro ni servidor.';
    }

    // Mostrar/ocultar elementos según si está compartiendo
    shareCreate.classList.toggle('hidden', isSharing);
    shareCreate.disabled = isSharing;
    shareCopy?.classList.toggle('hidden', !isSharing);
    shareCopySecondary?.classList.toggle('hidden', !isSharing);
    shareLeave?.classList.toggle('hidden', !isSharing);
    shareLinkWrapper?.classList.toggle('hidden', !isSharing);

    // Actualizar texto de status
    if (!isSharing) {
      shareStatus.textContent = 'Guardado localmente en este dispositivo.';
      shareStatus.className = 'text-sm text-slate-600';
    } else {
      shareStatus.textContent = `Compartiendo vía ${syncInfo.backend}`;
      shareStatus.className = 'text-sm text-green-600 font-medium';
    }

    // Actualizar input del enlace
    if (isSharing && shareLinkInput) {
      shareLinkInput.value = syncInfo.shareUrl || '';
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
        text = 'Guardado';
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
        text = 'Error';
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
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Maneja cambios locales para guardar
   */
  handleLocalStateChange() {
    const currentState = this.exportAppState();

    // Guardar localmente con debounce
    hybridSync.saveState(currentState);

    // Si está compartiendo, actualizar URL
    const syncInfo = hybridSync.getSyncInfo();
    if (syncInfo.isSharing && syncInfo.mode === 'url') {
      hybridSync.updateShareURL(currentState);
    }
  }

  /**
   * Maneja cambios remotos recibidos (desde URL compartida)
   */
  handleRemoteStateChange(remoteState) {
    if (!remoteState || typeof remoteState !== 'object') return;

    logger.log('[A Medias] Aplicando estado remoto');

    // Restaurar estado de calculadora
    if (remoteState.calc) {
      this.calculator.restoreState(remoteState.calc);
    }

    // Restaurar reembolsos
    if (Array.isArray(remoteState.reimbursements)) {
      this.reimbursements.restoreState(remoteState.reimbursements, { skipSync: true });
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
    });

    window.addEventListener('offline', () => {
      updateOnlineStatus();
      toast.warning('Sin conexión - Trabajando offline');
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
          .then(() => logger.log('[A Medias] Service Worker registrado'))
          .catch((err) => logger.error('[A Medias] Error registrando SW:', err));
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
