const CommunityPage = {
  activeTab: 'roommates',
  async render() {
    document.getElementById('app-content').innerHTML = `
      <div class="section" style="max-width:1000px">
        <div class="section-header">
          <div><h2>🎓 Student Community</h2><p>Find roommates and study partners near your institution</p></div>
          ${AUTH.isStudent()?`<div style="display:flex;gap:8px">
            <button class="see-all" onclick="navigate('dashboard')"><i class="fas fa-plus"></i> Post Request</button>
          </div>`:''}
        </div>
        <!-- Tabs -->
        <div style="display:flex;background:var(--gray-100);border-radius:12px;padding:4px;margin-bottom:24px;gap:4px">
          <button id="tab-rm" style="flex:1;padding:11px;border-radius:9px;font-weight:700;font-size:.9rem;background:var(--blue-600);color:white;transition:var(--transition)" onclick="CommunityPage.switchTab('roommates')">👥 Roommate Finder</button>
          <button id="tab-sb" style="flex:1;padding:11px;border-radius:9px;font-weight:700;font-size:.9rem;color:var(--gray-500);transition:var(--transition)" onclick="CommunityPage.switchTab('study-buddies')">📚 Study Buddy Finder</button>
        </div>
        <!-- Filters -->
        <div class="filter-bar" id="community-filters">
          <input type="text" class="form-control" id="comm-inst" placeholder="Filter by institution…" oninput="CommunityPage.load()" style="flex:1;min-width:160px" />
          <div id="extra-filters"></div>
          <button class="btn btn-sm btn-outline" onclick="document.getElementById('comm-inst').value='';CommunityPage.load()"><i class="fas fa-times"></i></button>
        </div>
        <div id="community-grid" class="hostels-grid" style="grid-template-columns:repeat(auto-fill,minmax(270px,1fr))">${skeletonCards(6)}</div>
      </div>`;
    this.load();
  },

  switchTab(tab) {
    this.activeTab = tab;
    document.getElementById('tab-rm').style.cssText = tab==='roommates'?'flex:1;padding:11px;border-radius:9px;font-weight:700;font-size:.9rem;background:var(--blue-600);color:white;transition:var(--transition)':'flex:1;padding:11px;border-radius:9px;font-weight:700;font-size:.9rem;color:var(--gray-500);transition:var(--transition)';
    document.getElementById('tab-sb').style.cssText = tab==='study-buddies'?'flex:1;padding:11px;border-radius:9px;font-weight:700;font-size:.9rem;background:var(--purple-600);color:white;transition:var(--transition)':'flex:1;padding:11px;border-radius:9px;font-weight:700;font-size:.9rem;color:var(--gray-500);transition:var(--transition)';
    this.load();
  },

  async load() {
    const grid = document.getElementById('community-grid');
    grid.innerHTML = skeletonCards(6);
    const inst = document.getElementById('comm-inst').value;
    try {
      if (this.activeTab === 'roommates') {
        const res = await API.getRoommates(inst?{institution:inst}:{});
        const items = res.data||[];
        if (!items.length) { grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="icon">👥</div><h3>No roommate requests</h3><p>Be the first to post one!</p>${AUTH.isStudent()?`<button class="btn btn-blue" onclick="navigate('dashboard')">Post Request</button>`:''}</div>`; return; }
        grid.innerHTML = items.map(r => `
          <div class="community-card slide-up">
            <div style="display:flex;gap:10px;align-items:center;margin-bottom:10px">
              <img class="community-avatar" src="${r.profile_photo||CONFIG.DEFAULT_AVATAR}" onerror="this.src='${CONFIG.DEFAULT_AVATAR}'" />
              <div style="flex:1;min-width:0">
                <div class="community-name">${r.name}</div>
                <div class="community-meta"><i class="fas fa-university"></i> ${r.institution||r.user_institution||'—'}</div>
              </div>
              <span class="gender-badge ${r.gender==='male'?'gender-male':'gender-female'}">${r.gender==='male'?'♂':'♀'}</span>
            </div>
            <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px">
              ${r.course?`<span class="tag tag-blue">📖 ${r.course}</span>`:''}
              ${r.year_of_study?`<span class="tag tag-purple">Year ${r.year_of_study}</span>`:''}
              ${r.budget_min&&r.budget_max?`<span class="tag tag-green">💰 ${formatKES(r.budget_min)}–${formatKES(r.budget_max)}</span>`:''}
              ${r.preferred_gender&&r.preferred_gender!=='any'?`<span class="tag tag-amber">Wants ${r.preferred_gender} roommate</span>`:'<span class="tag tag-amber">Open to anyone</span>'}
            </div>
            <p class="community-bio">${r.bio||'No bio provided.'}</p>
            ${r.move_in_date?`<div style="font-size:.76rem;color:var(--gray-400);margin-top:8px"><i class="fas fa-calendar"></i> Move in: ${formatDate(r.move_in_date)}</div>`:''}
            ${AUTH.isLoggedIn()&&AUTH.user.id!==r.student_id?`<button class="btn btn-sm btn-blue btn-block" style="margin-top:12px" onclick="ChatModule.openChat(${r.student_id},'${r.name}')"><i class="fas fa-comments"></i> Message ${r.name.split(' ')[0]}</button>`:''}
          </div>`).join('');
      } else {
        const res = await API.getStudyBuddies(inst?{institution:inst}:{});
        const items = res.data||[];
        if (!items.length) { grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="icon">📚</div><h3>No study buddy requests</h3>${AUTH.isStudent()?`<button class="btn btn-purple" onclick="navigate('dashboard')">Post Request</button>`:''}</div>`; return; }
        grid.innerHTML = items.map(b => `
          <div class="community-card slide-up">
            <div style="display:flex;gap:10px;align-items:center;margin-bottom:10px">
              <img class="community-avatar" src="${b.profile_photo||CONFIG.DEFAULT_AVATAR}" onerror="this.src='${CONFIG.DEFAULT_AVATAR}'" style="border-color:var(--purple-100)" />
              <div style="flex:1;min-width:0">
                <div class="community-name">${b.name}</div>
                <div class="community-meta" style="color:var(--purple-600)"><i class="fas fa-university"></i> ${b.institution}</div>
              </div>
            </div>
            <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px">
              <span class="tag tag-purple">📖 ${b.course}</span>
              ${b.user_year?`<span class="tag tag-blue">Year ${b.user_year}</span>`:''}
              ${b.study_style?`<span class="tag tag-amber">${b.study_style==='quiet'?'🤫 Quiet':b.study_style==='group'?'👥 Group':b.study_style==='discussions'?'💬 Discussions':'✨ Any style'}</span>`:''}
            </div>
            ${b.subjects?`<div style="font-size:.8rem;color:var(--gray-600);margin-bottom:8px"><strong>Subjects:</strong> ${b.subjects}</div>`:''}
            ${b.preferred_time?`<div style="font-size:.78rem;color:var(--purple-600);margin-bottom:6px"><i class="fas fa-clock"></i> ${b.preferred_time}</div>`:''}
            <p class="community-bio">${b.bio||'No bio provided.'}</p>
            ${AUTH.isLoggedIn()&&AUTH.user.id!==b.student_id?`<button class="btn btn-sm btn-purple btn-block" style="margin-top:12px" onclick="ChatModule.openChat(${b.student_id},'${b.name}')"><i class="fas fa-comments"></i> Connect with ${b.name.split(' ')[0]}</button>`:''}
          </div>`).join('');
      }
    } catch(e) { grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="icon">⚠️</div><h3>${e.message}</h3></div>`; }
  },
};