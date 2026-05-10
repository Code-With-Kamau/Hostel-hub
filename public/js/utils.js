// ── Toast Notifications ───────────────────────────────────────────────────
let toastQueue = [];
let toastShowing = false;

function showToast(message, type = 'info', duration = 4000) {
  toastQueue.push({ message, type, duration });
  if (!toastShowing) processToastQueue();
}

function processToastQueue() {
  if (!toastQueue.length) { toastShowing = false; return; }
  toastShowing = true;

  const { message, type, duration } = toastQueue.shift();
  const icons = { success:'✅', error:'❌', warning:'⚠️', info:'ℹ️' };

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span class="toast-icon">${icons[type] || 'ℹ️'}</span><span>${escapeHtml(message)}</span>`;

  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('toast-show'));

  setTimeout(() => {
    toast.classList.remove('toast-show');
    toast.addEventListener('transitionend', () => {
      toast.remove();
      setTimeout(processToastQueue, 100);
    }, { once: true });
  }, duration);
}

// ── Modal ─────────────────────────────────────────────────────────────────
function showModal(title, bodyHtml, footerHtml = '', size = 'md') {
  closeModal();
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id        = 'active-modal';
  overlay.innerHTML = `
    <div class="modal modal-${size}">
      <div class="modal-header">
        <h3>${title}</h3>
        <button class="modal-close" onclick="closeModal()">✕</button>
      </div>
      <div class="modal-body">${bodyHtml}</div>
      ${footerHtml ? `<div class="modal-footer">${footerHtml}</div>` : ''}
    </div>`;

  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';
  requestAnimationFrame(() => overlay.classList.add('modal-visible'));
}

function closeModal() {
  const m = document.getElementById('active-modal');
  if (!m) return;
  m.classList.remove('modal-visible');
  m.addEventListener('transitionend', () => {
    m.remove();
    document.body.style.overflow = '';
  }, { once: true });
}

// ── Loading Spinner ───────────────────────────────────────────────────────
function showLoading(el, text = 'Loading...') {
  if (typeof el === 'string') el = document.getElementById(el);
  if (!el) return;
  el.innerHTML = `<div class="spinner-container"><div class="spinner"></div><p>${text}</p></div>`;
}

function showError(el, message) {
  if (typeof el === 'string') el = document.getElementById(el);
  if (!el) return;
  el.innerHTML = `<div class="empty-state"><p class="error-msg">❌ ${escapeHtml(message)}</p></div>`;
}

function showEmpty(el, message, icon = '📭') {
  if (typeof el === 'string') el = document.getElementById(el);
  if (!el) return;
  el.innerHTML = `<div class="empty-state"><span class="empty-icon">${icon}</span><p>${escapeHtml(message)}</p></div>`;
}

// ── Button Loading State ──────────────────────────────────────────────────
function setButtonLoading(btn, loading, originalText = '') {
  if (typeof btn === 'string') btn = document.getElementById(btn);
  if (!btn) return;
  if (loading) {
    btn.dataset.originalText = btn.textContent;
    btn.disabled  = true;
    btn.innerHTML = '<span class="spinner-sm"></span> Please wait...';
  } else {
    btn.disabled     = false;
    btn.textContent  = originalText || btn.dataset.originalText || 'Submit';
  }
}

// ── Password Strength UI ──────────────────────────────────────────────────
function attachPasswordStrength(inputId, containerId) {
  const input     = document.getElementById(inputId);
  const container = document.getElementById(containerId);
  if (!input || !container) return;

  input.addEventListener('input', () => {
    const pwd    = input.value;
    const result = HH.checkPasswordStrength(pwd);

    const colors = ['#e74c3c','#e67e22','#f1c40f','#2ecc71','#27ae60'];
    const pct    = (result.score / 4) * 100;

    container.innerHTML = `
      <div class="strength-bar-wrap">
        <div class="strength-bar" style="width:${pct}%;background:${colors[result.score]};transition:all 0.3s;"></div>
      </div>
      <div class="strength-checks">
        <span class="${result.checks.length   ? 'check-pass' : 'check-fail'}">
          ${result.checks.length   ? '✅' : '❌'} At least 6 characters
        </span>
        <span class="${result.checks.upper    ? 'check-pass' : 'check-fail'}">
          ${result.checks.upper    ? '✅' : '❌'} Uppercase letter
        </span>
        <span class="${result.checks.number   ? 'check-pass' : 'check-fail'}">
          ${result.checks.number   ? '✅' : '❌'} Number
        </span>
        <span class="${result.checks.special  ? 'check-pass' : 'check-fail'}">
          ${result.checks.special  ? '✅' : '❌'} Special character (!@#$...)
        </span>
      </div>
      <p class="strength-label" style="color:${colors[result.score]}">
        ${result.label}
      </p>`;
  });
}

// ── Phone Input Auto-Formatter ────────────────────────────────────────────
function attachPhoneFormatter(inputEl) {
  if (typeof inputEl === 'string') inputEl = document.getElementById(inputEl);
  if (!inputEl) return;

  inputEl.setAttribute('placeholder', '0712 345 678');
  inputEl.setAttribute('maxlength', '13');

  inputEl.addEventListener('blur', () => {
    const val = inputEl.value.trim();
    if (val && HH.validateKenyanPhone(val)) {
      inputEl.value = HH.formatPhone(val);
      inputEl.classList.remove('input-error');
    } else if (val) {
      inputEl.classList.add('input-error');
    }
  });
}

// ── Form Validation Helper ─────────────────────────────────────────────────
function validateForm(fields) {
  // fields: [{id, label, required, type}]
  const errors = [];
  fields.forEach(f => {
    const el  = document.getElementById(f.id);
    const val = el?.value?.trim() || '';
    if (f.required && !val) {
      errors.push(`${f.label} is required`);
      el?.classList.add('input-error');
      return;
    }
    el?.classList.remove('input-error');
    if (val && f.type === 'email' && !HH.validateEmail(val)) {
      errors.push(`${f.label} must be a valid email (e.g. name@gmail.com)`);
      el?.classList.add('input-error');
    }
    if (val && f.type === 'phone' && !HH.validateKenyanPhone(val)) {
      errors.push(`${f.label} must be a valid Kenyan number (e.g. 0712345678)`);
      el?.classList.add('input-error');
    }
  });
  return errors;
}

// ── Confirm Dialog ────────────────────────────────────────────────────────
function confirmAction(message, onConfirm, onCancel) {
  showModal('Confirm Action', `<p>${escapeHtml(message)}</p>`,
    `<button class="btn btn-danger" id="confirm-yes">Yes, Continue</button>
     <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>`
  );
  document.getElementById('confirm-yes').addEventListener('click', () => {
    closeModal();
    onConfirm();
  });
}

// ── Debounce ──────────────────────────────────────────────────────────────
function debounce(fn, delay = 300) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), delay);
  };
}

// ── Copy to clipboard ─────────────────────────────────────────────────────
async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    showToast('Copied to clipboard!', 'success', 2000);
  } catch {
    showToast('Could not copy', 'error', 2000);
  }
}

// Expose
window.showToast  = showToast;
window.showModal  = showModal;
window.closeModal = closeModal;
window.showLoading = showLoading;
window.showError  = showError;
window.showEmpty  = showEmpty;
window.setButtonLoading = setButtonLoading;
window.attachPasswordStrength = attachPasswordStrength;
window.attachPhoneFormatter   = attachPhoneFormatter;
window.validateForm = validateForm;
window.confirmAction = confirmAction;
window.debounce   = debounce;
window.copyToClipboard = copyToClipboard;
window.escapeHtml = HH.escapeHtml;
