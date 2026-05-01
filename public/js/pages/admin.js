// ── pages/admin.js ──
const AdminPage = {
  render() {
    document.getElementById('app-content').innerHTML = `
      <div class="dashboard-layout">
        <aside class="dashboard-sidebar">
          <div class="sidebar-user"><img src="/uploads/profiles/default-admin.jpg" onerror="this.src='/public/default_avatar.png'" /><h4>${AUTH.user.name}</h4><p>🛡️ Admin</p></div>
          <ul class="sidebar-nav">
            <div class="sidebar-section">Admin Panel</div>
            <li class="sidebar-nav-item active" onclick="AdminPage.tab('overview',this)"><i class="fas fa-chart-bar"></i> Overview</li>
            <li class="sidebar-nav-item" onclick="AdminPage.tab('pending',this)"><i class="fas fa-clock"></i> Pending Approval</li>
            <li class="sidebar-nav-item" onclick="AdminPage.tab('hostels',this)"><i class="fas fa-building"></i> All Hostels</li>
            <li class="sidebar-nav-item" onclick="AdminPage.tab('users',this)"><i class="fas fa-users"></i> Users</li>
            <li class="sidebar-nav-item" onclick="AdminPage.tab('bookings',this)"><i class="fas fa-calendar"></i> Bookings</li>
            <hr style="border-color:rgba(255,255,255,.1);margin:6px 0"/>
            <li class="sidebar-nav-item" onclick="logout()" style="color:rgba(255,100,100,.8)"><i class="fas fa-sign-out-alt"></i> Sign Out</li>
          </ul>
        </aside>
        <main class="dashboard-content" id="admin-content"></main>
      </div>`;
    this.loadTab('overview');
  },

  tab(t, el) { document.querySelectorAll('.sidebar-nav-item').forEach(i=>i.classList.remove('active')); if(el) el.classList.add('active'); this.loadTab(t); },

  async loadTab(t) {
    const el = document.getElementById('admin-content');
    el.innerHTML = `<div style="text-align:center;padding:40px"><div class="loader-spinner" style="margin:0 auto"></div></div>`;
    if (t==='overview') await this.tabOverview(el);
    else if (t==='pending') await this.tabHostels(el, { is_approved:0 });
    else if (t==='hostels') await this.tabHostels(el, {});
    else if (t==='users') await this.tabUsers(el);
    else if (t==='bookings') await this.tabBookings(el);
  },

  async tabOverview(el) {
    const res = await API.getAdminStats();
    if (!res.success) { el.innerHTML = '<p style="color:red">Error</p>'; return; }
    const { stats: s, recent_bookings, recent_users } = res;
    el.innerHTML = `<h2 class="dashboard-title">🛡️ Admin Overview</h2>
      <div class="stats-grid">
        <div class="stat-card"><div class="stat-card-icon blue"><i class="fas fa-users"></i></div><div class="stat-card-value">${s.users?.total||0}</div><div class="stat-card-label">Total Users</div></div>
        <div class="stat-card"><div class="stat-card-icon purple"><i class="fas fa-user-graduate"></i></div><div class="stat-card-value">${s.users?.students||0}</div><div class="stat-card-label">Students</div></div>
        <div class="stat-card"><div class="stat-card-icon green"><i class="fas fa-building"></i></div><div class="stat-card-value">${s.hostels?.total||0}</div><div class="stat-card-label">Total Hostels</div></div>
        <div class="stat-card"><div class="stat-card-icon amber"><i class="fas fa-clock"></i></div><div class="stat-card-value">${s.hostels?.pending||0}</div><div class="stat-card-label">Pending Approval</div></div>
        <div class="stat-card"><div class="stat-card-icon green"><i class="fas fa-calendar-check"></i></div><div class="stat-card-value">${s.bookings?.confirmed||0}</div><div class="stat-card-label">Confirmed Bookings</div></div>
        <div class="stat-card"><div class="stat-card-icon blue"><i class="fas fa-money-bill-wave"></i></div><div class="stat-card-value" style="font-size:1rem">KES ${(parseFloat(s.revenue?.total||0)/1000).toFixed(0)}K</div><div class="stat-card-label">Total Deposits</div></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:18px;flex-wrap:wrap">
        <div class="card"><div class="card-title">Recent Bookings</div>
          ${(recent_bookings||[]).map(b=>`<div style="padding:9px 0;border-bottom:1px solid var(--gray-100);font-size:.84rem"><div style="font-weight:600">${b.hostel_title}</div><div style="color:var(--gray-400)">${b.student_name} ${statusBadge(b.status)}</div></div>`).join('')||'<p style="color:var(--gray-400)">None</p>'}
        </div>
        <div class="card"><div class="card-title">New Users</div>
          ${(recent_users||[]).map(u=>`<div style="display:flex;gap:9px;align-items:center;padding:7px 0;border-bottom:1px solid var(--gray-100)">
            <div style="font-size:1.2rem">${u.role==='owner'?'🏢':u.role==='admin'?'🛡️':'🎓'}</div>
            <div style="flex:1"><div style="font-size:.84rem;font-weight:600">${u.name}</div><div style="font-size:.74rem;color:var(--gray-400)">${u.email}</div></div>
            <span class="badge ${u.role==='owner'?'badge-blue':u.role==='admin'?'badge-red':'badge-green'}">${u.role}</span>
          </div>`).join('')||'<p style="color:var(--gray-400)">None</p>'}
        </div>
      </div>`;
  },

  async tabHostels(el, params) {
    const isPending = params.is_approved===0;
    const res = await API.getAdminHostels(params); const hostels = res.data||[];
    el.innerHTML = `<h2 class="dashboard-title">${isPending?'⏳ Pending Approval':'🏢 All Hostels'}</h2>
      ${!hostels.length?`<div class="empty-state"><div class="icon">🏢</div><h3>No hostels found</h3></div>`:`
      <div class="table-wrapper"><table class="data-table">
        <thead><tr><th>Hostel</th><th>Owner</th><th>Type</th><th>Price</th><th>Vacancy</th><th>Approved</th><th>Actions</th></tr></thead>
        <tbody>${hostels.map(h=>`<tr>
          <td><div style="display:flex;align-items:center;gap:9px">
            <img src="${h.primary_image||CONFIG.DEFAULT_HOSTEL}" style="width:42px;height:34px;border-radius:6px;object-fit:cover" onerror="this.style.display='none'" />
            <div><strong>${h.title}</strong><br/><small style="color:var(--blue-500)">${h.nearest_institution||h.location}</small></div>
          </div></td>
          <td><small>${h.owner_name}<br/>${h.owner_email}</small></td>
          <td><span class="badge badge-blue">${roomTypeName(h.room_type)}</span></td>
          <td>${formatKES(h.price_per_month)}</td>
          <td><span class="badge ${h.available_rooms>0?'badge-green':'badge-red'}">${h.available_rooms}/${h.total_rooms}</span></td>
          <td><span class="badge ${h.is_approved?'badge-green':'badge-amber'}">${h.is_approved?'✅ Live':'⏳ Pending'}</span></td>
          <td><div style="display:flex;gap:4px">
            <button class="btn btn-sm btn-outline" onclick="navigate('hostel',${h.id})"><i class="fas fa-eye"></i></button>
            ${!h.is_approved?`<button class="btn btn-sm btn-blue" onclick="AdminPage.approve(${h.id},true)"><i class="fas fa-check"></i> Approve</button>
            <button class="btn btn-sm btn-red" onclick="AdminPage.approve(${h.id},false)"><i class="fas fa-times"></i></button>`:
            `<button class="btn btn-sm btn-outline" style="color:var(--red)" onclick="AdminPage.approve(${h.id},false)"><i class="fas fa-times"></i></button>`}
          </div></td>
        </tr>`).join('')}</tbody>
      </table></div>`}`;
  },

  async tabUsers(el) {
    const res = await API.getAdminUsers(); const users = res.data||[];
    el.innerHTML = `<h2 class="dashboard-title">👥 All Users</h2>
      <div class="filter-bar" style="margin-bottom:18px">
        <select onchange="AdminPage.filterUsers(this.value)"><option value="">All Roles</option><option value="student">Students</option><option value="owner">Owners</option><option value="admin">Admins</option></select>
      </div>
      <div class="table-wrapper"><table class="data-table">
        <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Institution</th><th>Active</th><th>Joined</th><th>Actions</th></tr></thead>
        <tbody id="users-tbody">${this.userRows(users)}</tbody>
      </table></div>`;
    this._allUsers = users;
  },

  userRows(users) {
    return users.map(u=>`<tr>
      <td><strong>${u.name}</strong></td><td><small>${u.email}</small></td>
      <td><span class="badge ${u.role==='admin'?'badge-red':u.role==='owner'?'badge-blue':'badge-green'}">${u.role}</span></td>
      <td><small style="color:var(--blue-500)">${u.institution||'—'}</small></td>
      <td><span class="badge ${u.is_active?'badge-green':'badge-red'}">${u.is_active?'Active':'Banned'}</span></td>
      <td style="font-size:.78rem;color:var(--gray-400)">${formatDate(u.created_at)}</td>
      <td>${u.is_active?`<button class="btn btn-sm btn-red" onclick="AdminPage.banUser(${u.id})"><i class="fas fa-ban"></i></button>`:`<button class="btn btn-sm btn-blue" onclick="AdminPage.unbanUser(${u.id})"><i class="fas fa-check"></i></button>`}</td>
    </tr>`).join('');
  },

  filterUsers(role) { document.getElementById('users-tbody').innerHTML = this.userRows(role?this._allUsers.filter(u=>u.role===role):this._allUsers); },

  async approve(id, approved) {
    let reason = null;
    if (!approved) reason = prompt('Rejection reason (optional):');
    const res = await API.approveHostel(id, approved, reason);
    if (res.success) { showToast(res.message, 'success'); this.loadTab(approved?'hostels':'pending'); }
    else showToast(res.message, 'error');
  },

  async banUser(id) { if (!confirm('Ban this user?')) return; const res = await API.updateUser(id,{is_active:false}); if(res.success) { showToast('User banned','info'); this.loadTab('users'); } },
  async unbanUser(id) { const res = await API.updateUser(id,{is_active:true}); if(res.success) { showToast('User unbanned','success'); this.loadTab('users'); } },

  async tabBookings(el) {
    const res = await API.getAdminBookings(); const bookings = res.data||[];
    el.innerHTML = `<h2 class="dashboard-title">📅 All Bookings</h2>
      <div class="table-wrapper"><table class="data-table">
        <thead><tr><th>Hostel</th><th>Student</th><th>Institution</th><th>Status</th><th>Receipt</th><th>Amount</th><th>Date</th></tr></thead>
        <tbody>${bookings.map(b=>`<tr>
          <td><strong>${b.hostel_title}</strong><br/><small>${b.location}</small></td>
          <td><strong>${b.student_name}</strong><br/><small>${b.student_phone}</small></td>
          <td><small style="color:var(--blue-500)">${b.student_institution||'—'}</small></td>
          <td>${statusBadge(b.status)}</td>
          <td><small>${b.mpesa_receipt_number||'—'}</small></td>
          <td>${b.paid_amount?formatKES(b.paid_amount):'—'}</td>
          <td style="font-size:.78rem;color:var(--gray-400)">${formatDate(b.created_at)}</td>
        </tr>`).join('')}</tbody>
      </table></div>`;
  },
};
