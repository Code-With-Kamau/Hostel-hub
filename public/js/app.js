// ── SPA Router ────────────────────────────────────────────────────────────
const routes = {};

function registerPage(name, renderFn) { routes[name] = renderFn; }

function navigate(path) {
  window.location.hash = path;
}

async function handleRoute() {
  const hash  = window.location.hash.slice(1) || 'home';
  const parts = hash.split('/');
  const page  = parts[0];
  const param = parts[1];

  const main = document.getElementById('main-content');
  if (!main) return;

  // Update active nav link
  document.querySelectorAll('[data-route]').forEach(el => {
    el.classList.toggle('active', el.dataset.route === page);
  });

  if (routes[page]) {
    main.innerHTML = '';
    await routes[page](main, param);
  } else {
    main.innerHTML = `<div class="empty-state"><h2>Page not found</h2><button class="btn btn-primary" onclick="navigate('home')">Go Home</button></div>`;
  }
}

window.addEventListener('hashchange', handleRoute);
window.navigate = navigate;

// ── Navbar ────────────────────────────────────────────────────────────────
function buildNavbar() {
  const user = HH.getUser();
  const nav  = document.getElementById('navbar');
  if (!nav) return;

  const navLinks = user
    ? buildAuthNavLinks(user)
    : `<a data-route="home" href="#home">Home</a>
       <button class="btn btn-outline btn-sm" onclick="showLoginModal()">Log In</button>
       <button class="btn btn-primary btn-sm" onclick="showRegisterModal()">Sign Up</button>`;

  nav.innerHTML = `
    <div class="nav-brand" onclick="navigate('home')" style="cursor:pointer">
      <span class="brand-icon">🎓</span>
      <span class="brand-text">HostelHub</span>
    </div>
    <button class="nav-toggle" id="nav-toggle" onclick="toggleMobileNav()">☰</button>
    <div class="nav-links" id="nav-links">
      <a data-route="home" href="#home">🏠 Home</a>
      ${user ? navLinks : ''}
      ${!user ? navLinks : ''}
    </div>`;

  updateNotificationBell();
}

function buildAuthNavLinks(user) {
  const role = user.role;
  let links  = '';

  if (role === 'student') {
    links = `
      <a data-route="dashboard" href="#dashboard">📋 My Dashboard</a>
      <a data-route="community" href="#community">👥 Community</a>`;
  } else if (role === 'owner' || role === 'admin') {
    links = `
      <a data-route="owner" href="#owner">🏢 Owner Panel</a>`;
  } else if (role === 'university') {
    links = `
      <a data-route="university" href="#university">🏫 University Portal</a>`;
  }

  if (role === 'admin') {
    links += `<a data-route="admin" href="#admin">🛡️ Admin</a>`;
  }

  return `
    ${links}
    <div class="nav-notification" id="nav-notification" onclick="navigate('notifications')">
      🔔 <span class="notif-badge hidden" id="notif-count">0</span>
    </div>
    <div class="nav-avatar" onclick="toggleUserMenu()">
      <img src="${user.profile_photo || '/images/default-avatar.png'}" alt="${HH.escapeHtml(user.name)}"
           onerror="this.src='/images/default-avatar.png'" class="avatar-img">
      <span class="avatar-name">${HH.escapeHtml(user.name.split(' ')[0])}</span>
      <div class="user-dropdown hidden" id="user-dropdown">
        <div class="dropdown-header">
          <strong>${HH.escapeHtml(user.name)}</strong>
          <small>${user.role}</small>
        </div>
        <a onclick="navigate('profile')">👤 My Profile</a>
        ${role === 'student' ? '<a onclick="navigate(\'dashboard\')">📋 My Bookings</a>' : ''}
        <a onclick="showChangePasswordModal()">🔑 Change Password</a>
        <hr>
        <a class="logout-link" onclick="logout()">🚪 Log Out</a>
      </div>
    </div>`;
}

