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
          <li class="flex justify-between gap-3 py-1 border-b border-slate-100 last:border-0 text-sm">
            <div>
              <span class="font-medium text-slate-700">${formatMoney(p.amount)}</span>
              ${p.note ? `<span class="text-xs text-slate-500 block">${escapeHtml(p.note)}</span>` : ''}
            </div>
            <span class="text-xs text-slate-500 whitespace-nowrap">${escapeHtml(p.date || '')}</span>
          </li>
        `).join('')
      : '<li class="text-sm text-slate-500 italic">Aún no hay pagos registrados.</li>';

    return `
      <article class="card space-y-4" data-debt-id="${escapeHtml(debt.id)}">
        <header class="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
          <div>
            <h3 class="text-lg font-semibold text-slate-800">${escapeHtml(debt.concept)}</h3>
            <p class="text-sm text-slate-500">Pagó: ${payerLabel} · ${installmentsLabel}</p>
            ${debt.note ? `<p class="mt-1 text-xs text-slate-500">${escapeHtml(debt.note)}</p>` : ''}
          </div>
          <div class="text-right">
            <p class="text-sm text-slate-500">Total</p>
            <p class="text-2xl font-semibold text-slate-800">${formatMoney(debt.total)}</p>
          </div>
        </header>
        <div class="flex flex-wrap gap-2 md:justify-end">
          <button type="button" class="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-emerald-400 hover:text-emerald-600 transition"
                  data-debt-action="settle" data-debt-id="${escapeHtml(debt.id)}">
            Liquidar deuda
          </button>
          <button type="button" class="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-600 bg-rose-50 hover:bg-rose-100 transition"
                  data-debt-action="delete" data-debt-id="${escapeHtml(debt.id)}">
            Eliminar
          </button>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
          <div class="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <p class="text-slate-500">Tu parte</p>
            <p class="font-semibold text-slate-800">${formatMoney(debt.myShare)}</p>
          </div>
          <div class="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <p class="text-slate-500">Parte pareja</p>
            <p class="font-semibold text-slate-800">${formatMoney(debt.partnerShare)}</p>
          </div>
          <div class="rounded-lg border border-slate-200 px-3 py-2 ${pending === 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}">
            <p class="text-slate-500">${owedLabel}</p>
            <p class="font-semibold ${pending === 0 ? 'text-emerald-700' : 'text-amber-700'}">${pending === 0 ? 'Liquidado' : formatMoney(pending)}</p>
          </div>
        </div>

        <div>
          <div class="flex items-center justify-between text-sm text-slate-500 mb-1">
            <span>Progreso de devolución</span>
            <span>${pct}%</span>
          </div>
          <div class="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
            <div class="h-full bg-[var(--primary)] transition-all" style="width:${pct}%;"></div>
          </div>
        </div>

        <section class="space-y-2">
          <h4 class="text-sm font-semibold text-slate-600 uppercase tracking-wide">Historial</h4>
          <ul class="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white overflow-hidden">
            ${paymentsList}
          </ul>
        </section>

        <form class="payment-form grid gap-3 md:grid-cols-[repeat(auto-fit,minmax(140px,1fr))]" data-debt-id="${escapeHtml(debt.id)}">
          <div class="md:col-span-1">
            <label class="text-xs text-slate-500 block mb-1">Importe</label>
            <div class="relative">
              <span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">€</span>
              <input name="amount" type="number" step="0.01" min="0" class="pl-7 w-full rounded-lg border border-slate-300 py-2 px-2 focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-200" placeholder="${debt.installmentAmount}">
            </div>
          </div>
          <div>
            <label class="text-xs text-slate-500 block mb-1">Fecha</label>
            <input name="date" type="date" class="w-full rounded-lg border border-slate-300 py-2 px-3 focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-200" value="${todayISO()}">
          </div>
          <div class="md:col-span-2">
            <label class="text-xs text-slate-500 block mb-1">Nota (opcional)</label>
            <input name="note" type="text" class="w-full rounded-lg border border-slate-300 py-2 px-3 focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-200" placeholder="Bizum, transferencia, efectivo...">
          </div>
          <div class="md:col-span-full flex flex-col gap-2 sm:flex-row sm:items-center">
            <button type="submit" class="inline-flex justify-center rounded-lg bg-emerald-500 text-white font-semibold px-4 py-2 shadow hover:bg-emerald-600 transition">
              Registrar pago
            </button>
            <p class="payment-error text-xs text-rose-600"></p>
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
