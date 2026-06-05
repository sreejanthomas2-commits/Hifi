// ── CREATOR AI STUDIO TOOLS ──────────────────────────────────────
function renderCreator() {
  const bars = $id('analytics-bars'); if (bars) {
    const heights = [45,72,38,88,65,92,78];
    bars.innerHTML = heights.map(h => `<div class="chart-bar" style="height:${h}%" data-val="${h}%"></div>`).join('');
  }
  const sp = $id('scheduled-posts'); if (sp) {
    const posts = [
      { emoji:'\u2728', text:'My top 5 tools for 2025...', time:'Tomorrow 9:00 AM' },
      { emoji:'\u2728', text:'The mindset shift that changed everything', time:'Thu 2:00 PM' },
      { emoji:'\u2728', text:'Weekly challenge: Day 19 update', time:'Fri 7:00 PM' },
    ];
    sp.innerHTML = posts.map(p => `
      <div class="flex" style="gap:10px;padding:8px 0;border-bottom:1px solid var(--border);align-items:center">
        <span style="font-size:20px">${p.emoji}</span>
        <div style="flex:1;min-width:0">
          <div style="font-size:12.5px;font-weight:600;color:var(--t1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${p.text}</div>
          <div style="font-size:11px;color:var(--t3)">${p.time}</div>
        </div>
        <button class="icon-btn" style="font-size:13px" onclick="showToast('Editing post...')">✏️</button>
      </div>`).join('');
  }
}

