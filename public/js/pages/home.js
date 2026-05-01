// ── pages/home.js ──
const HomePage = {
  hostels: [], filters: {}, page: 1, userLoc: null,

  async render() {
    document.getElementById('app-content').innerHTML = `
      <!-- HERO -->
      <section class="hero">
        <div class="hero-content">
          <div class="hero-badge">🎓 Built for Kenyan Students</div>
          <h1>Find Your Perfect <em>Student Hostel</em></h1>
          <p>Search verified hostels near your university, college or polytechnic. Book instantly with M-Pesa.</p>
          <div class="search-bar">
            <i class="fas fa-university" style="color:var(--gray-400);flex-shrink:0"></i>
            <input id="hero-search" type="text" placeholder="University, location, hostel name…" />
            <div class="search-divider"></div>
            <select id="hero-room">
              <option value="">Any Room Type</option>
              <option value="single">Single Room</option>
              <option value="double">Double Room</option>
              <option value="ensuite">En-Suite</option>
              <option value="bedsitter">Bedsitter</option>
              <option value="studio">Studio</option>
            </select>
            <div class="search-divider"></div>
            <select id="hero-budget">
              <option value="">Any Budget</option>
              <option value="5000">Under KES 5K</option>
              <option value="8000">Under KES 8K</option>
              <option value="12000">Under KES 12K</option>
              <option value="20000">Under KES 20K</option>
            </select>
            <button class="btn-search" onclick="HomePage.search()"><i class="fas fa-search"></i> Search</button>
          </div>
          <div class="hero-stats">
            <div class="hero-stat"><div class="num" id="stat-hostels">…</div><div class="lbl">Hostels Listed</div></div>
            <div class="hero-stat"><div class="num" id="stat-rooms">…</div><div class="lbl">Rooms Available</div></div>
            <div class="hero-stat"><div class="num">200+</div><div class="lbl">Institutions Covered</div></div>
          </div>
        </div>
      </section>

      <!-- MAP -->
      <section style="background:white;border-bottom:1px solid var(--gray-200)">
        <div id="map" style="height:420px;background:var(--gray-100)"></div>
      </section>

      <!-- LISTINGS -->
      <div class="section">
        <div class="section-header">
          <div>
            <h2>🏢 Available Hostels</h2>
            <p id="listing-sub">Browse all verified student hostels</p>
          </div>
          <div style="display:flex;gap:8px">
            <button class="see-all" onclick="HomePage.useLocation()"><i class="fas fa-location-arrow"></i> Near Me</button>
            <a class="see-all" onclick="navigate('community')"><i class="fas fa-users"></i> Community</a>
          </div>
        </div>

        <!-- FILTERS -->
        <div class="filter-bar">
          <select id="f-institution" onchange="HomePage.filter('institution',this.value)" style="min-width:160px">
            <option value="">All Institutions</option>
            <option>University of Nairobi</option><option>Kenyatta University</option>
            <option>JKUAT</option><option>Mount Kenya University</option>
            <option>Strathmore University</option><option>Daystar University</option>
            <option>Laikipia University</option><option>Meru University</option>
            <option>Technical University of Kenya</option><option>Kenya Polytechnic</option>
          </select>
          <select id="f-room" onchange="HomePage.filter('room_type',this.value)">
            <option value="">Any Type</option>
            <option value="single">Single</option><option value="double">Double</option>
            <option value="ensuite">En-Suite</option><option value="bedsitter">Bedsitter</option>
            <option value="studio">Studio</option>
          </select>
          <select id="f-gender" onchange="HomePage.filter('gender_policy',this.value)">
            <option value="">Any Gender</option>
            <option value="male_only">Male Only</option>
            <option value="female_only">Female Only</option>
            <option value="mixed">Mixed</option>
          </select>
          <select id="f-sort" onchange="HomePage.filter('sort',this.value)">
            <option value="newest">Newest</option>
            <option value="price_asc">Price ↑</option>
            <option value="price_desc">Price ↓</option>
            <option value="rating">Best Rated</option>
            <option value="distance">Nearest Campus</option>
          </select>
          <div class="filter-chips">
            <button class="filter-chip" onclick="HomePage.chip(this,'allows_roommates')">👥 Roommates</button>
            <button class="filter-chip" onclick="HomePage.chip(this,'wifi')">📶 WiFi</button>
            <button class="filter-chip" onclick="HomePage.chip(this,'meals_provided')">🍽️ Meals</button>
            <button class="filter-chip" onclick="HomePage.chip(this,'study_friendly')">📚 Study</button>
            <button class="filter-chip" onclick="HomePage.chip(this,'security')">🔒 Security</button>
            <button class="filter-chip" onclick="HomePage.chip(this,'backup_power')">⚡ Generator</button>
          </div>
          <button class="btn btn-sm btn-outline" onclick="HomePage.clearFilters()"><i class="fas fa-times"></i></button>
        </div>

        <div id="results-count" style="color:var(--gray-500);font-size:.85rem;margin-bottom:14px"></div>
        <div class="hostels-grid" id="hostels-grid">${skeletonCards(6)}</div>
        <div id="pagination"></div>
      </div>

      <!-- WHY -->
      <section style="background:linear-gradient(135deg,var(--blue-900),#312e81);padding:56px 24px;margin-top:32px">
        <div style="max-width:960px;margin:0 auto;text-align:center">
          <h2 style="color:white;font-size:1.9rem;margin-bottom:8px">Everything a Student Needs</h2>
          <p style="color:rgba(255,255,255,.65);margin-bottom:36px">HostelHub is built specifically for Kenyan students</p>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(185px,1fr));gap:20px">
            ${[['🗺️','Map-Based Search','Find hostels near your campus on a live map'],
               ['📱','M-Pesa Booking','Pay deposit instantly via M-Pesa Lipa Na Mpesa'],
               ['👥','Roommate Finder','Connect with students looking to share a room'],
               ['📚','Study Buddy','Find coursemates to study with near your hostel'],
               ['🛒','Nearby Amenities','See shops, hospitals & ATMs near each hostel'],
               ['🔒','Verified Hostels','All listings reviewed before going live']
            ].map(([i,t,d])=>`<div style="background:rgba(255,255,255,.07);border-radius:14px;padding:20px;border:1px solid rgba(255,255,255,.1)">
              <div style="font-size:2.2rem;margin-bottom:10px">${i}</div>
              <h3 style="color:white;font-size:.9rem;margin-bottom:5px">${t}</h3>
              <p style="color:rgba(255,255,255,.55);font-size:.78rem;line-height:1.6">${d}</p>
            </div>`).join('')}
          </div>
        </div>
      </section>`;

    this.loadHostels();
    this.loadStats();
    this.initMap();
  },

  async loadStats() {
    try {
      const res = await API.getHostels({ limit: 1 });
      document.getElementById('stat-hostels').textContent = (res.total || 0) + '+';
      document.getElementById('stat-rooms').textContent = (res.total ? res.total * 3 : 0) + '+';
    } catch(e) {}
  },

  async loadHostels() {
    const grid = document.getElementById('hostels-grid');
    grid.innerHTML = skeletonCards(6);
    try {
      const params = { ...this.filters, page: this.page, limit: 12 };
      if (this.userLoc) { params.lat = this.userLoc.lat; params.lng = this.userLoc.lng; params.radius = 10; }
      const res = await API.getHostels(params);
      this.hostels = res.data || [];
      if (!this.hostels.length) {
        grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="icon">🏢</div><h3>No hostels found</h3><p>Try adjusting your filters.</p><button class="btn btn-blue" onclick="HomePage.clearFilters()">Clear Filters</button></div>`;
        document.getElementById('results-count').textContent = '';
        return;
      }
      document.getElementById('results-count').textContent = `Showing ${this.hostels.length} of ${res.total} hostels`;
      document.getElementById('listing-sub').textContent = this.userLoc ? `Hostels near your location` : `${res.total} hostels available`;
      grid.innerHTML = this.hostels.map(h => hostelCardHTML(h, !!this.userLoc)).join('');
      if (MapModule.map) MapModule.addHostelsToMap(this.hostels);
      this.renderPagination(res.pages, res.page);
    } catch(e) { grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="icon">⚠️</div><h3>${e.message}</h3></div>`; }
  },

  renderPagination(pages, cur) {
    const el = document.getElementById('pagination');
    if (pages <= 1) { el.innerHTML = ''; return; }
    let h = '<div class="pagination">';
    if (cur > 1) h += `<button class="page-btn" onclick="HomePage.goPage(${cur-1})"><i class="fas fa-chevron-left"></i></button>`;
    for (let i = 1; i <= pages; i++) {
      if (i===1||i===pages||(i>=cur-2&&i<=cur+2)) h += `<button class="page-btn${i===cur?' active':''}" onclick="HomePage.goPage(${i})">${i}</button>`;
      else if (i===cur-3||i===cur+3) h += `<span style="padding:8px 3px;color:var(--gray-400)">…</span>`;
    }
    if (cur < pages) h += `<button class="page-btn" onclick="HomePage.goPage(${cur+1})"><i class="fas fa-chevron-right"></i></button>`;
    el.innerHTML = h + '</div>';
  },

  goPage(n) { this.page = n; this.loadHostels(); window.scrollTo({ top: 550, behavior:'smooth' }); },
  search() {
    const s = document.getElementById('hero-search').value;
    const r = document.getElementById('hero-room').value;
    const b = document.getElementById('hero-budget').value;
    if (s) this.filters.search = s;
    if (r) this.filters.room_type = r;
    if (b) this.filters.max_price = b;
    this.page = 1; this.loadHostels();
    document.getElementById('hostels-grid').scrollIntoView({ behavior:'smooth', block:'start' });
  },
  filter(key, val) { if (val) this.filters[key] = val; else delete this.filters[key]; this.page = 1; this.loadHostels(); },
  chip(btn, key) { btn.classList.toggle('active'); if (btn.classList.contains('active')) this.filters[key] = 'true'; else delete this.filters[key]; this.page = 1; this.loadHostels(); },
  clearFilters() {
    this.filters = {}; this.page = 1; this.userLoc = null;
    document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
    ['f-institution','f-room','f-gender','f-sort'].forEach(id => { const el=document.getElementById(id); if(el) el.value=''; });
    this.loadHostels();
  },
  async useLocation() {
    try {
      showToast('Getting your location…', 'info');
      this.userLoc = await MapModule.getUserLocation();
      if (MapModule.map) { MapModule.map.setCenter(this.userLoc); MapModule.addUserMarker(this.userLoc.lat, this.userLoc.lng); }
      showToast('📍 Showing hostels near you!', 'success');
      this.page = 1; this.loadHostels();
    } catch(e) { showToast('Could not get location: ' + e, 'error'); }
  },
  async initMap() {
    await MapModule.loadGoogleMaps();
    const tryInit = () => {
      if (MapModule.mapLoaded) {
        MapModule.initMap('map', { lat: -1.2921, lng: 36.8219 }, 11);
        if (this.hostels.length) MapModule.addHostelsToMap(this.hostels);
      }
    };
    document.addEventListener('maps-ready', tryInit, { once: true });
    if (MapModule.mapLoaded) tryInit();
  },
};
