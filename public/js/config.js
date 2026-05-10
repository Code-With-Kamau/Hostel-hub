// ── API Config ────────────────────────────────────────────────────────────
const API_URL = window.location.origin + '/api';

// ── Auth Token Helpers ────────────────────────────────────────────────────
function getToken()       { return localStorage.getItem('hh_token'); }
function getUser()        { const u = localStorage.getItem('hh_user'); return u ? JSON.parse(u) : null; }
function setAuth(token, user) {
  localStorage.setItem('hh_token', token);
  localStorage.setItem('hh_user', JSON.stringify(user));
}
function clearAuth()      { localStorage.removeItem('hh_token'); localStorage.removeItem('hh_user'); }
function isLoggedIn()     { return !!getToken(); }
function isRole(role)     { const u = getUser(); return u?.role === role; }
function isAdmin()        { return isRole('admin'); }
function isOwner()        { return isRole('owner') || isRole('admin'); }
function isStudent()      { return isRole('student'); }
function isUniversity()   { return isRole('university'); }

// ── Fetch Wrapper ─────────────────────────────────────────────────────────
async function api(endpoint, options = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
    body: options.body ? (typeof options.body === 'string' ? options.body : JSON.stringify(options.body)) : undefined,
  });

  let data;
  const contentType = response.headers.get('content-type') || '';

  if (contentType.includes('application/pdf') || contentType.includes('text/csv')) {
    return response; // Return raw response for file downloads
  }

  try { data = await response.json(); } catch { data = {}; }

  if (!response.ok) {
    const err = new Error(data.error || `Request failed (${response.status})`);
    err.status = response.status;
    err.data   = data;
    throw err;
  }

  return data;
}

// ── File Download Helper ──────────────────────────────────────────────────
async function downloadFile(endpoint, filename) {
  const token    = getToken();
  const response = await fetch(`${API_URL}${endpoint}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) throw new Error('Download failed');

  const blob = await response.blob();
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Password Strength Checker ─────────────────────────────────────────────
function checkPasswordStrength(password) {
  const checks = {
    length:   password.length >= 6,
    upper:    /[A-Z]/.test(password),
    number:   /[0-9]/.test(password),
    special:  /[!@#$%^&*()\-_=+\[\]{};:'",.<>?/\\|`~]/.test(password),
  };
  const score = Object.values(checks).filter(Boolean).length;
  return { checks, score, label: ['Very Weak','Weak','Fair','Strong','Very Strong'][score] };
}

// ── Phone Formatter (Kenya) ───────────────────────────────────────────────
function formatPhone(phone) {
  const cleaned = phone.replace(/\s+/g, '').replace(/^\+/, '');
  if (cleaned.startsWith('254') && cleaned.length === 12) return '+' + cleaned;
  if (cleaned.startsWith('0')   && cleaned.length === 10) return '+254' + cleaned.slice(1);
  return phone;
}

function validateKenyanPhone(phone) {
  const cleaned = phone.replace(/\s+/g, '');
  return /^(0[17]\d{8}|\+2547\d{8}|\+2541\d{8}|2547\d{8})$/.test(cleaned);
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}

// ── Formatting Helpers ────────────────────────────────────────────────────
function formatCurrency(amount) {
  return 'KES ' + Number(amount).toLocaleString('en-KE', { minimumFractionDigits: 0 });
}

function formatDate(dateStr) {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleDateString('en-KE', { day:'numeric', month:'short', year:'numeric' });
}

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)    return 'just now';
  if (mins < 60)   return `${mins}m ago`;
  if (mins < 1440) return `${Math.floor(mins/60)}h ago`;
  return `${Math.floor(mins/1440)}d ago`;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(String(str || '')));
  return div.innerHTML;
}

// ── Hostel Card Builder ───────────────────────────────────────────────────
function buildHostelCard(h, saved = false) {
  const img = h.primary_image ? h.primary_image : '/images/default-hostel.jpg';
  const amenities = [];
  if (h.wifi)           amenities.push('📶 WiFi');
  if (h.meals_provided) amenities.push('🍽️ Meals');
  if (h.study_friendly) amenities.push('📚 Study-Friendly');
  if (h.security)       amenities.push('🔒 Security');
  if (h.backup_power)   amenities.push('⚡ Generator');

  const roomsClass = h.available_rooms === 0 ? 'badge-danger' : h.available_rooms <= 3 ? 'badge-warning' : 'badge-success';
  const roomsText  = h.available_rooms === 0 ? 'Full' : `${h.available_rooms} Available`;

  return `
    <div class="hostel-card" data-id="${h.id}">
      <div class="hostel-card-image">
        <img src="${escapeHtml(img)}" alt="${escapeHtml(h.name)}" loading="lazy" onerror="this.src='/images/default-hostel.jpg'">
        <span class="badge ${roomsClass}">${roomsText}</span>
        <button class="save-btn ${saved ? 'saved' : ''}" data-id="${h.id}" title="${saved ? 'Unsave' : 'Save'}">
          ${saved ? '❤️' : '🤍'}
        </button>
      </div>
      <div class="hostel-card-body">
        <h3 class="hostel-name">${escapeHtml(h.name)}</h3>
        <p class="hostel-address">📍 ${escapeHtml(h.address || '')}</p>
        ${h.nearest_institution ? `<p class="hostel-campus">🎓 ${escapeHtml(h.nearest_institution)} · ${h.distance_to_campus || '?'} km</p>` : ''}
        <div class="hostel-amenities">
          ${amenities.slice(0,3).map(a => `<span class="amenity-tag">${a}</span>`).join('')}
        </div>
        <div class="hostel-card-footer">
          <div class="hostel-price">
            <span class="price-main">${formatCurrency(h.monthly_price)}</span>
            <span class="price-period">/month</span>
          </div>
          <div class="hostel-rating">
            ⭐ ${Number(h.average_rating || 0).toFixed(1)} (${h.total_reviews || 0})
          </div>
        </div>
        <button class="btn btn-primary btn-sm view-btn" onclick="navigate('hostel/${h.id}')">
          View Details
        </button>
      </div>
    </div>`;
}

window.HH = {
  API_URL, api, downloadFile,
  getToken, getUser, setAuth, clearAuth,
  isLoggedIn, isRole, isAdmin, isOwner, isStudent, isUniversity,
  checkPasswordStrength, formatPhone, validateKenyanPhone, validateEmail,
  formatCurrency, formatDate, timeAgo, escapeHtml, buildHostelCard,
};
