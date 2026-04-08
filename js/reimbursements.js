// reimbursements.js - Módulo de gestión de reembolsos

import { STORAGE_KEYS, SPLIT_MODES } from './constants.js';
import { formatMoney, round2, generateUUID, todayISO, escapeHtml, getElement, readNumber, storage, calculateProportion } from './utils.js';
import toast from './toast.js';

class ReimbursementsManager {
  constructor() {
    this.reimbursements = [];
    this.elements = {};
    this.onStateChange = null;
    this.getCalculatorIncomes = null; // Función para obtener ingresos de la calculadora
  }

  init() {
    this.cacheElements();
    this.loadReimbursements();
    this.attachEventListeners();
    this.renderReimbursements();
    this.updatePreview();
  }

  cacheElements() {
    this.elements = {
      form: getElement('debt-form'),
      concept: getElement('debt-concept'),
      total: getElement('debt-total'),
      myShare: getElement('debt-my-share'),
      installments: getElement('debt-installments'),
      firstDate: getElement('debt-first-date'),
      note: getElement('debt-note'),
      preview: getElement('debt-preview'),
      error: getElement('debt-error'),
      list: getElement('debt-list'),
      empty: getElement('debt-empty'),
      shareActionBtn: getElement('btn-share-action'),
      modeProp: getElement('debt-mode-prop'),
      modeEq: getElement('debt-mode-eq'),
    };
  }

  attachEventListeners() {
    const { form, total, myShare, installments, shareActionBtn, modeProp, modeEq } = this.elements;

    if (form) {
      form.addEventListener('submit', (e) => this.handleAddDebt(e));
    }

    [total, myShare, installments].forEach((el) => {
      if (el) el.addEventListener('input', () => this.updatePreview());
    });

    const payerRadios = document.querySelectorAll('input[name="debt-payer"]');
    payerRadios.forEach((radio) => {
      radio.addEventListener('change', () => this.updatePreview());
    });

    if (shareActionBtn) {
      shareActionBtn.addEventListener('click', () => this.applyShareShortcut());
    }

    if (modeProp) {
      modeProp.addEventListener('click', () => this.applyShareShortcut(SPLIT_MODES.PROPORTIONAL));
    }

    if (modeEq) {
      modeEq.addEventListener('click', () => this.applyShareShortcut(SPLIT_MODES.EQUAL));
    }
  }

  applyShareShortcut(mode = null) {
    const total = readNumber('debt-total');
    if (total <= 0) return;

    const myShareInput = this.elements.myShare;
    if (!myShareInput) return;

    const incomes = this.getCalculatorIncomes ? this.getCalculatorIncomes() : null;
    const calculatedMode = mode || incomes?.mode || SPLIT_MODES.PROPORTIONAL;

    let proportion = 0.5;

    if (calculatedMode === SPLIT_MODES.PROPORTIONAL && incomes) {
      const { nomina1, nomina2 } = incomes;
      proportion = calculateProportion(nomina1, nomina2);
    }

    const computedShare = Math.min(total, round2(total * proportion));
    myShareInput.value = computedShare;
    this.updatePreview();
  }

  updatePreview() {
    const total = readNumber('debt-total');
    const myShare = readNumber('debt-my-share');
    const installments = Math.max(1, parseInt(this.elements.installments?.value ?? '1', 10) || 1);
    const payer = document.querySelector('input[name="debt-payer"]:checked')?.value || 'me';
    const { preview, error } = this.elements;

    if (error) error.textContent = '';
    if (!preview) return;

    if (!total && !myShare) {
      preview.textContent = 'Registra el total y tu parte para calcular cuánto queda pendiente.';
      return;
    }

    if (myShare > total) {
      preview.textContent = 'Tu parte no puede ser mayor que el total del gasto.';
      return;
    }

    const partnerShare = round2(Math.max(0, total - myShare));
    const owedAmount = payer === 'me' ? partnerShare : myShare;
    const installmentAmount = installments > 0 ? round2(owedAmount / installments) : owedAmount;

    const direction = payer === 'me'
      ? `Tu pareja te devolverá ${formatMoney(owedAmount)}`
      : `Devolverás ${formatMoney(owedAmount)} a tu pareja`;
    const cuotaText = installments > 1
      ? `en ${installments} cuotas aproximadas de ${formatMoney(installmentAmount)}`
      : 'en un solo pago';

    preview.innerHTML = `
      <div class="flex flex-col gap-1">
        <span>Tu parte: <strong>${formatMoney(myShare)}</strong> · Parte pareja: <strong>${formatMoney(partnerShare)}</strong></span>
        <span>${direction} ${cuotaText}.</span>
      </div>
    `;
  }

