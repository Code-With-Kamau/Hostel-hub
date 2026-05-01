// ── pages/owner.js ──
const OwnerPage = {
  render() {
    document.getElementById('app-content').innerHTML = `
      <div class="dashboard-layout">
        <aside class="dashboard-sidebar">
          <div class="sidebar-user"><img src="/uploads/profiles/default_avatar.png" onerror="this.src='${CONFIG.DEFAULT_AVATAR}'" /><h4>${AUTH.user.name}</h4><p>🏢 Hostel Owner</p></div>
          <ul class="sidebar-nav">
            <div class="sidebar-section">Dashboard</div>
            <li class="sidebar-nav-item active" onclick="OwnerPage.tab('overview',this)"><i class="fas fa-tachometer-alt"></i> Overview</li>
            <li class="sidebar-nav-item" onclick="OwnerPage.tab('my-hostels',this)"><i class="fas fa-building"></i> My Hostels</li>
            <li class="sidebar-nav-item" onclick="OwnerPage.tab('add-hostel',this)"><i class="fas fa-plus-circle"></i> Add Hostel</li>
            <li class="sidebar-nav-item" onclick="OwnerPage.tab('bookings',this)"><i class="fas fa-calendar-alt"></i> Bookings</li>
            <div class="sidebar-section">Account</div>
            <li class="sidebar-nav-item" onclick="DashboardPage.tabProfile(document.getElementById('owner-content'))"><i class="fas fa-user-edit"></i> Profile</li>
            <li class="sidebar-nav-item" onclick="navigate('chat')"><i class="fas fa-comments"></i> Messages</li>
            <li class="sidebar-nav-item" onclick="logout()" style="color:rgba(255,100,100,.8)"><i class="fas fa-sign-out-alt"></i> Sign Out</li>
          </ul>
        </aside>
        <main class="dashboard-content" id="owner-content"></main>
      </div>`;
    this.loadTab('overview');
  },

  tab(t, el) { document.querySelectorAll('.sidebar-nav-item').forEach(i=>i.classList.remove('active')); if(el) el.classList.add('active'); this.loadTab(t); },

  async loadTab(t) {
    const el = document.getElementById('owner-content');
    el.innerHTML = `<div style="text-align:center;padding:40px"><div class="loader-spinner" style="margin:0 auto"></div></div>`;
    if (t==='overview') await this.tabOverview(el);
    else if (t==='my-hostels') await this.tabMyHostels(el);
    else if (t==='add-hostel') this.tabAddHostel(el);
    else if (t==='bookings') await this.tabBookings(el);
  },

  async tabOverview(el) {
    const [hRes, bRes] = await Promise.allSettled([API.getMyHostels(), API.getOwnerBookings()]);
    const hostels = hRes.value?.data||[]; const bookings = bRes.value?.data||[];
    const revenue = bookings.filter(b=>b.payment_status==='completed').reduce((s,b)=>s+parseFloat(b.paid_amount||0),0);
    el.innerHTML = `
      <h2 class="dashboard-title">🏢 Owner Dashboard</h2>
      <div class="stats-grid">
        <div class="stat-card"><div class="stat-card-icon blue"><i class="fas fa-building"></i></div><div class="stat-card-value">${hostels.length}</div><div class="stat-card-label">Total Hostels</div></div>
        <div class="stat-card"><div class="stat-card-icon green"><i class="fas fa-door-open"></i></div><div class="stat-card-value">${hostels.reduce((s,h)=>s+(h.available_rooms||0),0)}</div><div class="stat-card-label">Vacant Rooms</div></div>
        <div class="stat-card"><div class="stat-card-icon amber"><i class="fas fa-calendar-check"></i></div><div class="stat-card-value">${bookings.filter(b=>b.status==='confirmed').length}</div><div class="stat-card-label">Confirmed Bookings</div></div>
        <div class="stat-card"><div class="stat-card-icon purple"><i class="fas fa-money-bill-wave"></i></div><div class="stat-card-value" style="font-size:1rem">KES ${(revenue/1000).toFixed(0)}K</div><div class="stat-card-label">Deposits Received</div></div>
      </div>
      <div class="card" style="margin-bottom:18px"><div class="card-title">Quick Actions</div>
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          <button class="btn btn-blue" onclick="OwnerPage.tab('add-hostel')"><i class="fas fa-plus"></i> Add Hostel</button>
          <button class="btn btn-outline" onclick="OwnerPage.tab('bookings')"><i class="fas fa-calendar"></i> View Bookings</button>
          <button class="btn btn-outline" onclick="navigate('chat')"><i class="fas fa-comments"></i> Messages</button>
        </div>
      </div>
      ${bookings.slice(0,5).length?`<div class="card"><div class="card-title">Recent Bookings</div>
        ${bookings.slice(0,5).map(b=>`<div style="display:flex;align-items:center;gap:11px;padding:10px 0;border-bottom:1px solid var(--gray-100)">
          <div style="flex:1"><div style="font-weight:600;font-size:.875rem">${b.hostel_title}</div>
          <div style="font-size:.78rem;color:var(--gray-500)">by ${b.student_name} • ${b.institution||''}</div></div>
          ${statusBadge(b.status)}
        </div>`).join('')}</div>`:''}`;
  },

  async tabMyHostels(el) {
    const res = await API.getMyHostels(); const hostels = res.data||[];
    el.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:22px">
      <h2 class="dashboard-title" style="margin:0">🏢 My Hostels</h2>
      <button class="btn btn-blue" onclick="OwnerPage.tab('add-hostel')"><i class="fas fa-plus"></i> Add Hostel</button></div>
      ${!hostels.length?`<div class="empty-state"><div class="icon">🏢</div><h3>No hostels yet</h3><button class="btn btn-blue" onclick="OwnerPage.tab('add-hostel')">Add Your First Hostel</button></div>`:`
      <div class="hostels-grid">${hostels.map(h=>`<div class="hostel-card">
        <div class="hostel-card-img"><img src="${h.primary_image||CONFIG.DEFAULT_HOSTEL}" onerror="this.src='${CONFIG.DEFAULT_HOSTEL}'" />
          <span class="hostel-card-badge${h.status!=='available'?' full':''}">${h.status}</span>
          <span style="position:absolute;bottom:8px;left:8px;background:${h.is_approved?'rgba(0,150,0,.8)':'rgba(200,100,0,.8)'};color:white;padding:1px 8px;border-radius:50px;font-size:.68rem">${h.is_approved?'✅ Live':'⏳ Pending'}</span>
        </div>
        <div class="hostel-card-body">
          <div class="hostel-card-price">${formatKES(h.price_per_month)}<span>/mo</span></div>
          <div class="hostel-card-title">${h.title}</div>
          <div class="hostel-card-campus"><i class="fas fa-university"></i>${h.nearest_institution||h.location}</div>
          <div style="font-size:.78rem;color:var(--gray-500)"><i class="fas fa-door-open"></i> ${h.available_rooms}/${h.total_rooms} available • <i class="fas fa-eye"></i> ${h.views_count} views</div>
        </div>
        <div class="hostel-card-footer">
          <button class="btn btn-sm btn-outline" onclick="navigate('hostel',${h.id})"><i class="fas fa-eye"></i></button>
          <button class="btn btn-sm btn-outline" onclick="OwnerPage.editHostel(${h.id})"><i class="fas fa-edit"></i> Edit</button>
          <button class="btn btn-sm btn-red" onclick="OwnerPage.deleteHostel(${h.id},'${h.title.replace(/'/g,'')}')"><i class="fas fa-trash"></i></button>
        </div>
      </div>`).join('')}</div>`}`;
  },

  tabAddHostel(el, existing = null) {
    el.innerHTML = `<h2 class="dashboard-title">${existing?'✏️ Edit Hostel':'🏢 Add New Hostel'}</h2>
      <div class="card" style="max-width:720px">
        <div class="form-row">
          <div class="form-group"><label class="form-label">Hostel Name *</label><input type="text" class="form-control" id="h-title" placeholder="e.g. Sunrise Student Hostels" value="${existing?.title||''}" /></div>
          <div class="form-group"><label class="form-label">Room Type *</label><select class="form-control" id="h-type">
            ${['single','double','triple','quad','ensuite','bedsitter','studio'].map(t=>`<option value="${t}" ${existing?.room_type===t?'selected':''}>${roomTypeName(t)}</option>`).join('')}
          </select></div>
        </div>
        <div class="form-group"><label class="form-label">Description</label><textarea class="form-control" id="h-desc" rows="3" placeholder="Describe your hostel, facilities, vibe…">${existing?.description||''}</textarea></div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">Price per Month (KES) *</label><input type="number" class="form-control" id="h-price" value="${existing?.price_per_month||''}" /></div>
          <div class="form-group"><label class="form-label">Deposit Amount (KES)</label><input type="number" class="form-control" id="h-deposit" placeholder="Same as monthly rent" value="${existing?.deposit_amount||''}" /></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">Total Rooms</label><input type="number" class="form-control" id="h-total" min="1" value="${existing?.total_rooms||1}" /></div>
          <div class="form-group"><label class="form-label">Available Rooms</label><input type="number" class="form-control" id="h-avail" min="0" value="${existing?.available_rooms||1}" /></div>
        </div>
        <div class="form-group"><label class="form-label">Location Address *</label><input type="text" class="form-control" id="h-location" placeholder="e.g. Ngara, Nairobi" value="${existing?.location||''}" /></div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">County</label><select class="form-control" id="h-county">
            ${['Nairobi','Kiambu','Nakuru','Mombasa','Kisumu','Uasin Gishu','Meru','Laikipia','Nyeri','Murang\'a','Machakos'].map(c=>`<option ${existing?.county===c?'selected':''}>${c}</option>`).join('')}
          </select></div>
          <div class="form-group"><label class="form-label">Sub-County / Estate</label><input type="text" class="form-control" id="h-sub" value="${existing?.sub_county||''}" /></div>
        </div>
        <div class="form-group"><label class="form-label">🎓 Nearest University / College</label><input type="text" class="form-control" id="h-inst" placeholder="e.g. Kenyatta University" value="${existing?.nearest_institution||''}" /></div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">Distance to Campus (km)</label><input type="number" class="form-control" id="h-dist" step="0.1" placeholder="e.g. 0.5" value="${existing?.distance_to_campus||''}" /></div>
          <div class="form-group"><label class="form-label">Gender Policy</label><select class="form-control" id="h-gender">
            <option value="any" ${existing?.gender_policy==='any'?'selected':''}>All Welcome</option>
            <option value="male_only" ${existing?.gender_policy==='male_only'?'selected':''}>Male Only</option>
            <option value="female_only" ${existing?.gender_policy==='female_only'?'selected':''}>Female Only</option>
            <option value="mixed" ${existing?.gender_policy==='mixed'?'selected':''}>Mixed</option>
          </select></div>
        </div>
        <div class="form-group"><label class="form-label">📍 GPS Location *</label>
          <div style="display:flex;gap:8px">
            <input type="number" class="form-control" id="h-lat" placeholder="Latitude (e.g. -1.2921)" step="any" value="${existing?.latitude||''}" style="flex:1" />
            <input type="number" class="form-control" id="h-lng" placeholder="Longitude (e.g. 36.8219)" step="any" value="${existing?.longitude||''}" style="flex:1" />
            <button class="btn btn-sm btn-outline" onclick="OwnerPage.openPinPicker()"><i class="fas fa-map-marker-alt"></i> Pin</button>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px">
          ${[['h-wifi','📶 WiFi'],['h-meals','🍽️ Meals Provided'],['h-security','🔒 Security'],
             ['h-cctv','📹 CCTV'],['h-backup','⚡ Generator/Solar'],['h-laundry','🧺 Laundry'],
             ['h-kitchen','🍳 Kitchen Access'],['h-common','📺 Common Room'],['h-study','📚 Study-Friendly'],
             ['h-roommates','👥 Allows Roommates'],['h-parking','🚗 Parking'],['h-caretaker','👨‍💼 Caretaker'],
          ].map(([id,label])=>`<label style="display:flex;align-items:center;gap:6px;font-size:.82rem;cursor:pointer"><input type="checkbox" id="${id}" ${existing?.[id.replace('h-','').replace('-','_')]?'checked':''} />${label}</label>`).join('')}
        </div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">WiFi Speed</label><input type="text" class="form-control" id="h-wifi-speed" placeholder="e.g. 20 Mbps" value="${existing?.wifi_speed||''}" /></div>
          <div class="form-group"><label class="form-label">Curfew Time</label><input type="text" class="form-control" id="h-curfew" placeholder="e.g. 11:00 PM" value="${existing?.curfew_time||''}" /></div>
        </div>
        <div class="form-group"><label class="form-label">Meals Description</label><input type="text" class="form-control" id="h-meals-desc" placeholder="e.g. Breakfast KES 100 | Dinner KES 150" value="${existing?.meals_description||''}" /></div>
        <div class="form-group"><label class="form-label">House Rules</label><textarea class="form-control" id="h-rules" rows="2" placeholder="No alcohol, No smoking, No loud music after 10pm…">${existing?.rules||''}</textarea></div>

        <!-- Nearby Amenities -->
        <div class="card-title" style="margin-top:16px">🗺️ Add Nearby Amenities (optional)</div>
        <div id="amenity-list"></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px">
          <input type="text" class="form-control" id="am-name" placeholder="e.g. Naivas Supermarket" style="flex:1;min-width:140px" />
          <select class="form-control" id="am-cat" style="min-width:120px">
            ${['shop','supermarket','pharmacy','hospital','bank','atm','restaurant','cafe','gym','library','church','mosque','salon','bus_stop'].map(c=>`<option value="${c}">${c.replace('_',' ')}</option>`).join('')}
          </select>
          <input type="number" class="form-control" id="am-dist" placeholder="Distance (m)" style="width:120px" />
          <button class="btn btn-sm btn-outline" onclick="OwnerPage.addAmenityRow()"><i class="fas fa-plus"></i></button>
        </div>

        <div class="form-group">
          <label class="form-label">📸 Hostel Photos (up to 10)</label>
          <div class="upload-area" onclick="document.getElementById('h-imgs').click()">
            <i class="fas fa-cloud-upload-alt" style="font-size:1.8rem;color:var(--gray-300);display:block;margin-bottom:7px"></i>
            <p style="color:var(--gray-500);font-size:.875rem">Click to upload photos</p>
            <input type="file" id="h-imgs" accept="image/*" multiple style="display:none" onchange="OwnerPage.previewImgs(this)" />
          </div>
          <div class="upload-preview" id="img-preview"></div>
        </div>
        <button class="btn btn-blue btn-block btn-lg" id="submit-hostel-btn" onclick="OwnerPage.submitHostel(${existing?.id||'null'})">
          <i class="fas fa-upload"></i> ${existing?'Update Hostel':'Submit for Approval'}
        </button>
      </div>`;
    this._amenities = [];
  },

  _amenities: [],
  addAmenityRow() {
    const name = document.getElementById('am-name').value.trim();
    const cat = document.getElementById('am-cat').value;
    const dist = document.getElementById('am-dist').value;
    if (!name) { showToast('Enter amenity name', 'error'); return; }
    this._amenities.push({ name, category: cat, distance_m: parseInt(dist)||0 });
    const list = document.getElementById('amenity-list');
    list.innerHTML = this._amenities.map((a,i)=>`<div style="display:flex;align-items:center;gap:8px;padding:6px 10px;background:var(--gray-50);border-radius:7px;margin-bottom:6px;font-size:.83rem">
      <span>${amenityIcon(a.category)}</span><span style="flex:1">${a.name}</span><span style="color:var(--gray-400)">${a.distance_m}m</span>
      <button class="btn btn-sm btn-red" onclick="OwnerPage._amenities.splice(${i},1);OwnerPage.addAmenityRow()"><i class="fas fa-times"></i></button>
    </div>`).join('');
    document.getElementById('am-name').value=''; document.getElementById('am-dist').value='';
  },

  openPinPicker() {
    MapModule.loadGoogleMaps().then(() => {
      MapModule.openPinPicker(({ lat, lng, address }) => {
        document.getElementById('h-lat').value = lat.toFixed(6);
        document.getElementById('h-lng').value = lng.toFixed(6);
        if (!document.getElementById('h-location').value) document.getElementById('h-location').value = address;
        showToast('📍 Location pinned!', 'success');
      });
    });
  },

  previewImgs(input) {
    const p = document.getElementById('img-preview'); p.innerHTML='';
    Array.from(input.files).forEach((f,i)=>{
      const d = document.createElement('div'); d.className='upload-preview-item';
      d.innerHTML=`<img src="${URL.createObjectURL(f)}" /><span class="upload-preview-remove" onclick="this.parentElement.remove()"><i class="fas fa-times"></i></span>`;
      p.appendChild(d);
    });
  },

  async submitHostel(existingId) {
    const btn = document.getElementById('submit-hostel-btn');
    const title = document.getElementById('h-title').value;
    const price = document.getElementById('h-price').value;
    const location = document.getElementById('h-location').value;
    const lat = document.getElementById('h-lat').value;
    const lng = document.getElementById('h-lng').value;
    if (!title||!price||!location||!lat||!lng) { showToast('Fill all required fields including GPS location', 'error'); return; }

    btn.disabled=true; btn.innerHTML='<i class="fas fa-spinner fa-spin"></i> Submitting…';
    const fd = new FormData();
    const boolField = (id) => document.getElementById(id)?.checked ? 'true' : 'false';
    Object.entries({ title, description:document.getElementById('h-desc').value, price_per_month:price,
      deposit_amount:document.getElementById('h-deposit').value||price, location, county:document.getElementById('h-county').value,
      sub_county:document.getElementById('h-sub').value, lat, lng, nearest_institution:document.getElementById('h-inst').value,
      distance_to_campus:document.getElementById('h-dist').value, room_type:document.getElementById('h-type').value,
      total_rooms:document.getElementById('h-total').value, available_rooms:document.getElementById('h-avail').value,
      gender_policy:document.getElementById('h-gender').value, curfew_time:document.getElementById('h-curfew').value,
      wifi_speed:document.getElementById('h-wifi-speed').value, meals_description:document.getElementById('h-meals-desc').value,
      rules:document.getElementById('h-rules').value,
      wifi:boolField('h-wifi'), meals_provided:boolField('h-meals'), security:boolField('h-security'),
      cctv:boolField('h-cctv'), backup_power:boolField('h-backup'), laundry:boolField('h-laundry'),
      kitchen_access:boolField('h-kitchen'), common_room:boolField('h-common'), study_friendly:boolField('h-study'),
      allows_roommates:boolField('h-roommates'), parking:boolField('h-parking'), caretaker:boolField('h-caretaker'),
      amenities_json:JSON.stringify(this._amenities||[]),
    }).forEach(([k,v])=>fd.append(k,v));
    const imgs = document.getElementById('h-imgs');
    if (imgs.files.length) Array.from(imgs.files).forEach(f=>fd.append('images',f));
    try {
      const res = existingId ? await API.updateHostel(existingId, fd) : await API.addHostel(fd);
      if (!res.success) throw new Error(res.message);
      showToast(res.message, 'success'); this.loadTab('my-hostels');
    } catch(e) { showToast(e.message, 'error'); btn.disabled=false; btn.innerHTML='<i class="fas fa-upload"></i> Submit for Approval'; }
  },

  async tabBookings(el) {
    const res = await API.getOwnerBookings(); const bookings = res.data||[];
    el.innerHTML = `<h2 class="dashboard-title">📅 Student Bookings</h2>
      ${!bookings.length?`<div class="empty-state"><div class="icon">📅</div><h3>No bookings yet</h3></div>`:`
      <div class="table-wrapper"><table class="data-table">
        <thead><tr><th>Hostel</th><th>Student</th><th>Institution</th><th>Status</th><th>Deposit</th><th>Receipt</th><th>Date</th></tr></thead>
        <tbody>${bookings.map(b=>`<tr>
          <td><strong>${b.hostel_title}</strong></td>
          <td><strong>${b.student_name}</strong><br/><small>${b.student_phone}</small></td>
          <td><small style="color:var(--blue-600)">${b.institution||'—'}<br/>${b.course||''} Yr${b.year_of_study||''}</small></td>
          <td>${statusBadge(b.status)}</td>
          <td><span class="badge ${b.payment_status==='completed'?'badge-green':'badge-amber'}">${b.payment_status==='completed'?'✅ Paid':'⏳ Unpaid'}</span></td>
          <td><small>${b.mpesa_receipt_number||'—'}</small></td>
          <td style="font-size:.78rem;color:var(--gray-400)">${formatDate(b.created_at)}</td>
        </tr>`).join('')}</tbody>
      </table></div>`}`;
  },

  async editHostel(id) {
    const res = await API.getHostel(id);
    if (!res.success) { showToast('Error loading hostel', 'error'); return; }
    this.tabAddHostel(document.getElementById('owner-content'), res.data);
  },

  async deleteHostel(id, title) {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;
    const res = await API.deleteHostel(id);
    if (res.success) { showToast('Hostel deleted', 'info'); this.loadTab('my-hostels'); }
    else showToast(res.message, 'error');
  },
};


