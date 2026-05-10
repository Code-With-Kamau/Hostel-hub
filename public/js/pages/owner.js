registerPage('owner', async (main) => {
  if (!HH.isLoggedIn() || (!HH.isOwner() && !HH.isAdmin())) {
    main.innerHTML = `<div class="empty-state"><h2>Access Denied</h2><p>This page is for hostel owners only.</p><button class="btn btn-primary" onclick="showLoginModal()">Log In</button></div>`;
    return;
  }

  const user = HH.getUser();
  main.innerHTML = `
    <div class="page-wrap">
      <div class="page-header">
        <div>
          <h2>🏢 Owner Panel</h2>
          <p class="subtitle">Manage your hostel listings and bookings</p>
        </div>
        <button class="btn btn-primary" onclick="showAddHostelModal()">+ Add Hostel</button>
      </div>

      <div class="tabs-wrap">
        <button class="tab active" data-tab="ow-hostels"  onclick="switchOwnerTab('ow-hostels')">🏠 My Hostels</button>
        <button class="tab" data-tab="ow-bookings" onclick="switchOwnerTab('ow-bookings')">📋 Bookings</button>
        <button class="tab" data-tab="ow-earnings" onclick="switchOwnerTab('ow-earnings')">💰 Earnings</button>
      </div>

      <!-- My Hostels -->
      <div id="ow-hostels" class="tab-content active">
        <div id="owner-hostels-list"><div class="spinner-container"><div class="spinner"></div></div></div>
      </div>

      <!-- Bookings -->
      <div id="ow-bookings" class="tab-content hidden">
        <div id="owner-bookings-list"><div class="spinner-container"><div class="spinner"></div></div></div>
      </div>

      <!-- Earnings -->
      <div id="ow-earnings" class="tab-content hidden">
        <div id="owner-earnings-content"><div class="spinner-container"><div class="spinner"></div></div></div>
      </div>
    </div>`;

  loadOwnerHostels();
  loadOwnerBookings();
  loadOwnerEarnings();
});

