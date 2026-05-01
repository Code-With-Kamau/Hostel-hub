//SPA router
const ROUTES = {
  home:       () => HomePage.render(),
  hostel:     (id) => HostelDetail.render(id),
  login:      () => AuthPages.renderLogin(),
  register:   () => AuthPages.renderRegister(),
  dashboard:  () => DashboardPage.render(),
  chat:       () => ChatPage.render(),
  community:  () => CommunityPage.render(),
};

function navigate(route, param = null) {
  closeMobileMenu();
  window.scrollTo(0, 0);
  document.getElementById('app-content').innerHTML = `<div class="page-loader"><div class="loader-spinner"></div></div>`;
  const handler = ROUTES[route];
  if (handler) handler(param);
  else document.getElementById('app-content').innerHTML = `<div class="empty-state" style="padding-top:120px"><div class="icon">🔍</div><h3>Page not found</h3><button class="btn btn-blue" onclick="navigate('home')">Go Home</button></div>`;
  history.pushState({ route, param }, '', `#${route}${param ? '/' + param : ''}`);
  updateNav();
}

window.addEventListener('popstate', (e) => { if (e.state) navigate(e.state.route, e.state.param); else navigate('home'); });

function parseRoute() {
  const hash = window.location.hash.replace('#', '');
  if (!hash) return navigate('home');
  const [route, param] = hash.split('/');
  navigate(route, param ? (parseInt(param) || param) : null);
}

// ── NAV UPDATE ──
function updateNav() {
  const guestNav = document.getElementById('guest-nav');
  const userMenu = document.getElementById('user-menu');

  if (AUTH.isLoggedIn()) {
    if (guestNav) guestNav.style.display = 'none';
    if (userMenu) {
      userMenu.style.display = 'flex';
      const img = document.getElementById('nav-avatar');
      if (img) { img.src = AUTH.user.profile_photo || CONFIG.DEFAULT_AVATAR; img.onerror = () => img.style.display='none'; }
      const nameEl = document.getElementById('nav-username'); if (nameEl) nameEl.textContent = AUTH.user.name.split(' ')[0];
      const ddName = document.getElementById('dd-name'); if (ddName) ddName.textContent = AUTH.user.name;
      const ddRole = document.getElementById('dd-role'); if (ddRole) ddRole.textContent = AUTH.user.role;
      const ddInst = document.getElementById('dd-inst'); if (ddInst) ddInst.textContent = AUTH.user.institution || '';
      const notifBtn = document.getElementById('notif-btn'); if (notifBtn) notifBtn.style.display = 'flex';
      const roleLinks = document.getElementById('dd-role-links');
      if (roleLinks) {
        if (AUTH.isAdmin()) roleLinks.innerHTML = `<a onclick="navigate('dashboard')"><i class="fas fa-shield-alt"></i> Admin Panel</a>`;
        else if (AUTH.isOwner()) roleLinks.innerHTML = `<a onclick="navigate('dashboard')"><i class="fas fa-building"></i> My Hostels</a>`;
        else roleLinks.innerHTML = `<a onclick="navigate('dashboard')"><i class="fas fa-calendar-check"></i> My Bookings</a>`;
      }
    }
    const mAuth = document.getElementById('mobile-auth');
    if (mAuth) mAuth.innerHTML = `<a onclick="navigate('dashboard')"><i class="fas fa-tachometer-alt"></i> Dashboard</a>
      <a onclick="navigate('community')"><i class="fas fa-users"></i> Community</a>
      <a onclick="navigate('chat')"><i class="fas fa-comments"></i> Messages</a>
      <a onclick="logout()" style="color:var(--red)"><i class="fas fa-sign-out-alt"></i> Sign Out</a>`;
  } else {
    if (guestNav) guestNav.style.display = 'flex';
    if (userMenu) userMenu.style.display = 'none';
    const notifBtn = document.getElementById('notif-btn'); if (notifBtn) notifBtn.style.display = 'none';
    const mAuth = document.getElementById('mobile-auth');
    if (mAuth) mAuth.innerHTML = `<a onclick="navigate('login')">Sign In</a><a onclick="navigate('register')" style="color:var(--blue-600);font-weight:600">Join Free</a>`;
  }
}

// ── NOTIFICATIONS ──
async function loadNotifications() {
  if (!AUTH.isLoggedIn()) return;
  try {
    const res = await API.getNotifications();
    const notifs = res.data || [];
    const unread = notifs.filter(n => !n.is_read).length;
    const badge = document.getElementById('notif-badge');
    if (badge) { badge.textContent = unread; badge.style.display = unread > 0 ? 'flex' : 'none'; }
    const list = document.getElementById('notif-list');
    if (!list) return;
    if (!notifs.length) { list.innerHTML = '<div style="padding:18px;text-align:center;color:var(--gray-400);font-size:.84rem">No notifications yet</div>'; return; }
    list.innerHTML = notifs.slice(0,10).map(n => `
      <div class="notif-item${n.is_read?'':' unread'}" onclick="markNotifRead(${n.id})">
        <div class="notif-item-title">${n.title}</div>
        <div class="notif-item-msg">${n.message}</div>
        <div class="notif-item-time">${timeAgo(n.created_at)}</div>
      </div>`).join('');
  } catch(e) {}
}

async function markNotifRead(id) { await API.markRead(id); loadNotifications(); }
async function markAllNotifsRead() { await API.markAllRead(); showToast('All read', 'success'); loadNotifications(); }

function searchFromNav() {
  const val = document.getElementById('nav-search-input')?.value;
  if (val) { navigate('home'); setTimeout(() => { const el = document.getElementById('hero-search'); if(el) { el.value = val; HomePage.search(); } }, 350); }
}

// ── INIT ──
document.addEventListener('DOMContentLoaded', () => {
  AUTH.init();
  updateNav();
  if (AUTH.isLoggedIn()) {
    ChatModule.init();
    loadNotifications();
    refreshChatBadge();
    setInterval(() => { loadNotifications(); refreshChatBadge(); }, 60000);
  }
  parseRoute();
});