function toggleMobileNav() {
  document.getElementById('nav-links')?.classList.toggle('nav-open');
}

function toggleUserMenu() {
  const dd = document.getElementById('user-dropdown');
  if (dd) dd.classList.toggle('hidden');
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.nav-avatar')) dd?.classList.add('hidden');
  }, { once: true });
}

// ── Notifications Bell ────────────────────────────────────────────────────
async function updateNotificationBell() {
  if (!HH.isLoggedIn()) return;
  try {
    const data = await HH.api('/notifications?limit=5');
    const unread = data.filter(n => !n.is_read).length;
    const badge = document.getElementById('notif-count');
    if (badge) {
      badge.textContent = unread > 9 ? '9+' : unread;
      badge.classList.toggle('hidden', unread === 0);
    }
  } catch {}
}

setInterval(updateNotificationBell, 30000);

// ── Auth Modals ───────────────────────────────────────────────────────────
function showLoginModal() {
  showModal('Log In to HostelHub', `
    <form id="login-form" onsubmit="handleLogin(event)">
      <div class="form-group">
        <label>Email Address</label>
        <input type="email" id="login-email" placeholder="you@example.com" required autocomplete="email">
      </div>
      <div class="form-group">
        <label>Password</label>
        <div class="input-password-wrap">
          <input type="password" id="login-password" placeholder="Your password" required autocomplete="current-password">
          <button type="button" class="toggle-pwd" onclick="togglePasswordVisibility('login-password')">👁</button>
        </div>
      </div>
      <div id="login-error" class="form-error hidden"></div>
      <button type="submit" class="btn btn-primary btn-full" id="login-btn">Log In</button>
      <div class="form-links">
        <a onclick="closeModal();showForgotPasswordModal()">Forgot password?</a>
        <a onclick="closeModal();showRegisterModal()">Don't have an account? Sign up</a>
      </div>
    </form>`, '', 'sm');
}

async function handleLogin(e) {
  e.preventDefault();
  const email    = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const errEl    = document.getElementById('login-error');
  const btn      = document.getElementById('login-btn');

  if (!HH.validateEmail(email)) {
    showFormError(errEl, 'Please enter a valid email address');
    return;
  }

  setButtonLoading(btn, true);
  errEl.classList.add('hidden');

  try {
    const data = await HH.api('/auth/login', { method: 'POST', body: { email, password } });
    HH.setAuth(data.token, data.user);
    closeModal();
    buildNavbar();
    showToast(`Welcome back, ${data.user.name.split(' ')[0]}! 👋`, 'success');
    handleRoute();
  } catch (err) {
    if (err.data?.unverified) {
      showFormError(errEl, err.message);
      setTimeout(() => {
        errEl.innerHTML += ` <a href="#" onclick="resendVerification('${email}')">Resend verification email</a>`;
      }, 100);
    } else {
      showFormError(errEl, err.message);
    }
  } finally {
    setButtonLoading(btn, false, 'Log In');
  }
}

