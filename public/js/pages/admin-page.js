registerPage('admin', async (main) => {
  if (!HH.isAdmin()) {
    main.innerHTML = `<div class="empty-state"><h2>Access Denied</h2></div>`;
    return;
  }

  main.innerHTML = `
    <div class="page-wrap">
      <div class="page-header"><h2>🛡️ Admin Dashboard</h2></div>
      <div class="stats-row" id="admin-stats-row">
        <div class="stat-card"><div class="spinner"></div></div>
      </div>
      <div class="tabs-wrap">
        <button class="tab active" data-tab="tab-overview"  onclick="switchAdminTab('tab-overview')">📊 Overview</button>
        <button class="tab" data-tab="tab-hostels"   onclick="switchAdminTab('tab-hostels')">🏠 Hostels</button>
        <button class="tab" data-tab="tab-users"     onclick="switchAdminTab('tab-users')">👥 Users</button>
        <button class="tab" data-tab="tab-bookings"  onclick="switchAdminTab('tab-bookings')">📋 Bookings</button>
        <button class="tab" data-tab="tab-commission" onclick="switchAdminTab('tab-commission')">💰 Commission</button>
        <button class="tab" data-tab="tab-reports"   onclick="switchAdminTab('tab-reports')">📄 Reports</button>
      </div>

      <!-- Overview -->
      <div id="tab-overview" class="tab-content active">
        <div id="admin-overview-content"><div class="spinner-container"><div class="spinner"></div></div></div>
      </div>

      <!-- Hostels -->
      <div id="tab-hostels" class="tab-content hidden">
        <div class="toolbar">
          <select id="hostel-status-filter" onchange="loadAdminHostels()">
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
          <input type="search" id="hostel-search-admin" placeholder="Search..." oninput="debounce(loadAdminHostels,400)()">
        </div>
        <div id="admin-hostels-list"><div class="spinner-container"><div class="spinner"></div></div></div>
      </div>

      <!-- Users -->
      <div id="tab-users" class="tab-content hidden">
        <div class="toolbar">
          <select id="user-role-filter" onchange="loadAdminUsers()">
            <option value="">All Roles</option>
            <option value="student">Students</option>
            <option value="owner">Owners</option>
            <option value="university">Universities</option>
          </select>
          <input type="search" id="user-search-admin" placeholder="Search..." oninput="debounce(loadAdminUsers,400)()">
        </div>
        <div id="admin-users-list"><div class="spinner-container"><div class="spinner"></div></div></div>
      </div>

      <!-- Bookings -->
      <div id="tab-bookings" class="tab-content hidden">
        <div id="admin-bookings-list"><div class="spinner-container"><div class="spinner"></div></div></div>
      </div>

      <!-- Commission -->
      <div id="tab-commission" class="tab-content hidden">
        <div id="admin-commission-content"><div class="spinner-container"><div class="spinner"></div></div></div>
      </div>

      <!-- Reports -->
      <div id="tab-reports" class="tab-content hidden">
        <div class="reports-grid">
          <div class="report-card">
            <h3>🎓 Students Report</h3>
            <p>All students with course, contacts, hostel & owner details.</p>
            <div class="report-actions">
              <button class="btn btn-outline" onclick="downloadAdminReport('students','csv')">⬇️ CSV</button>
              <button class="btn btn-primary" onclick="downloadAdminReport('students','pdf')">📄 PDF</button>
            </div>
          </div>
          <div class="report-card">
            <h3>🏠 Hostels Report</h3>
            <p>All hostels with owner details, bookings and revenue.</p>
            <div class="report-actions">
              <button class="btn btn-outline" onclick="downloadAdminReport('hostels','csv')">⬇️ CSV</button>
              <button class="btn btn-primary" onclick="downloadAdminReport('hostels','pdf')">📄 PDF</button>
            </div>
          </div>
        </div>
      </div>
    </div>`;

  loadAdminStats();
  loadAdminHostels();
  loadAdminUsers();
  loadAdminBookings();
  loadAdminCommissions();
});

