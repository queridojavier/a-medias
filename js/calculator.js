// calculator.js - Módulo de calculadora de división mensual

import { SPLIT_MODES, DEFAULTS, STORAGE_KEYS, TIMINGS } from './constants.js';
import { formatMoney, formatPercent, round2, readNumber, getElement, storage, calculateProportion, debounce } from './utils.js';
import syncManager from './sync.js';

class Calculator {
  constructor() {
    this.mode = SPLIT_MODES.PROPORTIONAL;
    this.defaultValues = { ...DEFAULTS };
    this.elements = {};
    this.onStateChange = null; // Callback cuando cambia el estado
    // Versión con debounce del cálculo para mejor rendimiento
    this.debouncedCalculate = debounce(() => this.calculate(), TIMINGS.CALC_DEBOUNCE);
  }

  /**
   * Inicializa la calculadora
   */
  init() {
    this.cacheElements();
    this.loadState();
    this.attachEventListeners();
    this.updateModeUI();
    this.calculate();
  }

  /**
   * Cachea los elementos del DOM
   */
  cacheElements() {
    this.elements = {
      nomina1: getElement('nomina1'),
      nomina2: getElement('nomina2'),
      fondoComun: getElement('fondoComun'),
      ajuste: getElement('ajuste'),
      btnReset: getElement('btnReset'),
      modeProp: getElement('mode-prop'),
      modeEq: getElement('mode-eq'),
      modeHint: getElement('mode-hint'),
      ingresoTotal: getElement('ingresoTotal'),
      dineroRepartir: getElement('dineroRepartir'),
      porcentaje1: getElement('porcentaje1'),
      porcentaje2: getElement('porcentaje2'),
      donut: getElement('donut'),
      p1Center: getElement('p1Center'),
      comun1: getElement('comun1'),
      comun2: getElement('comun2'),
      transferencia1: getElement('transferencia1'),
      transferencia2: getElement('transferencia2'),
      warning: getElement('warning'),
    };
  }

  /**
   * Adjunta event listeners
   */
  attachEventListeners() {
    const inputs = ['nomina1', 'nomina2', 'fondoComun', 'ajuste'];
    inputs.forEach((id) => {
      const element = this.elements[id];
      if (element) {
        element.addEventListener('input', () => {
          this.debouncedCalculate();
        });
      }
    });

    if (this.elements.modeProp) {
      this.elements.modeProp.addEventListener('click', () => this.setMode(SPLIT_MODES.PROPORTIONAL));
    }

    if (this.elements.modeEq) {
      this.elements.modeEq.addEventListener('click', () => this.setMode(SPLIT_MODES.EQUAL));
    }

    if (this.elements.btnReset) {
      this.elements.btnReset.addEventListener('click', () => this.reset());
    }
  }

  /**
   * Establece el modo de reparto
   */
  setMode(newMode) {
    if (newMode !== SPLIT_MODES.PROPORTIONAL && newMode !== SPLIT_MODES.EQUAL) {
      return;
    }

    this.mode = newMode;
    this.updateModeUI();
    this.calculate();
  }

  /**
   * Actualiza la UI del modo de reparto
   */
  updateModeUI() {
    const { modeProp, modeEq, modeHint } = this.elements;

    if (!modeProp || !modeEq) return;

    if (this.mode === SPLIT_MODES.PROPORTIONAL) {
      modeProp.className = 'flex-1 px-3 py-1.5 rounded-lg text-sm font-medium text-center bg-white shadow text-slate-900 ring-1 ring-[var(--primary)]';
      modeEq.className = 'flex-1 px-3 py-1.5 rounded-lg text-sm font-medium text-center text-slate-700 hover:text-slate-900';
      modeProp.setAttribute('aria-pressed', 'true');
      modeEq.setAttribute('aria-pressed', 'false');

      if (modeHint) {
        modeHint.textContent = 'Reparte según el peso de cada nómina.';
      }
    } else {
      modeEq.className = 'flex-1 px-3 py-1.5 rounded-lg text-sm font-medium text-center bg-white shadow text-slate-900 ring-1 ring-[var(--primary)]';
      modeProp.className = 'flex-1 px-3 py-1.5 rounded-lg text-sm font-medium text-center text-slate-700 hover:text-slate-900';
      modeEq.setAttribute('aria-pressed', 'true');
      modeProp.setAttribute('aria-pressed', 'false');

      if (modeHint) {
        modeHint.textContent = 'Reparte exactamente al 50% cada concepto.';
      }
    }
  }

  /**
   * Realiza el cálculo principal
   */
  calculate() {
    const nomina1 = readNumber('nomina1');
    const nomina2 = readNumber('nomina2');
    const fondoComun = readNumber('fondoComun');
    const ajuste = readNumber('ajuste', { allowNegative: true });

    const ingresoTotal = round2(nomina1 + nomina2);

    // Calcular porcentaje según modo
    const proportion1 = this.mode === SPLIT_MODES.EQUAL
      ? 0.5
      : calculateProportion(nomina1, nomina2);

    const comun1 = round2(fondoComun * proportion1);
    const comun2 = round2(fondoComun * (1 - proportion1));

    let dineroRepartir = round2(ingresoTotal - fondoComun);

    // Validación
    const { warning } = this.elements;
    if (warning) warning.textContent = '';

    if (dineroRepartir < 0) {
      dineroRepartir = 0;
      if (warning) {
        warning.textContent = 'La aportación a la cuenta común supera los ingresos totales. Revisa las cifras.';
      }
    }

    const sobrante1 = round2(nomina1 - comun1);
    const sobrante2 = round2(nomina2 - comun2);

    const transferencia1 = round2(sobrante1 - ajuste);
    const transferencia2 = round2(sobrante2 + ajuste);

    // Actualizar UI
    this.updateResults({
      ingresoTotal,
      dineroRepartir,
      proportion1,
      comun1,
      comun2,
      transferencia1,
      transferencia2,
    });

    // Guardar estado
    this.saveState();
  }