async function resendVerification(email) {
  try {
    await HH.api('/auth/resend-verification', { method: 'POST', body: { email } });
    showToast('Verification email sent! Check your inbox.', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function showRegisterModal() {
  showModal('Create Your HostelHub Account', `
    <form id="register-form" onsubmit="handleRegister(event)">
      <div class="form-group">
        <label>I am a</label>
        <div class="role-tabs" id="role-tabs">
          <button type="button" class="role-tab active" data-role="student" onclick="selectRole('student')">🎓 Student</button>
          <button type="button" class="role-tab" data-role="owner" onclick="selectRole('owner')">🏢 Hostel Owner</button>
          <button type="button" class="role-tab" data-role="university" onclick="selectRole('university')">🏫 University</button>
        </div>
        <input type="hidden" id="reg-role" value="student">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Full Name *</label>
          <input type="text" id="reg-name" placeholder="e.g. Brian Kamau" required>
        </div>
        <div class="form-group">
          <label>Phone Number *</label>
          <input type="tel" id="reg-phone" placeholder="0712 345 678" required>
        </div>
      </div>
      <div class="form-group">
        <label>Email Address *</label>
        <input type="email" id="reg-email" placeholder="you@example.com" required>
      </div>
      <div id="student-fields">
        <div class="form-row">
          <div class="form-group">
            <label>University/College *</label>
            <input type="text" id="reg-institution" placeholder="e.g. University of Nairobi">
          </div>
          <div class="form-group">
            <label>Course *</label>
            <input type="text" id="reg-course" placeholder="e.g. Computer Science">
          </div>
        </div>
        <div class="form-group">
          <label>Year of Study</label>
          <select id="reg-year">
            <option value="">Select year</option>
            <option value="1">1st Year</option>
            <option value="2">2nd Year</option>
            <option value="3">3rd Year</option>
            <option value="4">4th Year</option>
            <option value="5">5th Year+</option>
          </select>
        </div>
      </div>
      <div id="university-fields" class="hidden">
        <div class="form-group">
          <label>University Name *</label>
          <input type="text" id="reg-university-name" placeholder="e.g. University of Nairobi">
        </div>
      </div>
      <div class="form-group">
        <label>Password *</label>
        <div class="input-password-wrap">
          <input type="password" id="reg-password" placeholder="Create a strong password" required>
          <button type="button" class="toggle-pwd" onclick="togglePasswordVisibility('reg-password')">👁</button>
        </div>
        <div id="pwd-strength"></div>
      </div>
      <div class="form-group">
        <label>Confirm Password *</label>
        <input type="password" id="reg-confirm-password" placeholder="Repeat your password" required>
      </div>
      <div id="register-error" class="form-error hidden"></div>
      <button type="submit" class="btn btn-primary btn-full" id="register-btn">Create Account</button>
      <div class="form-links">
        <a onclick="closeModal();showLoginModal()">Already have an account? Log in</a>
      </div>
    </form>`, '', 'md');

  attachPasswordStrength('reg-password', 'pwd-strength');
  attachPhoneFormatter('reg-phone');
}

function selectRole(role) {
  document.getElementById('reg-role').value = role;
  document.querySelectorAll('.role-tab').forEach(t => t.classList.toggle('active', t.dataset.role === role));
  document.getElementById('student-fields').classList.toggle('hidden', role !== 'student');
  document.getElementById('university-fields').classList.toggle('hidden', role !== 'university');
}

async function handleRegister(e) {
  e.preventDefault();
  const errEl = document.getElementById('register-error');
  const btn   = document.getElementById('register-btn');

  const role     = document.getElementById('reg-role').value;
  const name     = document.getElementById('reg-name').value.trim();
  const email    = document.getElementById('reg-email').value.trim();
  const phone    = document.getElementById('reg-phone').value.trim();
  const password = document.getElementById('reg-password').value;
  const confirm  = document.getElementById('reg-confirm-password').value;

  // Client-side validation
  if (!HH.validateEmail(email)) {
    showFormError(errEl, 'Please enter a valid email address (e.g. name@gmail.com)');
    return;
  }
  if (!HH.validateKenyanPhone(phone)) {
    showFormError(errEl, 'Enter a valid Kenyan phone number (e.g. 0712345678 or +254712345678)');
    return;
  }
  const pwdCheck = HH.checkPasswordStrength(password);
  if (pwdCheck.score < 4) {
    showFormError(errEl, 'Password is too weak. Use uppercase, numbers and special characters.');
    return;
  }
  if (password !== confirm) {
    showFormError(errEl, 'Passwords do not match');
    return;
  }
  if (password.toLowerCase().includes(name.split(' ')[0].toLowerCase())) {
    showFormError(errEl, 'Password must not contain your name');
    return;
  }

  const body = { name, email, phone, password, role };
  if (role === 'student') {
    body.institution  = document.getElementById('reg-institution').value.trim();
    body.course       = document.getElementById('reg-course').value.trim();
    body.year_of_study = document.getElementById('reg-year').value;
    if (!body.institution || !body.course) {
      showFormError(errEl, 'Institution and course are required for students');
      return;
    }
  }
  if (role === 'university') {
    body.university_name = document.getElementById('reg-university-name').value.trim();
    if (!body.university_name) {
      showFormError(errEl, 'University name is required');
      return;
    }
  }

  setButtonLoading(btn, true);
  errEl.classList.add('hidden');

  try {
    await HH.api('/auth/register', { method: 'POST', body });
    closeModal();
    showModal('Account Created! 🎉', `
      <div class="success-message">
        <div class="success-icon">✉️</div>
        <h3>Check Your Email</h3>
        <p>We've sent a verification link to <strong>${HH.escapeHtml(email)}</strong>.</p>
        <p>Click the link in the email to activate your account and start using HostelHub.</p>
        <p class="hint">Didn't receive it? Check your spam folder or <a href="#" onclick="closeModal();resendVerification('${email}')">resend verification</a>.</p>
        <button class="btn btn-primary" onclick="closeModal();showLoginModal()">Go to Login</button>
      </div>`, '', 'sm');
  } catch (err) {
    showFormError(errEl, err.message);
  } finally {
    setButtonLoading(btn, false, 'Create Account');
  }
}

// ── Forgot Password ───────────────────────────────────────────────────────
function showForgotPasswordModal() {
  showModal('Reset Your Password', `
    <form id="forgot-form" onsubmit="handleForgotPassword(event)">
      <p>Enter your email address and we'll send you a link to reset your password.</p>
      <div class="form-group">
        <label>Email Address</label>
        <input type="email" id="forgot-email" placeholder="you@example.com" required>
      </div>
      <div id="forgot-error" class="form-error hidden"></div>
      <div id="forgot-success" class="form-success hidden"></div>
      <button type="submit" class="btn btn-primary btn-full" id="forgot-btn">Send Reset Link</button>
      <div class="form-links">
        <a onclick="closeModal();showLoginModal()">Back to Login</a>
      </div>
    </form>`, '', 'sm');
}

async function handleForgotPassword(e) {
  e.preventDefault();
  const email  = document.getElementById('forgot-email').value.trim();
  const errEl  = document.getElementById('forgot-error');
  const succEl = document.getElementById('forgot-success');
  const btn    = document.getElementById('forgot-btn');

  if (!HH.validateEmail(email)) {
    showFormError(errEl, 'Please enter a valid email address');
    return;
  }

  setButtonLoading(btn, true);
  errEl.classList.add('hidden');

  try {
    const data = await HH.api('/auth/forgot-password', { method: 'POST', body: { email } });
    succEl.textContent = data.message;
    succEl.classList.remove('hidden');
    document.getElementById('forgot-form').querySelector('button[type=submit]').style.display = 'none';
  } catch (err) {
    showFormError(errEl, err.message);
  } finally {
    setButtonLoading(btn, false, 'Send Reset Link');
  }
}

// ── Change Password Modal ─────────────────────────────────────────────────
function showChangePasswordModal() {
  document.getElementById('user-dropdown')?.classList.add('hidden');
  showModal('Change Password', `
    <form id="change-pwd-form" onsubmit="handleChangePassword(event)">
      <div class="form-group">
        <label>Current Password</label>
        <div class="input-password-wrap">
          <input type="password" id="current-pwd" placeholder="Your current password" required>
          <button type="button" class="toggle-pwd" onclick="togglePasswordVisibility('current-pwd')">👁</button>
        </div>
      </div>
      <div class="form-group">
        <label>New Password</label>
        <div class="input-password-wrap">
          <input type="password" id="new-pwd" placeholder="New strong password" required>
          <button type="button" class="toggle-pwd" onclick="togglePasswordVisibility('new-pwd')">👁</button>
        </div>
        <div id="new-pwd-strength"></div>
      </div>
      <div class="form-group">
        <label>Confirm New Password</label>
        <input type="password" id="confirm-pwd" placeholder="Repeat new password" required>
      </div>
      <div id="change-pwd-error" class="form-error hidden"></div>
      <button type="submit" class="btn btn-primary btn-full" id="change-pwd-btn">Update Password</button>
    </form>`, '', 'sm');

  attachPasswordStrength('new-pwd', 'new-pwd-strength');
}

async function handleChangePassword(e) {
  e.preventDefault();
  const current = document.getElementById('current-pwd').value;
  const newPwd  = document.getElementById('new-pwd').value;
  const confirm = document.getElementById('confirm-pwd').value;
  const errEl   = document.getElementById('change-pwd-error');
  const btn     = document.getElementById('change-pwd-btn');

  const strength = HH.checkPasswordStrength(newPwd);
  if (strength.score < 4) {
    showFormError(errEl, 'New password is too weak. Add uppercase, numbers and special characters.');
    return;
  }
  if (newPwd !== confirm) {
    showFormError(errEl, 'New passwords do not match');
    return;
  }

  setButtonLoading(btn, true);
  try {
    await HH.api('/auth/change-password', {
      method: 'PUT',
      body: { current_password: current, new_password: newPwd },
    });
    closeModal();
    showToast('Password changed successfully!', 'success');
  } catch (err) {
    showFormError(errEl, err.message);
  } finally {
    setButtonLoading(btn, false, 'Update Password');
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────
function showFormError(el, message) {
  if (!el) return;
  el.textContent = message;
  el.classList.remove('hidden');
}

function togglePasswordVisibility(inputId) {
  const inp = document.getElementById(inputId);
  if (!inp) return;
  inp.type = inp.type === 'password' ? 'text' : 'password';
}

function logout() {
  HH.clearAuth();
  buildNavbar();
  navigate('home');
  showToast('You have been logged out', 'info');
}

// ── Email Verification Page ───────────────────────────────────────────────
registerPage('verify-email', async (main) => {
  const token = new URLSearchParams(window.location.search).get('token');
  if (!token) {
    main.innerHTML = `<div class="empty-state"><h2>Invalid verification link</h2></div>`;
    return;
  }
  main.innerHTML = `<div class="empty-state"><div class="spinner"></div><p>Verifying your email...</p></div>`;
  try {
    const data = await HH.api(`/auth/verify-email?token=${token}`);
    main.innerHTML = `
      <div class="empty-state success-state">
        <div class="success-icon">✅</div>
        <h2>Email Verified!</h2>
        <p>${HH.escapeHtml(data.message)}</p>
        <button class="btn btn-primary" onclick="closeModal();showLoginModal()">Log In Now</button>
      </div>`;
  } catch (err) {
    main.innerHTML = `
      <div class="empty-state">
        <div class="error-icon">❌</div>
        <h2>Verification Failed</h2>
        <p>${HH.escapeHtml(err.message)}</p>
        <button class="btn btn-primary" onclick="showResendModal()">Resend Verification Email</button>
      </div>`;
  }
});

// ── Reset Password Page ───────────────────────────────────────────────────
registerPage('reset-password', (main) => {
  const token = new URLSearchParams(window.location.search).get('token');
  if (!token) {
    main.innerHTML = `<div class="empty-state"><h2>Invalid reset link</h2></div>`;
    return;
  }
  main.innerHTML = `
    <div class="auth-page-wrap">
      <div class="auth-card">
        <h2>Set New Password</h2>
        <form id="reset-form" onsubmit="handleResetPassword(event,'${token}')">
          <div class="form-group">
            <label>New Password</label>
            <div class="input-password-wrap">
              <input type="password" id="reset-pwd" placeholder="New strong password" required>
              <button type="button" class="toggle-pwd" onclick="togglePasswordVisibility('reset-pwd')">👁</button>
            </div>
            <div id="reset-pwd-strength"></div>
          </div>
          <div class="form-group">
            <label>Confirm New Password</label>
            <input type="password" id="reset-confirm-pwd" placeholder="Repeat password" required>
          </div>
          <div id="reset-error" class="form-error hidden"></div>
          <div id="reset-success" class="form-success hidden"></div>
          <button type="submit" class="btn btn-primary btn-full" id="reset-btn">Reset Password</button>
        </form>
      </div>
    </div>`;
  attachPasswordStrength('reset-pwd', 'reset-pwd-strength');
});

async function handleResetPassword(e, token) {
  e.preventDefault();
  const pwd    = document.getElementById('reset-pwd').value;
  const conf   = document.getElementById('reset-confirm-pwd').value;
  const errEl  = document.getElementById('reset-error');
  const succEl = document.getElementById('reset-success');
  const btn    = document.getElementById('reset-btn');

  const strength = HH.checkPasswordStrength(pwd);
  if (strength.score < 4) {
    showFormError(errEl, 'Password is too weak — add uppercase, numbers and a special character');
    return;
  }
  if (pwd !== conf) {
    showFormError(errEl, 'Passwords do not match');
    return;
  }

  setButtonLoading(btn, true);
  errEl.classList.add('hidden');
  try {
    const data = await HH.api('/auth/reset-password', { method: 'POST', body: { token, password: pwd } });
    succEl.textContent = data.message;
    succEl.classList.remove('hidden');
    document.getElementById('reset-form').querySelector('[type=submit]').style.display = 'none';
    setTimeout(() => { navigate('home'); showLoginModal(); }, 2500);
  } catch (err) {
    showFormError(errEl, err.message);
  } finally {
    setButtonLoading(btn, false, 'Reset Password');
  }
}

// ── Notifications Page ────────────────────────────────────────────────────
registerPage('notifications', async (main) => {
  if (!HH.isLoggedIn()) { showLoginModal(); return; }

  main.innerHTML = `
    <div class="page-wrap">
      <div class="page-header">
        <h2>🔔 Notifications</h2>
        <button class="btn btn-outline btn-sm" onclick="markAllNotificationsRead()">Mark all read</button>
      </div>
      <div id="notif-list"><div class="spinner-container"><div class="spinner"></div></div></div>
    </div>`;

  await loadNotifications();
});

async function loadNotifications() {
  const el = document.getElementById('notif-list');
  if (!el) return;
  try {
    const notifs = await HH.api('/notifications?limit=50');
    if (!notifs.length) {
      showEmpty(el, 'No notifications yet', '🔔');
      return;
    }
    el.innerHTML = notifs.map(n => `
      <div class="notif-item ${n.is_read ? '' : 'notif-unread'}" onclick="markNotifRead(${n.id}, this)">
        <div class="notif-body">
          <strong>${HH.escapeHtml(n.title)}</strong>
          <p>${HH.escapeHtml(n.message)}</p>
        </div>
        <span class="notif-time">${timeAgo(n.created_at)}</span>
      </div>`).join('');
  } catch (err) {
    showError(el, err.message);
  }
}

async function markNotifRead(id, el) {
  el?.classList.remove('notif-unread');
  try { await HH.api(`/notifications/${id}/read`, { method: 'PUT' }); } catch {}
  updateNotificationBell();
}

async function markAllNotificationsRead() {
  try {
    await HH.api('/notifications/read-all', { method: 'PUT' });
    document.querySelectorAll('.notif-unread').forEach(el => el.classList.remove('notif-unread'));
    updateNotificationBell();
    showToast('All notifications marked as read', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ── Profile Page ──────────────────────────────────────────────────────────
registerPage('profile', async (main) => {
  if (!HH.isLoggedIn()) { showLoginModal(); return; }
  const user = HH.getUser();

  main.innerHTML = `
    <div class="page-wrap narrow">
      <h2>👤 My Profile</h2>
      <form id="profile-form" onsubmit="handleProfileUpdate(event)">
        <div class="form-group">
          <label>Full Name</label>
          <input type="text" id="p-name" value="${HH.escapeHtml(user.name)}" required>
        </div>
        <div class="form-group">
          <label>Phone Number</label>
          <input type="tel" id="p-phone" value="${HH.escapeHtml(user.phone || '')}" required>
        </div>
        <div class="form-group">
          <label>Email <span class="hint">(cannot be changed)</span></label>
          <input type="email" value="${HH.escapeHtml(user.email)}" disabled>
        </div>
        ${user.role === 'student' ? `
        <div class="form-group">
          <label>Institution</label>
          <input type="text" id="p-institution" value="${HH.escapeHtml(user.institution || '')}">
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Course</label>
            <input type="text" id="p-course" value="${HH.escapeHtml(user.course || '')}">
          </div>
          <div class="form-group">
            <label>Year of Study</label>
            <select id="p-year">
              ${[1,2,3,4,5].map(y => `<option value="${y}" ${user.year_of_study == y ? 'selected' : ''}>${y === 5 ? '5th+' : `${y}${['st','nd','rd','th'][y-1]} Year`}</option>`).join('')}
            </select>
          </div>
        </div>` : ''}
        <div id="profile-error" class="form-error hidden"></div>
        <button type="submit" class="btn btn-primary" id="profile-btn">Save Changes</button>
      </form>
    </div>`;

  attachPhoneFormatter('p-phone');
});

async function handleProfileUpdate(e) {
  e.preventDefault();
  const btn   = document.getElementById('profile-btn');
  const errEl = document.getElementById('profile-error');
  const user  = HH.getUser();

  const body = {
    name:  document.getElementById('p-name')?.value.trim(),
    phone: document.getElementById('p-phone')?.value.trim(),
  };
  if (user.role === 'student') {
    body.institution  = document.getElementById('p-institution')?.value.trim();
    body.course       = document.getElementById('p-course')?.value.trim();
    body.year_of_study = document.getElementById('p-year')?.value;
  }

  if (!HH.validateKenyanPhone(body.phone)) {
    showFormError(errEl, 'Invalid Kenyan phone number');
    return;
  }

  setButtonLoading(btn, true);
  try {
    await HH.api('/students/profile', { method: 'PUT', body });
    // Update cached user
    const updated = { ...user, ...body };
    localStorage.setItem('hh_user', JSON.stringify(updated));
    buildNavbar();
    showToast('Profile updated!', 'success');
    errEl.classList.add('hidden');
  } catch (err) {
    showFormError(errEl, err.message);
  } finally {
    setButtonLoading(btn, false, 'Save Changes');
  }
}

// ── Init ──────────────────────────────────────────────────────────────────
window.handleLogin  = handleLogin;
window.handleRegister = handleRegister;
window.handleForgotPassword = handleForgotPassword;
window.handleChangePassword = handleChangePassword;
window.handleResetPassword  = handleResetPassword;
window.handleProfileUpdate  = handleProfileUpdate;
window.showLoginModal = showLoginModal;
window.showRegisterModal = showRegisterModal;
window.showForgotPasswordModal = showForgotPasswordModal;
window.showChangePasswordModal = showChangePasswordModal;
window.togglePasswordVisibility = togglePasswordVisibility;
window.selectRole   = selectRole;
window.logout       = logout;
window.resendVerification = resendVerification;
window.markAllNotificationsRead = markAllNotificationsRead;
window.markNotifRead = markNotifRead;
window.registerPage  = registerPage;
window.timeAgo       = timeAgo;

document.addEventListener('DOMContentLoaded', () => {
  buildNavbar();
  handleRoute();
});