async function loadAdminStats() {
  const el = document.getElementById('admin-stats-row');
  const ov = document.getElementById('admin-overview-content');
  try {
    const { stats, recentBookings, pendingHostels } = await HH.api('/admin/stats');
    el.innerHTML = `
      <div class="stat-card"><span class="stat-number">${stats.total_students}</span><span class="stat-label">Students</span></div>
      <div class="stat-card"><span class="stat-number">${stats.total_owners}</span><span class="stat-label">Owners</span></div>
      <div class="stat-card"><span class="stat-number">${stats.approved_hostels}</span><span class="stat-label">Live Hostels</span></div>
      <div class="stat-card badge-warning"><span class="stat-number">${stats.pending_hostels}</span><span class="stat-label">Pending Approval</span></div>
      <div class="stat-card"><span class="stat-number">${stats.confirmed_bookings}</span><span class="stat-label">Confirmed Bookings</span></div>
      <div class="stat-card badge-success"><span class="stat-number">${HH.formatCurrency(stats.total_deposits)}</span><span class="stat-label">Total Deposits</span></div>
      <div class="stat-card badge-success"><span class="stat-number">${HH.formatCurrency(stats.total_commission)}</span><span class="stat-label">Commission Earned</span></div>
      <div class="stat-card badge-danger"><span class="stat-number">${stats.banned_users}</span><span class="stat-label">Banned Users</span></div>`;

    if (ov) {
      ov.innerHTML = `
        <div class="two-col">
          <div>
            <h3>⏳ Pending Hostel Approvals</h3>
            ${pendingHostels.length === 0 ? '<p class="text-muted">No pending approvals</p>' :
              pendingHostels.map(h => `
                <div class="pending-card">
                  <div><strong>${HH.escapeHtml(h.name)}</strong> — ${HH.escapeHtml(h.owner_name)}</div>
                  <div class="pending-actions">
                    <button class="btn btn-success btn-xs" onclick="approveHostel(${h.id},'approved')">✅ Approve</button>
                    <button class="btn btn-danger btn-xs"  onclick="approveHostel(${h.id},'rejected')">❌ Reject</button>
                  </div>
                </div>`).join('')}
          </div>
          <div>
            <h3>📋 Recent Bookings</h3>
            ${recentBookings.map(b => `
              <div class="pending-card">
                <div><strong>${HH.escapeHtml(b.student_name)}</strong> → ${HH.escapeHtml(b.hostel_name)}</div>
                <div><span class="badge badge-${b.status === 'confirmed' ? 'success' : 'warning'}">${b.status}</span>
                  ${b.amount ? HH.formatCurrency(b.amount) : ''}</div>
              </div>`).join('')}
          </div>
        </div>`;
    }
  } catch (err) {
    if (el) showError(el, err.message);
  }
}

async function loadAdminHostels() {
  const el     = document.getElementById('admin-hostels-list');
  const status = document.getElementById('hostel-status-filter')?.value || '';
  const search = document.getElementById('hostel-search-admin')?.value.trim() || '';
  if (!el) return;
  showLoading(el, 'Loading hostels...');
  try {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (search) params.set('search', search);
    const hostels = await HH.api(`/admin/hostels?${params}`);
    if (!hostels.length) { showEmpty(el, 'No hostels found', '🏠'); return; }
    el.innerHTML = `
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>#</th><th>Name</th><th>Owner</th><th>Type</th><th>Price</th><th>Status</th><th>Bookings</th><th>Actions</th></tr></thead>
          <tbody>
            ${hostels.map((h, i) => `
              <tr>
                <td>${i + 1}</td>
                <td><strong>${HH.escapeHtml(h.name)}</strong><br><small>${HH.escapeHtml(h.address || '')}</small></td>
                <td>${HH.escapeHtml(h.owner_name)}<br><small>${HH.escapeHtml(h.owner_phone)}</small></td>
                <td>${h.room_type}</td>
                <td>${HH.formatCurrency(h.monthly_price)}</td>
                <td><span class="badge badge-${h.status === 'approved' ? 'success' : h.status === 'pending' ? 'warning' : 'danger'}">${h.status}</span></td>
                <td>${h.active_bookings}</td>
                <td>
                  ${h.status !== 'approved' ? `<button class="btn btn-success btn-xs" onclick="approveHostel(${h.id},'approved')">✅</button>` : ''}
                  ${h.status !== 'rejected' ? `<button class="btn btn-danger btn-xs" onclick="approveHostel(${h.id},'rejected')">❌</button>` : ''}
                </td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
  } catch (err) { showError(el, err.message); }
}

