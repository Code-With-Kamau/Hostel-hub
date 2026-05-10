registerPage('dashboard', async (main) => {
  if (!HH.isLoggedIn()) { showLoginModal(); return; }
  if (!HH.isStudent() && !HH.isAdmin()) {
    main.innerHTML = `<div class="empty-state"><h2>Students Only</h2></div>`;
    return;
  }

  const user = HH.getUser();
  main.innerHTML = `
    <div class="page-wrap">
      <div class="page-header">
        <h2>📋 My Dashboard</h2>
        <p class="subtitle">Welcome, ${HH.escapeHtml(user.name.split(' ')[0])}!</p>
      </div>
      <div class="tabs-wrap">
        <button class="tab active" data-tab="dash-bookings" onclick="switchDashTab('dash-bookings')">🏠 My Bookings</button>
        <button class="tab" data-tab="dash-saved"    onclick="switchDashTab('dash-saved')">❤️ Saved Hostels</button>
        <button class="tab" data-tab="dash-roommate" onclick="switchDashTab('dash-roommate')">👥 Roommate Finder</button>
        <button class="tab" data-tab="dash-buddy"    onclick="switchDashTab('dash-buddy')">📚 Study Buddy</button>
      </div>

      <!-- Bookings -->
      <div id="dash-bookings" class="tab-content active">
        <div id="my-bookings-list"><div class="spinner-container"><div class="spinner"></div></div></div>
      </div>
      <!-- Saved -->
      <div id="dash-saved" class="tab-content hidden">
        <div id="my-saved-list"><div class="spinner-container"><div class="spinner"></div></div></div>
      </div>
      <!-- Roommate -->
      <div id="dash-roommate" class="tab-content hidden">
        <div id="my-roommate-section"></div>
      </div>
      <!-- Study Buddy -->
      <div id="dash-buddy" class="tab-content hidden">
        <div id="my-buddy-section"></div>
      </div>
    </div>`;

  loadMyBookings();
  loadSavedHostels();
  loadRoommateDash();
  loadBuddyDash();
});

async function loadMyBookings() {
  const el = document.getElementById('my-bookings-list');
  if (!el) return;
  showLoading(el, 'Loading your bookings...');
  try {
    const bookings = await HH.api('/booking/my');
    if (!bookings.length) {
      el.innerHTML = `<div class="empty-state">
        <span class="empty-icon">🏠</span>
        <p>You haven't booked any hostel yet.</p>
        <button class="btn btn-primary" onclick="navigate('home')">Find a Hostel</button>
      </div>`;
      return;
    }
    el.innerHTML = bookings.map(b => buildBookingCard(b)).join('');
  } catch (err) { showError(el, err.message); }
}

