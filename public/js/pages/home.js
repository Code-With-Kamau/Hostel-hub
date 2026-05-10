registerPage('home', async (main) => {
  main.innerHTML = `
    <!-- Hero -->
    <section class="hero">
      <div class="hero-inner">
        <div class="hero-text">
          <h1>Find Your Perfect<br><span class="hero-highlight">Student Hostel</span></h1>
          <p>Verified, affordable hostels near Kenyan universities. Book and pay securely via M-Pesa.</p>
          <div class="hero-search">
            <input type="search" id="hero-search" placeholder="Search by name, university or location..."
              oninput="debounce(applyFilters,400)()" onkeydown="if(event.key==='Enter')applyFilters()">
            <button class="btn btn-primary" onclick="applyFilters()">🔍 Search</button>
          </div>
          <div class="hero-stats" id="hero-stats"></div>
        </div>
        <div class="hero-image">
          <div class="hero-img-wrap">
            <div class="hero-img-card">🏠</div>
          </div>
        </div>
      </div>
    </section>

    <!-- Filters -->
    <section class="filters-section">
      <div class="filters-inner">
        <div class="filter-group">
          <label>Room Type</label>
          <select id="filter-room" onchange="applyFilters()">
            <option value="">All Types</option>
            <option value="single">Single</option>
            <option value="double">Double</option>
            <option value="triple">Triple</option>
            <option value="ensuite">Ensuite</option>
            <option value="bedsitter">Bedsitter</option>
            <option value="studio">Studio</option>
          </select>
        </div>
        <div class="filter-group">
          <label>Gender Policy</label>
          <select id="filter-gender" onchange="applyFilters()">
            <option value="">Any</option>
            <option value="male_only">Male Only</option>
            <option value="female_only">Female Only</option>
            <option value="mixed">Mixed</option>
          </select>
        </div>
        <div class="filter-group">
          <label>Max Price (KES/mo)</label>
          <select id="filter-price" onchange="applyFilters()">
            <option value="">Any Price</option>
            <option value="5000">Up to 5,000</option>
            <option value="8000">Up to 8,000</option>
            <option value="12000">Up to 12,000</option>
            <option value="20000">Up to 20,000</option>
          </select>
        </div>
        <div class="filter-group filter-checks">
          <label class="checkbox-label"><input type="checkbox" id="filter-wifi" onchange="applyFilters()"> WiFi</label>
          <label class="checkbox-label"><input type="checkbox" id="filter-meals" onchange="applyFilters()"> Meals</label>
          <label class="checkbox-label"><input type="checkbox" id="filter-study" onchange="applyFilters()"> Study-Friendly</label>
          <label class="checkbox-label"><input type="checkbox" id="filter-avail" onchange="applyFilters()"> Available</label>
        </div>
        <div class="filter-group">
          <label>Sort By</label>
          <select id="filter-sort" onchange="applyFilters()">
            <option value="newest">Newest</option>
            <option value="price_asc">Price: Low to High</option>
            <option value="price_desc">Price: High to Low</option>
            <option value="rating">Highest Rated</option>
            <option value="distance">Closest to Campus</option>
          </select>
        </div>
        <button class="btn btn-outline btn-sm" onclick="clearFilters()">✕ Clear</button>
      </div>
    </section>

    <!-- Results -->
    <section class="results-section page-wrap">
      <div id="results-info" class="results-info"></div>
      <div id="hostel-grid" class="hostel-grid">
        <div class="spinner-container" style="grid-column:1/-1"><div class="spinner"></div><p>Loading hostels...</p></div>
      </div>
      <div id="pagination" class="pagination"></div>
    </section>

    <!-- Featured Amenities -->
    <section class="features-section">
      <div class="page-wrap">
        <h2 class="section-title">Why Choose HostelHub?</h2>
        <div class="features-grid">
          <div class="feature-card">
            <div class="feature-icon">✅</div>
            <h3>Verified Listings</h3>
            <p>Every hostel is reviewed and approved by our team before going live.</p>
          </div>
          <div class="feature-card">
            <div class="feature-icon">📱</div>
            <h3>Pay via M-Pesa</h3>
            <p>Secure deposit payments through Safaricom M-Pesa. No cash, no hassle.</p>
          </div>
          <div class="feature-card">
            <div class="feature-icon">🔄</div>
            <h3>3-Day Free Cancellation</h3>
            <p>Change your mind? Cancel within 3 days for a full refund to your M-Pesa.</p>
          </div>
          <div class="feature-card">
            <div class="feature-icon">💬</div>
            <h3>Direct Contact</h3>
            <p>Message or WhatsApp hostel owners directly from the platform.</p>
          </div>
          <div class="feature-card">
            <div class="feature-icon">👥</div>
            <h3>Roommate Finder</h3>
            <p>Find compatible roommates and study buddies at your institution.</p>
          </div>
          <div class="feature-card">
            <div class="feature-icon">🗺️</div>
            <h3>Map View</h3>
            <p>See hostel locations on a map relative to your campus.</p>
          </div>
        </div>
      </div>
    </section>`;

  loadHeroStats();
  applyFilters();
  attachSaveButtons();
});

let currentPage = 1;

