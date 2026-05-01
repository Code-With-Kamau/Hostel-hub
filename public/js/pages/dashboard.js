// Student Dashboard
const DashboardPage = {
  async render() {
    if (!AUTH.isLoggedIn()) { navigate('login'); return; }
    if (AUTH.isAdmin()) { AdminPage.render(); return; }
    if (AUTH.isOwner()) { OwnerPage.render(); return; }
    this.renderStudent();
  },

  renderStudent() {
    document.getElementById('app-content').innerHTML = `
      <div class="dashboard-layout">
        <aside class="dashboard-sidebar">
          <div class="sidebar-user">
            <img src="/uploads/profiles/default_avatar.png" onerror="this.src='${CONFIG.DEFAULT_AVATAR}'" />
            <h4>${AUTH.user.name}</h4>
            <p>${AUTH.user.role}</p>
            <div class="inst">${AUTH.user.institution||''}</div>
          </div>
          <ul class="sidebar-nav">
            <div class="sidebar-section">Dashboard</div>
            <li class="sidebar-nav-item active" onclick="DashboardPage.tab('overview',this)"><i class="fas fa-th-large"></i> Overview</li>
            <li class="sidebar-nav-item" onclick="DashboardPage.tab('bookings',this)"><i class="fas fa-calendar-check"></i> My Bookings</li>
            <li class="sidebar-nav-item" onclick="DashboardPage.tab('saved',this)"><i class="fas fa-heart"></i> Saved Hostels</li>
            <div class="sidebar-section">Community</div>
            <li class="sidebar-nav-item" onclick="DashboardPage.tab('roommate',this)"><i class="fas fa-user-friends"></i> Roommate Post</li>
            <li class="sidebar-nav-item" onclick="DashboardPage.tab('buddy',this)"><i class="fas fa-book-open"></i> Study Buddy</li>
            <li class="sidebar-nav-item" onclick="navigate('community')"><i class="fas fa-users"></i> Browse Community</li>
            <div class="sidebar-section">Account</div>
            <li class="sidebar-nav-item" onclick="DashboardPage.tab('profile',this)"><i class="fas fa-user-edit"></i> Edit Profile</li>
            <li class="sidebar-nav-item" onclick="navigate('chat')"><i class="fas fa-comments"></i> Messages</li>
            <li class="sidebar-nav-item" onclick="navigate('home')"><i class="fas fa-search"></i> Browse Hostels</li>
            <li class="sidebar-nav-item" onclick="logout()" style="color:rgba(255,100,100,.8)"><i class="fas fa-sign-out-alt"></i> Sign Out</li>
          </ul>
        </aside>
        <main class="dashboard-content" id="dash-content"></main>
      </div>`;
    this.loadTab('overview');
  },

  tab(t, el) { document.querySelectorAll('.sidebar-nav-item').forEach(i=>i.classList.remove('active')); if(el) el.classList.add('active'); this.loadTab(t); },

  async loadTab(t) {
    const el = document.getElementById('dash-content');
    el.innerHTML = `<div style="text-align:center;padding:40px"><div class="loader-spinner" style="margin:0 auto"></div></div>`;
    if (t==='overview') await this.tabOverview(el);
    else if (t==='bookings') await this.tabBookings(el);
    else if (t==='saved') await this.tabSaved(el);
    else if (t==='roommate') await this.tabRoommate(el);
    else if (t==='buddy') await this.tabBuddy(el);
    else if (t==='profile') this.tabProfile(el);
  },

  async tabOverview(el) {
    const [bRes, sRes] = await Promise.allSettled([API.getMyBookings(), API.getSaved()]);
    const bookings = bRes.value?.data||[]; const saved = sRes.value?.data||[];
    el.innerHTML = `
      <h2 class="dashboard-title">Welcome, ${AUTH.user.name.split(' ')[0]}! 🎓</h2>
      <div class="stats-grid">
        <div class="stat-card"><div class="stat-card-icon blue"><i class="fas fa-calendar-check"></i></div><div class="stat-card-value">${bookings.filter(b=>b.status==='confirmed').length}</div><div class="stat-card-label">Confirmed Rooms</div></div>
        <div class="stat-card"><div class="stat-card-icon amber"><i class="fas fa-clock"></i></div><div class="stat-card-value">${bookings.filter(b=>b.status==='pending').length}</div><div class="stat-card-label">Pending</div></div>
        <div class="stat-card"><div class="stat-card-icon purple"><i class="fas fa-heart"></i></div><div class="stat-card-value">${saved.length}</div><div class="stat-card-label">Saved Hostels</div></div>
        <div class="stat-card"><div class="stat-card-icon green"><i class="fas fa-university"></i></div><div class="stat-card-value" style="font-size:1rem">${AUTH.user.institution?.split(' ')[0]||'—'}</div><div class="stat-card-label">Your Institution</div></div>
      </div>
      <div class="card" style="margin-bottom:18px">
        <div class="card-title">🚀 Quick Actions</div>
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          <button class="btn btn-blue" onclick="navigate('home')"><i class="fas fa-search"></i> Find Hostel</button>
          <button class="btn btn-purple" onclick="navigate('community')"><i class="fas fa-users"></i> Find Roommate</button>
          <button class="btn btn-outline" onclick="DashboardPage.tab('buddy')"><i class="fas fa-book-open"></i> Study Buddy</button>
          <button class="btn btn-outline" onclick="navigate('chat')"><i class="fas fa-comments"></i> Messages</button>
        </div>
      </div>
      ${bookings.length?`<div class="card"><div class="card-title">Recent Bookings</div>
        ${bookings.slice(0,3).map(b=>`<div style="display:flex;align-items:center;gap:12px;padding:11px 0;border-bottom:1px solid var(--gray-100)">
          <img src="${b.hostel_image||CONFIG.DEFAULT_HOSTEL}" style="width:52px;height:42px;border-radius:7px;object-fit:cover" onerror="this.style.display='none'" />
          <div style="flex:1"><div style="font-weight:600;font-size:.875rem">${b.hostel_title}</div><div style="font-size:.78rem;color:var(--gray-500)">${b.location} • ${formatDate(b.created_at)}</div></div>
          ${statusBadge(b.status)}
          ${b.status==='pending'&&!b.deposit_paid?`<button class="btn btn-sm btn-amber" onclick="DashboardPage.payDeposit(${b.id},${b.deposit_amount})"><i class="fas fa-mobile-alt"></i> Pay</button>`:''}
        </div>`).join('')}</div>`:`<div class="empty-state"><div class="icon">🏢</div><h3>No bookings yet</h3><button class="btn btn-blue" onclick="navigate('home')">Find a Hostel</button></div>`}`;
  },

  async tabBookings(el) {
    const res = await API.getMyBookings(); const bookings = res.data||[];
    el.innerHTML = `<h2 class="dashboard-title">📅 My Bookings</h2>
      ${!bookings.length?`<div class="empty-state"><div class="icon">📅</div><h3>No bookings yet</h3><button class="btn btn-blue" onclick="navigate('home')">Find a Hostel</button></div>`:`
      <div class="table-wrapper"><table class="data-table">
        <thead><tr><th>Hostel</th><th>Type</th><th>Status</th><th>Deposit</th><th>Receipt</th><th>Date</th><th>Actions</th></tr></thead>
        <tbody>${bookings.map(b=>`<tr>
          <td><strong>${b.hostel_title}</strong><br/><small style="color:var(--gray-400)">${b.location}</small></td>
          <td><span class="badge badge-blue">${roomTypeName(b.room_type)}</span></td>
          <td>${statusBadge(b.status)}</td>
          <td><span class="badge ${b.deposit_paid?'badge-green':'badge-amber'}">${b.deposit_paid?'✅ Paid':'⏳ Pending'}</span><br/><small>${formatKES(b.deposit_amount)}</small></td>
          <td><small>${b.mpesa_receipt_number||'—'}</small></td>
          <td style="font-size:.78rem;color:var(--gray-400)">${formatDate(b.created_at)}</td>
          <td><div style="display:flex;gap:5px">
            <button class="btn btn-sm btn-outline" onclick="navigate('hostel',${b.hostel_id})"><i class="fas fa-eye"></i></button>
            ${!b.deposit_paid&&b.status==='pending'?`<button class="btn btn-sm btn-amber" onclick="DashboardPage.payDeposit(${b.id},${b.deposit_amount})"><i class="fas fa-mobile-alt"></i> Pay</button>`:''}
            ${b.status==='pending'?`<button class="btn btn-sm btn-red" onclick="DashboardPage.cancelBooking(${b.id})"><i class="fas fa-times"></i></button>`:''}
          </div></td>
        </tr>`).join('')}</tbody>
      </table></div>`}`;
  },

  async tabSaved(el) {
    const res = await API.getSaved(); const hostels = res.data||[];
    el.innerHTML = `<h2 class="dashboard-title">❤️ Saved Hostels</h2>
      ${!hostels.length?`<div class="empty-state"><div class="icon">❤️</div><h3>No saved hostels</h3><button class="btn btn-blue" onclick="navigate('home')">Browse Hostels</button></div>`:`<div class="hostels-grid">${hostels.map(h=>hostelCardHTML(h)).join('')}</div>`}`;
  },

  async tabRoommate(el) {
    el.innerHTML = `<h2 class="dashboard-title">👥 My Roommate Post</h2>
      <div class="card" style="max-width:560px">
        <p style="color:var(--gray-500);font-size:.875rem;margin-bottom:18px">Post what you're looking for and other students will be able to contact you.</p>
        <div class="form-row">
          <div class="form-group"><label class="form-label">Your Gender</label><select class="form-control" id="rm-gender"><option value="male">Male</option><option value="female">Female</option></select></div>
          <div class="form-group"><label class="form-label">Preferred Roommate Gender</label><select class="form-control" id="rm-pref"><option value="any">Any</option><option value="male">Male</option><option value="female">Female</option></select></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">Min Budget (KES)</label><input type="number" class="form-control" id="rm-min" placeholder="4000" /></div>
          <div class="form-group"><label class="form-label">Max Budget (KES)</label><input type="number" class="form-control" id="rm-max" placeholder="8000" /></div>
        </div>
        <div class="form-group"><label class="form-label">Institution</label><input type="text" class="form-control" id="rm-inst" value="${AUTH.user.institution||''}" /></div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">Course</label><input type="text" class="form-control" id="rm-course" value="${AUTH.user.course||''}" /></div>
          <div class="form-group"><label class="form-label">Move-in Date</label><input type="date" class="form-control" id="rm-date" /></div>
        </div>
        <div class="form-group"><label class="form-label">About You & What You're Looking For</label><textarea class="form-control" id="rm-bio" rows="4" placeholder="e.g. 2nd year CS student, quiet, keep clean, looking for a non-smoking roommate near UoN…"></textarea></div>
        <div style="display:flex;gap:10px">
          <button class="btn btn-blue" onclick="DashboardPage.postRoommate()"><i class="fas fa-paper-plane"></i> Post Request</button>
          <button class="btn btn-outline btn-red" onclick="DashboardPage.deleteRoommate()"><i class="fas fa-trash"></i> Delete Post</button>
        </div>
      </div>`;
  },

  async tabBuddy(el) {
    el.innerHTML = `<h2 class="dashboard-title">📚 My Study Buddy Post</h2>
      <div class="card" style="max-width:560px">
        <p style="color:var(--gray-500);font-size:.875rem;margin-bottom:18px">Find fellow students to study with near your hostel or campus.</p>
        <div class="form-row">
          <div class="form-group"><label class="form-label">Institution *</label><input type="text" class="form-control" id="sb-inst" value="${AUTH.user.institution||''}" /></div>
          <div class="form-group"><label class="form-label">Course *</label><input type="text" class="form-control" id="sb-course" value="${AUTH.user.course||''}" /></div>
        </div>
        <div class="form-group"><label class="form-label">Subjects to Study Together</label><input type="text" class="form-control" id="sb-subjects" placeholder="e.g. Calculus, Data Structures, Business Law" /></div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">Study Style</label><select class="form-control" id="sb-style"><option value="quiet">Quiet Study</option><option value="group">Group Study</option><option value="discussions">Discussions</option><option value="any">Any Style</option></select></div>
          <div class="form-group"><label class="form-label">Preferred Time</label><input type="text" class="form-control" id="sb-time" placeholder="e.g. Evenings 6-9pm" /></div>
        </div>
        <div class="form-group"><label class="form-label">About You</label><textarea class="form-control" id="sb-bio" rows="3" placeholder="Brief intro about you and your study goals…"></textarea></div>
        <button class="btn btn-blue" onclick="DashboardPage.postBuddy()"><i class="fas fa-paper-plane"></i> Post Study Request</button>
      </div>`;
  },

  tabProfile(el) {
    const u = AUTH.user;
    el.innerHTML = `<h2 class="dashboard-title">👤 Edit Profile</h2>
      <div class="card" style="max-width:500px">
        <div style="text-align:center;margin-bottom:22px">
          <img src="${u.profile_photo||CONFIG.DEFAULT_AVATAR}" id="prof-preview" style="width:76px;height:76px;border-radius:50%;object-fit:cover;border:4px solid var(--blue-300)" />
          <div style="margin-top:9px"><label class="btn btn-sm btn-outline" style="cursor:pointer"><i class="fas fa-camera"></i> Change Photo<input type="file" accept="image/*" style="display:none" id="prof-file" onchange="DashboardPage.previewPhoto(this)" /></label></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">Full Name</label><input type="text" class="form-control" id="pf-name" value="${u.name}" /></div>
          <div class="form-group"><label class="form-label">Phone</label><input type="tel" class="form-control" id="pf-phone" value="${u.phone||''}" /></div>
        </div>
        ${AUTH.isStudent()?`<div class="form-group"><label class="form-label">Institution</label><input type="text" class="form-control" id="pf-inst" value="${u.institution||''}" /></div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">Course</label><input type="text" class="form-control" id="pf-course" value="${u.course||''}" /></div>
          <div class="form-group"><label class="form-label">Year of Study</label><select class="form-control" id="pf-year">${[1,2,3,4,5,6].map(y=>`<option value="${y}" ${u.year_of_study==y?'selected':''}>${y}${['st','nd','rd','th','th','th'][y-1]} Year</option>`).join('')}</select></div>
        </div>`:''}
        <button class="btn btn-blue btn-block" onclick="DashboardPage.saveProfile()"><i class="fas fa-save"></i> Save Changes</button>
      </div>`;
  },

  previewPhoto(i) { if(i.files[0]) document.getElementById('prof-preview').src = URL.createObjectURL(i.files[0]); },

  async saveProfile() {
    const fd = new FormData();
    fd.append('name', document.getElementById('pf-name').value);
    fd.append('phone', document.getElementById('pf-phone').value);
    if (AUTH.isStudent()) {
      fd.append('institution', document.getElementById('pf-inst')?.value||'');
      fd.append('course', document.getElementById('pf-course')?.value||'');
      fd.append('year_of_study', document.getElementById('pf-year')?.value||1);
    }
    const file = document.getElementById('prof-file');
    if (file?.files[0]) fd.append('profile_photo', file.files[0]);
    const res = await API.updateProfile(fd);
    if (res.success) { AUTH.user = { ...AUTH.user, ...res.data }; localStorage.setItem('hh_user', JSON.stringify(AUTH.user)); showToast('✅ Profile updated!', 'success'); updateNav(); }
    else showToast(res.message, 'error');
  },

  async postRoommate() {
    const res = await API.postRoommate({ institution: document.getElementById('rm-inst').value, course: document.getElementById('rm-course').value,
      gender: document.getElementById('rm-gender').value, preferred_gender: document.getElementById('rm-pref').value,
      budget_min: document.getElementById('rm-min').value, budget_max: document.getElementById('rm-max').value,
      move_in_date: document.getElementById('rm-date').value, bio: document.getElementById('rm-bio').value });
    if (res.success) { showToast('✅ Roommate post published!', 'success'); navigate('community'); }
    else showToast(res.message, 'error');
  },

  async deleteRoommate() {
    const res = await API.deleteRoommate();
    if (res.success) showToast('Post deactivated', 'info');
    else showToast(res.message, 'error');
  },

  async postBuddy() {
    const res = await API.postStudyBuddy({ institution: document.getElementById('sb-inst').value, course: document.getElementById('sb-course').value,
      subjects: document.getElementById('sb-subjects').value, study_style: document.getElementById('sb-style').value,
      preferred_time: document.getElementById('sb-time').value, bio: document.getElementById('sb-bio').value });
    if (res.success) { showToast('✅ Study buddy post published!', 'success'); navigate('community'); }
    else showToast(res.message, 'error');
  },

  payDeposit(bookingId, amount) {
    openModal(`<div class="modal-title">💳 Pay Deposit</div>
      <div style="text-align:center;font-family:var(--font-display);font-size:2rem;font-weight:800;color:var(--blue-700);margin:12px 0">${formatKES(amount)}</div>
      <div class="form-group"><label class="form-label">M-Pesa Number</label><input type="tel" class="form-control" id="dp-phone" value="${AUTH.user.phone||''}" style="text-align:center;font-size:1.1rem" /></div>
      <button class="btn btn-blue btn-block btn-lg" onclick="DashboardPage.confirmPay(${bookingId})"><i class="fas fa-mobile-alt"></i> Pay Now</button>
      <button class="btn btn-outline btn-block" style="margin-top:8px" onclick="DashboardPage.simPay(${bookingId})">🧪 Simulate (Dev)</button>`);
  },

  async confirmPay(id) {
    const phone = document.getElementById('dp-phone').value;
    if (!phone) { showToast('Enter M-Pesa number', 'error'); return; }
    const res = await API.pay({ booking_id: id, phone });
    if (res.success) { closeModal({}); showToast('📱 Check your phone for PIN prompt', 'success', 6000); }
    else showToast(res.message, 'error');
  },

  async simPay(id) {
    const phone = document.getElementById('dp-phone')?.value || AUTH.user.phone || '0700000000';
    const res = await API.simulatePay({ booking_id: id, phone });
    if (res.success) { closeModal({}); showToast('✅ ' + res.message, 'success', 4000); this.loadTab('bookings'); }
    else showToast(res.message, 'error');
  },

  async cancelBooking(id) {
    if (!confirm('Cancel this booking?')) return;
    const res = await API.cancelBooking(id);
    if (res.success) { showToast('Booking cancelled', 'info'); this.loadTab('bookings'); }
    else showToast(res.message, 'error');
  },
};