  handleAddDebt(event) {
    event.preventDefault();

    const concept = this.elements.concept?.value.trim();
    const total = readNumber('debt-total');
    const myShare = readNumber('debt-my-share');
    const installments = Math.max(1, parseInt(this.elements.installments?.value ?? '1', 10) || 1);
    const firstDate = this.elements.firstDate?.value || todayISO();
    const payer = document.querySelector('input[name="debt-payer"]:checked')?.value || 'me';
    const note = this.elements.note?.value.trim();
    const { error } = this.elements;

    if (error) error.textContent = '';

    if (!concept) {
      if (error) error.textContent = 'Añade un concepto para identificar el gasto.';
      return;
    }

    if (total <= 0) {
      if (error) error.textContent = 'El total debe ser mayor que cero.';
      return;
    }

    if (myShare < 0 || myShare > total) {
      if (error) error.textContent = 'Tu parte debe estar entre 0 y el total.';
      return;
    }

    const partnerShare = round2(Math.max(0, total - myShare));
    const owedAmount = payer === 'me' ? partnerShare : myShare;

    if (owedAmount <= 0) {
      if (error) error.textContent = 'No hay importe pendiente de devolver.';
      return;
    }

    const debt = {
      id: generateUUID(),
      concept,
      total: round2(total),
      myShare: round2(myShare),
      partnerShare,
      payer,
      owedBy: payer === 'me' ? 'partner' : 'me',
      owedAmount: round2(owedAmount),
      installments,
      installmentAmount: round2(owedAmount / installments),
      note,
      createdAt: new Date().toISOString(),
      firstDate,
      payments: [],
    };

    this.reimbursements.unshift(debt);
    this.saveReimbursements();
    this.renderReimbursements();

    // Reset form
    this.elements.form?.reset();
    if (this.elements.firstDate) this.elements.firstDate.value = todayISO();
    const defaultPayer = document.querySelector('input[name="debt-payer"][value="me"]');
    if (defaultPayer) defaultPayer.checked = true;
    this.updatePreview();

    toast.success('Reembolso guardado correctamente');
  }

  totalPaid(debt) {
    return round2((debt.payments || []).reduce((acc, p) => acc + (Number(p.amount) || 0), 0));
  }

  remainingAmount(debt) {
    return Math.max(0, round2((debt.owedAmount || 0) - this.totalPaid(debt)));
  }

  renderReimbursements() {
    const { list, empty } = this.elements;
    if (!list) return;

    if (!this.reimbursements.length) {
      if (empty) empty.classList.remove('hidden');
      list.innerHTML = '';
      return;
    }

    if (empty) empty.classList.add('hidden');

    list.innerHTML = this.reimbursements.map((debt) => this.renderDebtCard(debt)).join('');

    this.attachPaymentHandlers();
    this.attachDebtActionHandlers();
  }