  /**
   * Actualiza los resultados en la UI
   */
  updateResults(results) {
    const {
      ingresoTotal,
      dineroRepartir,
      proportion1,
      comun1,
      comun2,
      transferencia1,
      transferencia2,
    } = results;

    const {
      ingresoTotal: ingresoTotalEl,
      dineroRepartir: dineroRepartirEl,
      porcentaje1,
      porcentaje2,
      donut,
      p1Center,
      comun1: comun1El,
      comun2: comun2El,
      transferencia1: transferencia1El,
      transferencia2: transferencia2El,
    } = this.elements;

    if (ingresoTotalEl) ingresoTotalEl.textContent = formatMoney(ingresoTotal);
    if (dineroRepartirEl) dineroRepartirEl.textContent = formatMoney(dineroRepartir);

    const p1pct = proportion1 * 100;
    if (porcentaje1) porcentaje1.textContent = `${formatPercent(p1pct)}%`;
    if (porcentaje2) porcentaje2.textContent = `${formatPercent(100 - p1pct)}%`;

    // Donut chart
    const p1deg = Math.round(proportion1 * 360);
    if (donut) {
      donut.style.background = `conic-gradient(var(--primary) ${p1deg}deg, var(--muted) 0)`;
    }
    if (p1Center) {
      p1Center.textContent = `${formatPercent(p1pct)}%`;
    }

    if (comun1El) comun1El.textContent = formatMoney(comun1);
    if (comun2El) comun2El.textContent = formatMoney(comun2);
    if (transferencia1El) transferencia1El.textContent = formatMoney(transferencia1);
    if (transferencia2El) transferencia2El.textContent = formatMoney(transferencia2);
  }

  /**
   * Guarda el estado en localStorage y sincroniza
   */
  saveState() {
    const state = this.getState();
    storage.set(STORAGE_KEYS.CALC_STATE, state);

    // Notificar cambio de estado para sincronización
    if (this.onStateChange) {
      this.onStateChange();
    }
  }

  /**
   * Carga el estado desde localStorage
   */
  loadState() {
    const state = storage.get(STORAGE_KEYS.CALC_STATE);

    if (state) {
      if (state.nomina1 != null && this.elements.nomina1) {
        this.elements.nomina1.value = state.nomina1;
      }
      if (state.nomina2 != null && this.elements.nomina2) {
        this.elements.nomina2.value = state.nomina2;
      }
      if (state.fondoComun != null && this.elements.fondoComun) {
        this.elements.fondoComun.value = state.fondoComun;
      }
      if (state.ajuste != null && this.elements.ajuste) {
        this.elements.ajuste.value = state.ajuste;
      }
      if (state.mode === SPLIT_MODES.EQUAL || state.mode === SPLIT_MODES.PROPORTIONAL) {
        this.mode = state.mode;
      }
    }
  }

  /**
   * Restaura inputs desde un estado dado
   */
  restoreState(state) {
    if (!state || typeof state !== 'object') return;

    if (state.nomina1 != null && this.elements.nomina1) {
      this.elements.nomina1.value = state.nomina1;
    }
    if (state.nomina2 != null && this.elements.nomina2) {
      this.elements.nomina2.value = state.nomina2;
    }
    if (state.fondoComun != null && this.elements.fondoComun) {
      this.elements.fondoComun.value = state.fondoComun;
    }
    if (state.ajuste != null && this.elements.ajuste) {
      this.elements.ajuste.value = state.ajuste;
    }
    if (state.mode === SPLIT_MODES.EQUAL || state.mode === SPLIT_MODES.PROPORTIONAL) {
      this.mode = state.mode;
      this.updateModeUI();
    }

    this.calculate();
  }

  /**
   * Obtiene el estado actual
   */
  getState() {
    return {
      nomina1: readNumber('nomina1'),
      nomina2: readNumber('nomina2'),
      fondoComun: readNumber('fondoComun'),
      ajuste: readNumber('ajuste', { allowNegative: true }),
      mode: this.mode,
    };
  }

  /**
   * Resetea a valores por defecto
   */
  reset() {
    storage.remove(STORAGE_KEYS.CALC_STATE);

    if (this.elements.nomina1) this.elements.nomina1.value = this.defaultValues.nomina1;
    if (this.elements.nomina2) this.elements.nomina2.value = this.defaultValues.nomina2;
    if (this.elements.fondoComun) this.elements.fondoComun.value = this.defaultValues.fondoComun;
    if (this.elements.ajuste) this.elements.ajuste.value = this.defaultValues.ajuste;

    this.mode = SPLIT_MODES.PROPORTIONAL;
    this.updateModeUI();
    this.calculate();
  }

  /**
   * Obtiene los valores de ingresos para uso en otros módulos
   */
  getIncomes() {
    return {
      nomina1: readNumber('nomina1'),
      nomina2: readNumber('nomina2'),
      mode: this.mode,
    };
  }
}

export default Calculator;