async function loadOwnerHostels() {
  const el = document.getElementById('owner-hostels-list');
  if (!el) return;
  showLoading(el, 'Loading your hostels...');
  try {
    const hostels = await HH.api('/hostels/owner/my-hostels');
    if (!hostels.length) {
      el.innerHTML = `
        <div class="empty-state">
          <span class="empty-icon">🏠</span>
          <p>You haven't listed any hostels yet.</p>
          <button class="btn btn-primary" onclick="showAddHostelModal()">+ List Your First Hostel</button>
        </div>`;
      return;
    }
    el.innerHTML = hostels.map(h => `
      <div class="owner-hostel-card">
        <div class="owner-hostel-img">
          <img src="${HH.escapeHtml(h.primary_image || '/images/default-hostel.jpg')}" alt="" onerror="this.src='/images/default-hostel.jpg'">
        </div>
        <div class="owner-hostel-body">
          <div class="owner-hostel-header">
            <h3>${HH.escapeHtml(h.name)}</h3>
            <span class="badge badge-${h.status === 'approved' ? 'success' : h.status === 'pending' ? 'warning' : 'danger'}">${h.status}</span>
          </div>
          <p class="text-muted">📍 ${HH.escapeHtml(h.address || '')}</p>
          <div class="owner-hostel-stats">
            <span>💰 ${HH.formatCurrency(h.monthly_price)}/mo</span>
            <span>🛏 ${h.room_type}</span>
            <span>🏠 ${h.available_rooms}/${h.total_rooms} available</span>
            <span>📋 ${h.active_bookings} active bookings</span>
            <span>⭐ ${Number(h.average_rating || 0).toFixed(1)}</span>
          </div>
          ${h.status === 'pending' ? `<p class="hint">⏳ Awaiting admin approval. You'll be notified once approved.</p>` : ''}
        </div>
        <div class="owner-hostel-actions">
          <button class="btn btn-outline btn-sm" onclick="navigate('hostel/${h.id}')">👁 View</button>
          <button class="btn btn-primary btn-sm" onclick="showEditHostelModal(${h.id})">✏️ Edit</button>
          <button class="btn btn-sm" onclick="showAddImagesModal(${h.id})">🖼 Photos</button>
          <button class="btn btn-danger btn-sm" onclick="deleteHostel(${h.id}, '${HH.escapeHtml(h.name)}')">🗑 Delete</button>
        </div>
      </div>`).join('');
  } catch (err) { showError(el, err.message); }
}

async function loadOwnerBookings() {
  const el = document.getElementById('owner-bookings-list');
  if (!el) return;
  showLoading(el, 'Loading bookings...');
  try {
    const bookings = await HH.api('/booking/owner');
    if (!bookings.length) { showEmpty(el, 'No bookings yet', '📋'); return; }
    el.innerHTML = `
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr>
            <th>Booking</th><th>Student</th><th>Course</th><th>Hostel</th>
            <th>Amount</th><th>Your Share</th><th>Status</th><th>Receipt</th><th>Actions</th>
          </tr></thead>
          <tbody>
            ${bookings.map(b => `
              <tr>
                <td>#${b.id}<br><small>${HH.formatDate(b.created_at)}</small></td>
                <td>
                  <strong>${HH.escapeHtml(b.student_name)}</strong><br>
                  <small>${HH.escapeHtml(b.institution || '')}</small><br>
                  <a href="tel:${HH.escapeHtml(b.student_phone || '')}" class="contact-link">${HH.escapeHtml(b.student_phone || '')}</a>
                </td>
                <td>${HH.escapeHtml(b.course || '—')}</td>
                <td>${HH.escapeHtml(b.hostel_name)}</td>
                <td>${b.paid_amount ? HH.formatCurrency(b.paid_amount) : '—'}</td>
                <td class="text-success">${b.owner_amount ? HH.formatCurrency(b.owner_amount) : '—'}</td>
                <td>
                  <span class="badge badge-${b.status === 'confirmed' ? 'success' : b.status === 'cancelled' || b.status === 'released' ? 'danger' : 'warning'}">${b.status}</span><br>
                  <small class="badge badge-${b.payment_status === 'completed' ? 'success' : 'warning'}">${b.payment_status || 'unpaid'}</small>
                </td>
                <td><small>${HH.escapeHtml(b.mpesa_receipt || '—')}</small></td>
                <td>
                  <button class="btn btn-success btn-xs" onclick="contactStudent(${b.student_id}, '${HH.escapeHtml(b.student_name)}', '${HH.escapeHtml(b.student_phone || '')}')">
                    💬
                  </button>
                  <a href="https://wa.me/${(b.student_phone||'').replace(/\+/,'').replace(/\s/g,'')}" target="_blank" class="btn btn-success btn-xs">📱</a>
                </td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
  } catch (err) { showError(el, err.message); }
}

async function loadOwnerEarnings() {
  const el = document.getElementById('owner-earnings-content');
  if (!el) return;
  showLoading(el, 'Loading earnings...');
  try {
    const bookings = await HH.api('/booking/owner');
    const completed = bookings.filter(b => b.payment_status === 'completed');
    const totalGross = completed.reduce((s, b) => s + Number(b.paid_amount || 0), 0);
    const totalNet   = completed.reduce((s, b) => s + Number(b.owner_amount || 0), 0);
    const totalComm  = completed.reduce((s, b) => s + Number(b.commission_amount || 0), 0);

    el.innerHTML = `
      <div class="stats-row">
        <div class="stat-card"><span class="stat-number">${HH.formatCurrency(totalGross)}</span><span class="stat-label">Total Deposits Received</span></div>
        <div class="stat-card badge-success"><span class="stat-number">${HH.formatCurrency(totalNet)}</span><span class="stat-label">Your Earnings (90%)</span></div>
        <div class="stat-card"><span class="stat-number">${HH.formatCurrency(totalComm)}</span><span class="stat-label">Platform Fee (10%)</span></div>
        <div class="stat-card"><span class="stat-number">${completed.length}</span><span class="stat-label">Paid Bookings</span></div>
      </div>
      <div class="earnings-note">
        <p>💡 HostelHub deducts a <strong>10% platform fee</strong> from each deposit. Your net earnings (90%) are shown above.</p>
      </div>`;
  } catch (err) { showError(el, err.message); }
}

function showAddHostelModal() {
  showModal('🏠 List New Hostel', buildHostelForm(), '', 'lg');
}

async function showEditHostelModal(hostelId) {
  showLoading(document.getElementById('owner-hostels-list'), 'Loading hostel data...');
  try {
    const h = await HH.api(`/hostels/${hostelId}`);
    showModal('✏️ Edit Hostel', buildHostelForm(h), '', 'lg');
  } catch (err) { showToast(err.message, 'error'); }
}

function buildHostelForm(h = null) {
  const isEdit = !!h;
  return `
    <form id="hostel-form" onsubmit="saveHostelForm(event, ${h?.id || 'null'})">
      <div class="form-row">
        <div class="form-group">
          <label>Hostel Name *</label>
          <input type="text" id="hf-name" value="${h ? HH.escapeHtml(h.name) : ''}" placeholder="e.g. Sunrise Student Apartments" required>
        </div>
        <div class="form-group">
          <label>Room Type *</label>
          <select id="hf-room-type" required>
            ${['single','double','triple','ensuite','bedsitter','studio'].map(t =>
              `<option value="${t}" ${h?.room_type === t ? 'selected' : ''}>${t.charAt(0).toUpperCase()+t.slice(1)}</option>`
            ).join('')}
          </select>
        </div>
      </div>
      <div class="form-group">
        <label>Address *</label>
        <input type="text" id="hf-address" value="${h ? HH.escapeHtml(h.address || '') : ''}" placeholder="Street, Area, Nairobi" required>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>County</label>
          <input type="text" id="hf-county" value="${h ? HH.escapeHtml(h.county || '') : ''}" placeholder="e.g. Nairobi">
        </div>
        <div class="form-group">
          <label>Gender Policy *</label>
          <select id="hf-gender">
            ${['male_only','female_only','mixed','any'].map(g =>
              `<option value="${g}" ${h?.gender_policy === g ? 'selected' : ''}>${g.replace('_',' ')}</option>`
            ).join('')}
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Nearest University/College</label>
          <input type="text" id="hf-institution" value="${h ? HH.escapeHtml(h.nearest_institution || '') : ''}" placeholder="e.g. University of Nairobi">
        </div>
        <div class="form-group">
          <label>Distance to Campus (km)</label>
          <input type="number" id="hf-distance" value="${h?.distance_to_campus || ''}" step="0.1" min="0" placeholder="e.g. 0.5">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Monthly Rent (KES) *</label>
          <input type="number" id="hf-price" value="${h?.monthly_price || ''}" min="1" placeholder="e.g. 8000" required>
        </div>
        <div class="form-group">
          <label>Deposit Amount (KES) *</label>
          <input type="number" id="hf-deposit" value="${h?.deposit_amount || ''}" min="1" placeholder="e.g. 8000" required>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Total Rooms *</label>
          <input type="number" id="hf-rooms" value="${h?.total_rooms || ''}" min="1" placeholder="e.g. 20" required>
        </div>
        <div class="form-group">
          <label>Curfew Time (optional)</label>
          <input type="time" id="hf-curfew" value="${h?.curfew_time || ''}">
        </div>
      </div>
      <div class="form-group">
        <label>Description</label>
        <textarea id="hf-desc" rows="3" placeholder="Describe your hostel — amenities, atmosphere, rules...">${h ? HH.escapeHtml(h.description || '') : ''}</textarea>
      </div>
      <!-- Amenities Checkboxes -->
      <div class="form-group">
        <label>Amenities</label>
        <div class="amenity-checks">
          <label class="checkbox-label"><input type="checkbox" id="hf-wifi"    ${h?.wifi           ? 'checked' : ''}> 📶 WiFi</label>
          <label class="checkbox-label"><input type="checkbox" id="hf-meals"   ${h?.meals_provided ? 'checked' : ''}> 🍽️ Meals</label>
          <label class="checkbox-label"><input type="checkbox" id="hf-study"   ${h?.study_friendly ? 'checked' : ''}> 📚 Study-Friendly</label>
          <label class="checkbox-label"><input type="checkbox" id="hf-security" ${h?.security      ? 'checked' : ''}> 🔒 24h Security</label>
          <label class="checkbox-label"><input type="checkbox" id="hf-power"   ${h?.backup_power  ? 'checked' : ''}> ⚡ Backup Power</label>
          <label class="checkbox-label"><input type="checkbox" id="hf-roommates" ${h?.allows_roommates ? 'checked' : ''}> 🤝 Allows Roommates</label>
        </div>
      </div>
      ${h?.meals_provided ? `
      <div class="form-group">
        <label>Meals Description</label>
        <input type="text" id="hf-meals-desc" value="${HH.escapeHtml(h.meals_description || '')}" placeholder="e.g. Breakfast and dinner included">
      </div>` : ''}
      <div id="hostel-form-error" class="form-error hidden"></div>
      <div class="modal-footer" style="padding:0;border:none;margin-top:20px">
        <button type="button" class="btn btn-outline" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn btn-primary" id="hostel-form-btn">
          ${isEdit ? '💾 Save Changes' : '🏠 Submit for Approval'}
        </button>
      </div>
    </form>`;
}

async function saveHostelForm(e, hostelId) {
  e.preventDefault();
  const errEl = document.getElementById('hostel-form-error');
  const btn   = document.getElementById('hostel-form-btn');

  const body = {
    name:               document.getElementById('hf-name')?.value.trim(),
    address:            document.getElementById('hf-address')?.value.trim(),
    county:             document.getElementById('hf-county')?.value.trim(),
    room_type:          document.getElementById('hf-room-type')?.value,
    gender_policy:      document.getElementById('hf-gender')?.value,
    nearest_institution: document.getElementById('hf-institution')?.value.trim(),
    distance_to_campus: document.getElementById('hf-distance')?.value || null,
    monthly_price:      document.getElementById('hf-price')?.value,
    deposit_amount:     document.getElementById('hf-deposit')?.value,
    total_rooms:        document.getElementById('hf-rooms')?.value,
    description:        document.getElementById('hf-desc')?.value.trim(),
    curfew_time:        document.getElementById('hf-curfew')?.value || null,
    wifi:               document.getElementById('hf-wifi')?.checked,
    meals_provided:     document.getElementById('hf-meals')?.checked,
    study_friendly:     document.getElementById('hf-study')?.checked,
    security:           document.getElementById('hf-security')?.checked,
    backup_power:       document.getElementById('hf-power')?.checked,
    allows_roommates:   document.getElementById('hf-roommates')?.checked,
  };

  if (!body.name || !body.address || !body.monthly_price || !body.deposit_amount || !body.total_rooms) {
    errEl.textContent = 'Please fill in all required fields';
    errEl.classList.remove('hidden');
    return;
  }

  setButtonLoading(btn, true);
  errEl.classList.add('hidden');

  try {
    if (hostelId) {
      await HH.api(`/hostels/${hostelId}`, { method: 'PUT', body });
      showToast('Hostel updated successfully!', 'success');
    } else {
      await HH.api('/hostels', { method: 'POST', body });
      showToast('Hostel submitted for review! You\'ll be notified once approved.', 'success');
    }
    closeModal();
    loadOwnerHostels();
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.remove('hidden');
  } finally {
    setButtonLoading(btn, false, hostelId ? '💾 Save Changes' : '🏠 Submit for Approval');
  }
}

function showAddImagesModal(hostelId) {
  showModal('🖼 Add Photos', `
    <div class="upload-area" onclick="document.getElementById('img-upload').click()">
      <div class="upload-icon">📷</div>
      <p>Click to select images</p>
      <small>JPEG, PNG, WebP — max 10MB each</small>
    </div>
    <input type="file" id="img-upload" accept="image/*" multiple style="display:none" onchange="previewAndUploadImages(${hostelId}, this)">
    <div id="img-preview" class="img-preview-grid"></div>
    <div id="img-upload-progress" class="form-success hidden"></div>`, '', 'sm');
}

async function previewAndUploadImages(hostelId, input) {
  const files = Array.from(input.files);
  if (!files.length) return;

  const previewEl  = document.getElementById('img-preview');
  const progressEl = document.getElementById('img-upload-progress');

  // Preview
  previewEl.innerHTML = files.map(f => `
    <div class="img-thumb">
      <img src="${URL.createObjectURL(f)}" alt="${HH.escapeHtml(f.name)}">
      <span>${HH.escapeHtml(f.name.slice(0,20))}</span>
    </div>`).join('');

  // Upload
  const formData = new FormData();
  files.forEach(f => formData.append('images', f));

  try {
    progressEl.textContent = 'Uploading...';
    progressEl.classList.remove('hidden');

    const token    = HH.getToken();
    const response = await fetch(`${HH.API_URL}/hostels/${hostelId}/images`, {
      method:  'POST',
      headers: { Authorization: `Bearer ${token}` },
      body:    formData,
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    progressEl.textContent = '✅ ' + data.message;
    showToast(data.message, 'success');
    loadOwnerHostels();
  } catch (err) {
    progressEl.textContent = '❌ ' + err.message;
    progressEl.style.color = 'red';
  }
}

async function deleteHostel(hostelId, name) {
  confirmAction(`Delete "${name}"? This action cannot be undone.`, async () => {
    try {
      await HH.api(`/hostels/${hostelId}`, { method: 'DELETE' });
      showToast('Hostel deleted', 'success');
      loadOwnerHostels();
    } catch (err) { showToast(err.message, 'error'); }
  });
}

async function contactStudent(studentId, name, phone) {
  try {
    const data = await HH.api('/chat/start', {
      method: 'POST',
      body: { other_user_id: studentId },
    });
    navigate(`chat/${data.conversationId}`);
  } catch (err) { showToast(err.message, 'error'); }
}

function switchOwnerTab(tab) {
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  document.querySelectorAll('.tab-content').forEach(c => {
    c.classList.toggle('active', c.id === tab);
    c.classList.toggle('hidden', c.id !== tab);
  });
}

window.loadOwnerHostels   = loadOwnerHostels;
window.loadOwnerBookings  = loadOwnerBookings;
window.showAddHostelModal  = showAddHostelModal;
window.showEditHostelModal = showEditHostelModal;
window.saveHostelForm      = saveHostelForm;
window.showAddImagesModal  = showAddImagesModal;
window.previewAndUploadImages = previewAndUploadImages;
window.deleteHostel        = deleteHostel;
window.contactStudent      = contactStudent;
window.switchOwnerTab      = switchOwnerTab;
