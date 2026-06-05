// ── COMMUNITY ────────────────────────────────────────────────────────
function renderCommunity() {
  const gg = $id('group-grid'); if (gg) {
    gg.innerHTML = DATA.groups.map(g => `
      <div class="group-card">
        <div class="group-emoji">
          <span class="material-symbols-rounded emoji-3d" style="font-size:24px; color:${g.iconColor}">${g.icon}</span>
        </div>
        <div class="group-name">${g.name}</div>
        <div class="group-desc">${g.desc}</div>
        <div class="group-meta">
          <span class="group-members" style="display:inline-flex; align-items:center; gap:4px">
            <span class="material-symbols-rounded" style="font-size:16px; color:var(--t3)">groups</span>
            ${g.members} members
          </span>
          <button class="btn${g.joined?' btn-ghost':' btn-primary'} btn-sm" onclick="joinGroup(this,'${g.name}')">${g.joined?'✓ Joined':'Join'}</button>
        </div>
      </div>`).join('');
  }
  const cl = $id('community-leaderboard'); if (cl) {
    cl.innerHTML = DATA.leaderboard.map((p,i) => {
      let rankHTML = '';
      if (i === 0) {
        rankHTML = `<span class="material-symbols-rounded emoji-3d" style="color:var(--orange); font-size:22px; font-variation-settings:'FILL' 1">workspace_premium</span>`;
      } else if (i === 1) {
        rankHTML = `<span class="material-symbols-rounded emoji-3d" style="color:hsl(217, 10%, 75%); font-size:22px; font-variation-settings:'FILL' 1">workspace_premium</span>`;
      } else if (i === 2) {
        rankHTML = `<span class="material-symbols-rounded emoji-3d" style="color:hsl(35, 60%, 50%); font-size:22px; font-variation-settings:'FILL' 1">workspace_premium</span>`;
      } else {
        rankHTML = `<span style="font-size:13px; font-weight:700; color:var(--t3); width:32px; text-align:center">${i + 1}</span>`;
      }
      const initials = p.name.split(' ').map(n=>n[0]).join('');
      return `
        <div class="lb-item">
          <div class="lb-rank${i===0?' gold':i===1?' silver':i===2?' bronze':''}">${rankHTML}</div>
          <div class="avatar av-xs" style="background:var(--g-brand); display:grid; place-items:center; font-size:10px; font-weight:700; color:#fff">${initials}</div>
          <div class="lb-name">${p.name}</div>
          <div class="lb-score">${p.score}</div>
        </div>`;
    }).join('');
  }
}

