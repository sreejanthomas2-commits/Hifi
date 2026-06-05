// ── HOME FEED ────────────────────────────────────────────────────
function renderStories() {
  const el = $id('stories-row'); if (!el) return;
  const myStory = `<div class="story-item" onclick="openStoryComposer()"><div class="story-ring"><div class="story-inner" style="font-size:18px;background:var(--card2);display:grid;place-items:center;"><span class="material-symbols-rounded" style="color:var(--t3)">add</span></div></div><div class="story-name">Your Story</div></div>`;
  const stories = DATA.stories.map(s => {
    const iconData = get3DIconForEmoji(s.emoji);
    return `
    <div class="story-item" onclick="viewStory('${s.name}')">
      <div class="story-ring${s.seen?' seen':''}">
        <div class="story-inner" style="display:grid; place-items:center;">
          <span class="material-symbols-rounded emoji-3d" style="font-size:22px; color:${iconData.color}">${iconData.icon}</span>
        </div>
      </div>
      <div class="story-name">${s.name}</div>
    </div>`;
  }).join('');
  el.innerHTML = myStory + stories;
}

function renderFeed(query = '') {
  const el = $id('feed-posts'); if (!el) return;
  const q = (query || ($id('global-search') ? $id('global-search').value : '')).toLowerCase();
  
  let posts = DATA.posts;

  // Mode-based category filtering
  const modeCats = MODE_CATEGORY_MAP[S.feedMode || 'entertainment'];
  if (modeCats) {
    posts = posts.filter(p => modeCats.includes(p.category));
  }
  
  // Dual feed filter
  if (S.dualFeed === 'growth') {
    posts = posts.filter(p => ['tech','fitness','science','motivation'].includes(p.category));
  }
  
  const filtered = posts.filter(p => !q || p.body.toLowerCase().includes(q) || p.tags.join(' ').toLowerCase().includes(q));
  el.innerHTML = filtered.map(p => renderPostCard(p)).join('');
}