async function approveHostel(hostelId, status) {
  const reason = status === 'rejected' ? window.prompt('Reason for rejection (optional):') : null;
  try {
    await HH.api(`/admin/hostels/${hostelId}/approve`, { method: 'PUT', body: { status, reason } });
    showToast(`Hostel ${status}!`, 'success');
    loadAdminHostels();
    loadAdminStats();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function loadAdminUsers() {
  const el   = document.getElementById('admin-users-list');
  const role = document.getElementById('user-role-filter')?.value || '';
  const search = document.getElementById('user-search-admin')?.value.trim() || '';
  if (!el) return;
  showLoading(el, 'Loading users...');
  try {
    const params = new URLSearchParams({ limit: 100 });
    if (role)   params.set('role', role);
    if (search) params.set('search', search);
    const { users } = await HH.api(`/admin/users?${params}`);
    if (!users.length) { showEmpty(el, 'No users found', '👥'); return; }
    el.innerHTML = `
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>#</th><th>Name</th><th>Email</th><th>Phone</th><th>Role</th><th>Institution</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            ${users.map((u, i) => `
              <tr>
                <td>${i + 1}</td>
                <td>${HH.escapeHtml(u.name)}</td>
                <td>${HH.escapeHtml(u.email)}</td>
                <td>${HH.escapeHtml(u.phone || '—')}</td>
                <td><span class="badge badge-info">${u.role}</span></td>
                <td>${HH.escapeHtml(u.institution || '—')}</td>
                <td><span class="badge ${u.is_banned ? 'badge-danger' : 'badge-success'}">${u.is_banned ? 'Banned' : 'Active'}</span></td>
                <td>
                  <button class="btn btn-xs ${u.is_banned ? 'btn-success' : 'btn-danger'}" onclick="toggleBanUser(${u.id}, ${u.is_banned ? 0 : 1})">
                    ${u.is_banned ? 'Unban' : 'Ban'}
                  </button>
                </td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
  } catch (err) { showError(el, err.message); }
}

async function toggleBanUser(userId, isBanned) {
  const action = isBanned ? 'ban' : 'unban';
  if (!confirm(`Are you sure you want to ${action} this user?`)) return;
  try {
    await HH.api(`/admin/users/${userId}`, { method: 'PUT', body: { is_banned: isBanned } });
    showToast(`User ${action}ned successfully`, 'success');
    loadAdminUsers();
  } catch (err) { showToast(err.message, 'error'); }
}

async function loadAdminBookings() {
  const el = document.getElementById('admin-bookings-list');
  if (!el) return;
  showLoading(el, 'Loading bookings...');
  try {
    const bookings = await HH.api('/admin/bookings');
    if (!bookings.length) { showEmpty(el, 'No bookings yet', '📋'); return; }
    el.innerHTML = `
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>#</th><th>Student</th><th>Hostel</th><th>Amount</th><th>Commission</th><th>Status</th><th>Receipt</th><th>Date</th></tr></thead>
          <tbody>
            ${bookings.map((b, i) => `
              <tr>
                <td>${i + 1}</td>
                <td>${HH.escapeHtml(b.student_name)}<br><small>${HH.escapeHtml(b.institution || '')} · ${HH.escapeHtml(b.course || '')}</small></td>
                <td>${HH.escapeHtml(b.hostel_name)}</td>
                <td>${b.paid_amount ? HH.formatCurrency(b.paid_amount) : '—'}</td>
                <td class="text-success">${b.commission_amount ? HH.formatCurrency(b.commission_amount) : '—'}</td>
                <td><span class="badge badge-${b.status === 'confirmed' ? 'success' : b.status === 'cancelled' ? 'danger' : 'warning'}">${b.status}</span></td>
                <td><small>${HH.escapeHtml(b.mpesa_receipt || '—')}</small></td>
                <td><small>${HH.formatDate(b.created_at)}</small></td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
  } catch (err) { showError(el, err.message); }
}

async function loadAdminCommissions() {
  const el = document.getElementById('admin-commission-content');
  if (!el) return;
  showLoading(el, 'Loading commission data...');
  try {
    const { summary, commissions } = await HH.api('/admin/commissions');
    el.innerHTML = `
      <div class="stats-row">
        <div class="stat-card badge-success"><span class="stat-number">${HH.formatCurrency(summary.total)}</span><span class="stat-label">Total Commission</span></div>
        <div class="stat-card"><span class="stat-number">${HH.formatCurrency(summary.owner_total)}</span><span class="stat-label">Paid to Owners</span></div>
        <div class="stat-card"><span class="stat-number">${summary.count}</span><span class="stat-label">Transactions</span></div>
      </div>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Booking</th><th>Hostel</th><th>Student</th><th>Owner</th><th>Total</th><th>Commission (10%)</th><th>Owner Receives</th><th>Receipt</th></tr></thead>
          <tbody>
            ${commissions.map(c => `
              <tr>
                <td>#${c.booking_id}</td>
                <td>${HH.escapeHtml(c.hostel_name)}</td>
                <td>${HH.escapeHtml(c.student_name)}</td>
                <td>${HH.escapeHtml(c.owner_name)}</td>
                <td>${HH.formatCurrency(c.total_amount)}</td>
                <td class="text-success"><strong>${HH.formatCurrency(c.commission_amount)}</strong></td>
                <td>${HH.formatCurrency(c.owner_amount)}</td>
                <td><small>${HH.escapeHtml(c.mpesa_receipt || '—')}</small></td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
  } catch (err) { showError(el, err.message); }
}

function switchAdminTab(tab) {
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  document.querySelectorAll('.tab-content').forEach(c => {
    c.classList.toggle('active', c.id === tab);
    c.classList.toggle('hidden', c.id !== tab);
  });
}

async function downloadAdminReport(type, format) {
  try {
    showToast(`Generating ${format.toUpperCase()} report...`, 'info');
    const ext = format === 'pdf' ? '.pdf' : '.csv';
    await HH.downloadFile(`/admin/report/${type}?format=${format}`, `${type}_report_${Date.now()}${ext}`);
    showToast('Report downloaded!', 'success');
  } catch (err) {
    showToast('Failed: ' + err.message, 'error');
  }
}

window.loadAdminHostels  = loadAdminHostels;
window.loadAdminUsers    = loadAdminUsers;
window.loadAdminBookings = loadAdminBookings;
window.approveHostel     = approveHostel;
window.toggleBanUser     = toggleBanUser;
window.switchAdminTab    = switchAdminTab;
window.downloadAdminReport = downloadAdminReport;