function openCreateGroupModal() {
  let modal = document.getElementById('create-group-modal');
  if (!modal) {
    const html = `
      <div id="create-group-modal" class="modal-backdrop" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); display:grid; place-items:center; z-index:9999;">
        <div class="card p20" style="width:90%; max-width:400px; background:var(--bg);">
          <div class="flex-between mb16">
            <h3 class="fw8 tc-1" style="display:flex; align-items:center; gap:8px"><span class="material-symbols-rounded emoji-3d" style="color:var(--orange)">add_circle</span> Create New Group</h3>
            <button class="btn btn-ghost btn-sm" onclick="closeCreateGroupModal()">o </button>
          </div>
          <form onsubmit="submitCreateGroup(event)" class="flex flex-col gap12">
            <input type="text" id="cg-name" class="input" placeholder="Group Name" required>
            <textarea id="cg-desc" class="input" placeholder="Group Description" rows="2" required></textarea>
            <div class="grid-2 gap12">
              <input type="text" id="cg-icon" class="input" placeholder="Emoji (e.g. oS)">
              <input type="text" id="cg-color" class="input" placeholder="Color (e.g. var(--blue))" value="var(--blue)">
            </div>
            <button type="submit" class="btn btn-primary" style="width:100%">Create Group</button>
          </form>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', html);
    modal = document.getElementById('create-group-modal');
  }
  modal.style.display = 'grid';
}

function closeCreateGroupModal() {
  const modal = document.getElementById('create-group-modal');
  if (modal) modal.style.display = 'none';
}

function submitCreateGroup(e) {
  e.preventDefault();
  const name = document.getElementById('cg-name').value;
  const desc = document.getElementById('cg-desc').value;
  const icon = document.getElementById('cg-icon').value || 'groups';
  const color = document.getElementById('cg-color').value || 'var(--blue)';

  DATA.groups.unshift({
    name, desc, icon, iconColor: color, members: 1, joined: true
  });

  closeCreateGroupModal();
  showToast('Group Created successfully! oS');
  
  if (typeof IX !== 'undefined' && IX.burstReaction) {
    IX.burstReaction('dY~ ', window.innerWidth/2, window.innerHeight/2, 8);
  }
  
  renderCommunity();
}

function joinGroup(btn, name) {
  const g = DATA.groups.find(g=>g.name===name);
  if (g) { g.joined = !g.joined; }
  btn.textContent = btn.textContent.includes('Join') ? '✓ Joined' : 'Join';
  btn.classList.toggle('btn-primary'); btn.classList.toggle('btn-ghost');
  showToast(btn.textContent.includes('Joined') ? `Joined ${name}!` : `Left ${name}`);
}

/* --- Civic Help Hub Toggles & Active Volunteering --- */
function switchCommunityTab(tab) {
  document.querySelectorAll('#pane-community .tabs button').forEach(btn => {
    btn.classList.remove('active');
  });
  
  const tabBtnIds = {
    all: 'com-t-all',
    wellness: 'com-t-wellness',
    startup: 'com-t-startup',
    civic: 'com-t-civic'
  };
  const activeBtn = $id(tabBtnIds[tab]);
  if (activeBtn) activeBtn.classList.add('active');
  
  $id('community-main-view')?.classList.toggle('hidden', tab !== 'all');
  $id('community-wellness-view')?.classList.toggle('hidden', tab !== 'wellness');
  $id('community-startup-view')?.classList.toggle('hidden', tab !== 'startup');
  $id('community-civic-view')?.classList.toggle('hidden', tab !== 'civic');
  
  if (tab === 'civic') {
    renderCivicHubList();
  }
}

function renderCivicHubList() {
  const el = $id('civic-feed-list');
  if (!el) return;
  
  if (!S.civicReports || S.civicReports.length === 0) {
    el.innerHTML = `<div class="tc-center tc-3 p24">No active hyperlocal reports. Good job city! 🌟</div>`;
    return;
  }
  
  el.innerHTML = S.civicReports.map(r => {
    let actionBtn = '';
    let statusClass = 'tc-blue';
    if (r.status === 'Tracked') {
      actionBtn = `<button class="btn btn-ghost btn-sm flex-center gap4" onclick="volunteerForCivic(${r.id}, event)" style="border-color:var(--green); color:var(--green)">
        <span class="material-symbols-rounded" style="font-size:14px">volunteer_activism</span> Apply Volunteer
      </button>`;
      statusClass = 'tc-pink';
    } else if (r.status.includes('Progress')) {
      actionBtn = `<span class="civic-volunteer-badge"><span class="material-symbols-rounded animate-spin" style="font-size:12px">sync</span> Solver Active</span>`;
      statusClass = 'tc-blue';
    } else {
      actionBtn = `<span class="tc-green fs11 fw7 flex-center" style="gap:4px">Resolved ✓</span>`;
      statusClass = 'tc-green';
    }
    
    return `
      <div class="civic-card flex flex-col gap8">
        <div class="civic-card-header">
          <span class="badge badge-blue fs10">${r.type}</span>
          <span class="fs11 fw8 ${statusClass}">${r.status}</span>
        </div>
        <div class="fs13 tc-1 fw6">${escapeHTML(r.text)}</div>
        <div class="flex-between mt8" style="border-top:1px solid var(--border); padding-top:10px; align-items:center;">
          <div class="fs10 tc-3">Proximity: <strong>${escapeHTML(r.location)}</strong> · Target: <strong>${r.authority}</strong></div>
          <div>${actionBtn}</div>
        </div>
      </div>
    `;
  }).join('');
}

function volunteerForCivic(id, event) {
  if (event) event.stopPropagation();
  const r = S.civicReports.find(x => x.id === id);
  if (!r) return;
  
  r.status = 'In Progress 🤝';
  showToast(`Ecosystem Match: Assigned you to solve ${r.type}! 🤝`);
  renderCivicHubList();
  
  if (typeof IX !== 'undefined' && IX.burstReaction) {
    const rect = event.target.getBoundingClientRect();
    IX.burstReaction('🤝', rect.left + rect.width / 2, rect.top + rect.height / 2, 6);
  }
  
  // Simulate consensus resolver after 3 seconds
  setTimeout(() => {
    r.status = 'Resolved ✅';
    S.user = S.user || { xp: 0 };
    S.user.xp += 100;
    updateUserUI();
    showToast(`Consensus: Issue "${r.type}" resolved! Earned +100 XP 🏆`);
    renderCivicHubList();
    
    // Confetti
    if (typeof IX !== 'undefined' && IX.burstReaction) {
      IX.burstReaction('🎉', window.innerWidth/2, window.innerHeight/2, 10);
    }
  }, 3000);
}

function submitCivicHubReport(event) {
  if (event) event.preventDefault();
  const type = $id('civic-hub-type').value;
  const desc = $id('civic-hub-desc').value.trim();
  const loc = $id('civic-hub-loc').value.trim();
  
  if (!desc || !loc) {
    showToast('Describe the issue and specify location! 📢');
    return;
  }
  
  const auths = {
    'Road Damage': '@CityTransit',
    'Lost Pet': '@AnimalCare',
    'Flood Alert': '@DrainageBoard',
    'Scam Warning': '@PublicSafety',
    'Blood Donation': '@RedCross'
  };
  
  const report = {
    id: Date.now(),
    type,
    text: desc,
    location: loc,
    status: 'Tracked',
    authority: auths[type] || '@CityCouncil'
  };
  
  S.civicReports = S.civicReports || [];
  S.civicReports.unshift(report);
  
  $id('civic-hub-desc').value = '';
  $id('civic-hub-loc').value = '';
  
  showToast(`Concern Broadcasted! Alerted ${report.authority} 📢`);
  renderCivicHubList();
  
  if (typeof IX !== 'undefined' && IX.burstReaction) {
    const rect = event.target.getBoundingClientRect();
    IX.burstReaction('📢', rect.left + rect.width / 2, rect.top + rect.height / 2, 6);
  }
}



function getCommunityTemplate() {
  return `<section id="pane-community" class="pane">
        <h1 class="pane-title" style="display:flex; align-items:center; gap:10px">
          <span class="material-symbols-rounded emoji-3d" style="font-size:32px; color:var(--blue)">groups</span>
          <span>Community</span> Ecosystem
        </h1>

        <div class="tabs mb16">
          <button class="tab-btn active flex-center" id="com-t-all" onclick="switchCommunityTab('all')" style="display:inline-flex; align-items:center; gap:4px">
            <span class="material-symbols-rounded emoji-3d" style="font-size:16px">explore</span> Discovery &amp; Groups
          </button>
          <button class="tab-btn flex-center" id="com-t-wellness" onclick="switchCommunityTab('wellness')" style="display:inline-flex; align-items:center; gap:4px">
            <span class="material-symbols-rounded emoji-3d" style="font-size:16px">spa</span> Wellness Focus
          </button>
          <button class="tab-btn flex-center" id="com-t-startup" onclick="switchCommunityTab('startup')" style="display:inline-flex; align-items:center; gap:4px">
            <span class="material-symbols-rounded emoji-3d" style="font-size:16px">rocket_launch</span> Startup Matcher
          </button>
          <button class="tab-btn flex-center" id="com-t-civic" onclick="switchCommunityTab('civic')" style="display:inline-flex; align-items:center; gap:4px">
            <span class="material-symbols-rounded emoji-3d" style="font-size:16px">volunteer_activism</span> Hyperlocal Civic
          </button>
        </div>

        <div id="community-main-view">
          <div class="section-hdr">
            <span class="section-title" style="display:flex; align-items:center; gap:6px">
              <span class="material-symbols-rounded emoji-3d" style="font-size:20px; color:var(--orange)">local_fire_department</span> Active Groups
            </span>
            <button class="btn btn-ghost btn-sm flex-center gap4" onclick="openCreateGroupModal()" style="display:inline-flex; align-items:center; gap:4px">
              <span class="material-symbols-rounded emoji-3d" style="font-size:16px">add</span> Create Group
            </button>
          </div>
          <div class="group-grid" id="group-grid"></div>

          <div class="grid-2 mt20" style="gap:20px">
            <!-- Weekly Challenge -->
            <div>
              <div class="section-hdr">
                <span class="section-title" style="display:flex; align-items:center; gap:6px">
                  <span class="material-symbols-rounded emoji-3d" style="font-size:20px; color:var(--orange)">emoji_events</span> Weekly Challenge
                </span>
              </div>
              <div class="card" style="padding:20px">
                <div style="text-align:center; margin-bottom:12px; display:grid; place-items:center">
                  <span class="material-symbols-rounded emoji-3d" style="font-size:48px; color:var(--purple)">rocket_launch</span>
                </div>
                <div style="font-size:15px; font-weight:800; margin-bottom:8px">30 Day Creator Sprint</div>
                <p class="tc-2 fs13">Post daily for 30 days and win exclusive badges + 10,000 XP</p>
                <div class="progress-bar mt12 mb8">
                  <div class="progress-fill" style="width:63%"></div>
                </div>
                <div class="flex-between fs12">
                  <span class="tc-3">Day 19 of 30</span>
                  <span class="tc-blue">63% Complete</span>
                </div>
                <button class="btn btn-primary mt12 flex-center gap4" style="width:100%; display:inline-flex; justify-content:center; align-items:center; gap:4px">
                  Join Challenge <span class="material-symbols-rounded" style="font-size:16px">east</span>
                </button>
              </div>
            </div>

            <!-- Leaderboard -->
            <div>
              <div class="section-hdr">
                <span class="section-title" style="display:flex; align-items:center; gap:6px">
                  <span class="material-symbols-rounded emoji-3d" style="font-size:20px; color:var(--purple)">leaderboard</span> Leaderboard
                </span>
              </div>
              <div class="card" style="padding:16px">
                <div id="community-leaderboard"></div>
              </div>
            </div>
          </div>
        </div>

        <!-- Wellness focus: guided breathing bubble -->
        <div id="community-wellness-view" class="hidden">
          <div class="grid-2 gap20" style="align-items:center">
            <div class="card p20 text-center">
              <h3 class="fw8 mb12 tc-1 text-left" style="display:flex; align-items:center; gap:6px">
                <span class="material-symbols-rounded emoji-3d" style="font-size:24px; color:var(--blue)">spa</span> Guided 4-7-8 Breathing
              </h3>
              <p class="tc-2 fs12 mb20">A scientifically backed relaxation technique to reset focus:</p>
              
              <!-- Expanding/Contracting Breathing Bubble -->
              <div class="flex-center" style="height:180px">
                <div class="breathing-circle-wrapper" id="breath-node">
                  <div class="breathing-glow-bubble" id="breath-bubble"></div>
                  <div class="breathing-glow-inner" style="display:grid; place-items:center; color:var(--blue)">
                    <span class="material-symbols-rounded emoji-3d" style="font-size:28px">spa</span>
                  </div>
                </div>
              </div>
              
              <h4 class="fw8 tc-blue mt16" id="breath-instructions">Inhale through nose... (4s)</h4>
              <p class="tc-3 fs11 mt4" id="breath-cycle-count">Cycle: 0 / 4</p>
              
              <div class="flex-center gap8 mt16">
                <button class="btn btn-primary btn-sm flex-center gap4" id="breath-start-btn" onclick="toggleBreathingGuide()" style="display:inline-flex; align-items:center; gap:4px">
                  <span class="material-symbols-rounded emoji-3d" style="font-size:16px">play_arrow</span> Start Guide
                </button>
                <button class="btn btn-ghost btn-sm" onclick="resetBreathingGuide()">Reset</button>
              </div>
            </div>
            
            <div class="card p20">
              <h3 class="fw8 mb12 tc-1" style="display:flex; align-items:center; gap:6px">
                <span class="material-symbols-rounded emoji-3d" style="font-size:24px; color:var(--pink)">psychology</span> Wellness Daily Tips
              </h3>
              <div class="flex flex-col gap8">
                <div class="py8" style="border-bottom:1px solid var(--border)">
                  <div class="fw7 fs12 tc-1">Hydration reminder alerts</div>
                  <div class="fs11 tc-3">Drinking water increases cognitive capacity by 14%. Keep logging your macros!</div>
                </div>
                <div class="py8" style="border-bottom:1px solid var(--border)">
                  <div class="fw7 fs12 tc-1">Digital Detox intervals</div>
                  <div class="fs11 tc-3">Mute notifications for 60m daily to restore neuro-balance.</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Startup Matcher: swiper cards -->
        <div id="community-startup-view" class="hidden">
          <div class="flex-center flex-col gap16">
            <div class="section-hdr" style="width:100%; max-width:400px">
              <span class="section-title" style="display:flex; align-items:center; gap:6px">
                <span class="material-symbols-rounded emoji-3d" style="font-size:20px; color:var(--purple)">rocket_launch</span> Startup Matcher
              </span>
              <span class="badge badge-purple">AI Pitch Analysis</span>
            </div>
            
            <!-- Swiper Card Container -->
            <div class="card p24 text-center swiper-card-wrapper" id="startup-swiper-node" style="width:100%; max-width:400px; background:var(--card2)">
              <div style="margin-bottom:12px; display:grid; place-items:center" id="su-emoji">
                <span class="material-symbols-rounded emoji-3d" style="font-size:52px; color:var(--blue)">rocket_launch</span>
              </div>
              <h3 class="fw8 tc-1" id="su-name">SpaceCrafting</h3>
              <p class="tc-3 fs11 mb12" id="su-founders">Founded by @astro_dave · Tech</p>
              <div class="eli15-card text-left mb16" id="su-pitch" style="min-height:72px">
                "We are building a Web3 satellite bandwidth sharing protocol so anybody can lease small sat dishes globally in minutes."
              </div>
              <div class="flex gap8 mt12">
                <button class="btn btn-ghost flex-center gap4" onclick="swipeStartup('left')" style="flex:1; display:inline-flex; align-items:center; justify-content:center; gap:4px">
                  <span class="material-symbols-rounded" style="font-size:16px">close</span> Skip
                </button>
                <button class="btn btn-primary flex-center gap4" onclick="swipeStartup('right')" style="flex:1; background:var(--pink); border:none; display:inline-flex; align-items:center; justify-content:center; gap:4px">
                  <span class="material-symbols-rounded" style="font-size:16px">favorite</span> Pitch / Match
                </button>
              </div>
            </div>
            
            <div class="card p16 text-center" style="width:100%; max-width:400px; background:var(--surface); border-style:dashed" id="su-feedback">
              Swipe Skip or Pitch to trigger matching feedback logs!
            </div>
          </div>
        </div>

        <!-- Hyperlocal Problem Solver Hub -->
        <div id="community-civic-view" class="hidden">
          <div class="grid-2 gap20">
            <!-- Left Column: Active Local Concerns -->
            <div class="card p20">
              <h3 class="fw8 mb12 tc-1" style="display:flex; align-items:center; gap:6px">
                <span class="material-symbols-rounded emoji-3d" style="font-size:24px; color:var(--pink)">campaign</span> Active Local Concerns Ledger
              </h3>
              <p class="tc-2 fs12 mb16">Real-time community-sourced alerts, volunteer gig matches, and civic broadcast protocols.</p>
              
              <div id="civic-feed-list" class="flex flex-col gap12" style="max-height:450px; overflow-y:auto; padding-right:4px">
                <!-- Rendered dynamically -->
              </div>
            </div>

            <!-- Right Column: Broadcast & Badges -->
            <div class="flex flex-col gap16">
              <div class="card p20">
                <h3 class="fw8 mb12 tc-1" style="display:flex; align-items:center; gap:6px">
                  <span class="material-symbols-rounded emoji-3d" style="font-size:24px; color:var(--blue)">spatial_tracking</span> Broadcast New Concern
                </h3>
                <p class="tc-2 fs12 mb16">Pinpoint a location and notify volunteer solvers or community dispatchers.</p>
                
                <form onsubmit="submitCivicHubReport(event)" class="flex flex-col gap12">
                  <div class="form-group">
                    <label class="form-label" style="font-size:10px">Concern Category</label>
                    <select id="civic-hub-type" class="input">
                      <option value="Road Damage">🚧 Road Damage / Pothole</option>
                      <option value="Lost Pet">🐕 Lost &amp; Found Pet</option>
                      <option value="Flood Alert">🌊 Local Flood / Weather</option>
                      <option value="Scam Warning">⚠️ Local Scam Alert</option>
                      <option value="Blood Donation">🩸 Blood Donation Request</option>
                    </select>
                  </div>
                  
                  <div class="form-group">
                    <label class="form-label" style="font-size:10px">Description Details</label>
                    <textarea id="civic-hub-desc" class="input" rows="3" placeholder="Explain the situation in details for community solvers..." required></textarea>
                  </div>
                  
                  <div class="form-group">
                    <label class="form-label" style="font-size:10px">Proximity / Location</label>
                    <input type="text" id="civic-hub-loc" class="input" placeholder="e.g. 5th Ave &amp; Broadway, Tokyo" required />
                  </div>
                  
                  <button type="submit" class="btn btn-primary flex-center gap4 mt8" style="width:100%">
                    <span class="material-symbols-rounded" style="font-size:16px">campaign</span> Broadcast Concern Alert
                  </button>
                </form>
              </div>

              <!-- Ecosystem Badges Tracker -->
              <div class="card p20">
                <h3 class="fw8 mb12 tc-1" style="display:flex; align-items:center; gap:6px">
                  <span class="material-symbols-rounded emoji-3d" style="font-size:24px; color:var(--orange)">workspace_premium</span> Solver Badges
                </h3>
                <div class="grid-2 gap8">
                  <div class="badge-item flex-center flex-col p8" style="background:var(--surface); border-radius:var(--r2); border:1px solid var(--border)">
                    <span class="emoji-3d" style="font-size:20px">🛡️</span>
                    <span class="fw7 fs10 tc-1 mt4">Local Guardian</span>
                  </div>
                  <div class="badge-item flex-center flex-col p8" style="background:var(--surface); border-radius:var(--r2); border:1px solid var(--border)">
                    <span class="emoji-3d" style="font-size:20px">🌟</span>
                    <span class="fw7 fs10 tc-1 mt4">Ecosystem Hero</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>`;
}