  renderDebtCard(debt) {
    const paid = this.totalPaid(debt);
    const pending = this.remainingAmount(debt);
    const pct = debt.owedAmount > 0 ? Math.min(100, Math.round((paid / debt.owedAmount) * 100)) : 100;
    const payerLabel = debt.payer === 'me' ? 'Tú' : 'Tu pareja';
    const owedLabel = debt.owedBy === 'partner' ? 'Tu pareja te debe' : 'Le debes a tu pareja';
    const installmentsLabel = debt.installments > 1
      ? `${debt.installments} cuotas aprox. de ${formatMoney(debt.installmentAmount)}`
      : 'Pago único';
    const paymentsList = (debt.payments || []).length
      ? debt.payments.map((p) => `
          <li class="reimbursement-history-item">
            <div>
              <span class="reimbursement-history-amount">${formatMoney(p.amount)}</span>
              ${p.note ? `<span class="reimbursement-history-note">${escapeHtml(p.note)}</span>` : ''}
            </div>
            <span class="reimbursement-history-date">${escapeHtml(p.date || '')}</span>
          </li>
        `).join('')
      : '<li class="reimbursement-history-empty">Aún no hay pagos registrados.</li>';

    return `
      <article class="reimbursement-card" data-debt-id="${escapeHtml(debt.id)}">
        <header class="reimbursement-card-header">
          <div>
            <h3 class="reimbursement-card-title">${escapeHtml(debt.concept)}</h3>
            <p class="reimbursement-card-meta">Pagó: ${payerLabel} · ${installmentsLabel}</p>
            ${debt.note ? `<p class="reimbursement-card-note">${escapeHtml(debt.note)}</p>` : ''}
          </div>
          <div class="reimbursement-card-total">
            <p>Total</p>
            <strong>${formatMoney(debt.total)}</strong>
          </div>
        </header>
        <div class="reimbursement-card-actions">
          <button type="button" class="pill-button"
                  data-debt-action="settle" data-debt-id="${escapeHtml(debt.id)}">
            Liquidar deuda
          </button>
          <button type="button" class="pill-button pill-button--danger"
                  data-debt-action="delete" data-debt-id="${escapeHtml(debt.id)}">
            Eliminar
          </button>
        </div>

        <div class="reimbursement-card-grid">
          <div class="reimbursement-mini-card">
            <p>Tu parte</p>
            <strong>${formatMoney(debt.myShare)}</strong>
          </div>
          <div class="reimbursement-mini-card">
            <p>Parte pareja</p>
            <strong>${formatMoney(debt.partnerShare)}</strong>
          </div>
          <div class="reimbursement-mini-card ${pending === 0 ? 'is-settled' : 'is-pending'}">
            <p>${owedLabel}</p>
            <strong>${pending === 0 ? 'Liquidado' : formatMoney(pending)}</strong>
          </div>
        </div>

        <div class="reimbursement-progress">
          <div class="reimbursement-progress-meta">
            <span>Progreso de devolución</span>
            <span>${pct}%</span>
          </div>
          <div class="reimbursement-progress-track">
            <div class="reimbursement-progress-fill" style="width:${pct}%;"></div>
          </div>
        </div>

        <section class="reimbursement-history">
          <h4>Historial</h4>
          <ul>
            ${paymentsList}
          </ul>
        </section>

        <form class="payment-form reimbursement-payment-form" data-debt-id="${escapeHtml(debt.id)}">
          <div>
            <label class="reimbursement-payment-label">Importe</label>
            <div class="ios-input-wrapper">
              <span class="ios-input-prefix">€</span>
              <input name="amount" type="number" step="0.01" min="0" class="ios-input" placeholder="${debt.installmentAmount}">
            </div>
          </div>
          <div>
            <label class="reimbursement-payment-label">Fecha</label>
            <input name="date" type="date" class="ios-input" value="${todayISO()}">
          </div>
          <div>
            <label class="reimbursement-payment-label">Nota</label>
            <input name="note" type="text" class="ios-input" placeholder="Bizum, transferencia, efectivo...">
          </div>
          <div class="reimbursement-payment-actions">
            <button type="submit" class="ios-btn-primary">
              Registrar pago
            </button>
            <p class="payment-error ios-error"></p>
          </div>
        </form>
      </article>
    `;
  }

  attachPaymentHandlers() {
    document.querySelectorAll('.payment-form').forEach((form) => {
      form.addEventListener('submit', (e) => this.handlePaymentSubmit(e));
    });
  }

  handlePaymentSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const debtId = form.dataset.debtId;
    const amountInput = form.elements.amount;
    const dateInput = form.elements.date;
    const noteInput = form.elements.note;
    const errorEl = form.querySelector('.payment-error');
    if (errorEl) errorEl.textContent = '';

    const amount = parseFloat(String(amountInput.value || '').replace(',', '.')) || 0;
    if (amount <= 0) {
      if (errorEl) errorEl.textContent = 'Introduce un importe válido.';
      return;
    }

