// toast.js - Sistema de notificaciones tipo toast (iOS style)

import { TOAST_TYPES, TIMINGS } from './constants.js';
import { escapeHtml } from './utils.js';

class ToastManager {
  constructor() {
    this.container = null;
    this.init();
  }

  init() {
    if (!document.getElementById('toast-container')) {
      this.container = document.createElement('div');
      this.container.id = 'toast-container';
      this.container.setAttribute('aria-live', 'polite');
      this.container.setAttribute('aria-atomic', 'true');
      document.body.appendChild(this.container);
    } else {
      this.container = document.getElementById('toast-container');
    }
  }

  show(message, type = TOAST_TYPES.INFO, duration = TIMINGS.TOAST_DURATION) {
    const toast = this.createToast(message, type);
    this.container.appendChild(toast);

    requestAnimationFrame(() => {
      toast.classList.add('ios-toast-visible');
    });

    if (duration > 0) {
      setTimeout(() => {
        this.dismiss(toast);
      }, duration);
    }

    return toast;
  }

  createToast(message, type) {
    const toast = document.createElement('div');
    toast.className = `ios-toast ios-toast-${type}`;
    toast.setAttribute('role', 'alert');

    const icon = this.getIcon(type);
    const closeBtn = this.createCloseButton();

    toast.innerHTML = `
      <div class="ios-toast-icon">${icon}</div>
      <div class="ios-toast-message">${escapeHtml(message)}</div>
    `;
    toast.appendChild(closeBtn);

    closeBtn.addEventListener('click', () => this.dismiss(toast));

    return toast;
  }

  getIcon(type) {
    const icons = {
      [TOAST_TYPES.INFO]: `
        <svg width="20" height="20" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/>
        </svg>
      `,
      [TOAST_TYPES.SUCCESS]: `
        <svg width="20" height="20" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
        </svg>
      `,
      [TOAST_TYPES.WARNING]: `
        <svg width="20" height="20" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
        </svg>
      `,
      [TOAST_TYPES.ERROR]: `
        <svg width="20" height="20" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/>
        </svg>
      `,
    };
    return icons[type] || icons[TOAST_TYPES.INFO];
  }

  createCloseButton() {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ios-toast-close';
    btn.setAttribute('aria-label', 'Cerrar notificación');
    btn.innerHTML = `
      <svg width="16" height="16" fill="currentColor" viewBox="0 0 20 20">
        <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/>
      </svg>
    `;
    return btn;
  }

  dismiss(toast) {
    toast.classList.remove('ios-toast-visible');

    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 300);
  }

  info(message, duration) {
    return this.show(message, TOAST_TYPES.INFO, duration);
  }

  success(message, duration) {
    return this.show(message, TOAST_TYPES.SUCCESS, duration);
  }

  warning(message, duration) {
    return this.show(message, TOAST_TYPES.WARNING, duration);
  }

  error(message, duration) {
    return this.show(message, TOAST_TYPES.ERROR, duration);
  }

  clear() {
    while (this.container.firstChild) {
      this.container.removeChild(this.container.firstChild);
    }
  }
}

const toast = new ToastManager();

export default toast;
