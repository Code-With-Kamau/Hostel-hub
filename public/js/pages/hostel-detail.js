//hostel-detail.js ──
const HostelDetail = {
  hostel: null, imgIdx: 0, selRating: 0,

  async render(id) {
    document.getElementById('app-content').innerHTML = `<div style="padding:90px 24px;text-align:center"><div class="loader-spinner" style="margin:0 auto"></div></div>`;
    try {
      const res = await API.getHostel(id);
      if (!res.success) throw new Error(res.message);
      this.hostel = res.data; this.renderPage();
    } catch(e) {
      document.getElementById('app-content').innerHTML = `<div class="empty-state" style="padding-top:120px"><div class="icon">⚠️</div><h3>${e.message}</h3><button class="btn btn-blue" onclick="navigate('home')">Go Home</button></div>`;
    }
  },

  renderPage() {
    const h = this.hostel;
    const imgs = h.images?.length ? h.images : [{ image_url: CONFIG.DEFAULT_HOSTEL }];
    document.getElementById('app-content').innerHTML = `
      <div style="background:white;border-bottom:1px solid var(--gray-200);padding:11px 24px">
        <div style="max-width:1100px;margin:0 auto;display:flex;gap:7px;align-items:center;font-size:.82rem;color:var(--gray-400)">
          <a onclick="navigate('home')" style="color:var(--blue-600);cursor:pointer">Home</a>
          <i class="fas fa-chevron-right" style="font-size:.65rem"></i>
          <span style="color:var(--gray-700)">${h.title}</span>
        </div>
      </div>
      <div class="hostel-detail">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px;margin-bottom:20px">
          <div>
            <h1 style="font-size:1.85rem;margin-bottom:8px">${h.title}</h1>
            <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;font-size:.85rem;color:var(--gray-500)">
              <span><i class="fas fa-map-marker-alt" style="color:var(--blue-500)"></i> ${h.location}</span>
              <span class="badge badge-blue">${roomTypeName(h.room_type)}</span>
              ${genderBadge(h.gender_policy)}
              ${statusBadge(h.status)}
              ${h.is_featured?'<span class="badge badge-amber">⭐ Featured</span>':''}
              <span><i class="fas fa-eye" style="color:var(--gray-300)"></i> ${h.views_count} views</span>
            </div>
          </div>
          <div style="text-align:right">
            <div class="booking-price">${formatKES(h.price_per_month)}<span>/month</span></div>
            <div style="font-size:.78rem;color:var(--gray-400);margin-top:3px">Deposit: ${formatKES(h.deposit_amount||h.price_per_month)}</div>
          </div>
        </div>

        <div class="detail-layout">
          <!-- LEFT -->
          <div>
            <!-- Gallery -->
            <div style="margin-bottom:18px">
              <div class="gallery-main" style="position:relative">
                <img id="main-img" src="${imgs[0].image_url}" alt="${h.title}" onerror="this.src='${CONFIG.DEFAULT_HOSTEL}'" style="width:100%;height:400px;object-fit:cover;border-radius:var(--radius-xl)" />
                ${imgs.length>1?`<button onclick="HostelDetail.prevImg()" style="position:absolute;left:10px;top:50%;transform:translateY(-50%);width:34px;height:34px;background:rgba(0,0,0,.5);color:white;border-radius:50%;display:flex;align-items:center;justify-content:center"><i class="fas fa-chevron-left"></i></button>
                <button onclick="HostelDetail.nextImg()" style="position:absolute;right:10px;top:50%;transform:translateY(-50%);width:34px;height:34px;background:rgba(0,0,0,.5);color:white;border-radius:50%;display:flex;align-items:center;justify-content:center"><i class="fas fa-chevron-right"></i></button>`:''}
              </div>
              ${imgs.length>1?`<div class="gallery-thumbs">${imgs.map((im,i)=>`<div class="gallery-thumb${i===0?' active':''}" id="th-${i}" onclick="HostelDetail.setImg(${i})"><img src="${im.image_url}" onerror="this.src='${CONFIG.DEFAULT_HOSTEL}'" /></div>`).join('')}</div>`:''}
            </div>

            <!-- Campus -->
            ${h.nearest_institution?`<div class="card" style="margin-bottom:16px;background:var(--blue-50);border:1px solid var(--blue-200)">
              <div style="display:flex;align-items:center;gap:12px">
                <div style="font-size:2rem">🎓</div>
                <div>
                  <div style="font-weight:700;color:var(--blue-800)">${h.nearest_institution}</div>
                  <div style="font-size:.85rem;color:var(--blue-600)">${h.distance_to_campus?`${h.distance_to_campus}km from campus gate`:'Close to campus'}</div>
                </div>
                <button class="btn btn-sm btn-outline" style="margin-left:auto" onclick="MapModule.getDirections(${h.latitude},${h.longitude})"><i class="fas fa-directions"></i> Directions</button>
              </div>
            </div>`:''}

            <!-- Description -->
            <div class="card" style="margin-bottom:16px">
              <div class="card-title">📋 About This Hostel</div>
              <p style="color:var(--gray-600);line-height:1.8;font-size:.9rem">${h.description||'No description provided.'}</p>
            </div>

            <!-- Room Details -->
            <div class="card" style="margin-bottom:16px">
              <div class="card-title">🏠 Room Details</div>
              <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-bottom:14px">
                ${[['fas fa-door-open',`${h.total_rooms} Total Rooms`],['fas fa-check-circle',`${h.available_rooms} Available`],
                   ['fas fa-users',h.allows_roommates?`Roommates OK (max ${h.max_roommates})`:'No Roommates'],
                   ['fas fa-tint',`Water: ${h.water_supply||'Piped'}`],['fas fa-bolt','Electricity: '+(h.electricity?'Yes':'No')],
                   ['fas fa-sun',h.backup_power?'Backup Power ✅':'No Backup Power'],
                ].map(([icon,label])=>`<div style="display:flex;align-items:center;gap:8px;padding:10px;background:var(--gray-50);border-radius:8px;font-size:.83rem"><i class="${icon}" style="color:var(--blue-400);width:16px"></i>${label}</div>`).join('')}
              </div>
              <div class="amenities-grid">
                ${[['fas fa-wifi','WiFi'+(h.wifi_speed?` (${h.wifi_speed})`:''),(!!h.wifi)],
                   ['fas fa-utensils',h.meals_provided?h.meals_description||'Meals Provided':'No Meals',(!!h.meals_provided)],
                   ['fas fa-shield-alt','Security',(!!h.security)],['fas fa-video','CCTV',(!!h.cctv)],
                   ['fas fa-user-tie','Caretaker',(!!h.caretaker)],['fas fa-car','Parking',(!!h.parking)],
                   ['fas fa-tshirt','Laundry',(!!h.laundry)],['fas fa-tv','Common Room',(!!h.common_room)],
                   ['fas fa-blender','Kitchen Access',(!!h.kitchen_access)],['fas fa-snowflake','Fridge Access',(!!h.fridge_access)],
                   ['fas fa-broom','Cleaning Service',(!!h.cleaning_service)],['fas fa-book-open','Study Friendly',(!!h.study_friendly)],
                ].map(([icon,label,has])=>`<div class="amenity-item ${has?'yes':'no'}"><i class="${icon}"></i><span>${label}</span></div>`).join('')}
              </div>
            </div>

            <!-- Rules -->
            <div class="card" style="margin-bottom:16px">
              <div class="card-title">📜 House Rules</div>
              <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px">
                ${h.no_alcohol?'<span class="badge badge-red">🚫 No Alcohol</span>':''}
                ${h.no_smoking?'<span class="badge badge-red">🚭 No Smoking</span>':''}
                ${h.visitors_allowed?'<span class="badge badge-green">✅ Visitors Allowed</span>':'<span class="badge badge-amber">⚠️ No Visitors</span>'}
                ${h.curfew_time?`<span class="badge badge-amber">⏰ Curfew: ${h.curfew_time}</span>`:''}
              </div>
              ${h.rules?`<p style="font-size:.85rem;color:var(--gray-600);line-height:1.7">${h.rules}</p>`:'<p style="font-size:.85rem;color:var(--gray-400)">No additional rules specified.</p>'}
            </div>

            <!-- Nearby Amenities -->
            ${h.amenities?.length?`<div class="card" style="margin-bottom:16px">
              <div class="card-title">🗺️ Nearby Amenities</div>
              <div class="nearby-grid">
                ${h.amenities.map(a=>`<div class="nearby-item">
                  <div class="icon">${amenityIcon(a.category)}</div>
                  <div class="name" title="${a.name}">${a.name}</div>
                  <div class="dist">${a.distance_m<1000?a.distance_m+'m':(a.distance_m/1000).toFixed(1)+'km'} away</div>
                </div>`).join('')}
              </div>
            </div>`:''}

            <!-- Map -->
            <div class="card" style="margin-bottom:16px">
              <div class="card-title">📍 Location</div>
              <div id="detail-map" style="height:280px;border-radius:10px;overflow:hidden;background:var(--gray-100)"></div>
              <button class="btn btn-outline" style="width:100%;margin-top:10px;justify-content:center" onclick="MapModule.getDirections(${h.latitude},${h.longitude})"><i class="fas fa-directions"></i> Get Directions</button>
            </div>

            <!-- Reviews -->
            <div class="card">
              <div class="card-title" style="display:flex;justify-content:space-between">
                <span>⭐ Reviews (${h.review_count||0})</span>
                <span style="font-size:1.4rem;font-weight:800;color:var(--amber)">${h.avg_rating?parseFloat(h.avg_rating).toFixed(1):'—'}</span>
              </div>
              ${h.reviews?.length?h.reviews.map(r=>`<div style="padding:12px 0;border-bottom:1px solid var(--gray-100)">
                <div style="display:flex;gap:9px;align-items:center;margin-bottom:5px">
                  <img src="${r.student_photo||CONFIG.DEFAULT_AVATAR}" style="width:34px;height:34px;border-radius:50%;object-fit:cover" />
                  <div><div style="font-weight:600;font-size:.875rem">${r.student_name}</div>
                  <div style="font-size:.74rem;color:var(--blue-500)">${r.institution||''} ${r.course?'• '+r.course:''}</div></div>
                  <div style="margin-left:auto;font-size:.78rem;color:var(--amber)">${'★'.repeat(r.rating)}${'☆'.repeat(5-r.rating)}</div>
                </div>
                <p style="font-size:.84rem;color:var(--gray-600)">${r.review_text||''}</p>
              </div>`).join(''):`<p style="text-align:center;color:var(--gray-400);padding:20px">No reviews yet — be the first!</p>`}
              ${AUTH.isStudent()?`<div style="margin-top:14px;padding-top:14px;border-top:1px solid var(--gray-100)">
                <div style="display:flex;gap:5px;margin-bottom:8px" id="star-row">
                  ${[1,2,3,4,5].map(n=>`<span style="font-size:1.7rem;cursor:pointer;color:var(--gray-300)" onclick="HostelDetail.setRating(${n})" data-s="${n}">★</span>`).join('')}
                </div>
                <textarea class="form-control" id="rev-text" placeholder="Share your experience…" rows="3"></textarea>
                <button class="btn btn-sm btn-blue" style="margin-top:7px" onclick="HostelDetail.submitReview(${h.id})">Submit Review</button>
              </div>`:''}
            </div>
          </div>

          <!-- RIGHT: BOOKING CARD -->
          <div>
            <div class="booking-card">
              <div class="booking-price">${formatKES(h.price_per_month)}<span>/month</span></div>
              <div style="display:flex;gap:12px;font-size:.82rem;color:var(--gray-500);margin:10px 0">
                <span><i class="fas fa-door-open" style="color:var(--blue-400)"></i> ${h.available_rooms} room${h.available_rooms!==1?'s':''} left</span>
                <span><i class="fas fa-shield-alt" style="color:var(--blue-400)"></i> Verified</span>
              </div>
              <div class="divider"></div>
              <div style="display:flex;justify-content:space-between;font-size:.875rem;margin-bottom:7px"><span>Monthly Rent</span><strong>${formatKES(h.price_per_month)}</strong></div>
              <div style="display:flex;justify-content:space-between;font-size:.875rem;margin-bottom:7px"><span>Deposit</span><strong>${formatKES(h.deposit_amount||h.price_per_month)}</strong></div>
              <div class="divider"></div>
              <div style="display:flex;justify-content:space-between;font-weight:700;font-size:.95rem"><span>Due on Arrival</span><span style="color:var(--blue-700)">${formatKES((h.deposit_amount||h.price_per_month))}</span></div>

              ${h.status==='available'&&h.available_rooms>0?`
                <button class="btn-book" onclick="HostelDetail.book(${h.id})">
                  ${AUTH.isLoggedIn()&&AUTH.isStudent()?'📅 Book This Room':'🔐 Login to Book'}
                </button>`:`<button class="btn-book" disabled>❌ No Vacancies</button>`}
              <button class="btn-contact" onclick="HostelDetail.contactOwner()"><i class="fas fa-comments"></i> Chat with Owner</button>
              ${AUTH.isLoggedIn()?`<button class="btn-contact" style="margin-top:7px;color:${h.is_saved?'var(--red)':'var(--gray-600)'}" onclick="HostelDetail.toggleSave()">
                <i class="fas fa-heart"></i> ${h.is_saved?'Saved':'Save Hostel'}
              </button>`:''}

              <!-- Share -->
              <div class="divider"></div>
              <div style="display:flex;gap:8px">
                <button class="btn btn-sm btn-outline" style="flex:1" onclick="navigator.clipboard.writeText(window.location.href);showToast('Link copied!','success')"><i class="fas fa-link"></i> Copy</button>
                <a href="https://wa.me/?text=${encodeURIComponent(h.title+' - '+formatKES(h.price_per_month)+'/mo. '+window.location.href)}" target="_blank" class="btn btn-sm" style="background:#25D366;color:white;flex:1;justify-content:center"><i class="fab fa-whatsapp"></i> Share</a>
              </div>
            </div>

            <!-- Owner Card -->
            <div class="card" style="margin-top:14px">
              <div class="card-title">👤 Hostel Owner</div>
              <div style="display:flex;align-items:center;gap:12px">
                <img src="${h.owner_photo||CONFIG.DEFAULT_AVATAR}" style="width:48px;height:48px;border-radius:50%;object-fit:cover;border:3px solid var(--blue-100)" />
                <div>
                  <div style="font-weight:700">${h.owner_name}</div>
                  ${AUTH.isLoggedIn()?`<div style="font-size:.8rem;color:var(--gray-500)"><i class="fas fa-phone"></i> ${h.owner_phone||'N/A'}</div>
                  <div style="font-size:.8rem;color:var(--gray-500)"><i class="fas fa-envelope"></i> ${h.owner_email||'N/A'}</div>`:`<div style="font-size:.8rem;color:var(--gray-400)">Login to view contact</div>`}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>`;

    this.loadDetailMap();
  },

  setImg(i) {
    this.imgIdx = i;
    const imgs = this.hostel.images?.length ? this.hostel.images : [{ image_url: CONFIG.DEFAULT_HOSTEL }];
    document.getElementById('main-img').src = imgs[i].image_url;
    document.querySelectorAll('.gallery-thumb').forEach((t,j) => t.classList.toggle('active', j===i));
  },
  prevImg() { const n = this.hostel.images?.length||1; this.setImg((this.imgIdx-1+n)%n); },
  nextImg() { const n = this.hostel.images?.length||1; this.setImg((this.imgIdx+1)%n); },

  loadDetailMap() {
    const h = this.hostel;
    if (!h.latitude) return;
    const tryInit = () => {
      const m = MapModule.initMap('detail-map', { lat: parseFloat(h.latitude), lng: parseFloat(h.longitude) }, 15);
      if (!m) return;
      MapModule.addHostelMarker(h);
      if (MapModule.userLat) MapModule.addUserMarker(MapModule.userLat, MapModule.userLng);
    };
    if (MapModule.mapLoaded) tryInit();
    else { MapModule.loadGoogleMaps(); document.addEventListener('maps-ready', tryInit, { once:true }); }
  },

  book(hostelId) {
    if (!AUTH.isLoggedIn()) { navigate('login'); return; }
    if (!AUTH.isStudent()) { showToast('Only students can book', 'error'); return; }
    const h = this.hostel;
    openModal(`
      <div class="modal-title">📅 Book a Room</div>
      <div style="background:var(--blue-50);border-radius:10px;padding:14px;margin-bottom:18px;border-left:4px solid var(--blue-500)">
        <h3 style="font-size:.95rem;margin-bottom:3px">${h.title}</h3>
        <p style="font-size:.82rem;color:var(--gray-500)">${h.location} ${h.nearest_institution?'• near '+h.nearest_institution:''}</p>
        <div style="margin-top:7px;font-size:.875rem"><strong>${formatKES(h.price_per_month)}/month</strong> • Deposit: <strong>${formatKES(h.deposit_amount||h.price_per_month)}</strong></div>
      </div>
      <div class="form-group">
        <label class="form-label">Preferred Move-in Date</label>
        <input type="date" class="form-control" id="move-in" min="${new Date().toISOString().split('T')[0]}" />
      </div>
      <div class="form-group">
        <label class="form-label">Duration (months)</label>
        <select class="form-control" id="duration">
          <option value="3">3 months</option><option value="6">6 months</option>
          <option value="12" selected>12 months (1 year)</option>
        </select>
      </div>
      ${h.allows_roommates?`<div class="form-group">
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:.875rem">
          <input type="checkbox" id="want-roommate" /> I'm looking for a roommate to share this room
        </label>
        <select class="form-control" id="roommate-gender" style="margin-top:8px">
          <option value="any">Any Gender Roommate</option>
          <option value="male">Male Roommate</option>
          <option value="female">Female Roommate</option>
        </select>
      </div>`:''}
      <div class="form-group">
        <label class="form-label">Message to Owner (optional)</label>
        <textarea class="form-control" id="book-notes" placeholder="Any questions or special requests?" rows="2"></textarea>
      </div>
      <button class="btn btn-blue btn-block btn-lg" id="confirm-book-btn" onclick="HostelDetail.confirmBook(${hostelId})">
        <i class="fas fa-calendar-check"></i> Confirm Booking
      </button>`);
  },

  async confirmBook(hostelId) {
    const btn = document.getElementById('confirm-book-btn');
    btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing…';
    
    try {
      const wantsRoommate = document.getElementById('want-roommate')?.checked || false;
      
      const payload = {
        hostel_id: hostelId,
        move_in_date: document.getElementById('move-in').value,
        duration_months: document.getElementById('duration').value,
        notes: document.getElementById('book-notes').value,
        wants_roommate: wantsRoommate,
        roommate_gender: document.getElementById('roommate-gender')?.value || 'any',
      };
      
      console.log('1. Sending booking payload:', payload); // DEBUG
      
      const res = await API.book(payload);
      
      console.log('2. Booking API response:', res); // DEBUG
      
      if (!res.success) throw new Error(res.message);
      
      console.log('3. Booking object:', res.booking); // DEBUG
      console.log('4. Booking ID:', res.booking?.id); // DEBUG
      
      closeModal({});
      showToast('✅ Booking created! Pay deposit to confirm.', 'success');
      setTimeout(() => this.showPayModal(res.booking), 600);
      
    } catch(e) {
      console.log('ERROR in confirmBook:', e.message); // DEBUG
      showToast(e.message, 'error');
      btn.disabled = false; 
      btn.innerHTML = '<i class="fas fa-calendar-check"></i> Confirm Booking';
    }
  },
  showPayModal(booking) {
    console.log('Booking object received:', booking);
    openModal(`
      <div style="text-align:center">
        <div style="font-size:3rem;margin-bottom:6px">📱</div>
        <h2 class="modal-title" style="text-align:center">Pay via M-Pesa</h2>
        <div style="font-family:var(--font-display);font-size:2.2rem;font-weight:800;color:var(--blue-700);margin:10px 0">${formatKES(booking.deposit_amount)}</div>
        <p style="font-size:.82rem;color:var(--gray-400);margin-bottom:18px">Refundable deposit to confirm your room</p>
        <div class="form-group">
          <label class="form-label">Your M-Pesa Number</label>
          <input type="tel" class="form-control" id="mpesa-phone" placeholder="07XX XXX XXX" value="${AUTH.user.phone||''}" style="font-size:1.1rem;text-align:center;letter-spacing:2px" />
        </div>
        <div style="background:var(--gray-50);border-radius:10px;padding:14px;text-align:left;margin-bottom:16px;font-size:.82rem">
          <strong>How it works:</strong><br/>
          1️⃣ Enter your Safaricom number above<br/>
          2️⃣ Click Pay — you'll get an STK push<br/>
          3️⃣ Enter your M-Pesa PIN<br/>
          4️⃣ Room is automatically reserved! ✅
        </div>
        <button class="btn btn-blue btn-block btn-lg" id="pay-btn" onclick="HostelDetail.processPay(${booking.id},${booking.deposit_amount})">
          <i class="fas fa-mobile-alt"></i> Pay ${formatKES(booking.deposit_amount)}
        </button>
        <button class="btn btn-outline btn-block" style="margin-top:8px" onclick="HostelDetail.simulatePay(${booking.id})">
          🧪 Simulate Payment (Dev Mode)
        </button>
      </div>`);
  },

async processPay(bookingId, amount) {
  console.log('=== processPay called ===');
  console.log('bookingId:', bookingId);
  console.log('amount:', amount);
  console.log('type of bookingId:', typeof bookingId);

  const phone = document.getElementById('mpesa-phone').value;
  console.log('phone:', phone);

  if (!phone) { showToast('Enter your M-Pesa number', 'error'); return; }

  const btn = document.getElementById('pay-btn');
  btn.disabled = true; 
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending…';

  try {
    const payload = { booking_id: bookingId, phone };
    console.log('Sending payload to /api/mpesa/pay:', payload);

    const res = await API.pay(payload);
    console.log('Response from /api/mpesa/pay:', res);

    if (!res.success) throw new Error(res.message);
    closeModal({}); 
    showToast('📱 Check your phone for M-Pesa PIN prompt!', 'success', 6000);
  } catch(e) { 
    console.log('processPay error:', e.message);
    showToast(e.message, 'error'); 
    btn.disabled = false; 
    btn.innerHTML = `<i class="fas fa-mobile-alt"></i> Pay ${formatKES(amount)}`; 
  }
},
  async simulatePay(bookingId) {
    const phone = document.getElementById('mpesa-phone')?.value || AUTH.user.phone || '0700000000';
    const res = await API.simulatePay({ booking_id: bookingId, phone });
    if (res.success) { closeModal({}); showToast('✅ ' + res.message + ` Receipt: ${res.receipt}`, 'success', 5000); setTimeout(() => navigate('dashboard'), 2200); }
    else showToast(res.message, 'error');
  },

  contactOwner() {
    if (!AUTH.isLoggedIn()) { navigate('login'); return; }
    if (this.hostel?.owner_id) ChatModule.openChat(this.hostel.owner_id, this.hostel.owner_name, this.hostel.id);
  },

  async toggleSave() {
    const res = await API.toggleSave(this.hostel.id);
    if (res.success) { this.hostel.is_saved = res.saved; showToast(res.message, 'success'); this.renderPage(); }
  },

  setRating(n) {
    this.selRating = n;
    document.querySelectorAll('#star-row span').forEach((s,i) => s.style.color = i<n?'var(--amber)':'var(--gray-300)');
  },

  async submitReview(hostelId) {
    if (!this.selRating) { showToast('Please select a star rating', 'error'); return; }
    const res = await API.addReview(hostelId, { rating: this.selRating, review_text: document.getElementById('rev-text').value });
    if (res.success) { showToast('✅ Review submitted!', 'success'); HostelDetail.render(hostelId); }
    else showToast(res.message, 'error');
  },
};
