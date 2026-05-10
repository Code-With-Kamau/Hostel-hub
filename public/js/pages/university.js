registerPage('university', async (main) => {
  if (!HH.isLoggedIn() || (!HH.isUniversity() && !HH.isAdmin())) {
    main.innerHTML = `<div class="empty-state"><h2>Access Denied</h2><p>This page is for university accounts only.</p><button class="btn btn-primary" onclick="showLoginModal()">Log In</button></div>`;
    return;
  }

  const user = HH.getUser();
  main.innerHTML = `
    <div class="page-wrap">
      <div class="page-header">
        <div>
          <h2>🏫 University Portal</h2>
          <p class="subtitle">Welcome, ${HH.escapeHtml(user.name)}</p>
        </div>
      </div>

      <!-- Stats Row -->
      <div class="stats-row" id="uni-stats">
        <div class="stat-card"><div class="spinner"></div></div>
      </div>

      <!-- Tabs -->
      <div class="tabs-wrap">
        <button class="tab active" data-tab="uni-hostels" onclick="switchUniTab('uni-hostels')">🏠 All Hostels</button>
        <button class="tab" data-tab="uni-students" onclick="switchUniTab('uni-students')">🎓 All Students</button>
      </div>

      <!-- Hostels Tab -->
      <div id="uni-hostels" class="tab-content active">
        <div class="toolbar">
          <input type="search" id="uni-hostel-search" placeholder="Search hostels..." oninput="debounce(loadUniHostels,400)()">
          <div class="toolbar-actions">
            <button class="btn btn-outline btn-sm" onclick="downloadUniReport('hostels','csv')">⬇️ CSV</button>
            <button class="btn btn-outline btn-sm" onclick="downloadUniReport('hostels','pdf')">📄 PDF</button>
          </div>
        </div>
        <div id="uni-hostels-list"><div class="spinner-container"><div class="spinner"></div></div></div>
      </div>

      <!-- Students Tab -->
      <div id="uni-students" class="tab-content hidden">
        <div class="toolbar">
          <input type="search" id="uni-student-search" placeholder="Search students..." oninput="debounce(loadUniStudents,400)()">
          <select id="uni-student-inst" onchange="loadUniStudents()">
            <option value="">All Institutions</option>
          </select>
          <div class="toolbar-actions">
            <button class="btn btn-outline btn-sm" onclick="downloadUniReport('students','csv')">⬇️ CSV</button>
            <button class="btn btn-primary btn-sm" onclick="downloadUniReport('students','pdf')">📄 PDF Report</button>
          </div>
        </div>
        <div id="uni-students-list"><div class="spinner-container"><div class="spinner"></div></div></div>
      </div>
    </div>`;

  loadUniStats();
  loadUniHostels();
  loadUniStudents();
});

async function loadUniStats() {
  const el = document.getElementById('uni-stats');
  if (!el) return;
  try {
    const s = await HH.api('/university/dashboard');
    el.innerHTML = `
      <div class="stat-card"><span class="stat-number">${s.total_students}</span><span class="stat-label">Students</span></div>
      <div class="stat-card"><span class="stat-number">${s.total_hostels}</span><span class="stat-label">Approved Hostels</span></div>
      <div class="stat-card"><span class="stat-number">${s.confirmed_bookings}</span><span class="stat-label">Active Bookings</span></div>
      <div class="stat-card"><span class="stat-number">${s.total_owners}</span><span class="stat-label">Hostel Owners</span></div>`;
  } catch {}
}