function buildBookingCard(b) {
  const cancelDeadline = new Date(b.cancel_deadline);
  const now            = new Date();
  const canCancel      = b.status === 'pending' || (b.status === 'confirmed' && now <= cancelDeadline);
  const canRelease     = b.status === 'confirmed';
  const daysLeft       = Math.max(0, Math.ceil((cancelDeadline - now) / 86400000));

  const statusColors = { pending:'warning', confirmed:'success', cancelled:'danger', released:'info', refunded:'info' };
  const img          = b.hostel_image || '/images/default-hostel.jpg';

  return `
    <div class="booking-card" id="booking-${b.id}">
      <div class="booking-card-img">
        <img src="${HH.escapeHtml(img)}" alt="${HH.escapeHtml(b.hostel_name)}" onerror="this.src='/images/default-hostel.jpg'">
      </div>
      <div class="booking-card-body">
        <div class="booking-card-header">
          <h3>${HH.escapeHtml(b.hostel_name)}</h3>
          <span class="badge badge-${statusColors[b.status] || 'info'}">${b.status}</span>
        </div>
        <p>📍 ${HH.escapeHtml(b.hostel_address || '')}</p>
        <p>🛏 ${b.room_type} &nbsp;|&nbsp; 💰 ${HH.formatCurrency(b.monthly_price)}/month</p>
        <p>💳 Deposit: <strong>${HH.formatCurrency(b.deposit_amount)}</strong>
          &nbsp; Payment: <span class="badge badge-${b.payment_status === 'completed' ? 'success' : 'warning'}">${b.payment_status || 'pending'}</span>
        </p>
        ${b.mpesa_receipt ? `<p>🧾 Receipt: <strong>${HH.escapeHtml(b.mpesa_receipt)}</strong></p>` : ''}
        <p>👤 Owner: ${HH.escapeHtml(b.owner_name)} · <a href="tel:${HH.escapeHtml(b.owner_phone)}">${HH.escapeHtml(b.owner_phone)}</a></p>
        ${b.commission_amount ? `<p class="text-muted">Platform fee deducted: ${HH.formatCurrency(b.commission_amount)}</p>` : ''}
        ${canCancel && b.status === 'confirmed' ? `
          <div class="cancel-warning">
            ⏰ Free cancellation ends in <strong>${daysLeft} day${daysLeft !== 1 ? 's' : ''}</strong>
            (${HH.formatDate(cancelDeadline)})
          </div>` : ''}

        <div class="booking-actions">
          ${b.payment_status !== 'completed' && b.status === 'pending' ? `
            <button class="btn btn-primary btn-sm" onclick="showPaymentModal(${b.id}, ${b.deposit_amount}, '${HH.escapeHtml(b.hostel_name)}')">
              💳 Pay Deposit
            </button>` : ''}
          ${canCancel ? `
            <button class="btn btn-danger btn-sm" onclick="cancelBooking(${b.id})">
              ❌ Cancel${b.payment_status === 'completed' && now <= cancelDeadline ? ' & Refund' : ''}
            </button>` : ''}
          ${canRelease ? `
            <button class="btn btn-warning btn-sm" onclick="releaseBooking(${b.id})">
              🔓 Release Hostel
            </button>` : ''}
          <button class="btn btn-outline btn-sm" onclick="startChat(${b.owner_id || 0}, '${HH.escapeHtml(b.owner_name)}', ${b.hostel_id || 0})">
            💬 Message Owner
          </button>
          <a href="https://wa.me/${(b.owner_phone || '').replace(/\+/,'').replace(/\s/,'')}" target="_blank" class="btn btn-success btn-sm">
            📱 WhatsApp Owner
          </a>
        </div>
      </div>
    </div>`;
}

function showPaymentModal(bookingId, amount, hostelName) {
  showModal('💳 Pay Deposit via M-Pesa', `
    <div class="payment-info">
      <p>Hostel: <strong>${HH.escapeHtml(hostelName)}</strong></p>
      <p>Amount: <strong>${HH.formatCurrency(amount)}</strong></p>
      <p class="hint">Note: 10% platform fee is included in the deposit amount.</p>
    </div>
    <div class="form-group">
      <label>M-Pesa Phone Number</label>
      <input type="tel" id="pay-phone" placeholder="0712 345 678" value="${HH.getUser()?.phone || ''}">
    </div>
    <div id="pay-error" class="form-error hidden"></div>
    <div class="payment-buttons">
      <button class="btn btn-primary btn-full" id="pay-btn" onclick="initiatePayment(${bookingId})">
        📱 Send M-Pesa Prompt
      </button>
      ${window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? `
      <button class="btn btn-outline btn-full" id="simulate-btn" onclick="simulatePayment(${bookingId})">
        🧪 Simulate Payment (Dev)
      </button>` : ''}
    </div>`, '', 'sm');
  attachPhoneFormatter('pay-phone');
}

async function initiatePayment(bookingId) {
  const phone = document.getElementById('pay-phone')?.value.trim();
  const errEl = document.getElementById('pay-error');
  const btn   = document.getElementById('pay-btn');

  if (!HH.validateKenyanPhone(phone)) {
    showFormError(errEl, 'Enter a valid Kenyan phone number');
    return;
  }

  setButtonLoading(btn, true);
  try {
    const data = await HH.api('/mpesa/pay', { method: 'POST', body: { booking_id: bookingId, phone } });
    closeModal();
    showToast('✅ ' + data.message, 'success', 6000);
    setTimeout(loadMyBookings, 5000);
  } catch (err) {
    showFormError(errEl, err.message);
  } finally {
    setButtonLoading(btn, false, '📱 Send M-Pesa Prompt');
  }
}

async function simulatePayment(bookingId) {
  const btn = document.getElementById('simulate-btn');
  setButtonLoading(btn, true);
  try {
    const data = await HH.api('/mpesa/simulate', { method: 'POST', body: { booking_id: bookingId } });
    closeModal();
    showToast(data.message, 'success');
    loadMyBookings();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    setButtonLoading(btn, false, '🧪 Simulate');
  }
}

async function cancelBooking(bookingId) {
  confirmAction(
    'Are you sure you want to cancel this booking? If within 3 days, your deposit will be refunded to your M-Pesa.',
    async () => {
      try {
        const data = await HH.api(`/booking/${bookingId}/cancel`, { method: 'POST' });
        showToast(data.message, 'success');
        if (data.refundNote) showToast(data.refundNote, 'info', 6000);
        loadMyBookings();
      } catch (err) { showToast(err.message, 'error'); }
    }
  );
}