    const debt = this.reimbursements.find((d) => d.id === debtId);
    if (!debt) {
      if (errorEl) errorEl.textContent = 'No se encontró el reembolso.';
      return;
    }

    const remaining = this.remainingAmount(debt);
    if (amount > remaining + 0.01) {
      if (errorEl) errorEl.textContent = 'El pago supera lo pendiente.';
      return;
    }

    const payment = {
      id: generateUUID(),
      amount: round2(amount),
      date: dateInput.value || todayISO(),
      note: noteInput.value.trim(),
    };

    debt.payments = debt.payments || [];
    debt.payments.push(payment);

    this.saveReimbursements();
    this.renderReimbursements();
    toast.success('Pago registrado');
  }

  attachDebtActionHandlers() {
    document.querySelectorAll('[data-debt-action]').forEach((btn) => {
      btn.addEventListener('click', (e) => this.handleDebtAction(e));
    });
  }

  handleDebtAction(event) {
    const btn = event.currentTarget;
    const { debtId, debtAction } = btn.dataset;
    const debt = this.reimbursements.find((d) => d.id === debtId);
    if (!debt) return;

    if (debtAction === 'delete') {
      if (!confirm('¿Seguro que quieres eliminar este reembolso?')) return;
      this.reimbursements = this.reimbursements.filter((d) => d.id !== debtId);
      this.saveReimbursements();
      this.renderReimbursements();
      toast.info('Reembolso eliminado');
      return;
    }

    if (debtAction === 'settle') {
      const pending = this.remainingAmount(debt);
      if (pending <= 0.01) {
        toast.info('Este reembolso ya está liquidado');
        return;
      }
      if (!confirm(`Se registrará un pago final de ${formatMoney(pending)} para liquidar la deuda. ¿Continuar?`)) return;

      const payment = {
        id: generateUUID(),
        amount: round2(pending),
        date: todayISO(),
        note: 'Liquidación manual',
      };
      debt.payments = debt.payments || [];
      debt.payments.push(payment);
      this.saveReimbursements();
      this.renderReimbursements();
      toast.success('Deuda liquidada');
    }
  }

  normalizeReimbursements(source) {
    if (!Array.isArray(source)) return [];
    return source.map((item) => ({
      id: item?.id || generateUUID(),
      concept: String(item?.concept || ''),
      total: round2(Number(item?.total) || 0),
      myShare: round2(Number(item?.myShare) || 0),
      partnerShare: round2(Number(item?.partnerShare) || 0),
      payer: item?.payer === 'partner' ? 'partner' : 'me',
      owedBy: item?.owedBy === 'partner' ? 'partner' : 'me',
      owedAmount: round2(Number(item?.owedAmount) || 0),
      installments: Math.max(1, parseInt(item?.installments ?? 1, 10) || 1),
      installmentAmount: round2(Number(item?.installmentAmount) || 0),
      note: String(item?.note || ''),
      createdAt: item?.createdAt || new Date().toISOString(),
      firstDate: item?.firstDate || todayISO(),
      payments: Array.isArray(item?.payments)
        ? item.payments.map((p) => ({
            id: p.id || generateUUID(),
            amount: round2(Number(p.amount) || 0),
            date: p.date || todayISO(),
            note: String(p.note || ''),
          }))
        : [],
    }));
  }

  loadReimbursements() {
    const raw = storage.get(STORAGE_KEYS.REIMBURSEMENTS, []);
    this.reimbursements = this.normalizeReimbursements(raw);
  }

  saveReimbursements() {
    storage.set(STORAGE_KEYS.REIMBURSEMENTS, this.reimbursements);
    if (this.onStateChange) {
      this.onStateChange();
    }
  }

  getState() {
    return this.normalizeReimbursements(this.reimbursements);
  }

  restoreState(reimbursements, { skipSync = false } = {}) {
    if (Array.isArray(reimbursements)) {
      this.reimbursements = this.normalizeReimbursements(reimbursements);
      // Guardar en localStorage sin disparar sincronización remota
      storage.set(STORAGE_KEYS.REIMBURSEMENTS, this.reimbursements);
      if (!skipSync && this.onStateChange) {
        this.onStateChange();
      }
      this.renderReimbursements();
    }
  }
}

export default ReimbursementsManager;
