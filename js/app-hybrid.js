// app-hybrid.js - Versión híbrida con Local First + Supabase opcional
// Reemplaza app.js para usar el nuevo sistema de almacenamiento

import { TABS, SYNC_STATUS, DATA_VERSION } from './constants.js';
import { getElement, copyToClipboard, isOnline, logger, formatMoney, round2 } from './utils.js';
import toast from './toast.js';
import hybridSync from './sync-hybrid.js';
import cloudSync, { CLOUD_STATUS } from './cloud-sync.js';
import Calculator from './calculator.js';
import ReimbursementsManager from './reimbursements.js';
import SplitCalculator from './split.js';
import CommonExpensesManager from './common-expenses.js';
import SettingsManager from './settings.js';

class App {
  constructor() {
    this.activeTab = TABS.SUMMARY;
    this.calculator = new Calculator();
    this.reimbursements = new ReimbursementsManager();
    this.splitCalculator = new SplitCalculator();
    this.commonExpenses = new CommonExpensesManager();
    this.settings = new SettingsManager();
    this.elements = {};
  }

  async init() {
    logger.log('[A Medias] Inicializando aplicación v4.7 (Local First + Cloud)');

    // Cachear elementos de UI global
    this.cacheElements();

    // Configurar callbacks
    this.setupCallbacks();

    // Inicializar sistema híbrido de sync (local IndexedDB)
    await hybridSync.init();

    // Inicializar módulos
    this.calculator.init();
    this.reimbursements.init();
    this.splitCalculator.init();
    this.settings.init();
    this.commonExpenses.getCategories = () => this.settings.getCategories();
    this.commonExpenses.init();
    this.updateProfileLabels();

    // Inicializar tabs
    this.setupTabs();

    // Inicializar compartición
    await this.initSharing();

    // Inicializar sesión cloud (adopta URL o restaura localStorage)
    await cloudSync.init();
    this.updateShareUI();

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
      shareCreatePartner: getElement('share-create-partner'),
      shareCopy: getElement('share-copy'),
      shareCopySecondary: getElement('share-copy-secondary'),
      shareLeave: getElement('share-leave'),
      shareLinkWrapper: getElement('share-link-wrapper'),
      shareLinkInput: getElement('share-link-input'),
      shareStatus: getElement('share-status-text'),
      shareMissingConfig: getElement('share-missing-config'),
      shareDescription: getElement('share-card-description'),
      partnerModal: getElement('partner-share-modal'),
      partnerModalConfirm: getElement('partner-share-confirm'),
      partnerModalCancel: getElement('partner-share-cancel'),
      syncIndicator: getElement('sync-indicator'),
      offlineBanner: getElement('offline-banner'),
      summaryCommonExpenses: getElement('summary-common-expenses'),
      summaryCommonFund: getElement('summary-common-fund'),
      summaryMyContribution: getElement('summary-my-contribution'),
      summaryPartnerContribution: getElement('summary-partner-contribution'),
      summaryBuffer: getElement('summary-buffer'),
      summaryCoverage: getElement('summary-coverage'),
      summaryCoverageMeta: getElement('summary-coverage-meta'),
      summaryMonthLabel: getElement('summary-month-label'),
      summaryBufferHint: getElement('summary-buffer-hint'),
      summaryMySalary: getElement('summary-my-salary'),
      summaryPartnerSalary: getElement('summary-partner-salary'),
      summaryDistributionBar: getElement('summary-distribution-bar'),
      summaryDistributionMine: getElement('summary-distribution-mine'),
      summaryDistributionPartner: getElement('summary-distribution-partner'),
      summaryDistributionMineLabel: getElement('summary-distribution-mine-label'),
      summaryDistributionPartnerLabel: getElement('summary-distribution-partner-label'),
      summaryMyContributionLabel: getElement('summary-my-contribution-label'),
      summaryPartnerContributionLabel: getElement('summary-partner-contribution-label'),
      labelNomina1: getElement('label-nomina1'),
      labelNomina2: getElement('label-nomina2'),
      labelComun1: getElement('label-comun1'),
      labelComun2: getElement('label-comun2'),
      labelPorcentaje1: getElement('label-porcentaje1'),
      labelPorcentaje2: getElement('label-porcentaje2'),
      labelTransferencia1: getElement('label-transferencia1'),
      labelTransferencia2: getElement('label-transferencia2'),

      // Nuevos elementos para Local First
      shareQRCode: getElement('share-qr-code'),
      exportBackup: getElement('export-backup'),
      importBackup: getElement('import-backup'),
    };
  }

  setupCallbacks() {
    // Cuando cambia el estado de la calculadora o reembolsos, guardar localmente
    this.calculator.onStateChange = () => {
      this.updateSummary();
      this.handleLocalStateChange();
    };
    this.reimbursements.onStateChange = () => this.handleLocalStateChange();
    this.commonExpenses.onStateChange = () => {
      this.updateSummary();
      this.handleLocalStateChange();
    };
    this.settings.onStateChange = () => {
      this.commonExpenses.refreshCategories();
      this.updateProfileLabels();
      this.updateSummary();
      this.handleLocalStateChange();
    };

    // Cuando se recibe estado remoto (desde URL compartida), aplicarlo
    hybridSync.onStateChange = (remoteState) => this.handleRemoteStateChange(remoteState);
    hybridSync.onStatusChange = (status) => this.updateSyncUI(status);

    // Cloud sync: estado remoto desde backend + indicador de estado
    cloudSync.onRemoteState = (remoteState) => this.handleRemoteStateChange(remoteState);
    cloudSync.onStatusChange = (status) => this.updateCloudStatus(status);

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
    const savedTab = this.activeTab || TABS.SUMMARY;
    const validTab = document.querySelector(`[data-tab-section="${savedTab}"]`);
    this.setActiveTab(validTab ? savedTab : TABS.SUMMARY);
  }

  setActiveTab(tabId) {
    this.activeTab = tabId;

    document.querySelectorAll('[data-tab-section]').forEach((section) => {
      const isActive = section.dataset.tabSection === tabId;
      section.classList.toggle('hidden', !isActive);
    });

    document.querySelectorAll('[data-tab-target]').forEach((btn) => {
      const isActive = btn.dataset.tabTarget === tabId;
      btn.classList.toggle('active', isActive);
      if (btn.getAttribute('role') === 'tab') {
        btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
      }
    });

    this.updateSummary();
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
      shareCreatePartner,
      shareCopy,
      shareCopySecondary,
      shareLeave,
      shareLinkInput,
      partnerModal,
      partnerModalConfirm,
      partnerModalCancel,
      exportBackup,
      importBackup
    } = this.elements;

    if (shareCreate) {
      shareCreate.addEventListener('click', () => this.startPersonalSync());
    }

    if (shareCreatePartner) {
      shareCreatePartner.addEventListener('click', () => this.openPartnerModal());
    }

    if (partnerModalConfirm) {
      partnerModalConfirm.addEventListener('click', () => {
        this.closePartnerModal();
        this.startPartnerShare();
      });
    }

    if (partnerModalCancel) {
      partnerModalCancel.addEventListener('click', () => this.closePartnerModal());
    }

    if (partnerModal) {
      partnerModal.addEventListener('click', (e) => {
        if (e.target === partnerModal) this.closePartnerModal();
      });
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
   * Nivel 1: sincronización entre tus propios dispositivos.
   * Crea una sesión cloud y muestra el enlace con clave en el fragment.
   */
  async startPersonalSync() {
    if (cloudSync.isActive()) {
      toast.info('Ya tienes una sesión activa');
      this.updateShareUI();
      await this.renderQRCode();
      return;
    }

    const currentState = this.exportAppState();
    try {
      await cloudSync.createSession(currentState);
      this.updateShareUI();
      await this.renderQRCode();
      toast.success('Sesión creada. Abre el enlace en tu otro dispositivo.');
    } catch (err) {
      logger.error('[A Medias] Error creando sesión cloud:', err);
      toast.error('No se pudo crear la sesión. Revisa tu conexión.');
    }
  }

  openPartnerModal() {
    const modal = this.elements.partnerModal;
    if (!modal) return;
    modal.classList.remove('hidden');
  }

  closePartnerModal() {
    const modal = this.elements.partnerModal;
    if (!modal) return;
    modal.classList.add('hidden');
  }

  /**
   * Nivel 2: misma mecánica que nivel 1, pero tras aviso explícito.
   */
  async startPartnerShare() {
    if (cloudSync.isActive()) {
      this.updateShareUI();
      await this.renderQRCode();
      this.copyShareLink();
      return;
    }
    await this.startPersonalSync();
    // Tras crearla, copiar al portapapeles para facilitar compartir
    this.copyShareLink();
  }

  async renderQRCode() {
    const qrCodeEl = this.elements.shareQRCode;
    const url = cloudSync.getShareURL();
    if (!qrCodeEl || !url) return;
    if (typeof window.QRCode === 'undefined' || !window.QRCode.toCanvas) {
      qrCodeEl.classList.add('hidden');
      return;
    }
    try {
      await window.QRCode.toCanvas(qrCodeEl, url, { width: 200, margin: 1 });
      qrCodeEl.classList.remove('hidden');
    } catch (err) {
      logger.error('[A Medias] Error generando QR:', err);
      qrCodeEl.classList.add('hidden');
    }
  }

  /**
   * Copia el enlace compartido al portapapeles
   */
  async copyShareLink() {
    const link = cloudSync.getShareURL();
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
   * Sale del enlace compartido (los datos quedan en local)
   */
  async leaveShare() {
    const confirmed = window.confirm(
      '¿Dejar de sincronizar? Los datos seguirán guardados localmente en este dispositivo.'
    );
    if (!confirmed) return;

    await cloudSync.leaveSession();
    this.updateShareUI();

    const qrCodeEl = this.elements.shareQRCode;
    if (qrCodeEl) {
      qrCodeEl.classList.add('hidden');
    }
    toast.info('Has salido de la sesión');
  }

  /**
   * Actualiza la UI del estado de compartición
   */
  updateShareUI() {
    const {
      shareCreate,
      shareCreatePartner,
      shareCopy,
      shareCopySecondary,
      shareLeave,
      shareLinkWrapper,
      shareLinkInput,
      shareStatus,
      shareMissingConfig,
    } = this.elements;

    if (!shareCreate || !shareStatus) return;

    const info = cloudSync.getInfo();
    const isActive = info.active;

    shareMissingConfig?.classList.add('hidden');

    shareCreate.classList.toggle('hidden', isActive);
    shareCreate.disabled = isActive;
    shareCreatePartner?.classList.toggle('hidden', isActive);
    if (shareCreatePartner) shareCreatePartner.disabled = isActive;

    shareCopy?.classList.toggle('hidden', !isActive);
    shareCopySecondary?.classList.toggle('hidden', !isActive);
    shareLeave?.classList.toggle('hidden', !isActive);
    shareLinkWrapper?.classList.toggle('hidden', !isActive);

    shareStatus.className = 'ios-share-status';
    shareStatus.style.color = '';
    if (!isActive) {
      shareStatus.textContent = 'Guardado localmente en este dispositivo.';
    } else {
      shareStatus.textContent = `Sesión activa — los cambios se sincronizan en la nube (${info.status}).`;
      shareStatus.style.color = 'var(--green)';
    }

    if (isActive && shareLinkInput) {
      shareLinkInput.value = info.shareUrl || '';
    }
  }

  /**
   * Refleja el estado del cloud-sync en el indicador superior.
   */
  updateCloudStatus(cloudStatus) {
    const map = {
      [CLOUD_STATUS.IDLE]: SYNC_STATUS.IDLE,
      [CLOUD_STATUS.SAVING]: SYNC_STATUS.SAVING,
      [CLOUD_STATUS.SYNCED]: SYNC_STATUS.SYNCED,
      [CLOUD_STATUS.OFFLINE]: SYNC_STATUS.ERROR,
      [CLOUD_STATUS.ERROR]: SYNC_STATUS.ERROR,
    };
    this.updateSyncUI(map[cloudStatus] || SYNC_STATUS.IDLE);
    this.updateShareUI();
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
      settings: this.settings.getState(),
      commonExpenses: this.commonExpenses.getState(),
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

    // Si hay sesión cloud activa, subir con debounce
    if (cloudSync.isActive()) {
      cloudSync.pushDebounced(currentState);
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

    if (remoteState.settings) {
      this.settings.restoreState(remoteState.settings, { skipSync: true });
      this.updateProfileLabels();
    }

    if (Array.isArray(remoteState.commonExpenses)) {
      this.commonExpenses.restoreState(remoteState.commonExpenses, { skipSync: true });
    }

    // Restaurar reembolsos
    if (Array.isArray(remoteState.reimbursements)) {
      this.reimbursements.restoreState(remoteState.reimbursements, { skipSync: true });
    }

    // Cambiar de tab si es necesario
    if (remoteState.activeTab && remoteState.activeTab !== this.activeTab) {
      this.setActiveTab(remoteState.activeTab);
    }

    this.updateSummary();
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

  updateSummary() {
    const calc = this.calculator.getComputedState();
    const common = this.commonExpenses.getSummary();
    const profiles = this.settings.getProfiles();
    const fundGap = round2(calc.fondoComun - common.totalMonthly);
    const coveragePct = calc.fondoComun > 0
      ? Math.min(100, Math.max(0, Math.round((common.totalMonthly / calc.fondoComun) * 100)))
      : 0;
    const monthLabel = new Intl.DateTimeFormat('es-ES', {
      month: 'long',
      year: 'numeric',
    }).format(new Date());

    if (this.elements.summaryCommonExpenses) {
      this.elements.summaryCommonExpenses.textContent = formatMoney(common.totalMonthly);
    }
    if (this.elements.summaryCommonFund) {
      this.elements.summaryCommonFund.textContent = formatMoney(calc.fondoComun);
    }
    if (this.elements.summaryMyContribution) {
      this.elements.summaryMyContribution.textContent = formatMoney(calc.comun1);
    }
    if (this.elements.summaryPartnerContribution) {
      this.elements.summaryPartnerContribution.textContent = formatMoney(calc.comun2);
    }
    if (this.elements.summaryBuffer) {
      this.elements.summaryBuffer.textContent = formatMoney(fundGap);
      this.elements.summaryBuffer.classList.toggle('is-negative', fundGap < 0);
    }
    if (this.elements.summaryCoverage) {
      this.elements.summaryCoverage.style.width = `${coveragePct}%`;
    }
    if (this.elements.summaryCoverageMeta) {
      this.elements.summaryCoverageMeta.textContent = `${coveragePct}% de la cuenta común ya tiene destino fijo`;
    }
    if (this.elements.summaryMonthLabel) {
      this.elements.summaryMonthLabel.textContent = `Último mes cargado: ${monthLabel}`;
    }
    if (this.elements.summaryBufferHint) {
      this.elements.summaryBufferHint.textContent = fundGap >= 0
        ? 'Colchón operativo para comida, ocio y pagos variables.'
        : 'Los gastos fijos superan lo que dejáis en la cuenta común.';
    }
    if (this.elements.summaryMySalary) {
      this.elements.summaryMySalary.textContent = formatMoney(calc.nomina1);
    }
    if (this.elements.summaryPartnerSalary) {
      this.elements.summaryPartnerSalary.textContent = formatMoney(calc.nomina2);
    }

    const myPct = Math.max(10, Math.min(90, Math.round(calc.proportion1 * 100)));
    if (this.elements.summaryDistributionBar) {
      this.elements.summaryDistributionBar.style.setProperty('--mine', `${myPct}%`);
    }
    if (this.elements.summaryDistributionMine) {
      this.elements.summaryDistributionMine.textContent = `${Math.round(calc.proportion1 * 100)}%`;
    }
    if (this.elements.summaryDistributionPartner) {
      this.elements.summaryDistributionPartner.textContent = `${Math.round((1 - calc.proportion1) * 100)}%`;
    }
    if (this.elements.summaryMyContributionLabel) {
      this.elements.summaryMyContributionLabel.textContent = `Aportación ${profiles.me} último mes`;
    }
    if (this.elements.summaryPartnerContributionLabel) {
      this.elements.summaryPartnerContributionLabel.textContent = `Aportación ${profiles.partner} último mes`;
    }
  }

  updateProfileLabels() {
    const profiles = this.settings.getProfiles();

    if (this.elements.summaryDistributionMineLabel) {
      this.elements.summaryDistributionMineLabel.textContent = profiles.me;
    }
    if (this.elements.summaryDistributionPartnerLabel) {
      this.elements.summaryDistributionPartnerLabel.textContent = profiles.partner;
    }
    if (this.elements.labelNomina1) {
      this.elements.labelNomina1.textContent = `Nómina de ${profiles.me}`;
    }
    if (this.elements.labelNomina2) {
      this.elements.labelNomina2.textContent = `Nómina de ${profiles.partner}`;
    }
    if (this.elements.labelComun1) {
      this.elements.labelComun1.textContent = `Aportación de ${profiles.me} al fondo`;
    }
    if (this.elements.labelComun2) {
      this.elements.labelComun2.textContent = `Aportación de ${profiles.partner}`;
    }
    if (this.elements.labelPorcentaje1) {
      this.elements.labelPorcentaje1.textContent = `Peso de ${profiles.me}`;
    }
    if (this.elements.labelPorcentaje2) {
      this.elements.labelPorcentaje2.textContent = profiles.partner;
    }
    if (this.elements.labelTransferencia1) {
      this.elements.labelTransferencia1.textContent = `Se queda en la cuenta de ${profiles.me}`;
    }
    if (this.elements.labelTransferencia2) {
      this.elements.labelTransferencia2.textContent = `Se queda en la cuenta de ${profiles.partner}`;
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
