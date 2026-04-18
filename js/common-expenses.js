// common-expenses.js - Gestión de gastos comunes

import { STORAGE_KEYS } from './constants.js';
import { formatMoney, generateUUID, getElement, round2, storage, todayISO, escapeHtml } from './utils.js';
import toast from './toast.js';

const DEFAULT_EXPENSES = () => [
  {
    id: generateUUID(),
    concept: 'Hipoteca + gastos comunes',
    amount: 700,
    frequency: 'monthly',
    dueDay: 1,
    category: 'Vivienda',
    notes: 'Cuenta común',
  },
];

function getMonthlyAmount(expense) {
  const amount = Number(expense.amount) || 0;
  return expense.frequency === 'annual' ? round2(amount / 12) : round2(amount);
}

function getAnnualAmount(expense) {
  const amount = Number(expense.amount) || 0;
  return expense.frequency === 'annual' ? round2(amount) : round2(amount * 12);
}

class CommonExpensesManager {
  constructor() {
    this.expenses = [];
    this.elements = {};
    this.onStateChange = null;
    this.getCategories = () => ['Vivienda', 'Otros'];
  }

  init() {
    this.cacheElements();
    this.loadExpenses();
    this.attachEventListeners();
    this.render();
  }

  cacheElements() {
    this.elements = {
      addButton: getElement('common-expenses-add'),
      tableBody: getElement('common-expenses-body'),
      totalMonthly: getElement('common-expenses-total-monthly'),
      totalAnnual: getElement('common-expenses-total-annual'),
      updatedAt: getElement('common-expenses-updated-at'),
      empty: getElement('common-expenses-empty'),
    };
  }

  attachEventListeners() {
    if (this.elements.addButton) {
      this.elements.addButton.addEventListener('click', () => this.addExpense());
    }

    if (this.elements.tableBody) {
      this.elements.tableBody.addEventListener('input', (event) => this.handleTableInput(event));
      this.elements.tableBody.addEventListener('change', (event) => this.handleTableInput(event));
      this.elements.tableBody.addEventListener('click', (event) => this.handleTableClick(event));
    }
  }

  createExpense(overrides = {}) {
    return {
      id: generateUUID(),
      concept: '',
      amount: 0,
      frequency: 'monthly',
      dueDay: 0,
      category: 'Otros',
      notes: '',
      ...overrides,
    };
  }

  /**
   * Migra datos del formato antiguo (monthly, dueDate) al nuevo (amount, frequency, dueDay)
   */
  migrateExpense(item) {
    const migrated = { ...item };

    // Migrar monthly → amount (si no tiene amount)
    if (migrated.monthly !== undefined && migrated.amount === undefined) {
      migrated.amount = Number(migrated.monthly) || 0;
      delete migrated.monthly;
    }

    // Asegurar frequency
    if (!migrated.frequency) {
      migrated.frequency = 'monthly';
    }

    // Migrar dueDate → dueDay
    if (migrated.dueDate !== undefined && migrated.dueDay === undefined) {
      if (migrated.dueDate) {
        try {
          const day = new Date(migrated.dueDate).getDate();
          migrated.dueDay = (day >= 1 && day <= 31) ? day : 0;
        } catch {
          migrated.dueDay = 0;
        }
      } else {
        migrated.dueDay = 0;
      }
      delete migrated.dueDate;
    }

    return migrated;
  }

  normalizeExpenses(source) {
    const categories = this.getCategories();
    const fallbackCategory = categories[0] || 'Otros';

    if (!Array.isArray(source) || source.length === 0) {
      return DEFAULT_EXPENSES().map((item) => ({
        ...item,
        category: categories.includes(item.category) ? item.category : fallbackCategory,
      }));
    }

    return source.map((item) => {
      const migrated = this.migrateExpense(item);
      return this.createExpense({
        id: migrated?.id || generateUUID(),
        concept: String(migrated?.concept || ''),
        amount: round2(Number(migrated?.amount) || 0),
        frequency: migrated?.frequency === 'annual' ? 'annual' : 'monthly',
        dueDay: Math.max(0, Math.min(31, parseInt(migrated?.dueDay) || 0)),
        category: categories.includes(migrated?.category) ? migrated.category : fallbackCategory,
        notes: String(migrated?.notes || ''),
      });
    });
  }