async function loadHeroStats() {
  try {
    // Grab a quick count from the hostels endpoint
    const { pagination } = await HH.api('/hostels?limit=1');
    const el = document.getElementById('hero-stats');
    if (el) {
      el.innerHTML = `
        <span>🏠 <strong>${pagination?.total || '100+'}</strong> verified hostels</span>
        <span>🎓 Near major universities</span>
        <span>📱 M-Pesa payments</span>`;
    }
  } catch {}
}

async function applyFilters(page = 1) {
  currentPage = page;
  const el = document.getElementById('hostel-grid');
  if (!el) return;

  el.innerHTML = `<div class="spinner-container" style="grid-column:1/-1"><div class="spinner"></div><p>Loading...</p></div>`;

  const params = new URLSearchParams();
  params.set('page', page);
  params.set('limit', 12);

  const search    = document.getElementById('hero-search')?.value.trim();
  const roomType  = document.getElementById('filter-room')?.value;
  const gender    = document.getElementById('filter-gender')?.value;
  const maxPrice  = document.getElementById('filter-price')?.value;
  const wifi      = document.getElementById('filter-wifi')?.checked;
  const meals     = document.getElementById('filter-meals')?.checked;
  const study     = document.getElementById('filter-study')?.checked;
  const avail     = document.getElementById('filter-avail')?.checked;
  const sort      = document.getElementById('filter-sort')?.value;

  if (search)   params.set('search', search);
  if (roomType) params.set('room_type', roomType);
  if (gender)   params.set('gender_policy', gender);
  if (maxPrice) params.set('max_price', maxPrice);
  if (wifi)     params.set('wifi', 'true');
  if (meals)    params.set('meals_provided', 'true');
  if (study)    params.set('study_friendly', 'true');
  if (avail)    params.set('available', 'true');
  if (sort)     params.set('sort', sort);

  try {
    const { hostels, pagination } = await HH.api(`/hostels?${params}`);

    const infoEl = document.getElementById('results-info');
    if (infoEl) {
      infoEl.innerHTML = `<p class="result-count">
        Showing <strong>${hostels.length}</strong> of <strong>${pagination.total}</strong> hostels
        ${search ? `for "<em>${HH.escapeHtml(search)}</em>"` : ''}
      </p>`;
    }

    if (!hostels.length) {
      el.innerHTML = `
        <div class="empty-state" style="grid-column:1/-1">
          <span class="empty-icon">🏠</span>
          <p>No hostels found matching your criteria.</p>
          <button class="btn btn-outline" onclick="clearFilters()">Clear Filters</button>
        </div>`;
      return;
    }

    // Get saved hostels for logged-in users
    let savedIds = new Set();
    if (HH.isLoggedIn() && HH.isStudent()) {
      try {
        const saved = await HH.api('/students/saved');
        savedIds = new Set(saved.map(h => h.id));
      } catch {}
    }

    el.innerHTML = hostels.map(h => HH.buildHostelCard(h, savedIds.has(h.id))).join('');
    renderPagination(pagination);
    attachSaveButtons();

  } catch (err) {
    el.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><p class="error-msg">❌ ${HH.escapeHtml(err.message)}</p></div>`;
  }
}

function renderPagination(pagination) {
  const el = document.getElementById('pagination');
  if (!el || pagination.pages <= 1) { if (el) el.innerHTML = ''; return; }

  const { page, pages } = pagination;
  let html = '<div class="pagination-wrap">';

  html += `<button class="btn btn-outline btn-sm" onclick="applyFilters(${page - 1})" ${page === 1 ? 'disabled' : ''}>← Prev</button>`;

  for (let i = 1; i <= pages; i++) {
    if (i === 1 || i === pages || (i >= page - 2 && i <= page + 2)) {
      html += `<button class="btn btn-sm ${i === page ? 'btn-primary' : 'btn-outline'}" onclick="applyFilters(${i})">${i}</button>`;
    } else if (i === page - 3 || i === page + 3) {
      html += `<span class="pagination-ellipsis">…</span>`;
    }
  }

  html += `<button class="btn btn-outline btn-sm" onclick="applyFilters(${page + 1})" ${page === pages ? 'disabled' : ''}>Next →</button>`;
  html += '</div>';
  el.innerHTML = html;
}

function clearFilters() {
  ['filter-room','filter-gender','filter-price','filter-sort'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  ['filter-wifi','filter-meals','filter-study','filter-avail'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.checked = false;
  });
  const search = document.getElementById('hero-search');
  if (search) search.value = '';
  applyFilters(1);
}

function attachSaveButtons() {
  document.querySelectorAll('.save-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!HH.isLoggedIn()) { showLoginModal(); return; }
      if (!HH.isStudent()) { showToast('Only students can save hostels', 'warning'); return; }

      const hostelId = btn.dataset.id;
      try {
        const data = await HH.api(`/students/saved/${hostelId}`, { method: 'POST' });
        btn.innerHTML   = data.saved ? '❤️' : '🤍';
        btn.title       = data.saved ? 'Unsave' : 'Save';
        btn.classList.toggle('saved', data.saved);
        showToast(data.message, 'success', 2000);
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  });
}

function clearFilters() {
  ['filter-room','filter-gender','filter-price','filter-sort'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  ['filter-wifi','filter-meals','filter-study','filter-avail'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.checked = false;
  });
  const search = document.getElementById('hero-search');
  if (search) search.value = '';
  applyFilters(1);
}

window.applyFilters   = applyFilters;
window.clearFilters   = clearFilters;
window.attachSaveButtons = attachSaveButtons;