async function releaseBooking(bookingId) {
  confirmAction(
    'Release this hostel? The room will immediately become available for other students. Note: outside the 3-day window, no refund is issued.',
    async () => {
      try {
        const data = await HH.api(`/booking/${bookingId}/release`, { method: 'POST' });
        showToast(data.message, 'success');
        loadMyBookings();
      } catch (err) { showToast(err.message, 'error'); }
    }
  );
}

async function loadSavedHostels() {
  const el = document.getElementById('my-saved-list');
  if (!el) return;
  showLoading(el, 'Loading saved hostels...');
  try {
    const hostels = await HH.api('/students/saved');
    if (!hostels.length) {
      showEmpty(el, 'No saved hostels yet. Browse and click the ❤️ button to save.', '❤️');
      return;
    }
    el.innerHTML = `<div class="hostel-grid">${hostels.map(h => HH.buildHostelCard(h, true)).join('')}</div>`;
  } catch (err) { showError(el, err.message); }
}

async function loadRoommateDash() {
  const el = document.getElementById('my-roommate-section');
  if (!el) return;
  el.innerHTML = `
    <div class="two-col">
      <div>
        <h3>My Roommate Post</h3>
        <form id="roommate-form" onsubmit="saveRoommatePost(event)">
          <div class="form-row">
            <div class="form-group">
              <label>My Gender</label>
              <select id="rm-gender" required>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div class="form-group">
              <label>Preferred Roommate</label>
              <select id="rm-pref-gender">
                <option value="any">Any</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Min Budget (KES)</label>
              <input type="number" id="rm-min" placeholder="e.g. 4000">
            </div>
            <div class="form-group">
              <label>Max Budget (KES)</label>
              <input type="number" id="rm-max" placeholder="e.g. 8000">
            </div>
          </div>
          <div class="form-group">
            <label>Move-in Date</label>
            <input type="date" id="rm-date">
          </div>
          <div class="form-group">
            <label>About Me</label>
            <textarea id="rm-bio" rows="3" placeholder="Describe your lifestyle, study habits..."></textarea>
          </div>
          <button type="submit" class="btn btn-primary">Post / Update</button>
          <button type="button" class="btn btn-danger btn-sm" onclick="deactivateRoommatePost()">Deactivate Post</button>
        </form>
      </div>
      <div>
        <h3>Browse Roommate Seekers</h3>
        <div id="roommate-browse-list"><div class="spinner-container"><div class="spinner"></div></div></div>
      </div>
    </div>`;
  loadRoommateBrowse();
}

async function saveRoommatePost(e) {
  e.preventDefault();
  try {
    await HH.api('/students/roommates', {
      method: 'POST',
      body: {
        gender:           document.getElementById('rm-gender').value,
        preferred_gender: document.getElementById('rm-pref-gender').value,
        min_budget:       document.getElementById('rm-min').value || null,
        max_budget:       document.getElementById('rm-max').value || null,
        move_in_date:     document.getElementById('rm-date').value || null,
        bio:              document.getElementById('rm-bio').value,
      },
    });
    showToast('Roommate post updated!', 'success');
  } catch (err) { showToast(err.message, 'error'); }
}

async function deactivateRoommatePost() {
  try {
    await HH.api('/students/roommates/mine', { method: 'DELETE' });
    showToast('Roommate post deactivated', 'info');
  } catch (err) { showToast(err.message, 'error'); }
}

async function loadRoommateBrowse() {
  const el = document.getElementById('roommate-browse-list');
  if (!el) return;
  try {
    const rows = await HH.api('/students/roommates?limit=20');
    if (!rows.length) { showEmpty(el, 'No roommate seekers yet', '👥'); return; }
    el.innerHTML = rows.map(r => `
      <div class="community-card">
        <strong>${HH.escapeHtml(r.name)}</strong>
        <p>${HH.escapeHtml(r.institution || '')} · ${HH.escapeHtml(r.course || '')}</p>
        <p>Budget: ${r.min_budget ? HH.formatCurrency(r.min_budget) : '?'} – ${r.max_budget ? HH.formatCurrency(r.max_budget) : '?'}</p>
        <p class="text-muted">${HH.escapeHtml(r.bio || '')}</p>
        <div class="card-actions">
          <button class="btn btn-primary btn-sm" onclick="startChat(${r.student_id}, '${HH.escapeHtml(r.name)}', 0)">💬 Message</button>
          <a href="https://wa.me/${(r.phone || '').replace(/\+/,'')}" target="_blank" class="btn btn-success btn-sm">📱 WhatsApp</a>
        </div>
      </div>`).join('');
  } catch (err) { showError(el, err.message); }
}

