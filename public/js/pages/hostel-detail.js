registerPage('hostel', async (main, hostelId) => {
  if (!hostelId) { navigate('home'); return; }

  main.innerHTML = `<div class="spinner-container" style="padding:80px"><div class="spinner"></div><p>Loading hostel...</p></div>`;

  try {
    const hostel = await HH.api(`/hostels/${hostelId}`);
    renderHostelDetail(main, hostel);
  } catch (err) {
    main.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">🏠</span>
        <h2>Hostel Not Found</h2>
        <p>${HH.escapeHtml(err.message)}</p>
        <button class="btn btn-primary" onclick="navigate('home')">Browse Hostels</button>
      </div>`;
  }
});

function renderHostelDetail(main, h) {
  const images = h.images?.length
    ? h.images
    : [{ image_path: '/images/default-hostel.jpg', is_primary: 1 }];

  const primaryImg = images.find(i => i.is_primary)?.image_path || images[0].image_path;
  const amenityIcons = { wifi:'📶', meals:'🍽️', study:'📚', security:'🔒', power:'⚡', transport:'🚌', hospital:'🏥', supermarket:'🛒', gym:'💪', laundry:'👕' };

  const roomsClass = h.available_rooms === 0 ? 'badge-danger' : h.available_rooms <= 3 ? 'badge-warning' : 'badge-success';

  main.innerHTML = `
    <div class="hostel-detail-wrap">

      <!-- Image Gallery -->
      <div class="hostel-gallery">
        <div class="gallery-main">
          <img id="gallery-main-img" src="${HH.escapeHtml(primaryImg)}" alt="${HH.escapeHtml(h.name)}"
            onerror="this.src='/images/default-hostel.jpg'">
        </div>
        ${images.length > 1 ? `
        <div class="gallery-thumbs">
          ${images.map((img, i) => `
            <div class="gallery-thumb ${i === 0 ? 'active' : ''}" onclick="setGalleryImage('${HH.escapeHtml(img.image_path)}', this)">
              <img src="${HH.escapeHtml(img.image_path)}" alt="Image ${i+1}" onerror="this.src='/images/default-hostel.jpg'">
            </div>`).join('')}
        </div>` : ''}
      </div>

      <!-- Detail Body -->
      <div class="hostel-detail-body page-wrap">
        <div class="hostel-detail-grid">

          <!-- Left: Info -->
          <div class="hostel-detail-left">
            <div class="hostel-detail-header">
              <div>
                <h1 class="hostel-detail-name">${HH.escapeHtml(h.name)}</h1>
                <p class="hostel-detail-address">📍 ${HH.escapeHtml(h.address || '')}</p>
                ${h.nearest_institution ? `<p class="hostel-detail-campus">🎓 ${HH.escapeHtml(h.nearest_institution)} · ${h.distance_to_campus || '?'} km away</p>` : ''}
              </div>
              <div class="hostel-detail-rating">
                <span class="rating-star">⭐</span>
                <span class="rating-score">${Number(h.average_rating || 0).toFixed(1)}</span>
                <span class="rating-count">(${h.total_reviews || 0} reviews)</span>
              </div>
            </div>

            <!-- Key Info Chips -->
            <div class="info-chips">
              <span class="info-chip">🛏 ${h.room_type}</span>
              <span class="info-chip">👥 ${(h.gender_policy || '').replace('_',' ')}</span>
              <span class="badge ${roomsClass}">${h.available_rooms > 0 ? h.available_rooms + ' rooms available' : 'Fully booked'}</span>
              ${h.wifi           ? '<span class="info-chip">📶 WiFi</span>' : ''}
              ${h.meals_provided ? '<span class="info-chip">🍽️ Meals included</span>' : ''}
              ${h.study_friendly ? '<span class="info-chip">📚 Study-friendly</span>' : ''}
              ${h.security       ? '<span class="info-chip">🔒 24h Security</span>' : ''}
              ${h.backup_power   ? '<span class="info-chip">⚡ Generator</span>' : ''}
              ${h.allows_roommates ? '<span class="info-chip">🤝 Roommates OK</span>' : ''}
              ${h.curfew_time    ? `<span class="info-chip">🕐 Curfew: ${h.curfew_time}</span>` : ''}
              ${h.wifi_speed     ? `<span class="info-chip">📶 WiFi: ${HH.escapeHtml(h.wifi_speed)}</span>` : ''}
            </div>

            <!-- Description -->
            ${h.description ? `
            <div class="detail-section">
              <h3>About This Hostel</h3>
              <p class="hostel-description">${HH.escapeHtml(h.description)}</p>
            </div>` : ''}

            <!-- Nearby Amenities -->
            ${h.amenities?.length ? `
            <div class="detail-section">
              <h3>Nearby Amenities</h3>
              <div class="amenities-list">
                ${h.amenities.map(a => `
                  <div class="amenity-row">
                    <span>${amenityIcons[a.category] || '📍'} ${HH.escapeHtml(a.name)}</span>
                    <span class="amenity-dist">${a.distance_m ? `${a.distance_m}m` : 'Nearby'}</span>
                  </div>`).join('')}
              </div>
            </div>` : ''}

            <!-- Map -->
            ${h.latitude && h.longitude ? `
            <div class="detail-section">
              <h3>📍 Location</h3>
              <div id="hostel-map" class="hostel-map-embed"></div>
              <a class="map-link" href="https://www.google.com/maps?q=${h.latitude},${h.longitude}" target="_blank">
                Open in Google Maps ↗
              </a>
            </div>` : ''}

            <!-- Reviews -->
            <div class="detail-section" id="reviews-section">
              <h3>⭐ Reviews (${h.total_reviews || 0})</h3>
              <div id="reviews-list">
                ${h.reviews?.length
                  ? h.reviews.map(r => `
                    <div class="review-card">
                      <div class="review-header">
                        <img src="${HH.escapeHtml(r.profile_photo || '/images/default-avatar.png')}" alt="" onerror="this.src='/images/default-avatar.png'" class="review-avatar">
                        <div>
                          <strong>${HH.escapeHtml(r.student_name)}</strong>
                          <div class="review-stars">${'⭐'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</div>
                        </div>
                        <span class="review-date">${HH.formatDate(r.created_at)}</span>
                      </div>
                      ${r.comment ? `<p class="review-comment">${HH.escapeHtml(r.comment)}</p>` : ''}
                    </div>`).join('')
                  : '<p class="text-muted">No reviews yet. Be the first!</p>'}
              </div>

              ${HH.isStudent() ? `
              <div class="write-review" id="review-form-wrap">
                <h4>Write a Review</h4>
                <div class="star-rating-input" id="star-input">
                  ${[1,2,3,4,5].map(s => `<span class="star-btn" data-val="${s}" onclick="selectStar(${s})">☆</span>`).join('')}
                </div>
                <textarea id="review-comment" placeholder="Share your experience (optional)..." rows="3"></textarea>
                <button class="btn btn-primary btn-sm" onclick="submitReview(${h.id})">Submit Review</button>
              </div>` : ''}
            </div>
          </div>

          <!-- Right: Booking Sidebar -->
          <div class="hostel-booking-sidebar">
            <div class="booking-box">
              <div class="booking-box-price">
                <span class="price-main">${HH.formatCurrency(h.monthly_price)}</span>
                <span class="price-period">/month</span>
              </div>
              <div class="booking-box-deposit">
                Deposit: <strong>${HH.formatCurrency(h.deposit_amount)}</strong>
                <span class="hint"> (10% platform fee included)</span>
              </div>

              <hr class="divider">

              <div class="owner-info">
                <h4>Hostel Owner</h4>
                <p><strong>${HH.escapeHtml(h.owner_name)}</strong></p>
                <p><a href="tel:${HH.escapeHtml(h.owner_phone)}">${HH.escapeHtml(h.owner_phone)}</a></p>
              </div>

              <div class="contact-buttons">
                <a href="https://wa.me/${(h.owner_phone||'').replace(/\+/,'').replace(/\s/g,'')}?text=${encodeURIComponent('Hello, I am interested in your hostel: ' + h.name)}"
                  target="_blank" class="btn btn-success btn-full">
                  📱 WhatsApp Owner
                </a>
                <button class="btn btn-outline btn-full" onclick="messageOwner(${h.id}, ${h.owner_id || 0}, '${HH.escapeHtml(h.owner_name)}')">
                  💬 In-App Message
                </button>
              </div>

              <hr class="divider">

              ${h.available_rooms > 0 ? `
              <div class="book-form">
                <div class="form-group">
                  <label>Check-in Date</label>
                  <input type="date" id="checkin-date" min="${new Date().toISOString().split('T')[0]}">
                </div>
                <div class="form-group">
                  <label>M-Pesa Phone</label>
                  <input type="tel" id="book-phone" placeholder="0712 345 678" value="${HH.getUser()?.phone || ''}">
                </div>
                <div class="form-group">
                  <label>Notes (optional)</label>
                  <textarea id="book-notes" rows="2" placeholder="Anything the owner should know..."></textarea>
                </div>
                <div id="book-error" class="form-error hidden"></div>
                <button class="btn btn-primary btn-full" id="book-btn" onclick="bookHostel(${h.id}, ${h.deposit_amount})">
                  🏠 Book Now — ${HH.formatCurrency(h.deposit_amount)}
                </button>
                <p class="booking-note">✅ 3-day free cancellation · M-Pesa deposit · Refundable</p>
              </div>` : `
              <div class="fully-booked">
                <p>😔 This hostel is currently fully booked.</p>
                <button class="btn btn-outline btn-full" onclick="saveHostel(${h.id})">
                  ❤️ Save & Get Notified
                </button>
              </div>`}

              <button class="btn btn-outline btn-full save-detail-btn" onclick="saveHostel(${h.id})" style="margin-top:8px">
                ${h.isSaved ? '❤️ Saved' : '🤍 Save Hostel'}
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>`;

  // Init map if coords exist
  if (h.latitude && h.longitude) {
    initHostelMap(h.latitude, h.longitude, h.name, h.address);
  }

  attachPhoneFormatter('book-phone');
}

function setGalleryImage(src, thumbEl) {
  const mainImg = document.getElementById('gallery-main-img');
  if (mainImg) mainImg.src = src;
  document.querySelectorAll('.gallery-thumb').forEach(t => t.classList.remove('active'));
  thumbEl.classList.add('active');
}

function initHostelMap(lat, lng, name, address) {
  const el = document.getElementById('hostel-map');
  if (!el) return;

  // Use a static map embed if Google Maps JS isn't available
  el.innerHTML = `
    <iframe
      src="https://maps.google.com/maps?q=${lat},${lng}&z=16&output=embed"
      width="100%" height="300" frameborder="0" style="border:0;border-radius:8px"
      allowfullscreen loading="lazy">
    </iframe>`;
}

let selectedStarRating = 0;

function selectStar(val) {
  selectedStarRating = val;
  document.querySelectorAll('.star-btn').forEach((star, i) => {
    star.textContent = i < val ? '⭐' : '☆';
  });
}

async function submitReview(hostelId) {
  if (!HH.isLoggedIn()) { showLoginModal(); return; }
  if (!selectedStarRating) { showToast('Please select a star rating', 'warning'); return; }

  const comment = document.getElementById('review-comment')?.value.trim();
  try {
    await HH.api(`/hostels/${hostelId}/reviews`, {
      method: 'POST',
      body: { rating: selectedStarRating, comment },
    });
    showToast('Review submitted! Thank you.', 'success');
    document.getElementById('review-form-wrap')?.remove();
    // Reload reviews section
    const updatedHostel = await HH.api(`/hostels/${hostelId}`);
    const reviewsList = document.getElementById('reviews-list');
    if (reviewsList && updatedHostel.reviews) {
      reviewsList.innerHTML = updatedHostel.reviews.map(r => `
        <div class="review-card">
          <div class="review-header">
            <img src="${HH.escapeHtml(r.profile_photo || '/images/default-avatar.png')}" class="review-avatar" onerror="this.src='/images/default-avatar.png'">
            <div>
              <strong>${HH.escapeHtml(r.student_name)}</strong>
              <div class="review-stars">${'⭐'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</div>
            </div>
            <span class="review-date">${HH.formatDate(r.created_at)}</span>
          </div>
          ${r.comment ? `<p class="review-comment">${HH.escapeHtml(r.comment)}</p>` : ''}
        </div>`).join('');
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function bookHostel(hostelId, depositAmount) {
  if (!HH.isLoggedIn()) { showLoginModal(); return; }
  if (!HH.isStudent()) { showToast('Only students can book hostels', 'warning'); return; }

  const phone    = document.getElementById('book-phone')?.value.trim();
  const date     = document.getElementById('checkin-date')?.value;
  const notes    = document.getElementById('book-notes')?.value.trim();
  const errEl    = document.getElementById('book-error');
  const btn      = document.getElementById('book-btn');

  if (!phone) {
    showFormError(errEl, 'Please enter your M-Pesa phone number');
    return;
  }
  if (!HH.validateKenyanPhone(phone)) {
    showFormError(errEl, 'Enter a valid Kenyan phone number (e.g. 0712345678)');
    return;
  }

  setButtonLoading(btn, true);
  errEl.classList.add('hidden');

  try {
    const booking = await HH.api('/booking/book', {
      method: 'POST',
      body: { hostel_id: hostelId, mpesa_phone: phone, check_in_date: date || null, notes: notes || null },
    });

    showModal('Booking Created! 🎉', `
      <div class="payment-modal">
        <div class="payment-summary">
          <p>Booking created successfully! Now pay the deposit via M-Pesa to confirm your room.</p>
          <div class="payment-detail-row">
            <span>Deposit Amount</span>
            <strong>${HH.formatCurrency(depositAmount)}</strong>
          </div>
          <div class="payment-detail-row note">
            <span>Admin Commission (10%)</span>
            <strong>${HH.formatCurrency(depositAmount * 0.10)}</strong>
          </div>
          <div class="payment-detail-row">
            <span>M-Pesa Phone</span>
            <strong>${HH.escapeHtml(phone)}</strong>
          </div>
        </div>
        <div id="pay2-error" class="form-error hidden"></div>
        <button class="btn btn-primary btn-full" id="pay2-btn" onclick="initiatePaymentFromDetail(${booking.bookingId}, '${phone}')">
          📱 Pay KES ${Number(depositAmount).toLocaleString()} via M-Pesa
        </button>
        ${window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? `
        <button class="btn btn-outline btn-full" style="margin-top:8px" onclick="simulateFromDetail(${booking.bookingId})">
          🧪 Simulate Payment (Dev Only)
        </button>` : ''}
        <button class="btn btn-sm btn-outline btn-full" style="margin-top:8px" onclick="closeModal();navigate('dashboard')">
          Pay Later (Go to Dashboard)
        </button>
        <p class="booking-note">3-day free cancellation with full M-Pesa refund.</p>
      </div>`, '', 'sm');

  } catch (err) {
    showFormError(errEl, err.message);
  } finally {
    setButtonLoading(btn, false, `🏠 Book Now — ${HH.formatCurrency(depositAmount)}`);
  }
}

async function initiatePaymentFromDetail(bookingId, phone) {
  const errEl = document.getElementById('pay2-error');
  const btn   = document.getElementById('pay2-btn');
  setButtonLoading(btn, true);
  try {
    const data = await HH.api('/mpesa/pay', { method: 'POST', body: { booking_id: bookingId, phone } });
    closeModal();
    showToast('✅ ' + data.message, 'success', 7000);
    navigate('dashboard');
  } catch (err) {
    if (errEl) { errEl.textContent = err.message; errEl.classList.remove('hidden'); }
  } finally {
    setButtonLoading(btn, false, '📱 Pay via M-Pesa');
  }
}

async function simulateFromDetail(bookingId) {
  try {
    const data = await HH.api('/mpesa/simulate', { method: 'POST', body: { booking_id: bookingId } });
    closeModal();
    showToast(data.message, 'success');
    navigate('dashboard');
  } catch (err) { showToast(err.message, 'error'); }
}

async function messageOwner(hostelId, ownerId, ownerName) {
  if (!HH.isLoggedIn()) { showLoginModal(); return; }
  try {
    const data = await HH.api('/chat/start', {
      method: 'POST',
      body: { other_user_id: ownerId, hostel_id: hostelId },
    });
    navigate(`chat/${data.conversationId}`);
  } catch (err) { showToast(err.message, 'error'); }
}

async function saveHostel(hostelId) {
  if (!HH.isLoggedIn()) { showLoginModal(); return; }
  if (!HH.isStudent()) { showToast('Only students can save hostels', 'warning'); return; }
  try {
    const data = await HH.api(`/students/saved/${hostelId}`, { method: 'POST' });
    const btn  = document.querySelector('.save-detail-btn');
    if (btn) btn.textContent = data.saved ? '❤️ Saved' : '🤍 Save Hostel';
    showToast(data.message, 'success', 2000);
  } catch (err) { showToast(err.message, 'error'); }
}

function showFormError(el, msg) {
  if (!el) return;
  el.textContent = msg;
  el.classList.remove('hidden');
}

window.setGalleryImage  = setGalleryImage;
window.selectStar       = selectStar;
window.submitReview     = submitReview;
window.bookHostel       = bookHostel;
window.initiatePaymentFromDetail = initiatePaymentFromDetail;
window.simulateFromDetail        = simulateFromDetail;
window.messageOwner     = messageOwner;
window.saveHostel       = saveHostel;