function renderPostCard(p) {
  // Setup Reality Score and Time Value metrics dynamically
  const tvMap = {
    1: { badge: '⏱️ 5m Learn = 2h Scroll', val: '5m = 2h Scroll' },
    2: { badge: '🔥 10m Gym = 1h Scroll', val: '10m = 1h Scroll' },
    3: { badge: '💡 1m Motivation = 30m Scroll', val: '1m = 30m Scroll' },
    4: { badge: '⏱️ 10m Study = 3h Scroll', val: '10m = 3h Scroll' },
    5: { badge: '💡 8m Design = 2.5h Scroll', val: '8m = 2.5h Scroll' },
    6: { badge: '🔥 5m Action = 1h Scroll', val: '5m = 1h Scroll' }
  };
  const rsMap = {
    1: { score: 94, bias: 'Center-Left', ai: 12, trust: 98 },
    2: { score: 99, bias: 'Center', ai: 2, trust: 97 },
    3: { score: 91, bias: 'Center', ai: 8, trust: 96 },
    4: { score: 97, bias: 'Center', ai: 5, trust: 99 },
    5: { score: 98, bias: 'Center', ai: 1, trust: 98 },
    6: { score: 95, bias: 'Center', ai: 4, trust: 97 }
  };
  const eliMap = {
    1: "I spent 3 weeks working hard and finally finished my cool computer project today! It feels so good to see it work! 🚀",
    2: "I woke up early and exercised. Starting your day with movement is super important to stay healthy! 💪",
    3: "Stop waiting for the perfect day to start making stuff. The best time was in the past, but the next best time is right now! Just go for it! 🌟",
    4: "Here are the smart robot helpers I use every day to brainstorm, draw pictures, write code, and organize my thoughts! What helpers do you use? 🤖",
    5: "Leaving blank space on a screen isn't wasting space. It gives your eyes a rest and makes the important parts look much cleaner and easier to read! 🎨",
    6: "I just ran super fast and beat my personal speed record! Working hard every day is totally worth it! Never give up! ⚡"
  };

  const tv = tvMap[p.id] || { badge: '⏱️ 2m Learn = 30m Scroll', val: '2m = 30m Scroll' };
  const rs = rsMap[p.id] || { score: 95, bias: 'Center', ai: 4, trust: 97 };
  const eliText = eliMap[p.id] || "This is a super simple, easy to understand version of my post. Hope you like it! ✨";

  // Use state to check if ELI15 is active for this post
  S.postEli15 = S.postEli15 || {};
  const isEli15Active = S.postEli15[p.id];
  const postBodyText = isEli15Active ? eliText : p.body;
  const eliBadge = isEli15Active ? `<span class="eli15-badge ml8">ELI15 Active ✨</span>` : '';

  const emojiBlock = p.emoji_block ? `<div class="post-emoji-block">${p.emoji_block}</div>` : '';
  const tags = p.tags.map(t => `<span class="post-tag">${t}</span>`).join('');
  
  let pollHTML = '';
  if (p.type === 'poll' && p.options) {
    const totalVotes = p.options.reduce((sum, opt) => sum + opt.votes, 0);
    pollHTML = '<div class="post-poll mt12">';
    p.options.forEach((opt, idx) => {
      const pct = totalVotes === 0 ? 0 : Math.round((opt.votes / totalVotes) * 100);
      const isWinner = totalVotes > 0 && opt.votes === Math.max(...p.options.map(o=>o.votes));
      pollHTML += `
        <div class="poll-option mb8" style="cursor:pointer; padding:8px; border:1px solid var(--border); border-radius:var(--r2); transition:var(--tr)" onclick="votePoll(${p.id}, ${idx})" onmouseover="this.style.background='var(--hover)'" onmouseout="this.style.background='transparent'">
          <div style="display:flex; justify-content:space-between; margin-bottom:6px; font-size:13px; font-weight:500; color:var(--t1)">
            <span>${opt.text}</span>
            <span>${pct}%</span>
          </div>
          <div class="poll-bar-bg" style="height:6px; background:rgba(255,255,255,0.05); border-radius:3px; overflow:hidden">
            <div class="poll-bar-fill" style="height:100%; width:${pct}%; background:${isWinner ? 'var(--blue)' : 'var(--t3)'}; transition:width 0.4s cubic-bezier(0.4, 0, 0.2, 1)"></div>
          </div>
        </div>
      `;
    });
    pollHTML += `<div class="fs11 tc-3 mt4">${totalVotes} votes</div></div>`;
  }

  return `
  <div class="post-card" id="post-${p.id}">
    <div class="post-header">
      <div class="avatar av-sm" style="background:var(--g-brand)">${p.emoji}</div>
      <div class="post-author" style="flex:1">
        <div class="post-author-name">${p.author} <span style="font-size:11px;color:var(--t3);font-weight:500">${p.handle}</span></div>
        <div class="post-meta">${formatRelativeTime(p.time)} · 🌐 Public</div>
      </div>
      
      <!-- Time Value and Reality Score indicators -->
      <div style="display:flex; align-items:center; gap:8px; margin-right:12px;">
        <span class="time-value-badge" title="Time Value Indicator: scroll efficiency ratio">${tv.badge}</span>
        <button class="reality-score-pill" onclick="toggleRealityScorecard(${p.id}, event)" title="Reality Score: Fact reliability & bias rating">
          <span class="material-symbols-rounded" style="font-size:14px">verified_user</span> ${rs.score}%
        </button>
      </div>
      
      <button class="icon-btn" style="width:30px;height:30px;font-size:14px" title="More">···</button>
    </div>
    
    <div class="post-body" id="post-body-${p.id}">${escapeHTML(postBodyText).replace(/\n/g,'<br>')} ${eliBadge}</div>
    ${emojiBlock}
    ${pollHTML}
    
    <!-- Reality Scorecard Drawer -->
    <div class="reality-score-scorecard hidden" id="scorecard-${p.id}" onclick="event.stopPropagation()">
      <div class="fw8 fs12 tc-1" style="border-bottom:1px solid var(--border); padding-bottom:6px; display:flex; align-items:center; gap:4px">
        <span class="material-symbols-rounded tc-green" style="font-size:16px">verified_user</span> Reality Score Verification Tally
      </div>
      
      <div class="reality-score-gauge-row mt4">
        <span class="tc-2">Fact Reliability:</span>
        <div class="reality-score-bar"><div class="reality-score-fill" style="width:${rs.score}%; background:var(--green)"></div></div>
        <strong class="tc-green">${rs.score}%</strong>
      </div>
      
      <div class="reality-score-gauge-row">
        <span class="tc-2">Rhetorical Bias:</span>
        <div class="reality-score-bar"><div class="reality-score-fill" style="width:100%; background:var(--blue)"></div></div>
        <strong class="tc-blue">${rs.bias}</strong>
      </div>
      
      <div class="reality-score-gauge-row">
        <span class="tc-2">AI-Gen Probability:</span>
        <div class="reality-score-bar"><div class="reality-score-fill" style="width:${rs.ai}%; background:var(--pink)"></div></div>
        <strong class="tc-pink">${rs.ai}%</strong>
      </div>
      
      <div class="reality-score-gauge-row">
        <span class="tc-2">Community Trust:</span>
        <div class="reality-score-bar"><div class="reality-score-fill" style="width:${rs.trust}%; background:var(--orange)"></div></div>
        <strong class="tc-orange">${rs.trust}%</strong>
      </div>
      <div class="fs10 tc-3 mt4 text-center">Verified via double-consensus ledger &amp; AI NLP validators.</div>
    </div>
    
    <div class="post-tags">${tags}</div>
    <div class="post-actions">
      <button class="post-act-btn${p.liked?' liked':''}" onclick="likePost(event, ${p.id})">
        <span class="material-symbols-rounded" style="font-size:16px; margin-right:4px; font-variation-settings: 'FILL' ${p.liked?1:0}">favorite</span> ${p.likes}
      </button>
      <button class="post-act-btn" onclick="toggleComments(${p.id})">
        <span class="material-symbols-rounded" style="font-size:16px; margin-right:4px">chat_bubble</span> ${p.comments}
      </button>
      <button class="post-act-btn" onclick="showToast('Post reshared! 🚀 ')">
        <span class="material-symbols-rounded" style="font-size:16px; margin-right:4px">sync</span> ${p.shares}
      </button>
      <button class="post-act-btn" onclick="togglePostELI15(${p.id}, event)" style="color:var(--orange)">
        <span class="material-symbols-rounded" style="font-size:16px; margin-right:4px">child_care</span> ELI15 Explainer
      </button>
      <button class="post-act-btn" onclick="narratePost(${p.id})">
        <span class="material-symbols-rounded" style="font-size:16px; margin-right:4px">volume_up</span> Narrate
      </button>
      <button class="post-act-btn" onclick="openTipModal('${p.author}', '${p.handle}')" style="color:var(--pink)">
        <span class="material-symbols-rounded" style="font-size:16px; margin-right:4px">volunteer_activism</span> Tip 💎
      </button>
      <button class="post-act-btn" style="margin-left:auto" onclick="showToast('Share link copied to clipboard! 📋')">
        <span class="material-symbols-rounded" style="font-size:16px">send</span>
      </button>
    </div>
  </div>`;
}

function toggleRealityScorecard(id, event) {
  if (event) event.stopPropagation();
  const el = $id(`scorecard-${id}`);
  if (!el) return;
  el.classList.toggle('hidden');
  
  // Haptic reaction burst
  if (typeof IX !== 'undefined' && IX.burstReaction) {
    const rect = event.target.getBoundingClientRect();
    IX.burstReaction('🛡️', rect.left + rect.width / 2, rect.top + rect.height / 2, 6);
  }
}

function togglePostELI15(id, event) {
  if (event) event.stopPropagation();
  S.postEli15 = S.postEli15 || {};
  S.postEli15[id] = !S.postEli15[id];
  
  // Rerender the specific post text in body
  const bodyEl = $id(`post-body-${id}`);
  if (!bodyEl) return;
  
  const eliMap = {
    1: "I spent 3 weeks working hard and finally finished my cool computer project today! It feels so good to see it work! 🚀",
    2: "I woke up early and exercised. Starting your day with movement is super important to stay healthy! 💪",
    3: "Stop waiting for the perfect day to start making stuff. The best time was in the past, but the next best time is right now! Just go for it! 🌟",
    4: "Here are the smart robot helpers I use every day to brainstorm, draw pictures, write code, and organize my thoughts! What helpers do you use? 🤖",
    5: "Leaving blank space on a screen isn't wasting space. It gives your eyes a rest and makes the important parts look much cleaner and easier to read! 🎨",
    6: "I just ran super fast and beat my personal speed record! Working hard every day is totally worth it! Never give up! ⚡"
  };
  const originalPost = DATA.posts.find(x => x.id === id);
  if (!originalPost) return;
  
  const eliText = eliMap[id] || "This is a super simple, easy to understand version of my post. Hope you like it! ✨";
  const textToShow = S.postEli15[id] ? eliText : originalPost.body;
  const eliBadge = S.postEli15[id] ? `<span class="eli15-badge ml8">ELI15 Active ✨</span>` : '';
  
  bodyEl.innerHTML = `${escapeHTML(textToShow).replace(/\n/g,'<br>')} ${eliBadge}`;
  
  showToast(S.postEli15[id] ? "ELI15 Mode: Simplified explanation active ✨" : "Original post text restored.");
  
  // Haptic reaction burst
  if (typeof IX !== 'undefined' && IX.burstReaction) {
    const rect = event.target.getBoundingClientRect();
    IX.burstReaction('💡', rect.left + rect.width / 2, rect.top + rect.height / 2, 6);
  }
}

