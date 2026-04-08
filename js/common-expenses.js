// common-expenses.js - Gestión de gastos comunes

import { STORAGE_KEYS } from './constants.js';
import { formatMoney, generateUUID, getElement, round2, storage, todayISO, escapeHtml } from './utils.js';
import toast from './toast.js';

const DEFAULT_EXPENSES = () => [
  {
    id: generateUUID(),
    concept: 'Hipoteca + gastos comunes',
    monthly: 700,
    dueDate: '',
    category: 'Vivienda',
    notes: 'Cuenta común',
  },
];

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
      monthly: 0,
      dueDate: '',
      category: 'Otros',
      notes: '',
      ...overrides,
    };
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

    return source.map((item) => this.createExpense({
      id: item?.id || generateUUID(),
      concept: String(item?.concept || ''),
      monthly: round2(Number(item?.monthly) || 0),
      dueDate: item?.dueDate || '',
      category: categories.includes(item?.category) ? item.category : fallbackCategory,
      notes: String(item?.notes || ''),
    }));
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

    if (field === 'monthly') {
      expense.monthly = round2(Math.max(0, parseFloat(String(rawValue || '').replace(',', '.')) || 0));
    } else if (field === 'dueDate') {
      expense.dueDate = String(rawValue || '');
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

    if (field === 'monthly') {
      const row = target.closest('tr');
      const annualCell = row?.querySelector('.table-annual');
      if (annualCell) {
        annualCell.textContent = formatMoney(round2(updatedExpense.monthly * 12));
      }
    }
  }

  handleTableClick(event) {
    const button = event.target.closest('[data-remove-expense]');
    if (!button) return;
    this.removeExpense(button.dataset.removeExpense);
  }

  formatDate(dateValue) {
    if (!dateValue) return 'Sin fecha';
    try {
      return new Intl.DateTimeFormat('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }).format(new Date(dateValue));
    } catch {
      return dateValue;
    }
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
        <td>
          <input
            type="text"
            class="table-input"
            value="${escapeHtml(expense.concept)}"
            placeholder="Hipoteca, luz, internet..."
            data-expense-id="${escapeHtml(expense.id)}"
            data-field="concept"
          >
        </td>
        <td>
          <div class="table-money-input">
            <span>€</span>
            <input
              type="number"
              step="0.01"
              min="0"
              class="table-input table-input--money"
              value="${expense.monthly}"
              data-expense-id="${escapeHtml(expense.id)}"
              data-field="monthly"
            >
          </div>
        </td>
        <td class="table-annual">${formatMoney(round2(expense.monthly * 12))}</td>
        <td>
          <input
            type="date"
            class="table-input"
            value="${escapeHtml(expense.dueDate)}"
            data-expense-id="${escapeHtml(expense.id)}"
            data-field="dueDate"
          >
        </td>
        <td>
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
        <td>
          <input
            type="text"
            class="table-input"
            value="${escapeHtml(expense.notes)}"
            placeholder="Cuenta común, renovación..."
            data-expense-id="${escapeHtml(expense.id)}"
            data-field="notes"
          >
        </td>
        <td class="table-actions">
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
      this.elements.updatedAt.textContent = `Actualizado: ${this.formatDate(todayISO())}`;
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
    const totalMonthly = round2(this.expenses.reduce((acc, expense) => acc + (Number(expense.monthly) || 0), 0));
    return {
      totalMonthly,
      totalAnnual: round2(totalMonthly * 12),
      count: this.expenses.length,
      categories: this.expenses.reduce((acc, expense) => {
        const current = acc[expense.category] || 0;
        acc[expense.category] = round2(current + expense.monthly);
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