  loadExpenses() {
    const raw = storage.get(STORAGE_KEYS.COMMON_EXPENSES, []);
    this.expenses = this.normalizeExpenses(raw);
  }

  saveExpenses() {
    storage.set(STORAGE_KEYS.COMMON_EXPENSES, this.expenses);
    if (this.onStateChange) {
      this.onStateChange();
    }
  }

  addExpense() {
    this.expenses.push(this.createExpense());
    this.saveExpenses();
    this.render();

    // Scroll al final de la tabla para que la nueva fila sea visible
    if (this.elements.tableBody) {
      const lastRow = this.elements.tableBody.lastElementChild;
      if (lastRow) {
        lastRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }

  removeExpense(expenseId) {
    if (this.expenses.length === 1) {
      toast.info('Deja al menos una fila para la tabla de gastos comunes');
      return;
    }

    this.expenses = this.expenses.filter((expense) => expense.id !== expenseId);
    this.saveExpenses();
    this.render();
  }

  updateExpense(expenseId, field, rawValue) {
    const expense = this.expenses.find((item) => item.id === expenseId);
    if (!expense) return null;

    if (field === 'amount') {
      expense.amount = round2(Math.max(0, parseFloat(String(rawValue || '').replace(',', '.')) || 0));
    } else if (field === 'frequency') {
      expense.frequency = rawValue === 'annual' ? 'annual' : 'monthly';
    } else if (field === 'dueDay') {
      expense.dueDay = Math.max(0, Math.min(31, parseInt(rawValue) || 0));
    } else if (field === 'category') {
      const categories = this.getCategories();
      expense.category = categories.includes(rawValue) ? rawValue : (categories[0] || 'Otros');
    } else if (field === 'concept' || field === 'notes') {
      expense[field] = String(rawValue || '');
    }

    this.saveExpenses();
    this.renderSummary();
    return expense;
  }

  handleTableInput(event) {
    const target = event.target;
    const expenseId = target?.dataset?.expenseId;
    const field = target?.dataset?.field;

    if (!expenseId || !field) return;
    const updatedExpense = this.updateExpense(expenseId, field, target.value);
    if (!updatedExpense) return;

    // Actualizar columnas calculadas de esa fila
    if (field === 'amount' || field === 'frequency') {
      const row = target.closest('tr');
      const monthlyCell = row?.querySelector('.col-monthly');
      const annualCell = row?.querySelector('.col-annual');
      if (monthlyCell) monthlyCell.textContent = formatMoney(getMonthlyAmount(updatedExpense));
      if (annualCell) annualCell.textContent = formatMoney(getAnnualAmount(updatedExpense));
    }
  }

  handleTableClick(event) {
    const button = event.target.closest('[data-remove-expense]');
    if (!button) return;
    this.removeExpense(button.dataset.removeExpense);
  }

  render() {
    const { tableBody, empty } = this.elements;
    if (!tableBody) return;
    const categories = this.getCategories();

    if (!this.expenses.length) {
      if (empty) empty.classList.remove('hidden');
      tableBody.innerHTML = '';
      return;
    }

    if (empty) empty.classList.add('hidden');

    tableBody.innerHTML = this.expenses.map((expense) => `
      <tr>
        <td class="cell-concept" data-label="Concepto">
          <input
            type="text"
            class="table-input"
            value="${escapeHtml(expense.concept)}"
            placeholder="Hipoteca, luz..."
            data-expense-id="${escapeHtml(expense.id)}"
            data-field="concept"
          >
        </td>
        <td class="cell-amount" data-label="Importe">
          <div class="table-money-input">
            <span>€</span>
            <input
              type="number"
              step="0.01"
              min="0"
              class="table-input table-input--money"
              value="${expense.amount}"
              data-expense-id="${escapeHtml(expense.id)}"
              data-field="amount"
            >
          </div>
        </td>
        <td class="cell-frequency" data-label="Frecuencia">
          <select
            class="table-input table-select"
            data-expense-id="${escapeHtml(expense.id)}"
            data-field="frequency"
          >
            <option value="monthly" ${expense.frequency === 'monthly' ? 'selected' : ''}>Mes</option>
            <option value="annual" ${expense.frequency === 'annual' ? 'selected' : ''}>Año</option>
          </select>
        </td>
        <td class="cell-monthly col-monthly" data-label="Mensual">${formatMoney(getMonthlyAmount(expense))}</td>
        <td class="cell-annual col-annual" data-label="Anual">${formatMoney(getAnnualAmount(expense))}</td>
        <td class="cell-day" data-label="Día cobro">
          <input
            type="number"
            min="1"
            max="31"
            class="table-input table-input--day"
            value="${expense.dueDay || ''}"
            placeholder="—"
            data-expense-id="${escapeHtml(expense.id)}"
            data-field="dueDay"
          >
        </td>
        <td class="cell-category" data-label="Categoría">
          <select
            class="table-input table-select"
            data-expense-id="${escapeHtml(expense.id)}"
            data-field="category"
          >
            ${categories.map((category) => `
              <option value="${escapeHtml(category)}" ${expense.category === category ? 'selected' : ''}>${escapeHtml(category)}</option>
            `).join('')}
          </select>
        </td>
        <td class="cell-notes" data-label="Notas">
          <input
            type="text"
            class="table-input"
            value="${escapeHtml(expense.notes)}"
            placeholder="Nota..."
            data-expense-id="${escapeHtml(expense.id)}"
            data-field="notes"
          >
        </td>
        <td class="cell-actions table-actions">
          <button type="button" class="icon-action" data-remove-expense="${escapeHtml(expense.id)}" aria-label="Eliminar fila">
            ×
          </button>
        </td>
      </tr>
    `).join('');

    this.renderSummary();
  }

  renderSummary() {
    const summary = this.getSummary();

    if (this.elements.totalMonthly) {
      this.elements.totalMonthly.textContent = formatMoney(summary.totalMonthly);
    }

    if (this.elements.totalAnnual) {
      this.elements.totalAnnual.textContent = formatMoney(summary.totalAnnual);
    }

    if (this.elements.updatedAt) {
      this.elements.updatedAt.textContent = `Actualizado: ${new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date())}`;
    }
  }

  getState() {
    return this.normalizeExpenses(this.expenses);
  }

  restoreState(expenses, { skipSync = false } = {}) {
    this.expenses = this.normalizeExpenses(expenses);
    storage.set(STORAGE_KEYS.COMMON_EXPENSES, this.expenses);
    if (!skipSync && this.onStateChange) {
      this.onStateChange();
    }
    this.render();
  }

  getSummary() {
    const totalMonthly = round2(this.expenses.reduce((acc, expense) => acc + getMonthlyAmount(expense), 0));
    return {
      totalMonthly,
      totalAnnual: round2(totalMonthly * 12),
      count: this.expenses.length,
      categories: this.expenses.reduce((acc, expense) => {
        const current = acc[expense.category] || 0;
        acc[expense.category] = round2(current + getMonthlyAmount(expense));
        return acc;
      }, {}),
    };
  }

  refreshCategories() {
    const categories = this.getCategories();
    const fallbackCategory = categories[0] || 'Otros';
    this.expenses = this.expenses.map((expense) => ({
      ...expense,
      category: categories.includes(expense.category) ? expense.category : fallbackCategory,
    }));
    this.saveExpenses();
    this.render();
  }
}

export default CommonExpensesManager;