function likePost(e, id) {
  
  const p = DATA.posts.find(x => x.id === id);
  if (!p) return;
  p.liked = !p.liked;
  p.likes += p.liked ? 1 : -1;
  
  if (p.liked && e && typeof IX !== 'undefined' && IX.burstReaction) {
    IX.burstReaction('❤️', e.clientX, e.clientY, 8);
  }
  
  savePostsToLocal();
  renderFeed();
}

function renderTrending() {
  const el = $id('trending-list'); if (!el) return;
  el.innerHTML = DATA.trending.map((t,i) => `
    <div class="trend-item" onclick="clickCategory('politics')">
      <div class="trend-rank">${i+1}</div>
      <div class="trend-info">
        <div class="trend-name">${t.name}</div>
        <div class="trend-count">${t.count}</div>
      </div>
      <div class="trend-icon">${t.icon}</div>
    </div>`).join('');
}

function renderWhoToFollow() {
  const el = $id('who-to-follow'); if (!el) return;
  if (!DATA.suggestedFriends) {
    DATA.suggestedFriends = [
      { id: 1, name: 'Sarah Chen', emoji: '\u2728', handle: '@sarahc', shared: ['Design', 'Tech'], match: '96%', state: 'add' },
      { id: 2, name: 'Marcus Webb', emoji: '\u2728', handle: '@marcusw', shared: ['Fitness', 'Gaming'], match: '88%', state: 'add' },
      { id: 3, name: 'Zara Ahmed', emoji: '\u2728', handle: '@zaraa', shared: ['Creator', 'Design'], match: '92%', state: 'add' },
      { id: 4, name: 'Dev Kumar', emoji: '\u2728', handle: '@devk', shared: ['Tech', 'Creator'], match: '90%', state: 'add' }
    ];
  }
  
  let friends = DATA.suggestedFriends;
  const names = MODE_PEOPLE_MAP[S.feedMode || 'entertainment'];
  if (names) {
    friends = friends.filter(f => names.includes(f.name));
  }
  if (!friends.length) friends = DATA.suggestedFriends;

  el.innerHTML = friends.map(f => {
    let btnHtml = '';
    if (f.state === 'add') {
      btnHtml = `<button class="btn btn-ghost btn-sm" onclick="sendFriendRequest(${f.id}, event)" style="color:var(--blue); font-weight:700">Add</button>`;
    } else if (f.state === 'pending') {
      btnHtml = `<span class="tc-3 fs11 fw7 flex-center" style="gap:4px">Pending ⏳</span>`;
    } else {
      btnHtml = `<span class="tc-green fs11 fw7 flex-center" style="gap:4px">Friends 🤝</span>`;
    }
    
    return `
    <div class="trend-item flex-between" style="padding:10px 0; border-bottom:1px solid var(--border)">
      <div class="flex gap8" style="align-items:center; flex:1; min-width:0">
        <div class="avatar av-xs" style="background:var(--g-brand); display:grid; place-items:center; color:#fff; font-size:12px; font-weight:700">${f.emoji}</div>
        <div style="flex:1; min-width:0">
          <div class="fw8 tc-1" style="font-size:12.5px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis">${f.name} <span class="badge badge-blue fs9" style="margin-left:4px; padding:2px 4px">${f.match} match</span></div>
          <div class="fs10 tc-3" style="margin-top:2px">Shared: ${f.shared.join(', ')}</div>
        </div>
      </div>
      <div>${btnHtml}</div>
    </div>`;
  }).join('');
}

function sendFriendRequest(id, event) {
  event.stopPropagation();
  const f = DATA.suggestedFriends.find(x => x.id === id);
  if (!f) return;
  
  f.state = 'pending';
  showToast(`Friend request sent to ${f.name}! 📬`);
  
  // Dynamic burst explosion
  if (typeof IX !== 'undefined' && IX.burstReaction) {
    IX.burstReaction('🤝', event.clientX, event.clientY, 8);
  }
  
  renderWhoToFollow();
  
  // Simulate acceptance after 3 seconds!
  setTimeout(() => {
    f.state = 'friends';
    showToast(`You and ${f.name} are now Friends! 🤝🎉`);
    renderWhoToFollow();
    
    // Burst hearts at the sidebar location
    const el = document.getElementById('who-to-follow');
    if (el && typeof IX !== 'undefined' && IX.burstReaction) {
      const rect = el.getBoundingClientRect();
      IX.burstReaction('💖', rect.left + rect.width / 2, rect.top + rect.height / 2, 8);
    }
  }, 3000);
}
function publishPost() {
  const input = $id('post-input'); if (!input) return;
  const text = input.value.trim();
  if (!text) { input.focus(); return; }
  const currentMode = S.feedMode || 'entertainment';
  const categoryToUse = (typeof MODE_CATEGORY_MAP !== 'undefined' && MODE_CATEGORY_MAP[currentMode]) ? MODE_CATEGORY_MAP[currentMode][0] : 'ent';
  const isAnon = S.anonymousMode;
  const authorName = isAnon ? 'Anonymous User' : (typeof S !== 'undefined' && S.user ? `${S.user.fname} ${S.user.lname}` : 'Alex Vance');
  const handleName = isAnon ? '@ghost_user' : (typeof S !== 'undefined' && S.user ? S.user.handle : '@alex_vance');

  const newPost = {
    id: Date.now(), author: authorName, handle: handleName, emoji:'\u2728',
    time: Date.now(), body: text, tags: ['#trending'], likes:0, comments:0, shares:0, liked:false, type:'text', category: categoryToUse
  };
  DATA.posts.unshift(newPost);
  input.value = '';
  savePostsToLocal();
  renderFeed();
}
function openPostComposer() { $id('post-input') && $id('post-input').focus(); }

