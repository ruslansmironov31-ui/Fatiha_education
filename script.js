/**
 * ОСНОВНАЯ ЛОГИКА ПОРТАЛА — FATIH EDUCATIONS
 * Нативный ES6+ без тяжёлых фреймворков.
 * Включает безопасный рендеринг (защита от XSS), фильтрацию каталога,
 * модальное окно подробностей, FAQ-аккордеон и валидацию формы.
 */

import {
  UNIVERSITIES as DEFAULT_UNIVERSITIES,
  CAMPUS_IMAGE_PRESETS,
  COUNTRIES,
  STATUS_META,
  CONTACT_CONFIG,
} from './universities.js';

const STORAGE_KEY = 'fatiha_demo_universities_v1';

// ============================================================================
// 1. БЕЗОПАСНОСТЬ И САНИТИЗАЦИЯ ВВОДА
// ============================================================================

/**
 * Экранирование HTML-спецсимволов для защиты от XSS при вставке строк в DOM.
 */
function escapeHtml(value) {
  const str = String(value ?? '');
  return str
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/**
 * Очистка и нормализация пользовательского ввода перед подстановкой в ссылки/сообщения.
 */
function sanitizePlainText(value, maxLength = 300) {
  return String(value ?? '')
    .replace(/[\u0000-\u001F\u007F<>]/g, '')
    .trim()
    .slice(0, maxLength);
}

/**
 * Проверка безопасности пути к изображению (локальные ассеты или проверенный data:image).
 */
function safeImageSrc(src) {
  if (typeof src === 'string') {
    if (src.startsWith('/src/assets/') || src.startsWith('/assets/')) {
      return src;
    }
    if (/^data:image\/(png|jpeg|jpg|webp);base64,[A-Za-z0-9+/=]+$/.test(src)) {
      return src;
    }
  }
  return '/src/assets/images/hero_fatih_campus_1795491435106.jpg';
}

/**
 * Построение безопасных ссылок для WhatsApp и Telegram с предзаполненным текстом.
 */
function buildWhatsAppUrl(message) {
  const cleanPhone = String(CONTACT_CONFIG.whatsappPhone).replace(/\D/g, '');
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
}

function buildTelegramUrl(message) {
  const cleanUser = String(CONTACT_CONFIG.telegramUsername).replace(/[^a-zA-Z0-9_]/g, '');
  return `https://t.me/${cleanUser}?text=${encodeURIComponent(message)}`;
}

function loadUniversitiesFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(DEFAULT_UNIVERSITIES);
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
  } catch {
    // Fallback на дефолтный список при повреждении localStorage
  }
  return structuredClone(DEFAULT_UNIVERSITIES);
}

function saveUniversitiesToStorage(list) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// 2. СОСТОЯНИЕ ПРИЛОЖЕНИЯ И DOM-ЭЛЕМЕНТЫ
// ============================================================================

let universitiesData = loadUniversitiesFromStorage();

const state = {
  country: 'Все страны',
  status: 'all',
  search: '',
  lastFocusedElement: null,
  slideIndex: 0,
  slideTimer: null,
  selectedAdminId: universitiesData[0]?.id || null,
  pendingAdminImage: '',
};

const dom = {
  grid: document.getElementById('universities-grid'),
  emptyState: document.getElementById('catalog-empty'),
  countLabel: document.getElementById('catalog-count'),
  countryFilterBar: document.getElementById('country-filter-bar'),
  searchInput: document.getElementById('university-search'),
  statusTabs: document.querySelectorAll('[data-status-filter]'),
  resetFiltersBtn: document.getElementById('reset-filters-btn'),
  emptyResetBtn: document.getElementById('empty-reset-btn'),

  // Шапка и меню
  dropdownBtn: document.getElementById('nav-universities-btn'),
  dropdownMenu: document.getElementById('nav-universities-menu'),
  mobileToggle: document.getElementById('mobile-menu-toggle'),
  mobileDrawer: document.getElementById('mobile-drawer'),

  // Модальное окно
  modal: document.getElementById('university-modal'),
  modalBody: document.getElementById('modal-body-content'),
  modalCloseBtn: document.getElementById('modal-close-btn'),

  // Форма заявки
  leadForm: document.getElementById('lead-form'),
  inputName: document.getElementById('applicant-name'),
  inputAge: document.getElementById('applicant-age'),
  inputPhone: document.getElementById('applicant-phone'),
  inputCountry: document.getElementById('applicant-country'),
  inputUniversity: document.getElementById('applicant-university'),
  inputComment: document.getElementById('applicant-comment'),
  inputConsent: document.getElementById('applicant-consent'),
  successBox: document.getElementById('form-success-box'),
  successSummary: document.getElementById('form-success-summary'),
  successWaLink: document.getElementById('success-whatsapp-link'),
  successTgLink: document.getElementById('success-telegram-link'),

  // Слайдшоу Hero
  heroSection: document.getElementById('hero'),
  slideshowBox: document.getElementById('hero-slideshow'),
  slideshowStage: document.getElementById('slideshow-stage'),
  slideshowMetaInfo: document.getElementById('slideshow-meta-info'),
  slideshowDots: document.getElementById('slideshow-dots'),
  slideshowCounter: document.getElementById('slideshow-counter'),
  slideshowPrev: document.getElementById('slideshow-prev'),
  slideshowNext: document.getElementById('slideshow-next'),

  // Демо-админка
  adminTriggers: document.querySelectorAll('[data-open-admin]'),
  adminModal: document.getElementById('admin-modal'),
  adminCloseBtn: document.getElementById('admin-close-btn'),
  adminUniList: document.getElementById('admin-uni-list'),
  adminEditorForm: document.getElementById('admin-editor-form'),
  adminUniId: document.getElementById('admin-uni-id'),
  adminImgPreview: document.getElementById('admin-img-preview'),
  adminImagePreset: document.getElementById('admin-image-preset'),
  adminImageUpload: document.getElementById('admin-image-upload'),
  adminName: document.getElementById('admin-name'),
  adminCountry: document.getElementById('admin-country'),
  adminCity: document.getElementById('admin-city'),
  adminStatus: document.getElementById('admin-status'),
  adminAge: document.getElementById('admin-age'),
  adminDates: document.getElementById('admin-dates'),
  adminShortGrant: document.getElementById('admin-short-grant'),
  adminFeedback: document.getElementById('admin-feedback'),
  adminNewBtn: document.getElementById('admin-new-btn'),
  adminResetBtn: document.getElementById('admin-reset-btn'),
  adminDeleteBtn: document.getElementById('admin-delete-btn'),
};

