// settings.js - Ajustes persistentes de perfiles y categorías

import { STORAGE_KEYS } from './constants.js';
import { escapeHtml, generateUUID, getElement, storage } from './utils.js';
import toast from './toast.js';

const DEFAULT_CATEGORIES = [
  'Vivienda',
  'Suministros',
  'Servicios',
  'Suscripciones',
  'Comida',
  'Ocio',
  'Transporte',
  'Ahorro',
  'Otros',
];

const DEFAULT_SETTINGS = {
  profiles: {
    me: 'Tú',
    partner: 'Pareja',
  },
  deviceUser: 'me',
  categories: DEFAULT_CATEGORIES,
};

class SettingsManager {
  constructor() {
    this.settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
    this.elements = {};
    this.onStateChange = null;
  }

  init() {
    this.cacheElements();
    this.loadSettings();
    this.attachEventListeners();
    this.render();
  }

  cacheElements() {
    this.elements = {
      meName: getElement('settings-name-me'),
      partnerName: getElement('settings-name-partner'),
      deviceRadios: document.querySelectorAll('input[name="settings-device-user"]'),
      categoriesList: getElement('settings-categories-list'),
      categoryInput: getElement('settings-category-input'),
      addCategory: getElement('settings-category-add'),
      profileMeLabel: getElement('settings-profile-me-label'),
      profilePartnerLabel: getElement('settings-profile-partner-label'),
      profileMeText: getElement('settings-profile-me-text'),
      profilePartnerText: getElement('settings-profile-partner-text'),
    };
  }

  attachEventListeners() {
    this.elements.meName?.addEventListener('input', () => this.updateProfile('me', this.elements.meName.value));
    this.elements.partnerName?.addEventListener('input', () => this.updateProfile('partner', this.elements.partnerName.value));

    this.elements.deviceRadios?.forEach((radio) => {
      radio.addEventListener('change', () => {
        if (radio.checked) {
          this.settings.deviceUser = radio.value === 'partner' ? 'partner' : 'me';
          this.saveSettings();
          this.renderProfilePreview();
        }
      });
    });

    this.elements.addCategory?.addEventListener('click', () => this.addCategory());
    this.elements.categoryInput?.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        this.addCategory();
      }
    });

    this.elements.categoriesList?.addEventListener('click', (event) => {
      const removeButton = event.target.closest('[data-remove-category]');
      if (!removeButton) return;
      this.removeCategory(removeButton.dataset.removeCategory);
    });
  }

  loadSettings() {
    const raw = storage.get(STORAGE_KEYS.USER_SETTINGS, DEFAULT_SETTINGS);
    this.settings = this.normalizeSettings(raw);
  }

  normalizeSettings(raw) {
    const profiles = raw?.profiles || {};
    const me = String(profiles.me || DEFAULT_SETTINGS.profiles.me).trim() || DEFAULT_SETTINGS.profiles.me;
    const partner = String(profiles.partner || DEFAULT_SETTINGS.profiles.partner).trim() || DEFAULT_SETTINGS.profiles.partner;
    const categories = Array.isArray(raw?.categories) && raw.categories.length
      ? raw.categories
          .map((item) => String(item || '').trim())
          .filter(Boolean)
          .filter((item, index, arr) => arr.indexOf(item) === index)
      : DEFAULT_CATEGORIES;

    return {
      profiles: { me, partner },
      deviceUser: raw?.deviceUser === 'partner' ? 'partner' : 'me',
      categories,
    };
  }

  saveSettings() {
    storage.set(STORAGE_KEYS.USER_SETTINGS, this.settings);
    if (this.onStateChange) {
      this.onStateChange();
    }
  }

  updateProfile(key, value) {
    const cleanValue = String(value || '').trim();
    this.settings.profiles[key] = cleanValue || DEFAULT_SETTINGS.profiles[key];
    this.saveSettings();
    this.renderProfilePreview();
  }

  addCategory() {
    const value = String(this.elements.categoryInput?.value || '').trim();
    if (!value) return;
    if (this.settings.categories.includes(value)) {
      toast.info('Esa categoría ya existe');
      return;
    }

    this.settings.categories.push(value);
    if (this.elements.categoryInput) {
      this.elements.categoryInput.value = '';
    }
    this.saveSettings();
    this.renderCategories();
  }

  removeCategory(category) {
    if (this.settings.categories.length <= 1) {
      toast.info('Debe quedar al menos una categoría');
      return;
    }

    this.settings.categories = this.settings.categories.filter((item) => item !== category);
    this.saveSettings();
    this.renderCategories();
  }

  render() {
    if (this.elements.meName) {
      this.elements.meName.value = this.settings.profiles.me;
    }
    if (this.elements.partnerName) {
      this.elements.partnerName.value = this.settings.profiles.partner;
    }
    this.elements.deviceRadios?.forEach((radio) => {
      radio.checked = radio.value === this.settings.deviceUser;
    });

    this.renderProfilePreview();
    this.renderCategories();
  }

  renderProfilePreview() {
    if (this.elements.profileMeLabel) {
      this.elements.profileMeLabel.textContent = this.settings.profiles.me;
    }
    if (this.elements.profilePartnerLabel) {
      this.elements.profilePartnerLabel.textContent = this.settings.profiles.partner;
    }
    if (this.elements.profileMeText) {
      this.elements.profileMeText.textContent = this.settings.deviceUser === 'me'
        ? 'Este es el perfil activo en este dispositivo.'
        : 'Perfil listo para cálculos, resumen y etiquetas.';
    }
    if (this.elements.profilePartnerText) {
      this.elements.profilePartnerText.textContent = this.settings.deviceUser === 'partner'
        ? 'Este es el perfil activo en este dispositivo.'
        : 'Perfil listo para cálculos, resumen y etiquetas.';
    }
  }

  renderCategories() {
    if (!this.elements.categoriesList) return;

    this.elements.categoriesList.innerHTML = this.settings.categories.map((category) => `
      <div class="settings-placeholder-item">
        <span>${escapeHtml(category)}</span>
        <button type="button" class="mini-action" data-remove-category="${escapeHtml(category)}">Quitar</button>
      </div>
    `).join('');
  }

  getState() {
    return this.normalizeSettings(this.settings);
  }

  restoreState(state, { skipSync = false } = {}) {
    this.settings = this.normalizeSettings(state);
    storage.set(STORAGE_KEYS.USER_SETTINGS, this.settings);
    if (!skipSync && this.onStateChange) {
      this.onStateChange();
    }
    this.render();
  }

  getProfiles() {
    return { ...this.settings.profiles, deviceUser: this.settings.deviceUser };
  }

  getCategories() {
    return [...this.settings.categories];
  }
}

export default SettingsManager;