function openStoryComposer() {
  let modal = document.getElementById('story-composer-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'story-composer-modal';
    modal.style.cssText = 'position:fixed; inset:0; z-index:99999; background:#000; display:flex; flex-direction:column; opacity:0; transition:opacity 0.3s ease; overflow:hidden;';
    document.body.appendChild(modal);
  }
  modal.innerHTML = `
    <!-- Video Background -->
    <video id="story-camera-feed" autoplay playsinline muted style="position:absolute; inset:0; width:100%; height:100%; object-fit:cover; z-index:1; transform:scaleX(-1);"></video>
    
    <!-- Dim Overlay for better text visibility -->
    <div style="position:absolute; inset:0; background:rgba(0,0,0,0.25); z-index:2;"></div>

    <!-- Top Left Navigation -->
    <div style="position:absolute; top:40px; left:20px; z-index:100000; display:flex; align-items:center;">
      <button class="icon-btn" onclick="closeStoryComposer()" style="background:rgba(0,0,0,0.5); color:#fff; backdrop-filter:blur(10px); width:40px; height:40px; border-radius:50%; display:flex; justify-content:center; align-items:center; border:1px solid rgba(255,255,255,0.2);">
        <span class="material-symbols-rounded">arrow_back</span>
      </button>
    </div>

    <!-- Top Right Vertical Toolbar -->
    <div style="position:absolute; top:40px; right:20px; z-index:100000; display:flex; flex-direction:column; gap:16px;">
      <button class="icon-btn" style="background:rgba(0,0,0,0.5); color:#fff; backdrop-filter:blur(10px); width:44px; height:44px; border-radius:50%; border:1px solid rgba(255,255,255,0.2);" onclick="document.getElementById('story-compose-input').focus()">
        <span class="material-symbols-rounded" style="font-size:22px;">match_case</span>
      </button>
      <button class="icon-btn" style="background:rgba(0,0,0,0.5); color:#fff; backdrop-filter:blur(10px); width:44px; height:44px; border-radius:50%; border:1px solid rgba(255,255,255,0.2);" onclick="showToast('Opening Stickers... 😊')">
        <span class="material-symbols-rounded" style="font-size:22px;">mood</span>
      </button>
      <button class="icon-btn" style="background:rgba(0,0,0,0.5); color:#fff; backdrop-filter:blur(10px); width:44px; height:44px; border-radius:50%; border:1px solid rgba(255,255,255,0.2);" onclick="showToast('Opening Music Library... 🎵')">
        <span class="material-symbols-rounded" style="font-size:22px;">music_note</span>
      </button>
      <button class="icon-btn" style="background:rgba(0,0,0,0.5); color:#fff; backdrop-filter:blur(10px); width:44px; height:44px; border-radius:50%; border:1px solid rgba(255,255,255,0.2);" onclick="showToast('Applying AI Filters... ✨')">
        <span class="material-symbols-rounded" style="font-size:22px;">auto_awesome</span>
      </button>
      <button class="icon-btn" style="background:rgba(0,0,0,0.5); color:#fff; backdrop-filter:blur(10px); width:44px; height:44px; border-radius:50%; border:1px solid rgba(255,255,255,0.2);" onclick="showToast('Tagging Creators... @')">
        <span class="material-symbols-rounded" style="font-size:22px;">alternate_email</span>
      </button>
      <button class="icon-btn" style="background:rgba(0,0,0,0.5); color:#fff; backdrop-filter:blur(10px); width:44px; height:44px; border-radius:50%; border:1px solid rgba(255,255,255,0.2);" onclick="showToast('Drawing Mode Enabled 🖌️')">
        <span class="material-symbols-rounded" style="font-size:22px;">draw</span>
      </button>
      <button class="icon-btn" style="background:rgba(0,0,0,0.5); color:#fff; backdrop-filter:blur(10px); width:44px; height:44px; border-radius:50%; border:1px solid rgba(255,255,255,0.2);" onclick="showToast('Draft Saved to Device! 💾')">
        <span class="material-symbols-rounded" style="font-size:22px;">download</span>
      </button>
    </div>
    
    <!-- Central Text Canvas -->
    <div style="flex:1; display:flex; align-items:center; justify-content:center; position:relative; z-index:10; pointer-events:none;">
      <textarea id="story-compose-input" placeholder="Type something amazing..." style="pointer-events:auto; background:transparent; border:none; outline:none; color:#fff; font-size:36px; font-weight:800; text-align:center; width:80%; resize:none; text-shadow:0 4px 16px rgba(0,0,0,0.6)" rows="3" autofocus></textarea>
    </div>

    <!-- Bottom Sharing Footer -->
    <div style="position:absolute; bottom:30px; left:20px; right:20px; z-index:100000; display:flex; justify-content:space-between; align-items:center;">
      <div style="display:flex; gap:16px;">
        <!-- Your Story -->
        <button class="btn" style="background:rgba(0,0,0,0.5); backdrop-filter:blur(10px); border:1px solid rgba(255,255,255,0.2); border-radius:30px; padding:8px 16px; display:flex; align-items:center; gap:8px; color:#fff; font-weight:600;" onclick="submitStory('Your Story')">
          <div style="width:24px; height:24px; border-radius:50%; background:var(--g-brand); display:grid; place-items:center; font-size:10px;">AV</div>
          Your Story
        </button>
        <!-- Close Friends -->
        <button class="btn" style="background:rgba(0,0,0,0.5); backdrop-filter:blur(10px); border:1px solid rgba(255,255,255,0.2); border-radius:30px; padding:8px 16px; display:flex; align-items:center; gap:8px; color:#fff; font-weight:600;" onclick="submitStory('Close Friends')">
          <div style="width:24px; height:24px; border-radius:50%; background:var(--green); display:grid; place-items:center;">
            <span class="material-symbols-rounded" style="font-size:16px; color:#fff;">stars</span>
          </div>
          Close Friends
        </button>
      </div>
      <!-- Send Button -->
      <button class="icon-btn" style="width:56px; height:56px; border-radius:50%; background:var(--blue); color:#fff; box-shadow:0 4px 16px rgba(33,150,243,0.4); display:grid; place-items:center; border:none;" onclick="submitStory('Direct Message')">
        <span class="material-symbols-rounded" style="font-size:28px;">send</span>
      </button>
    </div>
  `;
  modal.style.display = 'flex';
  setTimeout(() => modal.style.opacity = '1', 10);

  // Request Camera Access
  const videoEl = document.getElementById('story-camera-feed');
  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
      .then(function(stream) {
        window.currentStoryStream = stream;
        videoEl.srcObject = stream;
      })
      .catch(function(err) {
        console.warn("Camera access denied or unavailable: ", err);
        // Fallback gradient if camera fails
        videoEl.style.display = 'none';
        modal.style.background = 'linear-gradient(135deg, var(--g-brand))';
      });
  } else {
    videoEl.style.display = 'none';
    modal.style.background = 'linear-gradient(135deg, var(--g-brand))';
  }
}