function switchCreatorTab(tab) {
  S.activeCreatorTab = tab;
  document.querySelectorAll('#pane-creator .tab-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  const tIds = { composer:'ct-composer', thumbnail:'ct-thumbnail', dubber:'ct-dubber', clipper:'ct-clipper' };
  const targetBtn = $id(tIds[tab]);
  if (targetBtn) targetBtn.classList.add('active');
  
  $id('creator-tab-composer').classList.toggle('hidden', tab !== 'composer');
  $id('creator-tab-thumbnail').classList.toggle('hidden', tab !== 'thumbnail');
  $id('creator-tab-dubber').classList.toggle('hidden', tab !== 'dubber');
  $id('creator-tab-clipper').classList.toggle('hidden', tab !== 'clipper');
}

function generateMockThumbnail() {
  const prompt = $id('thumb-prompt').value.trim();
  const preview = $id('thumb-preview');
  if (!prompt) { showToast('Describe thumbnail prompt! 🎨'); return; }
  
  showToast('AI generating thumbnail...');
  preview.innerHTML = '⏳';
  
  setTimeout(() => {
    const icons = ['🌌','🚀','💻','🤖','🪙','🦖','🎭','📐'];
    const randomIcon = icons[Math.floor(Math.random()*icons.length)];
    preview.innerHTML = `${randomIcon} <span style="font-size:13px; font-weight:800; color:#fff">${prompt}</span>`;
    showToast('AI Thumbnail ready! 🎨');
    S.user.xp += 30;
    updateUserUI();
  }, 1400);
}

function simulateVoiceDubbing() {
  const lang = $id('dub-lang').value;
  const status = $id('dub-status');
  if (!status) return;
  
  showToast('Simulating multilingual dubbing...');
  status.textContent = '⏳ Dubbing tracks & matching frequencies...';
  
  setTimeout(() => {
    const names = { es:'Spanish 🇪🇸', ja:'Japanese 🇯🇵', fr:'French 🇫🇷', de:'German 🇩🇪', hi:'Hindi 🇮🇳' };
    status.innerHTML = `✅ Dubbing Complete! Track is now available in <strong class="tc-green">${names[lang]}</strong>. Player ready.`;
    showToast('Audio dub successfully rendered 🎙️');
    S.user.xp += 20;
    updateUserUI();
  }, 1600);
}

function simulateAutoClipping() {
  const out = $id('clip-output'); if (!out) return;
  
  showToast('Analyzing scene highlights...');
  out.innerHTML = '<span class="tc-2 fs12">⏳ AI scanning content and tracking facial expressions...</span>';
  
  setTimeout(() => {
    const clips = [
      { t: 'High energy drop', s: '0:14 - 0:29', x: '+50 XP' },
      { t: 'Key takeaway breakdown', s: '1:45 - 2:00', x: '+50 XP' }
    ];
    out.innerHTML = clips.map(c => `
      <div class="flex-between py4 card p8 mb4" style="background:var(--card2)">
        <div>
          <span class="fw7 fs12 tc-1">${c.t}</span>
          <span class="fs11 tc-blue font-bold ml8">${c.s}</span>
        </div>
        <button class="btn btn-ghost btn-sm" onclick="showToast('Exported to reels!')">Export Reel 🎬</button>
      </div>`).join('');
    showToast('Highlight scenes extracted!');
    S.user.xp += 40;
    updateUserUI();
  }, 1500);
}

function publishFromCreator() {
  const ta = $id('compose-text');
  const text = ta ? ta.value.trim() : '';
  if (!text) { showToast('Write something first! ✍️'); return; }
  
  const isAnon = S.anonymousMode;
  const authorName = isAnon ? 'Anonymous User' : (typeof S !== 'undefined' && S.user ? `${S.user.fname} ${S.user.lname}` : 'Alex Vance');
  const handleName = isAnon ? '@ghost_user' : (typeof S !== 'undefined' && S.user ? S.user.handle : '@alex_vance');
  
  const newPost = { id:Date.now(), author:authorName, handle:handleName, emoji:'\u2728', time:Date.now(), body:text, tags:['#creator'], likes:0, comments:0, shares:0, liked:false, type:'text', category:'tech' };
  DATA.posts.unshift(newPost);
  if (ta) ta.value = '';
  savePostsToLocal();
  if (typeof renderFeed === 'function') renderFeed();
  showToast('Published successfully! 🚀 Check your Home Feed.');
}

// ── ADVANCED MESSENGER & CALL SIMULATOR ──────────────────────────
let activeChat = 1;
function setupMessages() {
  renderConversations();
  loadChat(1);
  const btn = $id('send-msg-btn');
  if (btn) btn.addEventListener('click', sendMessage);
  const inp = $id('chat-input');
  if (inp) inp.addEventListener('keydown', e => { if (e.key==='Enter') sendMessage(); });
}

function filterChats(filter) {
  S.activeChatFilter = filter;
  document.querySelectorAll('.chat-tabs .tab-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  const mapBtn = { all:'chat-t-all', groups:'chat-t-group', channels:'chat-t-channel', bots:'chat-t-bot' };
  const target = $id(mapBtn[filter]);
  if (target) target.classList.add('active');
  renderConversations();
}

function renderConversations() {
  const el = $id('chat-list'); if (!el) return;
  let list = DATA.conversations;
  if (S.activeChatFilter !== 'all') {
    list = list.filter(c => c.type === S.activeChatFilter);
  }
  
  el.innerHTML = list.map(c => `
    <div class="chat-item${c.id===activeChat?' active':''}" onclick="loadChat(${c.id})">
      <div class="avatar" style="background:var(--g-brand); color:#fff; display:grid; place-items:center; font-size:24px">${c.emoji}</div>
      <div style="flex:1; min-width:0; border-bottom:1px solid rgba(255,255,255,0.05); padding-bottom:12px; margin-bottom:-12px;">
        <div style="display:flex; justify-content:space-between; align-items:center">
          <div class="chat-item-name">${c.name}</div>
          <div style="font-size:12px; color:${c.unread ? 'var(--wa-green)' : 'var(--wa-text-muted)'}">${c.id === 1 ? '10:42 AM' : 'Yesterday'}</div>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:4px">
          <div class="chat-item-preview" style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis">${c.online ? `<span style="color:var(--wa-green); font-weight:600">typing...</span>` : escapeHTML(c.preview)}</div>
          ${c.unread ? `<div style="background:var(--wa-green); color:#111b21; border-radius:50%; width:20px; height:20px; display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:700">${c.unread}</div>` : ''}
        </div>
      </div>
    </div>`).join('');
}

function loadChat(id) {
  activeChat = id;
  const conv = DATA.conversations.find(c=>c.id===id); if (!conv) return;
  conv.unread = 0;
  renderConversations();
  const hn = $id('chat-header-name'); if (hn) hn.textContent = conv.name;
  const ha = $id('chat-header-av');   if (ha) ha.textContent = conv.emoji;
  
  const status = $id('chat-header-status');
  if (status) {
    status.textContent = conv.online ? '● Online' : 'Offline';
    status.style.color = conv.online ? 'var(--green)' : 'var(--t3)';
  }
  
  renderMessages(id);
  renderQuickReplies(id);
}

function renderMessages(id) {
  const el = $id('chat-messages'); if (!el) return;
  const msgs = DATA.chatHistory[id] || [];
  el.innerHTML = msgs.map(m => `
    <div class="msg-bubble-wrap${m.me?' me':''}">
      <div class="msg-bubble">
        ${escapeHTML(m.text)}
        <div class="msg-time">
          ${m.time}
          ${m.me ? '<span class="material-symbols-rounded" style="font-size:14px; color:#53bdeb; margin-left:2px">done_all</span>' : ''}
        </div>
      </div>
    </div>`).join('');
  el.scrollTop = el.scrollHeight;
}

function renderQuickReplies(id) {
  const rEl = $id('chat-quick-replies'); if (!rEl) return;
  
  const replies = {
    1: ['Sounds great! See you there 🚀', 'Can you send the location details?', 'Nice, thanks Sarah!'],
    2: ['Leg day is a killer 💀', 'Gym again tomorrow?', 'Consistency is key.'],
    7: ['What can you write?', 'Give me coding tips.', 'Translate to French.']
  };
  
  const list = replies[id] || ['Perfect!', 'Awesome!', 'Talk later!'];
  rEl.innerHTML = list.map(text => `
    <button class="quick-reply-chip" onclick="sendQuickReplyText('${text.replace(/'/g,"\\'")}')">${text}</button>
  `).join('');
}

function sendQuickReplyText(text) {
  const inp = $id('chat-input');
  if (inp) { inp.value = text; sendMessage(); }
}

function sendMessage() {
  const inp = $id('chat-input'); if (!inp) return;
  const text = inp.value.trim(); if (!text) return;
  const now = new Date();
  const time = now.getHours()+':'+(now.getMinutes()+'').padStart(2,'0')+' '+((now.getHours()>=12)?'PM':'AM');
  if (!DATA.chatHistory[activeChat]) DATA.chatHistory[activeChat] = [];
  DATA.chatHistory[activeChat].push({ me:true, text, time });
  inp.value = '';
  renderMessages(activeChat);
  
  // Simulated Disappearing messages deletion
  if (S.disappearingMessages) {
    const msgRef = DATA.chatHistory[activeChat][DATA.chatHistory[activeChat].length - 1];
    setTimeout(() => {
      const idx = DATA.chatHistory[activeChat].indexOf(msgRef);
      if (idx !== -1) {
        DATA.chatHistory[activeChat].splice(idx, 1);
        renderMessages(activeChat);
        showToast('⏱️ Encrypted chat message expired & vanished.');
      }
    }, 6000);
  }
  
  // Auto reply after delay
  setTimeout(() => {
    const replies = ['That\'s awesome! 🔥','Totally agree!','Wow, really? Tell me more 👀','Haha that\'s so relatable 😂','Love that energy! 💪','Can\'t wait! 🚀'];
    const conv = DATA.conversations.find(c=>c.id===activeChat);
    const replyTime = now.getHours()+':'+(((now.getMinutes()+1)%60)+'').padStart(2,'0')+' '+((now.getHours()>=12)?'PM':'AM');
    
    let replyText = replies[Math.floor(Math.random()*replies.length)];
    if (activeChat === 7) {
      // AI bot response
      replyText = DATA.aiResponses[Math.floor(Math.random()*DATA.aiResponses.length)];
    }
    
    DATA.chatHistory[activeChat].push({ me:false, text:replyText, time:replyTime });
    renderMessages(activeChat);
  }, 1200 + Math.random()*800);
}

// Disappearing messages
function toggleDisappearingMessages() {
  S.disappearingMessages = !S.disappearingMessages;
  showToast(S.disappearingMessages ? '⏱️ Disappearing messages active (6s lifetime)' : '⏱️ Disappearing messages disabled');
  
  if (S.disappearingMessages) {
    if (!DATA.chatHistory[activeChat]) DATA.chatHistory[activeChat] = [];
    DATA.chatHistory[activeChat].push({ me:false, text: '⏱️ Disappearing messages turned on. Chats expire in 6 seconds.', time: 'System Alert' });
    renderMessages(activeChat);
  }
}

// Calling and attachment overlays
function toggleAttachmentMenu() {
  const m = $id('chat-attach-menu');
  if (m) m.classList.toggle('hidden');
}
function sendMockAttachment(type) {
  toggleAttachmentMenu();
  const inp = $id('chat-input'); if (!inp) return;
  
  const tags = { image: 'Shared an HD Photo 📷', document: 'Shared a Project PDF Document 📄', location: 'Sent current coordinates 📍' };
  inp.value = tags[type];
  sendMessage();
}



function getCreatorTemplate() {
  return `<section id="pane-creator" class="pane">
        <h1 class="pane-title" style="display:flex; align-items:center; gap:10px">
          <span class="material-symbols-rounded emoji-3d" style="font-size:32px; color:var(--pink)">auto_awesome</span>
          <span>Creator</span> Studio
        </h1>

        <div class="creator-layout">
          <!-- Left -->
          <div>
            <div class="compose-card">
              <div class="compose-title" style="display:flex; align-items:center; gap:6px"><span class="material-symbols-rounded" style="color:var(--blue)">construction</span> AI Creator Tools</div>
              <div class="tabs mb12">
                <button class="tab-btn active" id="ct-composer" onclick="switchCreatorTab('composer')">Composer</button>
                <button class="tab-btn flex-center gap4" id="ct-thumbnail" onclick="switchCreatorTab('thumbnail')" style="display:inline-flex; align-items:center; gap:4px">
                  Thumbnail AI <span class="material-symbols-rounded" style="font-size:14px">photo_camera</span>
                </button>
                <button class="tab-btn flex-center gap4" id="ct-dubber" onclick="switchCreatorTab('dubber')" style="display:inline-flex; align-items:center; gap:4px">
                  Voice Dubber <span class="material-symbols-rounded" style="font-size:14px">mic</span>
                </button>
                <button class="tab-btn flex-center gap4" id="ct-clipper" onclick="switchCreatorTab('clipper')" style="display:inline-flex; align-items:center; gap:4px">
                  Auto Clipper <span class="material-symbols-rounded" style="font-size:14px">movie</span>
                </button>
              </div>
              
              <div id="creator-tab-content">
                <!-- Composer Tab -->
                <div id="creator-tab-composer" class="creator-tab-pane">
                  <textarea class="compose-textarea" id="compose-text" placeholder="Share your thoughts, ideas, or content with the world..."></textarea>
                  <div class="compose-actions">
                    <div class="compose-tools" style="display:flex; gap:6px">
                      <button class="compose-tool flex-center" title="Photo" style="display:grid; place-items:center"><span class="material-symbols-rounded" style="font-size:16px">photo_camera</span></button>
                      <button class="compose-tool flex-center" title="Video" style="display:grid; place-items:center"><span class="material-symbols-rounded" style="font-size:16px">movie</span></button>
                      <button class="compose-tool flex-center" title="Poll" style="display:grid; place-items:center"><span class="material-symbols-rounded" style="font-size:16px">bar_chart</span></button>
                      <button class="compose-tool flex-center" title="Tag" style="display:grid; place-items:center"><span class="material-symbols-rounded" style="font-size:16px">label</span></button>
                      <button class="compose-tool flex-center" title="Emoji" style="display:grid; place-items:center"><span class="material-symbols-rounded" style="font-size:16px">sentiment_satisfied</span></button>
                    </div>
                    <button class="btn btn-primary flex-center gap4" onclick="publishFromCreator()" style="display:inline-flex; align-items:center; gap:4px">
                      <span class="material-symbols-rounded" style="font-size:16px">send</span> Publish
                    </button>
                  </div>
                </div>
                
                <!-- Thumbnail Tab -->
                <div id="creator-tab-thumbnail" class="creator-tab-pane hidden">
                  <div class="flex flex-col gap8">
                    <input class="input" type="text" id="thumb-prompt" placeholder="Describe your video theme (e.g., Space Travel)...">
                    <button class="btn btn-primary" onclick="generateMockThumbnail()">Generate Thumbnail</button>
                    <div class="thumb-preview card flex-center mt8" id="thumb-preview" style="height:120px; background:var(--card2)">
                      <span class="material-symbols-rounded emoji-3d" style="font-size:48px; color:var(--blue)">image</span>
                    </div>
                  </div>
                </div>
                
                <!-- Dubber Tab -->
                <div id="creator-tab-dubber" class="creator-tab-pane hidden">
                  <div class="flex flex-col gap8">
                    <select class="input" id="dub-lang">
                      <option value="es">Spanish (Español)</option>
                      <option value="ja">Japanese (日本語)</option>
                      <option value="fr">French (Français)</option>
                      <option value="de">German (Deutsch)</option>
                      <option value="hi">Hindi (हिन्दी)</option>
                    </select>
                    <button class="btn btn-primary" onclick="simulateVoiceDubbing()">Dub Video Audio</button>
                    <div id="dub-status" class="tc-2 fs12 mt8">Select language and click Dub Video.</div>
                  </div>
                </div>
                
                <!-- Clipper Tab -->
                <div id="creator-tab-clipper" class="creator-tab-pane hidden">
                  <div class="flex flex-col gap8">
                    <p class="tc-2 fs12">Extract the top engaging moments from your video automatically into Reels.</p>
                    <button class="btn btn-primary" onclick="simulateAutoClipping()">Find High-Energy Scenes</button>
                    <div id="clip-output" class="flex flex-col gap4 mt8"></div>
                  </div>
                </div>
              </div>
            </div>

            <div class="analytics-chart">
              <div class="section-hdr">
                <span class="section-title" style="display:flex; align-items:center; gap:6px"><span class="material-symbols-rounded" style="color:var(--purple)">bar_chart</span> Weekly Analytics</span>
              </div>
              <div class="grid-4 mt12">
                <div class="stat-card">
                  <div class="stat-val tc-blue">12.4K</div>
                  <div class="stat-lbl">Views</div>
                </div>
                <div class="stat-card">
                  <div class="stat-val tc-pink">847</div>
                  <div class="stat-lbl">Likes</div>
                </div>
                <div class="stat-card">
                  <div class="stat-val tc-green">234</div>
                  <div class="stat-lbl">Shares</div>
                </div>
                <div class="stat-card">
                  <div class="stat-val" style="color:var(--purple)">156</div>
                  <div class="stat-lbl">Comments</div>
                </div>
              </div>
              <div class="chart-bars" id="analytics-bars"></div>
              <div class="flex mt4">
                <span class="chart-bar-day">Mon</span>
                <span class="chart-bar-day">Tue</span>
                <span class="chart-bar-day">Wed</span>
                <span class="chart-bar-day">Thu</span>
                <span class="chart-bar-day">Fri</span>
                <span class="chart-bar-day">Sat</span>
                <span class="chart-bar-day">Sun</span>
              </div>
            </div>
          </div>

          <!-- Right -->
          <div>
            <div class="card" style="padding:16px;margin-bottom:14px">
              <div class="section-hdr">
                <span class="section-title" style="display:flex; align-items:center; gap:6px"><span class="material-symbols-rounded" style="color:var(--green)">monetization_on</span> Partner Earnings</span>
                <span class="badge badge-green">$348.50</span>
              </div>
              <div class="creator-stat-row flex-between fs12 mb4">
                <span class="tc-2">Ad Revenue Share</span>
                <span class="fw7 tc-blue">$214.20</span>
              </div>
              <div class="creator-stat-row flex-between fs12 mb4">
                <span class="tc-2">Memberships &amp; Tips</span>
                <span class="fw7">$94.30</span>
              </div>
              <div class="creator-stat-row flex-between fs12">
                <span class="tc-2">Crowdfund Pools</span>
                <span class="fw7 tc-pink">$40.00</span>
              </div>
            </div>

            <div class="card" style="padding:16px;margin-bottom:14px">
              <div class="section-hdr">
                <span class="section-title" style="display:flex; align-items:center; gap:6px"><span class="material-symbols-rounded" style="color:var(--blue)">bar_chart</span> Creator Stats</span>
              </div>
              <div class="creator-stat-row">
                <span class="tc-2 fs13">Followers</span>
                <span class="fw7 tc-blue">28.4K</span>
              </div>
              <div class="creator-stat-row">
                <span class="tc-2 fs13">Following</span>
                <span class="fw7">892</span>
              </div>
              <div class="creator-stat-row">
                <span class="tc-2 fs13">Posts</span>
                <span class="fw7">347</span>
              </div>
            </div>

            <div class="card" style="padding:16px">
              <div class="section-hdr">
                <span class="section-title" style="display:flex; align-items:center; gap:6px"><span class="material-symbols-rounded" style="color:var(--blue)">calendar_month</span> Scheduled</span>
              </div>
              <div id="scheduled-posts"></div>
            </div>
          </div>
        </div>
      </section>`;
}