async function loadBuddyDash() {
  const el = document.getElementById('my-buddy-section');
  if (!el) return;
  el.innerHTML = `
    <div class="two-col">
      <div>
        <h3>My Study Buddy Post</h3>
        <form id="buddy-form" onsubmit="saveBuddyPost(event)">
          <div class="form-group">
            <label>Subjects (comma-separated)</label>
            <input type="text" id="buddy-subjects" placeholder="e.g. Maths, Physics, Programming">
          </div>
          <div class="form-group">
            <label>Study Style</label>
            <select id="buddy-style">
              <option value="any">Any</option>
              <option value="quiet">Quiet / Individual</option>
              <option value="group">Group Study</option>
              <option value="discussions">Discussions</option>
            </select>
          </div>
          <div class="form-group">
            <label>Preferred Times</label>
            <input type="text" id="buddy-times" placeholder="e.g. Weekday evenings 6-9pm">
          </div>
          <div class="form-group">
            <label>About Me</label>
            <textarea id="buddy-bio" rows="3" placeholder="Tell others about your study habits..."></textarea>
          </div>
          <button type="submit" class="btn btn-primary">Post / Update</button>
        </form>
      </div>
      <div>
        <h3>Browse Study Buddies</h3>
        <div id="buddy-browse-list"><div class="spinner-container"><div class="spinner"></div></div></div>
      </div>
    </div>`;
  loadBuddyBrowse();
}

async function saveBuddyPost(e) {
  e.preventDefault();
  try {
    await HH.api('/students/study-buddies', {
      method: 'POST',
      body: {
        subjects:        document.getElementById('buddy-subjects').value,
        study_style:     document.getElementById('buddy-style').value,
        preferred_times: document.getElementById('buddy-times').value,
        bio:             document.getElementById('buddy-bio').value,
      },
    });
    showToast('Study buddy post updated!', 'success');
  } catch (err) { showToast(err.message, 'error'); }
}

async function loadBuddyBrowse() {
  const el = document.getElementById('buddy-browse-list');
  if (!el) return;
  try {
    const rows = await HH.api('/students/study-buddies?limit=20');
    if (!rows.length) { showEmpty(el, 'No study buddy posts yet', '📚'); return; }
    el.innerHTML = rows.map(r => `
      <div class="community-card">
        <strong>${HH.escapeHtml(r.name)}</strong>
        <p>${HH.escapeHtml(r.institution || '')} · ${HH.escapeHtml(r.course || '')}</p>
        <p>📚 ${HH.escapeHtml(r.subjects)}</p>
        <p>🕐 ${HH.escapeHtml(r.preferred_times || 'Flexible')}</p>
        <div class="card-actions">
          <button class="btn btn-primary btn-sm" onclick="startChat(${r.student_id}, '${HH.escapeHtml(r.name)}', 0)">💬 Message</button>
        </div>
      </div>`).join('');
  } catch (err) { showError(el, err.message); }
}

function switchDashTab(tab) {
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  document.querySelectorAll('.tab-content').forEach(c => {
    c.classList.toggle('active', c.id === tab);
    c.classList.toggle('hidden', c.id !== tab);
  });
}

async function startChat(userId, userName, hostelId) {
  if (!HH.isLoggedIn()) { showLoginModal(); return; }
  try {
    const data = await HH.api('/chat/start', {
      method: 'POST',
      body: { other_user_id: userId, hostel_id: hostelId || null },
    });
    navigate(`chat/${data.conversationId}`);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// Expose
window.loadMyBookings      = loadMyBookings;
window.showPaymentModal    = showPaymentModal;
window.initiatePayment     = initiatePayment;
window.simulatePayment     = simulatePayment;
window.cancelBooking       = cancelBooking;
window.releaseBooking      = releaseBooking;
window.saveRoommatePost    = saveRoommatePost;
window.deactivateRoommatePost = deactivateRoommatePost;
window.saveBuddyPost       = saveBuddyPost;
window.switchDashTab       = switchDashTab;
window.startChat           = startChat;
window.showFormError       = (el, msg) => { if (typeof el === 'string') el = document.getElementById(el); if (el) { el.textContent = msg; el.classList.remove('hidden'); } };