function closeStoryComposer() {
  const modal = document.getElementById('story-composer-modal');
  if (modal) {
    modal.style.opacity = '0';
    setTimeout(() => {
      modal.style.display = 'none';
      // Stop camera stream to free up resources
      if (window.currentStoryStream) {
        window.currentStoryStream.getTracks().forEach(track => track.stop());
        window.currentStoryStream = null;
      }
    }, 300);
  }
}

function submitStory(destination = 'Your Story') {
  closeStoryComposer();
  showToast(`Shared to ${destination}! ✨`);
}
// ── INSTAGRAM-STYLE STORIES VIEWER CONTROLLER ──────────────────────
let storyTimerInterval = null;
let currentStoryIdx = -1;
let storyProgressPct = 0;
let storyPaused = false;

const STORY_CONTENTS = {
  'Sarah': { text: "Brewing some fresh code this morning! ☕💻 Let's build something incredible today.", handle: "@sarahc", time: "2h ago", bg: "linear-gradient(135deg, #1b122c, #4a1240)" },
  'Marcus': { text: "No excuses. 5 AM cardio session demolished! 🏋️💪 Consistency beats talent every single day.", handle: "@marcusw", time: "5h ago", bg: "linear-gradient(135deg, #0e1a2f, #114b3e)" },
  'Zara': { text: "Off to Tokyo! ✈️🇯🇵 Exploring new minimal UI design trends for the next dashboard. Stay tuned!", handle: "@zaraa", time: "8h ago", bg: "linear-gradient(135deg, #3d1b11, #5c2c16)" },
  'Tyler': { text: "Apex Legends championship tournament starts in 10 minutes! Wish me luck. 🎮🏆 #gaming", handle: "@tylerr", time: "10h ago", bg: "linear-gradient(135deg, #2b120c, #481912)" },
  'Mia': { text: "Working on a new digital speed-painting canvas piece. 🎨✨ Reveal is coming soon! #procreate", handle: "@miat", time: "12h ago", bg: "linear-gradient(135deg, #290c2b, #4b1a4a)" },
  'Dev': { text: "Refactoring the entire database caching layer. 💻⚙️ Muting alerts to enter flow state.", handle: "@devk", time: "14h ago", bg: "linear-gradient(135deg, #0c202b, #12404b)" },
  'Luna': { text: "Chasing quiet sunsets and finding deep breathing room in design. 🌅🧘 #calm", handle: "@lunap", time: "16h ago", bg: "linear-gradient(135deg, #0f0a21, #25123d)" },
  'Kai': { text: "Crushed my running speed record today! ⚡🔥 Training pays off. Never stop pushing.", handle: "@kaib", time: "18h ago", bg: "linear-gradient(135deg, #2b250c, #4e3f11)" }
};

function openStoryViewer(startIndex) {
  // Clear any existing timers
  if (storyTimerInterval) clearInterval(storyTimerInterval);
  storyPaused = false;
  storyProgressPct = 0;
  currentStoryIdx = startIndex;
  
  // Suppress background scroll
  document.body.style.overflow = 'hidden';
  
  // Remove if exists
  const existing = document.getElementById('stories-popup-overlay');
  if (existing) existing.remove();
  
  const story = DATA.stories[startIndex];
  const content = STORY_CONTENTS[story.name] || { text: `Checking out the universe with ${story.name}!`, handle: `@${story.name.toLowerCase()}`, time: "Just now", bg: "linear-gradient(135deg, #1b122c, #07040a)" };
  const iconData = get3DIconForEmoji(story.emoji);
  
  // Build progress bars
  const progressBarsHTML = DATA.stories.map((s, idx) => {
    let fillWidth = '0%';
    if (idx < startIndex) fillWidth = '100%';
    return `
      <div class="story-progress-bar">
        <div class="story-progress-fill" id="story-progress-fill-${idx}" style="width: ${fillWidth}"></div>
      </div>
    `;
  }).join('');
  
  const overlay = document.createElement('div');
  overlay.id = 'stories-popup-overlay';
  overlay.innerHTML = `
    <div class="story-popup-player" style="background: ${content.bg}">
      <!-- Progress Bar Container -->
      <div class="story-progress-container">
        ${progressBarsHTML}
      </div>
      
      <!-- Story Header -->
      <div class="story-popup-header">
        <div class="story-popup-avatar">${story.name.slice(0, 2).toUpperCase()}</div>
        <div>
          <div class="story-popup-username">${story.name}</div>
          <div class="story-popup-time">${content.time}</div>
        </div>
        <button class="story-popup-close" onclick="closeStoryViewer(event)" title="Close Story">
          <span class="material-symbols-rounded">close</span>
        </button>
      </div>
      
      <!-- Interactive Tap & Content Area -->
      <div class="story-popup-content-screen">
        <div class="story-popup-tap-zone-left" onclick="prevStory(event)"></div>
        <div class="story-popup-tap-zone-right" onclick="nextStory(event)"></div>
        
        <div class="story-popup-body">
          <div class="story-popup-emoji-container">
            <span class="material-symbols-rounded story-popup-emoji-3d" style="color: ${iconData.color}; text-shadow: 0 0 20px ${iconData.color}80">${iconData.icon}</span>
          </div>
          <div class="story-popup-text">"${content.text}"</div>
        </div>
      </div>
      
      <!-- Footer Reply Bar -->
      <div class="story-popup-footer">
        <input type="text" class="story-popup-input" id="story-reply-input" placeholder="Send a reply to ${story.name}..." onkeydown="handleStoryReplyKey(event, ${startIndex})" onclick="event.stopPropagation()">
        <button class="story-popup-send-btn" onclick="sendStoryReply(${startIndex}, event)">
          <span class="material-symbols-rounded">send</span>
        </button>
      </div>
    </div>
  `;
  
  document.body.appendChild(overlay);
  
  // Start the progress loop
  startStoryTimer();
}

function closeStoryViewer(event) {
  if (event) event.stopPropagation();
  document.body.style.overflow = '';
  if (storyTimerInterval) {
    clearInterval(storyTimerInterval);
    storyTimerInterval = null;
  }
  const overlay = document.getElementById('stories-popup-overlay');
  if (overlay) overlay.remove();
  currentStoryIdx = -1;
}

