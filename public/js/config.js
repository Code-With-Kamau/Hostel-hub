// ── config.js ──
const _IS_LOCAL_HOST =
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1';

// If you're visiting via a public/ngrok URL, the API should usually be same-origin.
// Only force :3000 when using Apache/XAMPP on localhost.
const _API_ORIGIN =
  window.location.port === '3000'
    ? window.location.origin
    : (_IS_LOCAL_HOST ? `${window.location.protocol}//${window.location.hostname}:3000` : window.location.origin);

const CONFIG = {
  API_URL: _API_ORIGIN + '/api',
  SOCKET_URL: _API_ORIGIN,
  APP_NAME: 'HostelHub',
  DEFAULT_AVATAR:'/public/default_avatar.png',
  DEFAULT_HOSTEL: '/images/default-hostel.jpg'
};

// ── api.js ──
const API = {
  token: null,
  getHeaders(isForm = false) {
    const h = {};
    if (this.token) h['Authorization'] = `Bearer ${this.token}`;
    if (!isForm) h['Content-Type'] = 'application/json';
    return h;
  },
  async request(method, path, body = null, isForm = false) {
    const opts = { method, headers: this.getHeaders(isForm) };
    if (body) opts.body = isForm ? body : JSON.stringify(body);
    try {
      const res = await fetch(CONFIG.API_URL + path, opts);
      const contentType = res.headers.get('content-type') || '';
      const data = contentType.includes('application/json') ? await res.json() : await res.text();
      if (res.status === 401) { AUTH.logout(); throw new Error('Session expired. Please login.'); }
      if (!res.ok) {
        const msg = (typeof data === 'string')
          ? `Request failed (${res.status}).`
          : (data?.message || `Request failed (${res.status}).`);
        throw new Error(msg);
      }
      return data;
    } catch (e) {
      if (e.name === 'TypeError') throw new Error('Cannot connect to server. Is it running?');
      throw e;
    }
  },
  get: (p) => API.request('GET', p),
  post: (p, b) => API.request('POST', p, b),
  put: (p, b) => API.request('PUT', p, b),
  delete: (p) => API.request('DELETE', p),
  postForm: (p, b) => API.request('POST', p, b, true),
  putForm: (p, b) => API.request('PUT', p, b, true),

  // Auth
  register: (d) => API.post('/auth/register', d),
  login: (d) => API.post('/auth/login', d),
  getMe: () => API.get('/auth/me'),
  updateProfile: (fd) => API.putForm('/auth/profile', fd),

  // Hostels
  getHostels: (p = {}) => API.get('/hostels/all?' + new URLSearchParams(p)),
  getHostel: (id) => API.get('/hostels/' + id),
  addHostel: (fd) => API.postForm('/hostels/add', fd),
  updateHostel: (id, fd) => API.putForm('/hostels/' + id, fd),
  deleteHostel: (id) => API.delete('/hostels/' + id),
  getMyHostels: () => API.get('/hostels/owner/my'),
  toggleSave: (id) => API.post('/hostels/' + id + '/save'),
  getSaved: () => API.get('/hostels/saved/list'),
  addReview: (id, d) => API.post('/hostels/' + id + '/review', d),

  // Booking
  book: (d) => API.post('/booking/book', d),
  getMyBookings: () => API.get('/booking/my'),
  getOwnerBookings: () => API.get('/booking/owner'),
  cancelBooking: (id) => API.post('/booking/' + id + '/cancel'),

  // Payments
  pay: (d) => API.post('/mpesa/pay', d),
  simulatePay: (d) => API.post('/mpesa/simulate', d),

  // Students
  getRoommates: (p = {}) => API.get('/students/roommates?' + new URLSearchParams(p)),
  postRoommate: (d) => API.post('/students/roommates', d),
  deleteRoommate: () => API.delete('/students/roommates/mine'),
  getStudyBuddies: (p = {}) => API.get('/students/study-buddies?' + new URLSearchParams(p)),
  postStudyBuddy: (d) => API.post('/students/study-buddies', d),
  getAmenities: (hId) => API.get('/students/amenities/' + hId),
  addAmenity: (hId, d) => API.post('/students/amenities/' + hId, d),

  // Chat
  getConversations: () => API.get('/chat/conversations'),
  getMessages: (convId) => API.get('/chat/messages/' + convId),
  getUnread: () => API.get('/chat/unread-count'),

  // Notifications
  getNotifications: () => API.get('/notifications'),
  markAllRead: () => API.put('/notifications/read-all'),
  markRead: (id) => API.put('/notifications/' + id + '/read'),

  // Admin
  getAdminStats: () => API.get('/admin/stats'),
  getAdminHostels: (p = {}) => API.get('/admin/hostels?' + new URLSearchParams(p)),
  approveHostel: (id, approved, reason) => API.put('/admin/hostels/' + id + '/approve', { approved, reason }),
  getAdminUsers: (p = {}) => API.get('/admin/users?' + new URLSearchParams(p)),
  updateUser: (id, d) => API.put('/admin/users/' + id, d),
  getAdminBookings: () => API.get('/admin/bookings'),
};

// ── auth.js ──
const AUTH = {
  user: null, token: null,
  init() {
    this.token = localStorage.getItem('hh_token');
    const u = localStorage.getItem('hh_user');
    if (u) try { this.user = JSON.parse(u); } catch {}
    if (this.token) API.token = this.token;
  },
  isLoggedIn() { return !!this.token && !!this.user; },
  save(token, user) {
    this.token = token; this.user = user; API.token = token;
    localStorage.setItem('hh_token', token);
    localStorage.setItem('hh_user', JSON.stringify(user));
  },
  logout() {
    this.token = null; this.user = null; API.token = null;
    localStorage.removeItem('hh_token'); localStorage.removeItem('hh_user');
    updateNav(); navigate('home');
  },
  isStudent() { return this.user?.role === 'student'; },
  isOwner()   { return this.user?.role === 'owner'; },
  isAdmin()   { return this.user?.role === 'admin'; },
};

function logout() { AUTH.logout(); showToast('Signed out', 'info'); }
