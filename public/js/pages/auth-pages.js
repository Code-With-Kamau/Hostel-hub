const AuthPages = {
  renderLogin() {
    document.getElementById('app-content').innerHTML = `
      <div class="auth-page">
        <div class="auth-card fade-in">
          <div class="auth-logo"><div style="display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:8px"><div class="logo-icon" style="width:40px;height:40px">🎓</div><span style="font-family:var(--font-display);font-size:1.4rem;font-weight:800">HostelHub</span></div>
            <p style="color:var(--gray-500);font-size:.875rem">Welcome back! Sign in to continue</p></div>
          <div class="form-group"><label class="form-label">Email Address</label><input type="email" class="form-control" id="l-email" placeholder="your@email.com" /></div>
          <div class="form-group"><label class="form-label">Password</label>
            <div style="position:relative"><input type="password" class="form-control" id="l-pass" placeholder="Your password" onkeydown="if(event.key==='Enter')AuthPages.login()" />
            <button onclick="AuthPages.togglePass('l-pass')" style="position:absolute;right:12px;top:50%;transform:translateY(-50%);background:none;color:var(--gray-400)"><i class="fas fa-eye"></i></button></div></div>
          <button class="btn-primary" id="login-btn" onclick="AuthPages.login()"><i class="fas fa-sign-in-alt"></i> Sign In</button>
          <div style="text-align:center;margin-top:18px;font-size:.85rem;color:var(--gray-500)">No account? <a onclick="navigate('register')" style="color:var(--blue-600);font-weight:600;cursor:pointer">Join Free</a></div>
          <div style="background:var(--gray-50);border-radius:8px;padding:12px;margin-top:16px;font-size:.78rem;color:var(--gray-500)">
            
          </div>
        </div>
      </div>`;
    document.getElementById('l-email').focus();
  },

  renderRegister() {
    document.getElementById('app-content').innerHTML = `
      <div class="auth-page">
        <div class="auth-card fade-in" style="max-width:500px">
          <div class="auth-logo"><div style="font-size:2.2rem;margin-bottom:8px">🎓</div><h1>Join HostelHub</h1><p style="color:var(--gray-500);font-size:.85rem;margin-top:5px">Create your free account</p></div>
          <div class="form-group"><label class="form-label">I am a…</label>
            <div class="role-selector">
              <div class="role-option selected" id="r-student" onclick="AuthPages.setRole('student')"><div class="icon">🎓</div><p>Student</p><small>Looking for a hostel</small></div>
              <div class="role-option" id="r-owner" onclick="AuthPages.setRole('owner')"><div class="icon">🏢</div><p>Hostel Owner</p><small>Listing my hostel</small></div>
            </div>
            <input type="hidden" id="reg-role" value="student" />
          </div>
          <div class="form-row">
            <div class="form-group"><label class="form-label">Full Name *</label><input type="text" class="form-control" id="r-name" placeholder="John Kamau" /></div>
            <div class="form-group"><label class="form-label">Phone</label><input type="tel" class="form-control" id="r-phone" placeholder="0712 345 678" /></div>
          </div>
          <div class="form-group"><label class="form-label">Email *</label><input type="email" class="form-control" id="r-email" placeholder="your@email.com" /></div>
          <div id="student-fields">
            <div class="form-group"><label class="form-label">University / College</label><input type="text" class="form-control" id="r-inst" placeholder="e.g. University of Nairobi" /></div>
            <div class="form-row">
              <div class="form-group"><label class="form-label">Course</label><input type="text" class="form-control" id="r-course" placeholder="e.g. Computer Science" /></div>
              <div class="form-group"><label class="form-label">Year of Study</label><select class="form-control" id="r-year"><option value="1">1st Year</option><option value="2">2nd Year</option><option value="3">3rd Year</option><option value="4">4th Year</option><option value="5">5th Year</option><option value="6">6th Year</option></select></div>
            </div>
          </div>
          <div class="form-group"><label class="form-label">Password *</label>
            <div style="position:relative"><input type="password" class="form-control" id="r-pass" placeholder="Min 6 characters" />
            <button onclick="AuthPages.togglePass('r-pass')" style="position:absolute;right:12px;top:50%;transform:translateY(-50%);background:none;color:var(--gray-400)"><i class="fas fa-eye"></i></button></div></div>
          <div style="margin-bottom:16px"><label style="display:flex;gap:7px;align-items:flex-start;font-size:.83rem;color:var(--gray-600);cursor:pointer"><input type="checkbox" id="r-terms" style="margin-top:2px" /><span>I agree to the <a href="#" style="color:var(--blue-600)">Terms of Service</a></span></label></div>
          <button class="btn-primary" id="reg-btn" onclick="AuthPages.register()"><i class="fas fa-user-plus"></i> Create Account</button>
          <div style="text-align:center;margin-top:16px;font-size:.85rem;color:var(--gray-500)">Already have an account? <a onclick="navigate('login')" style="color:var(--blue-600);font-weight:600;cursor:pointer">Sign In</a></div>
        </div>
      </div>`;
  },

  setRole(role) {
    document.getElementById('reg-role').value = role;
    ['student','owner'].forEach(r => document.getElementById(`r-${r}`).classList.toggle('selected', r===role));
    document.getElementById('student-fields').style.display = role === 'student' ? 'block' : 'none';
  },

  togglePass(id) { const i = document.getElementById(id); i.type = i.type==='password'?'text':'laikipia'; },

  async login() {
    const email = document.getElementById('l-email').value.trim();
    const password = document.getElementById('l-pass').value;
    if (!email||!password) { showToast('Email and password required', 'error'); return; }
    const btn = document.getElementById('login-btn');
    btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing in…';
    try {
      const res = await API.login({ email, password });
      if (!res.success) throw new Error(res.message);
      AUTH.save(res.token, res.user);
      showToast(`Welcome back, ${res.user.name}! 🎓`, 'success');
      updateNav(); ChatModule.init(); loadNotifications(); refreshChatBadge();
      navigate('dashboard');
    } catch(e) { showToast(e.message, 'error'); btn.disabled = false; btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Sign In'; }
  },

  async register() {
    const name = document.getElementById('r-name').value.trim();
    const email = document.getElementById('r-email').value.trim();
    const password = document.getElementById('r-pass').value;
    const role = document.getElementById('reg-role').value;
    if (!name||!email||!password) { showToast('Fill all required fields', 'error'); return; }
    if (password.length < 6) { showToast('Password must be at least 6 characters', 'error'); return; }
    if (!document.getElementById('r-terms').checked) { showToast('Accept the Terms of Service', 'error'); return; }
    const btn = document.getElementById('reg-btn');
    btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating…';
    try {
      const res = await API.register({ name, email, password, role, phone: document.getElementById('r-phone').value,
        institution: document.getElementById('r-inst')?.value||null, course: document.getElementById('r-course')?.value||null,
        year_of_study: document.getElementById('r-year')?.value||1 });
      if (!res.success) throw new Error(res.message);
      showToast('✅ Account created! Please sign in.', 'success');
      navigate('login');
    } catch(e) { showToast(e.message, 'error'); btn.disabled = false; btn.innerHTML = '<i class="fas fa-user-plus"></i> Create Account'; }
  },
};