function startStoryTimer() {
  const fillElement = document.getElementById(`story-progress-fill-${currentStoryIdx}`);
  if (!fillElement) return;
  
  const tickTime = 40; // ms
  const totalDuration = 4000; // 4 seconds total
  const increments = totalDuration / tickTime;
  
  storyTimerInterval = setInterval(() => {
    if (storyPaused) return;
    
    storyProgressPct += (100 / increments);
    if (storyProgressPct >= 100) {
      storyProgressPct = 100;
      fillElement.style.width = '100%';
      clearInterval(storyTimerInterval);
      nextStory();
    } else {
      fillElement.style.width = `${storyProgressPct}%`;
    }
  }, tickTime);
}

function nextStory(event) {
  if (event) event.stopPropagation();
  if (storyTimerInterval) clearInterval(storyTimerInterval);
  
  const nextIdx = currentStoryIdx + 1;
  if (nextIdx < DATA.stories.length) {
    // Mark next story seen instantly as well
    DATA.stories[nextIdx].seen = true;
    renderStories();
    openStoryViewer(nextIdx);
  } else {
    closeStoryViewer();
  }
}

function prevStory(event) {
  if (event) event.stopPropagation();
  if (storyTimerInterval) clearInterval(storyTimerInterval);
  
  const prevIdx = currentStoryIdx - 1;
  if (prevIdx >= 0) {
    openStoryViewer(prevIdx);
  } else {
    // Reset timer on first slide
    openStoryViewer(0);
  }
}

function handleStoryReplyKey(event, idx) {
  event.stopPropagation();
  if (event.key === 'Enter') {
    sendStoryReply(idx, event);
  }
}

function sendStoryReply(idx, event) {
  if (event) event.stopPropagation();
  const input = document.getElementById('story-reply-input');
  if (!input) return;
  const reply = input.value.trim();
  if (!reply) return;
  
  const storyName = DATA.stories[idx].name;
  showToast(`Story reply sent to ${storyName}! 💬`);
  
  // Tactile visual feedback
  const rect = input.getBoundingClientRect();
  if (typeof IX !== 'undefined' && IX.burstReaction) {
    IX.burstReaction('📩', rect.left + rect.width / 2, rect.top - 20, 8);
  }
  
  input.value = '';
  // Close after brief response delay
  setTimeout(() => {
    closeStoryViewer();
  }, 100);
}

function viewStory(name) {
  const idx = DATA.stories.findIndex(s => s.name === name);
  if (idx !== -1) {
    DATA.stories[idx].seen = true;
    renderStories();
    openStoryViewer(idx);
  } else {
    showToast(`Viewing ${name}'s story ✨`);
  }
}

// ── EXPLORE ──────────────────────────────────────────────────────
function renderExplore() {
  const tg = $id('topic-grid');
  if (tg) {
    tg.innerHTML = DATA.topics.map(t => {
      const iconData = get3DIconForEmoji(t.emoji);
      return `
      <div class="topic-card" onclick="clickCategory('${t.cat || 'tech'}')">
        <div class="topic-emoji" style="display:grid; place-items:center; width:48px; height:48px; border-radius:var(--r2); background:var(--card2); border:1px solid var(--border)">
          <span class="material-symbols-rounded emoji-3d" style="font-size:24px; color:${iconData.color}">${iconData.icon}</span>
        </div>
        <div class="topic-name">${t.name}</div>
        <div class="topic-count" style="${t.live ? 'color:#34A853; font-weight:700' : ''}">${t.count} ${t.live ? '🔥 (Google Live)' : ''}</div>
      </div>`;
    }).join('');
  }
  const tc = $id('topic-chips');
  if (tc) {
    const cats = [
      { icon: 'local_fire_department', color: 'var(--orange)', label: 'Trending', filter: 'all' },
      { icon: 'smart_toy', color: 'var(--purple)', label: 'AI', filter: 'ai' },
      { icon: 'fitness_center', color: 'var(--green)', label: 'Fitness', filter: 'fitness' },
      { icon: 'sports_esports', color: 'var(--orange)', label: 'Gaming', filter: 'gaming' },
      { icon: 'public', color: 'var(--blue)', label: 'Travel', filter: 'travel' },
      { icon: 'palette', color: 'var(--pink)', label: 'Design', filter: 'design' },
      { icon: 'terminal', color: 'var(--blue)', label: 'Code', filter: 'tech' },
      { icon: 'restaurant', color: 'var(--orange)', label: 'Food', filter: 'food' }
    ];
    tc.innerHTML = cats.map((c,i) => `
      <span class="chip${i===0?' active':''}" onclick="filterTopicGrid('${c.filter}', this)" style="display:inline-flex; align-items:center; gap:4px">
        <span class="material-symbols-rounded" style="font-size:14px; color:${c.color}">${c.icon}</span>
        ${c.label}
      </span>`).join('');
  }
  const cg = $id('creator-grid');
  if (cg) {
    cg.innerHTML = DATA.users.map(u => {
      const initials = u.name.split(' ').map(n=>n[0]).join('');
      return `
      <div class="card" style="padding:14px;text-align:center;cursor:pointer;transition:var(--tr-spring)" onmouseover="this.style.transform='translateY(-3px)'" onmouseout="this.style.transform=''">
        <div class="avatar av-md" style="margin:0 auto 8px;background:var(--g-brand);display:grid;place-items:center;font-size:14px;font-weight:700;color:#fff">${initials}</div>
        <div style="font-size:13px;font-weight:700">${u.name}</div>
        <div style="font-size:11px;color:var(--t3)">${u.handle}</div>
        <button class="btn btn-primary btn-sm" style="margin-top:10px;width:100%" onclick="showToast('Following ${u.name}!')">Follow</button>
      </div>`;
    }).join('');
  }
}