async function loadUniHostels() {
  const el     = document.getElementById('uni-hostels-list');
  const search = document.getElementById('uni-hostel-search')?.value.trim() || '';
  if (!el) return;
  showLoading(el, 'Loading hostels...');
  try {
    const params = new URLSearchParams({ limit: 50 });
    if (search) params.set('search', search);
    const { hostels } = await HH.api(`/university/hostels?${params}`);
    if (!hostels.length) { showEmpty(el, 'No hostels found', '🏠'); return; }
    el.innerHTML = `
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr>
            <th>#</th><th>Hostel Name</th><th>Address</th><th>Room Type</th>
            <th>Price/Month</th><th>Rooms</th><th>Owner</th><th>Owner Phone</th><th>Rating</th>
          </tr></thead>
          <tbody>
            ${hostels.map((h, i) => `
              <tr onclick="navigate('hostel/${h.id}')" style="cursor:pointer">
                <td>${i + 1}</td>
                <td><strong>${HH.escapeHtml(h.name)}</strong></td>
                <td>${HH.escapeHtml(h.address || '')}</td>
                <td><span class="badge badge-info">${h.room_type}</span></td>
                <td>${HH.formatCurrency(h.monthly_price)}</td>
                <td><span class="badge ${h.available_rooms > 0 ? 'badge-success' : 'badge-danger'}">${h.available_rooms}/${h.total_rooms}</span></td>
                <td>${HH.escapeHtml(h.owner_name)}</td>
                <td><a href="tel:${HH.escapeHtml(h.owner_phone)}">${HH.escapeHtml(h.owner_phone)}</a></td>
                <td>⭐ ${Number(h.average_rating).toFixed(1)}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
  } catch (err) { showError(el, err.message); }
}

async function loadUniStudents() {
  const el     = document.getElementById('uni-students-list');
  const search = document.getElementById('uni-student-search')?.value.trim() || '';
  const inst   = document.getElementById('uni-student-inst')?.value || '';
  if (!el) return;
  showLoading(el, 'Loading students...');
  try {
    const params = new URLSearchParams({ limit: 100 });
    if (search) params.set('search', search);
    if (inst)   params.set('institution', inst);
    const { students } = await HH.api(`/university/students?${params}`);
    if (!students.length) { showEmpty(el, 'No students found', '🎓'); return; }
    el.innerHTML = `
      <p class="result-count">${students.length} student(s) found</p>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr>
            <th>#</th><th>Name</th><th>Email</th><th>Phone</th>
            <th>Institution</th><th>Course</th><th>Year</th>
            <th>Current Hostel</th><th>Owner</th><th>Owner Phone</th>
          </tr></thead>
          <tbody>
            ${students.map((s, i) => `
              <tr>
                <td>${i + 1}</td>
                <td><strong>${HH.escapeHtml(s.name)}</strong></td>
                <td>${HH.escapeHtml(s.email)}</td>
                <td><a href="tel:${HH.escapeHtml(s.phone)}">${HH.escapeHtml(s.phone)}</a></td>
                <td>${HH.escapeHtml(s.institution || '—')}</td>
                <td>${HH.escapeHtml(s.course || '—')}</td>
                <td>${s.year_of_study || '—'}</td>
                <td>${s.current_hostel ? `<span class="badge badge-success">${HH.escapeHtml(s.current_hostel)}</span>` : '<span class="badge">None</span>'}</td>
                <td>${HH.escapeHtml(s.hostel_owner || '—')}</td>
                <td>${s.owner_phone ? `<a href="tel:${HH.escapeHtml(s.owner_phone)}">${HH.escapeHtml(s.owner_phone)}</a>` : '—'}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
  } catch (err) { showError(el, err.message); }
}

function switchUniTab(tab) {
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  document.querySelectorAll('.tab-content').forEach(c => {
    c.classList.toggle('active', c.id === tab);
    c.classList.toggle('hidden', c.id !== tab);
  });
}

async function downloadUniReport(type, format) {
  try {
    showToast(`Generating ${format.toUpperCase()} report...`, 'info');
    const ext  = format === 'pdf' ? '.pdf' : '.csv';
    await HH.downloadFile(`/university/report/${type}?format=${format}`, `${type}_report_${Date.now()}${ext}`);
    showToast('Report downloaded!', 'success');
  } catch (err) {
    showToast('Failed to generate report: ' + err.message, 'error');
  }
}

window.loadUniHostels  = loadUniHostels;
window.loadUniStudents = loadUniStudents;
window.switchUniTab    = switchUniTab;
window.downloadUniReport = downloadUniReport;
