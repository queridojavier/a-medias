// split.js - Divisor rápido

import { DEFAULTS } from './constants.js';
import { formatMoney, round2, readNumber, getElement } from './utils.js';

class SplitCalculator {
  constructor() {
    this.elements = {};
  }

  init() {
    this.cacheElements();
    this.attachEventListeners();
    this.updateResult();
  }

  cacheElements() {
    this.elements = {
      total: getElement('split-total'),
      count: getElement('split-count'),
      amountEach: getElement('split-amount-each'),
      detail: getElement('split-detail'),
      remainder: getElement('split-remainder'),
      context: getElement('split-context'),
    };
  }

  attachEventListeners() {
    const { total, count } = this.elements;

    if (total) {
      total.addEventListener('input', () => this.updateResult());
    }

    if (count) {
      count.addEventListener('input', () => this.updateResult());
    }

    document.querySelectorAll('[data-split-count]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const target = parseInt(btn.dataset.splitCount, 10) || 2;
        if (this.elements.count) {
          this.elements.count.value = target;
        }
        this.updateResult();
      });
    });
  }

  updateResult() {
    const total = readNumber('split-total');
    const countInput = this.elements.count;
    if (!countInput) return;

    let count = Math.max(1, parseInt(countInput.value, 10) || 1);
    countInput.value = count;

    const totalCents = Math.round(total * 100);
    const baseCents = count ? Math.floor(totalCents / count) : 0;
    const remainder = count ? totalCents - baseCents * count : 0;
    const higherCents = baseCents + (remainder > 0 ? 1 : 0);

    const { amountEach, detail, remainder: remainderEl, context } = this.elements;

    if (amountEach) {
      const avg = count > 0 ? round2(total / count) : 0;
      amountEach.textContent = formatMoney(avg);
    }

    if (detail) {
      if (total <= 0) {
        detail.textContent = 'Introduce un importe para calcular el reparto.';
      } else if (remainder === 0) {
        detail.textContent = `Todos pagan ${formatMoney(baseCents / 100)} para cubrir ${formatMoney(total)}.`;
      } else {
        const higherPeople = remainder;
        const lowerPeople = count - remainder;
        detail.textContent = `${higherPeople} ${higherPeople === 1 ? 'persona' : 'personas'} pagan ${formatMoney(higherCents / 100)} y ${lowerPeople} ${lowerPeople === 1 ? 'persona' : 'personas'} pagan ${formatMoney(baseCents / 100)} para llegar a ${formatMoney(total)}.`;
      }
    }

    if (remainderEl) {
      remainderEl.textContent = remainder === 0
        ? ''
        : 'Distribuimos los céntimos sobrantes para que el total encaje al céntimo.';
    }

    if (context) {
      context.textContent = count === 2
        ? 'Ideal para dividir un gasto entre tu pareja y tú.'
        : `Dividiendo entre ${count} personas.`;
    }

    this.updateChips(count);
  }

  updateChips(activeCount) {
    document.querySelectorAll('[data-split-count]').forEach((btn) => {
      const target = parseInt(btn.dataset.splitCount, 10);
      const isActive = target === activeCount;
      btn.classList.toggle('chip-button-active', isActive);
    });
  }
}

export default SplitCalculator;
