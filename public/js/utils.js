function showToast(msg, type = 'info', ms = 3500) {
  const icons = { success:'fa-check-circle', error:'fa-exclamation-circle', info:'fa-info-circle', warning:'fa-exclamation-triangle' };
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = `<i class="fas ${icons[type]}"></i><span>${msg}</span><span class="toast-close" onclick="this.parentElement.remove()"><i class="fas fa-times"></i></span>`;
  document.getElementById('toast-container').appendChild(t);
  setTimeout(() => t?.remove(), ms);
}

function openModal(html, wide = false) {
  document.getElementById('modal-body').innerHTML = html;
  document.getElementById('modal').style.maxWidth = wide ? '720px' : '520px';
  document.getElementById('modal-overlay').classList.add('open');
}
function closeModal(e) {
  if (e && e.target !== document.getElementById('modal-overlay')) return;
  document.getElementById('modal-overlay').classList.remove('open');
}

function formatKES(n) { return 'KES ' + Number(n).toLocaleString('en-KE'); }
function formatDate(d) { return d ? new Date(d).toLocaleDateString('en-KE', { day:'numeric', month:'short', year:'numeric' }) : 'N/A'; }
function timeAgo(d) {
  const s = (Date.now() - new Date(d)) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return Math.floor(s/60) + 'm ago';
  if (s < 86400) return Math.floor(s/3600) + 'h ago';
  return Math.floor(s/86400) + 'd ago';
}

function roomTypeName(t) {
  return { single:'Single Room', double:'Double Room', triple:'Triple Room', quad:'Quad Room',
    ensuite:'En-Suite Room', bedsitter:'Bedsitter', studio:'Studio' }[t] || t;
}

function genderBadge(g) {
  const map = { male_only: ['gender-male','♂ Male Only'], female_only:['gender-female','♀ Female Only'],
    mixed:['gender-mixed','⚧ Mixed'], any:['gender-any','👥 All Welcome'] };
  const [cls, label] = map[g] || ['gender-any','👥 All Welcome'];
  return `<span class="gender-badge ${cls}">${label}</span>`;
}

function statusBadge(s) {
  const m = { available:'badge-green', full:'badge-red', pending:'badge-amber',
    confirmed:'badge-green', cancelled:'badge-gray', maintenance:'badge-amber', completed:'badge-blue' };
  return `<span class="badge ${m[s]||'badge-gray'}">${s}</span>`;
}

function stars(r) {
  if (!r) return '<span style="color:#ccc">No reviews</span>';
  const n = Math.round(r * 2) / 2;
  let s = '';
  for (let i = 1; i <= 5; i++) s += i <= n ? '★' : (i - .5 <= n ? '⭐' : '☆');
  return `<span style="color:#f59e0b">${s}</span> <span style="color:#999">${parseFloat(r).toFixed(1)}</span>`;
}

function amenityIcon(cat) {
  const icons = { shop:'🏪', supermarket:'🛒', pharmacy:'💊', hospital:'🏥', bank:'🏦', atm:'💳',
    restaurant:'🍽️', cafe:'☕', gym:'💪', library:'📚', church:'⛪', mosque:'🕌',
    salon:'💇', market:'🛍️', bus_stop:'🚌', other:'📍' };
  return icons[cat] || '📍';
}

function skeletonCards(n = 6) {
  return Array(n).fill(0).map(() => `<div class="skeleton skeleton-card"></div>`).join('');
}

function hostelCardHTML(h, showDist = false) {
  const img = h.primary_image || CONFIG.DEFAULT_HOSTEL;
  const dist = showDist && h.distance ? `<span style="position:absolute;bottom:10px;left:10px;background:rgba(0,0,0,.6);color:white;padding:2px 8px;border-radius:50px;font-size:.68rem"><i class="fas fa-map-marker-alt"></i> ${h.distance.toFixed(1)}km</span>` : '';
  const vacancy = h.available_rooms > 0
    ? `<span class="tag tag-green">✅ ${h.available_rooms} room${h.available_rooms>1?'s':''} free</span>`
    : `<span class="tag" style="background:var(--red-light);color:var(--red)">❌ Full</span>`;
  return `
    <div class="hostel-card slide-up" onclick="navigate('hostel', ${h.id})">
      <div class="hostel-card-img">
        <img src="${img}" alt="${h.title}" onerror="this.src=''/images/default-hostel.jpg''" loading="lazy"/>
        <span class="hostel-card-badge ${h.status==='full'?'full':''}${h.is_featured?' featured':''}">${h.is_featured?'⭐ Featured':roomTypeName(h.room_type)}</span>
        ${AUTH.isLoggedIn() ? `<button class="hostel-card-save${h.is_saved?' saved':''}" onclick="event.stopPropagation();toggleSaveHostel(${h.id},this)"><i class="fas fa-heart"></i></button>` : ''}
        <span class="hostel-card-gender">${h.gender_policy==='male_only'?'♂ Male':h.gender_policy==='female_only'?'♀ Female':'👥 All'}</span>
        ${dist}
      </div>
      <div class="hostel-card-body">
        <div class="hostel-card-price">${formatKES(h.price_per_month)}<span>/month</span></div>
        <div class="hostel-card-title">${h.title}</div>
        ${h.nearest_institution ? `<div class="hostel-card-campus"><i class="fas fa-university"></i>${h.nearest_institution}${h.distance_to_campus?` • ${h.distance_to_campus}km`:''}</div>` : ''}
        <div class="hostel-card-location"><i class="fas fa-map-marker-alt"></i>${h.location}</div>
        <div class="hostel-card-tags">
          ${vacancy}
          ${h.wifi ? '<span class="tag tag-blue"><i class="fas fa-wifi"></i> WiFi</span>' : ''}
          ${h.meals_provided ? '<span class="tag tag-amber">🍽️ Meals</span>' : ''}
          ${h.allows_roommates ? '<span class="tag tag-purple">👥 Roommates OK</span>' : ''}
          ${h.study_friendly ? '<span class="tag tag-green">📚 Study-friendly</span>' : ''}
        </div>
      </div>
      <div class="hostel-card-footer">
        <div>${stars(h.avg_rating)} <span style="font-size:.72rem;color:var(--gray-400)">(${h.review_count||0})</span></div>
        <div style="font-size:.75rem;color:var(--gray-400)">${h.views_count} views</div>
      </div>
    </div>`;
}

async function toggleSaveHostel(id, btn) {
  if (!AUTH.isLoggedIn()) { navigate('login'); return; }
  try {
    const res = await API.toggleSave(id);
    if (res.success) { btn.classList.toggle('saved', res.saved); showToast(res.message, 'success'); }
  } catch (e) { showToast('Error', 'error'); }
}

// Nav helpers
function toggleUserMenu() { document.getElementById('user-dropdown')?.classList.toggle('open'); }
function toggleNotifications() { document.getElementById('notif-dropdown')?.classList.toggle('open'); }
function toggleMobileMenu() { document.getElementById('mobile-menu')?.classList.toggle('open'); }
function closeMobileMenu() { document.getElementById('mobile-menu')?.classList.remove('open'); }

document.addEventListener('click', (e) => {
  if (!e.target.closest('.nav-user-menu')) document.getElementById('user-dropdown')?.classList.remove('open');
  if (!e.target.closest('.nav-notifications')) document.getElementById('notif-dropdown')?.classList.remove('open');
});
window.addEventListener('scroll', () => {
  document.getElementById('navbar')?.classList.toggle('scrolled', window.scrollY > 10);
});