// ============================================================================
// 3. ВСПОМОГАТЕЛЬНЫЕ SVG-ИКОНКИ СТАТУСА (Цвет всегда дублируется иконкой и текстом)
// ============================================================================

function getStatusIconSvg(iconType) {
  if (iconType === 'check') {
    return `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
  }
  if (iconType === 'clock') {
    return `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>`;
  }
  return `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>`;
}

// ============================================================================
// 4. ФИЛЬТРАЦИЯ И РЕНДЕРИНГ КАТАЛОГА УНИВЕРСИТЕТОВ
// ============================================================================

function renderCountryFilters() {
  if (!dom.countryFilterBar) return;
  dom.countryFilterBar.innerHTML = '';

  COUNTRIES.forEach((country) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `country-btn${state.country === country ? ' is-active' : ''}`;
    btn.textContent = country;
    btn.dataset.countryFilter = country;
    btn.addEventListener('click', () => {
      state.country = country;
      updateCatalog();
    });
    dom.countryFilterBar.appendChild(btn);
  });
}

function getFilteredUniversities() {
  const query = state.search.trim().toLowerCase();

  return universitiesData.filter((uni) => {
    const matchesCountry =
      state.country === 'Все страны' || uni.country === state.country;
    const matchesStatus =
      state.status === 'all' || uni.status === state.status;
    const matchesSearch =
      !query ||
      uni.name.toLowerCase().includes(query) ||
      uni.city.toLowerCase().includes(query) ||
      uni.country.toLowerCase().includes(query) ||
      uni.shortGrant.toLowerCase().includes(query);

    return matchesCountry && matchesStatus && matchesSearch;
  });
}

function createUniversityCard(uni) {
  const statusInfo = STATUS_META[uni.status] || STATUS_META.closed;
  const card = document.createElement('article');
  card.className = 'uni-card';

  card.innerHTML = `
    <div class="uni-card-media">
      <img
        src="${escapeHtml(safeImageSrc(uni.image))}"
        alt="${escapeHtml(uni.name)} — ${escapeHtml(uni.city)}, ${escapeHtml(uni.country)}"
        class="uni-card-img"
        loading="lazy"
        width="640"
        height="480"
        referrerpolicy="no-referrer"
      />
    </div>
    <div class="uni-card-body">
      <div class="uni-card-header">
        <span class="uni-location">${escapeHtml(uni.country)} · ${escapeHtml(uni.city)}</span>
        <span class="status-tag ${escapeHtml(statusInfo.className)}">
          ${getStatusIconSvg(statusInfo.icon)}
          <span>${escapeHtml(statusInfo.label)}</span>
        </span>
      </div>

      <h3 class="uni-title">${escapeHtml(uni.name)}</h3>
      <p class="uni-grant-summary">${escapeHtml(uni.shortGrant)}</p>

      <div class="uni-specs">
        <div class="uni-spec-row">
          <span class="uni-spec-label">Возраст:</span>
          <span class="uni-spec-value tabular-nums">${escapeHtml(uni.ageLimit)}</span>
        </div>
        <div class="uni-spec-row">
          <span class="uni-spec-label">Приём:</span>
          <span class="uni-spec-value">${escapeHtml(uni.dates)}</span>
        </div>
      </div>

      <div class="uni-card-actions">
        <button type="button" class="btn btn-primary uni-apply-btn" data-apply-id="${escapeHtml(uni.id)}">
          Подать заявку через Fatiha Educations
        </button>
        <button type="button" class="btn btn-secondary uni-details-btn" data-details-id="${escapeHtml(uni.id)}">
          Подробнее
        </button>
      </div>
    </div>
  `;

  return card;
}

function updateCatalog() {
  const filtered = getFilteredUniversities();
  const hasActiveFilters =
    state.country !== 'Все страны' ||
    state.status !== 'all' ||
    state.search.trim() !== '';

  // Синхронизация кнопок стран
  if (dom.countryFilterBar) {
    dom.countryFilterBar.querySelectorAll('.country-btn').forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.countryFilter === state.country);
    });
  }

  // Синхронизация кнопок статуса
  dom.statusTabs.forEach((tab) => {
    tab.classList.toggle('is-active', tab.dataset.statusFilter === state.status);
  });

  // Обновление счётчика
  if (dom.countLabel) {
    dom.countLabel.innerHTML = `Показано: <span class="tabular-nums">${filtered.length}</span> из <span class="tabular-nums">${universitiesData.length}</span> программ`;
  }

  if (dom.resetFiltersBtn) {
    dom.resetFiltersBtn.hidden = !hasActiveFilters;
  }

  // Рендер карточек или пустого состояния
  if (!dom.grid || !dom.emptyState) return;
  dom.grid.innerHTML = '';

  if (filtered.length === 0) {
    dom.emptyState.hidden = false;
    return;
  }

  dom.emptyState.hidden = true;
  const fragment = document.createDocumentFragment();
  filtered.forEach((uni) => {
    fragment.appendChild(createUniversityCard(uni));
  });
  dom.grid.appendChild(fragment);
}

function resetAllFilters() {
  state.country = 'Все страны';
  state.status = 'all';
  state.search = '';
  if (dom.searchInput) dom.searchInput.value = '';
  updateCatalog();
}

// ============================================================================
// 5. МОДАЛЬНОЕ ОКНО ПОДРОБНОСТЕЙ УНИВЕРСИТЕТА
// ============================================================================

function openUniversityModal(universityId) {
  const uni = universitiesData.find((item) => item.id === universityId);
  if (!uni || !dom.modal || !dom.modalBody) return;

  const statusInfo = STATUS_META[uni.status] || STATUS_META.closed;
  const prefillMessage = `Здравствуйте! Интересует поступление на грант в ${uni.name} (${uni.country}) через Fatiha Educations.`;

  const benefitsHtml = uni.grantBenefits
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join('');

  const docsHtml = uni.documents
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join('');

  dom.modalBody.innerHTML = `
    <img
      src="${escapeHtml(safeImageSrc(uni.image))}"
      alt="${escapeHtml(uni.name)}"
      class="modal-cover"
      referrerpolicy="no-referrer"
    />
    <div class="modal-content-pad">
      <div class="modal-meta-line">
        <span class="status-tag ${escapeHtml(statusInfo.className)}">
          ${getStatusIconSvg(statusInfo.icon)}
          <span>${escapeHtml(statusInfo.label)}</span>
        </span>
        <span>${escapeHtml(uni.country)} · ${escapeHtml(uni.city)}</span>
        <span>·</span>
        <span>${escapeHtml(uni.portal)}</span>
      </div>

      <h2 class="modal-title" id="modal-title">${escapeHtml(uni.name)}</h2>
      <p class="modal-description">${escapeHtml(uni.description)}</p>

      <div class="modal-facts-grid">
        <div>
          <span class="modal-fact-label">Возрастные ограничения</span>
          <span class="modal-fact-value tabular-nums">${escapeHtml(uni.ageLimit)}</span>
        </div>
        <div>
          <span class="modal-fact-label">Окна приёма документов</span>
          <span class="modal-fact-value">${escapeHtml(uni.dates)}</span>
        </div>
        <div>
          <span class="modal-fact-label">Уровни обучения</span>
          <span class="modal-fact-value">${escapeHtml(uni.degreeLevels)}</span>
        </div>
        <div>
          <span class="modal-fact-label">Язык обучения</span>
          <span class="modal-fact-value">${escapeHtml(uni.language)}</span>
        </div>
      </div>

      <div class="modal-lists-grid">
        <div>
          <h3 class="modal-list-title">Что покрывает грант</h3>
          <ul class="modal-list">${benefitsHtml}</ul>
        </div>
        <div>
          <h3 class="modal-list-title">Базовый пакет документов</h3>
          <ul class="modal-list">${docsHtml}</ul>
        </div>
      </div>

      <div class="modal-cta-bar">
        <button type="button" class="btn btn-primary" id="modal-apply-btn">
          Подать заявку через Fatiha Educations
        </button>
        <a
          href="${escapeHtml(buildWhatsAppUrl(prefillMessage))}"
          target="_blank"
          rel="noopener noreferrer"
          class="btn btn-whatsapp"
        >
          Обсудить в WhatsApp
        </a>
        <a
          href="${escapeHtml(buildTelegramUrl(prefillMessage))}"
          target="_blank"
          rel="noopener noreferrer"
          class="btn btn-telegram"
        >
          Обсудить в Telegram
        </a>
      </div>
    </div>
  `;

  const modalApplyBtn = document.getElementById('modal-apply-btn');
  if (modalApplyBtn) {
    modalApplyBtn.addEventListener('click', () => {
      closeUniversityModal();
      prefillApplicationForm(uni.name, uni.country);
    });
  }

  state.lastFocusedElement = document.activeElement;
  dom.modal.hidden = false;
  document.body.style.overflow = 'hidden';
  if (dom.modalCloseBtn) dom.modalCloseBtn.focus();
}

function closeUniversityModal() {
  if (!dom.modal || dom.modal.hidden) return;
  dom.modal.hidden = true;
  document.body.style.overflow = '';
  if (state.lastFocusedElement && typeof state.lastFocusedElement.focus === 'function') {
    state.lastFocusedElement.focus();
  }
}

// ============================================================================
// 6. АВТОПОДСТАНОВКА ВЫБРАННОГО ВУЗА В ФОРМУ ЗАЯВКИ
// ============================================================================

function prefillApplicationForm(universityOrServiceName, countryName = '') {
  if (dom.inputUniversity) {
    dom.inputUniversity.value = sanitizePlainText(universityOrServiceName, 140);
  }
  if (dom.inputCountry && countryName) {
    dom.inputCountry.value = countryName;
  }

  const formSection = document.getElementById('application-form');
  if (formSection) {
    formSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  window.setTimeout(() => {
    if (dom.inputName) dom.inputName.focus({ preventScroll: true });
  }, 350);
}

// ============================================================================
// 7. ВАЛИДАЦИЯ И ОТПРАВКА ФОРМЫ ЗАЯВКИ
// ============================================================================

function setFieldError(inputEl, errorId, message) {
  const errEl = document.getElementById(errorId);
  if (inputEl) {
    inputEl.classList.toggle('is-invalid', Boolean(message));
  }
  if (errEl) {
    errEl.textContent = message || '';
  }
}

function validatePhone(rawPhone) {
  const digits = rawPhone.replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 15;
}

function handleFormSubmit(event) {
  event.preventDefault();
  if (!dom.leadForm) return;

  const name = sanitizePlainText(dom.inputName?.value, 80);
  const ageRaw = Number(dom.inputAge?.value);
  const phone = sanitizePlainText(dom.inputPhone?.value, 25);
  const country = sanitizePlainText(dom.inputCountry?.value, 60);
  const university = sanitizePlainText(dom.inputUniversity?.value, 140);
  const comment = sanitizePlainText(dom.inputComment?.value, 500);
  const consent = Boolean(dom.inputConsent?.checked);

  let isValid = true;

  if (name.length < 2) {
    setFieldError(dom.inputName, 'error-name', 'Укажите имя и фамилию (минимум 2 символа).');
    isValid = false;
  } else {
    setFieldError(dom.inputName, 'error-name', '');
  }

  if (!Number.isInteger(ageRaw) || ageRaw < 14 || ageRaw > 45) {
    setFieldError(dom.inputAge, 'error-age', 'Укажите корректный возраст от 14 до 45 лет.');
    isValid = false;
  } else {
    setFieldError(dom.inputAge, 'error-age', '');
  }

  if (!validatePhone(phone)) {
    setFieldError(dom.inputPhone, 'error-phone', 'Введите корректный номер телефона (от 10 цифр).');
    isValid = false;
  } else {
    setFieldError(dom.inputPhone, 'error-phone', '');
  }

  if (!consent) {
    setFieldError(null, 'error-consent', 'Подтвердите согласие на обратную связь в мессенджере.');
    isValid = false;
  } else {
    setFieldError(null, 'error-consent', '');
  }

  if (!isValid) return;

  const lines = [
    'Здравствуйте, Fatiha Educations! Хочу подать заявку на поступление.',
    `Имя: ${name}`,
    `Возраст: ${ageRaw}`,
    `Телефон: ${phone}`,
  ];
  if (country) lines.push(`Страна: ${country}`);
  if (university) lines.push(`Вуз / услуга: ${university}`);
  if (comment) lines.push(`Комментарий: ${comment}`);

  const fullMessage = lines.join('\n');

  if (dom.successSummary) {
    dom.successSummary.textContent = `${name} (${ageRaw} лет), заявка сформирована${university ? ` по направлению «${university}»` : ''}. Выберите удобный мессенджер ниже, чтобы сразу отправить её нашему куратору:`;
  }

  if (dom.successWaLink) {
    dom.successWaLink.href = buildWhatsAppUrl(fullMessage);
  }
  if (dom.successTgLink) {
    dom.successTgLink.href = buildTelegramUrl(fullMessage);
  }

  if (dom.successBox) {
    dom.successBox.hidden = false;
    dom.successBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

// ============================================================================
// 8. НАВИГАЦИЯ, ВЫПАДАЮЩЕЕ МЕНЮ И FAQ
// ============================================================================

function closeDropdownMenu() {
  if (!dom.dropdownBtn || !dom.dropdownMenu) return;
  dom.dropdownBtn.setAttribute('aria-expanded', 'false');
  dom.dropdownMenu.classList.remove('is-open');
}

function closeMobileDrawer() {
  if (!dom.mobileToggle || !dom.mobileDrawer) return;
  dom.mobileToggle.setAttribute('aria-expanded', 'false');
  dom.mobileDrawer.hidden = true;
}

function jumpToCatalogWithFilter({ country, status }) {
  if (country) {
    state.country = country === 'all' ? 'Все страны' : country;
  }
  if (status) {
    state.status = status;
  }
  updateCatalog();
  closeDropdownMenu();
  closeMobileDrawer();

  const section = document.getElementById('universities');
  if (section) {
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function initNavigationAndFaq() {
  // Выпадающее меню «Вузы»
  if (dom.dropdownBtn && dom.dropdownMenu) {
    dom.dropdownBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = dom.dropdownBtn.getAttribute('aria-expanded') === 'true';
      dom.dropdownBtn.setAttribute('aria-expanded', String(!isOpen));
      dom.dropdownMenu.classList.toggle('is-open', !isOpen);
    });

    document.addEventListener('click', (e) => {
      if (!dom.dropdownMenu.contains(e.target) && e.target !== dom.dropdownBtn) {
        closeDropdownMenu();
      }
    });
  }

  // Быстрая фильтрация из выпадающего меню и мобильного меню
  document.querySelectorAll('[data-quick-country]').forEach((btn) => {
    btn.addEventListener('click', () => {
      jumpToCatalogWithFilter({ country: btn.dataset.quickCountry });
    });
  });

  document.querySelectorAll('[data-quick-status]').forEach((btn) => {
    btn.addEventListener('click', () => {
      jumpToCatalogWithFilter({ status: btn.dataset.quickStatus });
    });
  });

  // Мобильный бургер
  if (dom.mobileToggle && dom.mobileDrawer) {
    dom.mobileToggle.addEventListener('click', () => {
      const isExpanded = dom.mobileToggle.getAttribute('aria-expanded') === 'true';
      dom.mobileToggle.setAttribute('aria-expanded', String(!isExpanded));
      dom.mobileDrawer.hidden = isExpanded;
    });

    dom.mobileDrawer.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', closeMobileDrawer);
    });
  }

  // FAQ-аккордеон
  document.querySelectorAll('.faq-trigger').forEach((trigger) => {
    trigger.addEventListener('click', () => {
      const expanded = trigger.getAttribute('aria-expanded') === 'true';
      const content = trigger.nextElementSibling;
      trigger.setAttribute('aria-expanded', String(!expanded));
      if (content) content.hidden = expanded;
    });
  });

  // Кнопки выбора услуги -> подстановка в форму
  document.querySelectorAll('[data-prefill-service]').forEach((btn) => {
    btn.addEventListener('click', () => {
      prefillApplicationForm(btn.dataset.prefillService || '');
    });
  });
}

// ============================================================================
// 9. СЛАЙДШОУ УНИВЕРСИТЕТОВ НА HERO
// ============================================================================

function renderHeroSlide() {
  if (!dom.slideshowStage || universitiesData.length === 0) return;
  if (state.slideIndex >= universitiesData.length) {
    state.slideIndex = 0;
  }
  const uni = universitiesData[state.slideIndex];
  const statusInfo = STATUS_META[uni.status] || STATUS_META.closed;

  if (dom.slideshowCounter) {
    dom.slideshowCounter.textContent = `${state.slideIndex + 1} / ${universitiesData.length}`;
  }

  dom.slideshowStage.innerHTML = `
    <img
      src="${escapeHtml(safeImageSrc(uni.image))}"
      alt="${escapeHtml(uni.name)} — ${escapeHtml(uni.country)}"
      class="hero-bg-img"
      referrerpolicy="no-referrer"
    />
  `;

  if (dom.slideshowMetaInfo) {
    dom.slideshowMetaInfo.innerHTML = `
      <button type="button" class="dock-slide-btn" data-slide-id="${escapeHtml(uni.id)}">
        <div class="dock-slide-top">
          <span>${escapeHtml(uni.country)} · ${escapeHtml(uni.city)}</span>
          <span class="status-tag ${escapeHtml(statusInfo.className)}">
            ${getStatusIconSvg(statusInfo.icon)}
            <span>${escapeHtml(statusInfo.label)}</span>
          </span>
        </div>
        <h2 class="dock-slide-title">${escapeHtml(uni.name)}</h2>
        <p class="dock-slide-grant">${escapeHtml(uni.shortGrant)}</p>
        <span class="dock-slide-link">Подробнее об условиях гранта и документах →</span>
      </button>
    `;

    const slideBtn = dom.slideshowMetaInfo.querySelector('[data-slide-id]');
    if (slideBtn) {
      slideBtn.addEventListener('click', () => openUniversityModal(uni.id));
    }
  }

  if (dom.slideshowDots) {
    dom.slideshowDots.innerHTML = '';
    universitiesData.forEach((item, index) => {
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.className = `slideshow-dot${index === state.slideIndex ? ' is-active' : ''}`;
      dot.setAttribute('aria-label', `Перейти к слайду ${index + 1}: ${item.name}`);
      dot.addEventListener('click', () => {
        state.slideIndex = index;
        renderHeroSlide();
        startSlideshowTimer();
      });
      dom.slideshowDots.appendChild(dot);
    });
  }
}

function stepHeroSlide(delta) {
  if (universitiesData.length === 0) return;
  state.slideIndex =
    (state.slideIndex + delta + universitiesData.length) % universitiesData.length;
  renderHeroSlide();
}

function startSlideshowTimer() {
  stopSlideshowTimer();
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReduced || universitiesData.length <= 1) return;
  state.slideTimer = window.setInterval(() => {
    stepHeroSlide(1);
  }, 4500);
}

function stopSlideshowTimer() {
  if (state.slideTimer) {
    window.clearInterval(state.slideTimer);
    state.slideTimer = null;
  }
}

// ============================================================================
// 10. ЛЁГКАЯ ДЕМО-АДМИНКА (СМЕНА ВУЗОВ И КАРТИНОК)
// ============================================================================

function populateAdminImagePresets() {
  if (!dom.adminImagePreset) return;
  dom.adminImagePreset.innerHTML = '';
  CAMPUS_IMAGE_PRESETS.forEach((preset) => {
    const opt = document.createElement('option');
    opt.value = preset.url;
    opt.textContent = preset.label;
    dom.adminImagePreset.appendChild(opt);
  });
}

function showAdminFeedback(text) {
  if (!dom.adminFeedback) return;
  dom.adminFeedback.textContent = text;
  dom.adminFeedback.hidden = false;
  window.setTimeout(() => {
    if (dom.adminFeedback) dom.adminFeedback.hidden = true;
  }, 3000);
}

function renderAdminSidebar() {
  if (!dom.adminUniList) return;
  dom.adminUniList.innerHTML = '';

  universitiesData.forEach((uni) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `admin-uni-item${uni.id === state.selectedAdminId ? ' is-selected' : ''}`;
    btn.innerHTML = `
      <span class="admin-uni-item-name">${escapeHtml(uni.name)}</span>
      <span class="admin-uni-item-meta">${escapeHtml(uni.country)} · ${escapeHtml(uni.city)}</span>
    `;
    btn.addEventListener('click', () => {
      loadUniversityIntoAdminForm(uni.id);
    });
    dom.adminUniList.appendChild(btn);
  });
}

function loadUniversityIntoAdminForm(uniId) {
  const uni = universitiesData.find((u) => u.id === uniId);
  if (!uni) return;

  state.selectedAdminId = uni.id;
  state.pendingAdminImage = uni.image;

  if (dom.adminUniId) dom.adminUniId.value = uni.id;
  if (dom.adminName) dom.adminName.value = uni.name;
  if (dom.adminCountry) dom.adminCountry.value = uni.country;
  if (dom.adminCity) dom.adminCity.value = uni.city;
  if (dom.adminStatus) dom.adminStatus.value = uni.status;
  if (dom.adminAge) dom.adminAge.value = uni.ageLimit || '';
  if (dom.adminDates) dom.adminDates.value = uni.dates || '';
  if (dom.adminShortGrant) dom.adminShortGrant.value = uni.shortGrant || '';
  if (dom.adminImgPreview) dom.adminImgPreview.src = safeImageSrc(uni.image);
  if (dom.adminImageUpload) dom.adminImageUpload.value = '';

  if (dom.adminImagePreset) {
    const hasPreset = CAMPUS_IMAGE_PRESETS.some((p) => p.url === uni.image);
    dom.adminImagePreset.value = hasPreset
      ? uni.image
      : CAMPUS_IMAGE_PRESETS[0].url;
  }

  if (dom.adminDeleteBtn) {
    dom.adminDeleteBtn.disabled = universitiesData.length <= 1;
  }

  renderAdminSidebar();
}

function prepareNewUniversityInAdmin() {
  state.selectedAdminId = '';
  const defaultImg = CAMPUS_IMAGE_PRESETS[0].url;
  state.pendingAdminImage = defaultImg;

  if (dom.adminUniId) dom.adminUniId.value = '';
  if (dom.adminName) dom.adminName.value = '';
  if (dom.adminCountry) dom.adminCountry.value = 'Саудовская Аравия';
  if (dom.adminCity) dom.adminCity.value = '';
  if (dom.adminStatus) dom.adminStatus.value = 'open';
  if (dom.adminAge) dom.adminAge.value = '17–25 лет';
  if (dom.adminDates) dom.adminDates.value = 'Идёт приём документов';
  if (dom.adminShortGrant) {
    dom.adminShortGrant.value =
      'Бесплатное обучение, общежитие, ежемесячная стипендия и медицинская страховка.';
  }
  if (dom.adminImgPreview) dom.adminImgPreview.src = defaultImg;
  if (dom.adminImagePreset) dom.adminImagePreset.value = defaultImg;
  if (dom.adminImageUpload) dom.adminImageUpload.value = '';
  if (dom.adminDeleteBtn) dom.adminDeleteBtn.disabled = true;

  renderAdminSidebar();
  if (dom.adminName) dom.adminName.focus();
}

function handleAdminImageUpload(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    showAdminFeedback('Выберите файл изображения (PNG, JPG или WebP).');
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      const maxW = 960;
      const scale = img.width > maxW ? maxW / img.width : 1;
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const compressed = canvas.toDataURL('image/jpeg', 0.82);
      state.pendingAdminImage = compressed;
      if (dom.adminImgPreview) dom.adminImgPreview.src = compressed;
      showAdminFeedback('Картинка загружена. Нажмите «Сохранить изменения».');
    };
    img.src = String(reader.result || '');
  };
  reader.readAsDataURL(file);
}

function handleAdminSave(event) {
  event.preventDefault();
  const name = sanitizePlainText(dom.adminName?.value, 120);
  const country = sanitizePlainText(dom.adminCountry?.value, 60);
  const city = sanitizePlainText(dom.adminCity?.value, 80);
  const status = sanitizePlainText(dom.adminStatus?.value, 20) || 'open';
  const ageLimit = sanitizePlainText(dom.adminAge?.value, 80) || '17–25 лет';
  const dates = sanitizePlainText(dom.adminDates?.value, 100) || 'Уточняется';
  const shortGrant =
    sanitizePlainText(dom.adminShortGrant?.value, 260) ||
    'Государственный грант на бесплатное обучение и проживание.';
  const image = safeImageSrc(state.pendingAdminImage || CAMPUS_IMAGE_PRESETS[0].url);

  if (name.length < 2 || city.length < 2) {
    showAdminFeedback('Заполните название университета и город.');
    return;
  }

  const existingId = dom.adminUniId?.value;
  if (existingId) {
    const idx = universitiesData.findIndex((u) => u.id === existingId);
    if (idx !== -1) {
      universitiesData[idx] = {
        ...universitiesData[idx],
        name,
        country,
        city,
        status,
        ageLimit,
        dates,
        shortGrant,
        image,
      };
      state.selectedAdminId = existingId;
    }
  } else {
    const newId = `custom-uni-${Date.now()}`;
    const newUni = {
      id: newId,
      name,
      country,
      city,
      portal: 'Прямой портал вуза',
      status,
      ageLimit,
      dates,
      degreeLevels: 'Бакалавриат · Магистратура',
      language: 'Арабский / Английский',
      image,
      shortGrant,
      grantBenefits: [
        'Полное или частичное покрытие обучения',
        'Проживание в студенческом кампусе',
        'Ежемесячная стипендия и визовая поддержка',
      ],
      documents: [
        'Заграничный паспорт',
        'Аттестат или диплом с переводом',
        'Медицинская справка и рекомендации',
      ],
      description: shortGrant,
    };
    universitiesData.unshift(newUni);
    state.selectedAdminId = newId;
    state.slideIndex = 0;
  }

  const saved = saveUniversitiesToStorage(universitiesData);
  updateCatalog();
  renderHeroSlide();
  loadUniversityIntoAdminForm(state.selectedAdminId);
  showAdminFeedback(
    saved
      ? 'Изменения сохранены и применены на сайте.'
      : 'Обновлено в текущей сессии (превышен лимит памяти для фото).'
  );
}

function handleAdminDelete() {
  if (universitiesData.length <= 1 || !state.selectedAdminId) return;
  universitiesData = universitiesData.filter((u) => u.id !== state.selectedAdminId);
  saveUniversitiesToStorage(universitiesData);
  state.slideIndex = 0;
  updateCatalog();
  renderHeroSlide();
  loadUniversityIntoAdminForm(universitiesData[0].id);
  showAdminFeedback('Университет удалён из списка.');
}

function handleAdminReset() {
  universitiesData = structuredClone(DEFAULT_UNIVERSITIES);
  saveUniversitiesToStorage(universitiesData);
  state.slideIndex = 0;
  updateCatalog();
  renderHeroSlide();
  loadUniversityIntoAdminForm(universitiesData[0].id);
  showAdminFeedback('Список вузов восстановлен по умолчанию.');
}

function openAdminModal() {
  if (!dom.adminModal) return;
  populateAdminImagePresets();
  const targetId = state.selectedAdminId || universitiesData[0]?.id;
  if (targetId) loadUniversityIntoAdminForm(targetId);
  state.lastFocusedElement = document.activeElement;
  dom.adminModal.hidden = false;
  document.body.style.overflow = 'hidden';
  if (dom.adminCloseBtn) dom.adminCloseBtn.focus();
}

function closeAdminModal() {
  if (!dom.adminModal || dom.adminModal.hidden) return;
  dom.adminModal.hidden = true;
  document.body.style.overflow = '';
  if (state.lastFocusedElement && typeof state.lastFocusedElement.focus === 'function') {
    state.lastFocusedElement.focus();
  }
}

// ============================================================================
// 11. ИНИЦИАЛИЗАЦИЯ ПРИ ЗАГРУЗКЕ
// ============================================================================

function init() {
  const yearEl = document.getElementById('current-year');
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  renderCountryFilters();
  updateCatalog();
  renderHeroSlide();
  startSlideshowTimer();
  initNavigationAndFaq();

  // Слайдшоу Hero
  if (dom.slideshowPrev) {
    dom.slideshowPrev.addEventListener('click', () => {
      stepHeroSlide(-1);
      startSlideshowTimer();
    });
  }
  if (dom.slideshowNext) {
    dom.slideshowNext.addEventListener('click', () => {
      stepHeroSlide(1);
      startSlideshowTimer();
    });
  }
  if (dom.heroSection) {
    dom.heroSection.addEventListener('mouseenter', stopSlideshowTimer);
    dom.heroSection.addEventListener('mouseleave', startSlideshowTimer);

    let touchStartX = 0;
    dom.heroSection.addEventListener(
      'touchstart',
      (e) => {
        touchStartX = e.changedTouches[0]?.clientX || 0;
      },
      { passive: true }
    );
    dom.heroSection.addEventListener(
      'touchend',
      (e) => {
        const touchEndX = e.changedTouches[0]?.clientX || 0;
        const deltaX = touchEndX - touchStartX;
        if (Math.abs(deltaX) > 40) {
          stepHeroSlide(deltaX < 0 ? 1 : -1);
          startSlideshowTimer();
        }
      },
      { passive: true }
    );
  }

  // Поиск по каталогу
  if (dom.searchInput) {
    dom.searchInput.addEventListener('input', (e) => {
      state.search = e.target.value;
      updateCatalog();
    });
  }

  // Фильтр по статусу приёма
  dom.statusTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      state.status = tab.dataset.statusFilter || 'all';
      updateCatalog();
    });
  });

  // Сброс фильтров
  if (dom.resetFiltersBtn) {
    dom.resetFiltersBtn.addEventListener('click', resetAllFilters);
  }
  if (dom.emptyResetBtn) {
    dom.emptyResetBtn.addEventListener('click', resetAllFilters);
  }

  // Делегирование кликов по карточкам вузов
  if (dom.grid) {
    dom.grid.addEventListener('click', (e) => {
      const detailsBtn = e.target.closest('[data-details-id]');
      if (detailsBtn) {
        openUniversityModal(detailsBtn.dataset.detailsId);
        return;
      }

      const applyBtn = e.target.closest('[data-apply-id]');
      if (applyBtn) {
        const uni = universitiesData.find((u) => u.id === applyBtn.dataset.applyId);
        if (uni) {
          prefillApplicationForm(uni.name, uni.country);
        }
      }
    });
  }

  // Закрытие модального окна деталей
  if (dom.modalCloseBtn) {
    dom.modalCloseBtn.addEventListener('click', closeUniversityModal);
  }
  if (dom.modal) {
    dom.modal.addEventListener('click', (e) => {
      if (e.target === dom.modal) closeUniversityModal();
    });
  }

  // Демо-админка (все кнопки: в подвале, в мобильном меню «три полоски» и над каталогом)
  dom.adminTriggers.forEach((trigger) => {
    trigger.addEventListener('click', () => {
      closeMobileDrawer();
      openAdminModal();
    });
  });
  if (dom.adminCloseBtn) {
    dom.adminCloseBtn.addEventListener('click', closeAdminModal);
  }
  if (dom.adminModal) {
    dom.adminModal.addEventListener('click', (e) => {
      if (e.target === dom.adminModal) closeAdminModal();
    });
  }
  if (dom.adminImagePreset) {
    dom.adminImagePreset.addEventListener('change', (e) => {
      state.pendingAdminImage = e.target.value;
      if (dom.adminImgPreview) dom.adminImgPreview.src = safeImageSrc(e.target.value);
    });
  }
  if (dom.adminImageUpload) {
    dom.adminImageUpload.addEventListener('change', handleAdminImageUpload);
  }
  if (dom.adminEditorForm) {
    dom.adminEditorForm.addEventListener('submit', handleAdminSave);
  }
  if (dom.adminNewBtn) {
    dom.adminNewBtn.addEventListener('click', prepareNewUniversityInAdmin);
  }
  if (dom.adminDeleteBtn) {
    dom.adminDeleteBtn.addEventListener('click', handleAdminDelete);
  }
  if (dom.adminResetBtn) {
    dom.adminResetBtn.addEventListener('click', handleAdminReset);
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeUniversityModal();
      closeAdminModal();
      closeDropdownMenu();
    }
  });

  // Форма заявки
  if (dom.leadForm) {
    dom.leadForm.addEventListener('submit', handleFormSubmit);
  }
}

init();