function getFeedsTemplate() {
  return `<section id="pane-feeds" class="pane active">
        <!-- HORIZONTAL CATEGORY BAR -->
        <div class="category-scroll-bar" id="category-bar" style="margin-bottom: 16px;">
          <button class="cat-chip active" onclick="clickCategory('all')">All</button>
          <button class="cat-chip" onclick="clickCategory('science')"><span class="material-symbols-rounded" style="font-size:16px; vertical-align:middle; margin-right:4px">science</span>Science</button>
          <button class="cat-chip" onclick="clickCategory('politics')"><span class="material-symbols-rounded" style="font-size:16px; vertical-align:middle; margin-right:4px">newspaper</span>Politics &amp; News</button>
          <button class="cat-chip" onclick="clickCategory('crypto')"><span class="material-symbols-rounded" style="font-size:16px; vertical-align:middle; margin-right:4px">monetization_on</span>Crypto &amp; Finance</button>
          <button class="cat-chip" onclick="clickCategory('music')"><span class="material-symbols-rounded" style="font-size:16px; vertical-align:middle; margin-right:4px">music_note</span>Music</button>
          <button class="cat-chip" onclick="clickCategory('tech')"><span class="material-symbols-rounded" style="font-size:16px; vertical-align:middle; margin-right:4px">terminal</span>Tech &amp; AI</button>
          <button class="cat-chip" onclick="clickCategory('wildlife')"><span class="material-symbols-rounded" style="font-size:16px; vertical-align:middle; margin-right:4px">forest</span>Wildlife &amp; Nature</button>
          <button class="cat-chip" onclick="clickCategory('local')"><span class="material-symbols-rounded" style="font-size:16px; vertical-align:middle; margin-right:4px">location_on</span>Local Civic</button>
          <button class="cat-chip" onclick="toggleCategorySidebar()"><span class="material-symbols-rounded" style="font-size:16px; vertical-align:middle; margin-right:4px">folder</span>Expand All 50+</button>
        </div>

        <div class="flex-between mb16">
          <h1 class="pane-title" style="margin-bottom:0"><span>Home</span> Feed</h1>
          <!-- Dual Feed Toggle -->
          <div class="dual-feed-toggle">
            <button class="df-btn active" id="df-ent-btn" onclick="toggleDualFeed('entertainment')"><span class="material-symbols-rounded" style="font-size:14px; vertical-align:middle; margin-right:4px">theater_comedy</span>Entertainment</button>
            <button class="df-btn" id="df-gro-btn" onclick="toggleDualFeed('growth')"><span class="material-symbols-rounded" style="font-size:14px; vertical-align:middle; margin-right:4px">spa</span>Growth Feed</button>
          </div>
        </div>

        <!-- Sliding Feed Modes -->
        <div class="feed-modes-wrapper mb16">
          <span class="fs11 fw8 tc-3 mr8" style="text-transform:uppercase; letter-spacing:0.05em">Mode:</span>
          <div class="feed-modes-scroll" id="feed-modes">
            <button class="mode-btn active" onclick="switchFeedMode('entertainment')"><span class="material-symbols-rounded" style="font-size:14px; vertical-align:middle; margin-right:4px">theater_comedy</span>Entertainment</button>
            <button class="mode-btn" onclick="switchFeedMode('focus')"><span class="material-symbols-rounded" style="font-size:14px; vertical-align:middle; margin-right:4px">track_changes</span>Focus</button>
            <button class="mode-btn" onclick="switchFeedMode('study')"><span class="material-symbols-rounded" style="font-size:14px; vertical-align:middle; margin-right:4px">menu_book</span>Study</button>
            <button class="mode-btn" onclick="switchFeedMode('chill')"><span class="material-symbols-rounded" style="font-size:14px; vertical-align:middle; margin-right:4px">bedtime</span>Night Chill</button>
            <button class="mode-btn" onclick="switchFeedMode('motivation')"><span class="material-symbols-rounded" style="font-size:14px; vertical-align:middle; margin-right:4px">bolt</span>Motivation</button>
            <button class="mode-btn" onclick="switchFeedMode('news')"><span class="material-symbols-rounded" style="font-size:14px; vertical-align:middle; margin-right:4px">campaign</span>Breaking News</button>
            <button class="mode-btn" onclick="switchFeedMode('wellness')"><span class="material-symbols-rounded" style="font-size:14px; vertical-align:middle; margin-right:4px">self_improvement</span>Wellness</button>
            <button class="mode-btn" onclick="switchFeedMode('productivity')"><span class="material-symbols-rounded" style="font-size:14px; vertical-align:middle; margin-right:4px">trending_up</span>Productivity</button>
          </div>
        </div>

        <div class="home-layout">
          <!-- Left Column -->
          <div>
            <!-- Stories Row -->
            <div class="stories-row" id="stories-row"></div>

            <!-- Composer -->
            <div class="composer card">
              <div class="composer-row">
                <div class="avatar av-sm" id="composer-av">AV</div>
                <input class="composer-input" id="post-input" type="text" placeholder="What's trending with you today?">
              </div>
              <div id="composer-preview" style="display:none; padding:8px 12px; margin:8px 0; background:var(--surface); border-radius:var(--r2); border:1px solid var(--border); font-size:12px; color:var(--t2)"></div>
              <input type="file" id="composer-file-photo" accept="image/*" style="display:none" onchange="handleComposerFile(this, 'photo')">
              <input type="file" id="composer-file-video" accept="video/*" style="display:none" onchange="handleComposerFile(this, 'video')">
              <div class="composer-actions">
                <button class="composer-act-btn" onclick="document.getElementById('composer-file-photo').click()"><span class="material-symbols-rounded" style="font-size:16px; color:var(--blue); vertical-align:middle; margin-right:4px">photo_camera</span>Photo</button>
                <button class="composer-act-btn" onclick="document.getElementById('composer-file-video').click()"><span class="material-symbols-rounded" style="font-size:16px; color:var(--pink); vertical-align:middle; margin-right:4px">movie</span>Video</button>
                <button class="composer-act-btn" onclick="createPoll()"><span class="material-symbols-rounded" style="font-size:16px; color:var(--green); vertical-align:middle; margin-right:4px">bar_chart</span>Poll</button>
                <button class="btn btn-primary btn-sm" onclick="publishPost()" style="margin-left:auto">Post</button>
              </div>
            </div>

            <!-- Feed Posts -->
            <div id="feed-posts"></div>
          </div>

          <!-- Right Column -->
          <div class="trend-sidebar">
            <!-- Creator Wallet & Live Earnings Card -->
            <div class="trend-card mb12" style="background:linear-gradient(135deg, rgba(24, 25, 36, 0.9), rgba(155, 60, 44, 0.1)); border:1px solid var(--border)">
              <div class="section-hdr">
                <span class="section-title" style="display:flex; align-items:center; gap:6px"><span class="material-symbols-rounded" style="color:var(--orange)">payments</span> Creator Economy Wallet</span>
                <span class="badge badge-green">Active Share</span>
              </div>
              <div class="mt12">
                <div class="flex-between">
                  <span class="fs11 tc-3">Ecosystem Balance:</span>
                  <strong class="fs14 tc-1" id="ew-balance">1.842 BTC</strong>
                </div>
                <div class="flex-between mt4">
                  <span class="fs11 tc-3">Ad Share Earnings:</span>
                  <strong class="fs13 tc-green" id="ew-ad-share">$248.15</strong>
                </div>
                <div class="flex-between mt4">
                  <span class="fs11 tc-3">Escrow In Hold:</span>
                  <strong class="fs12 tc-blue" id="ew-escrow-hold">$0.00</strong>
                </div>
              </div>
              <div class="flex gap8 mt12">
                <button class="btn btn-primary btn-sm flex-center gap4" onclick="navigateTo('profile'); switchProfileTab('wallet');" style="flex:1"><span class="material-symbols-rounded" style="font-size:12px">account_balance_wallet</span> Open Wallet</button>
                <button class="btn btn-ghost btn-sm" onclick="simulateCreatorTip()" title="Tip active creator">🎁 Tip Creator</button>
              </div>
            </div>

            <!-- Mindfulness Widget -->
            <div class="trend-card mb12">
              <div class="section-hdr">
                <span class="section-title" style="display:flex; align-items:center; gap:6px"><span class="material-symbols-rounded" style="color:var(--green)">self_improvement</span> Mindfulness Space</span>
                <span class="badge badge-pink">Active</span>
              </div>
              <div class="wellness-stats mt8">
                <div class="flex-between fs12 mb8">
                  <span class="tc-2">Daily Screen Time Limit</span>
                  <span class="fw7 tc-blue" id="screen-time-val">18m / 45m</span>
                </div>
                <div class="progress-bar mb12"><div class="progress-fill" style="width: 40%; background: var(--blue)"></div></div>
                <div class="flex-between fs12 mb4">
                  <span class="tc-2">Emotional Balance Status</span>
                  <span class="fw7 tc-green" id="emotional-status">Calm &amp; Focused</span>
                </div>
                <div class="flex-between fs12">
                  <span class="tc-2">Focus Session Streak</span>
                  <span class="fw7 tc-pink" style="display:inline-flex; align-items:center; gap:4px">3 Days <span class="material-symbols-rounded" style="font-size:14px; color:var(--orange)">local_fire_department</span></span>
                </div>
              </div>
              <button class="btn btn-ghost btn-sm mt12" style="width:100%" onclick="startFocusSession()">Start 25m Focus Block</button>
            </div>

            <div class="trend-card">
              <div class="section-hdr">
                <span class="section-title" style="display:flex; align-items:center; gap:6px"><span class="material-symbols-rounded" style="color:var(--orange)">local_fire_department</span> Trending</span>
                <span class="section-link">See all</span>
              </div>
              <div id="trending-list"></div>
            </div>

            <div class="trend-card mt12">
              <div class="section-hdr">
                <span class="section-title" style="display:flex; align-items:center; gap:6px"><span class="material-symbols-rounded" style="color:var(--blue)">group_add</span> Suggested Friends</span>
              </div>
              <div id="who-to-follow"></div>
            </div>
          </div>
        </div>
      </section>`;
}

function handleComposerFile(input, type) {
  const file = input.files[0];
  if (!file) return;
  const preview = document.getElementById('composer-preview');
  if (preview) {
    preview.style.display = 'flex';
    preview.style.alignItems = 'center';
    preview.style.gap = '8px';
    const icon = type === 'photo' ? 'image' : 'videocam';
    const color = type === 'photo' ? 'var(--blue)' : 'var(--pink)';
    preview.innerHTML = `<span class="material-symbols-rounded" style="font-size:16px; color:${color}">${icon}</span> <span style="flex:1">${file.name}</span> <span style="cursor:pointer; color:var(--red); font-size:14px" onclick="clearComposerFile()">✕</span>`;
  }
  showToast(`${type === 'photo' ? '📸' : '🎬'} ${file.name} attached!`);
}

function clearComposerFile() {
  const preview = document.getElementById('composer-preview');
  if (preview) { preview.style.display = 'none'; preview.innerHTML = ''; }
  const pf = document.getElementById('composer-file-photo'); if (pf) pf.value = '';
  const vf = document.getElementById('composer-file-video'); if (vf) vf.value = '';
}

// ── POLL LOGIC ───────────────────────────────────────────────────
function createPoll() {
  const q = prompt('Enter your poll question:');
  if (!q) return;
  const opt1 = prompt('Enter Option 1:');
  if (!opt1) return;
  const opt2 = prompt('Enter Option 2:');
  if (!opt2) return;
  
  const newPost = {
    id: Date.now(),
    type: 'poll',
    author: S.user.fname + ' ' + S.user.lname,
    handle: S.user.handle,
    emoji: `${(S.user.fname||'A')[0]}${(S.user.lname||'V')[0]}`.toUpperCase(),
    body: q,
    tags: ['#poll', '#community'],
    likes: 0,
    comments: 0,
    shares: 0,
    category: S.feedMode || 'entertainment',
    options: [
      { text: opt1, votes: 0 },
      { text: opt2, votes: 0 }
    ]
  };
  
  DATA.posts.unshift(newPost);
  localStorage.setItem('ts_posts', JSON.stringify(DATA.posts));
  renderFeed();
  showToast('Poll published! dY"Z');
}

window.votePoll = function(postId, optIdx) {
  const p = DATA.posts.find(x => x.id === postId);
  if (!p || p.type !== 'poll') return;
  
  if (p.hasVoted) {
    showToast('You already voted on this poll.');
    return;
  }
  
  p.options[optIdx].votes++;
  p.hasVoted = true;
  localStorage.setItem('ts_posts', JSON.stringify(DATA.posts));
  
  renderFeed();
  showToast('Vote recorded!');
};

function filterTopicGrid(cat, chipEl) {
  // Update active chip
  if (chipEl) {
    chipEl.parentNode.querySelectorAll('.chip').forEach(x => x.classList.remove('active'));
    chipEl.classList.add('active');
  }
  
  // Filter topic cards
  const grid = $id('topic-grid');
  if (!grid) return;
  
  const cards = grid.querySelectorAll('.topic-card');
  cards.forEach(card => {
    const name = card.querySelector('.topic-name')?.textContent.toLowerCase() || '';
    
    // Map chip filter to topic names
    const filterMap = {
      'all': null,
      'ai': 'artificial intelligence',
      'fitness': 'fitness',
      'gaming': 'gaming',
      'travel': 'travel',
      'design': 'design',
      'tech': 'tech',
      'food': 'food',
      'music': 'music',
      'finance': 'finance',
      'startup': 'startup'
    };
    
    const filterTerm = filterMap[cat];
    if (!filterTerm) {
      // Show all
      card.style.display = '';
      card.style.opacity = '1';
      card.style.transform = '';
    } else if (name.includes(filterTerm)) {
      card.style.display = '';
      card.style.opacity = '1';
      card.style.transform = '';
    } else {
      card.style.display = 'none';
    }
  });
}
