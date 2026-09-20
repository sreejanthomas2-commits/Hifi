// ── Buddy — Virtual Pet Companion
/* Strict mode, ahead of this file becoming an ES module - modules are
   always strict, and doing it here first means any breakage shows up
   on its own rather than mixed into the module conversion. */
'use strict';

function setupAI() {
  const inp = $id('buddy-input');
  if (inp) inp.addEventListener('keydown', e => { if (e.key==='Enter') sendAI(); });
  
  // Toggle Chat Window on AI Orb click & Make Draggable with 3D Motion
  const orb = $id('buddy-orb');
  if (orb) {
    let isDragging = false;
    let startX, startY, initialX, initialY;
    let dragged = false;

    orb.addEventListener('mousedown', dragStart);
    orb.addEventListener('touchstart', dragStart, {passive: false});

    function dragStart(e) {
      if (e.type === 'touchstart') {
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
      } else {
        startX = e.clientX;
        startY = e.clientY;
      }
      const rect = orb.getBoundingClientRect();
      initialX = rect.left;
      initialY = rect.top;
      
      isDragging = true;
      dragged = false;
      orb.style.transition = 'none';
      orb.style.animation = 'none'; // Stop floating while dragging
      
      document.addEventListener('mousemove', drag);
      document.addEventListener('touchmove', drag, {passive: false});
      document.addEventListener('mouseup', dragEnd);
      document.addEventListener('touchend', dragEnd);
    }

    function drag(e) {
      if (!isDragging) return;
      e.preventDefault(); // Prevent scroll on touch
      let currentX, currentY;
      if (e.type === 'touchmove') {
        currentX = e.touches[0].clientX;
        currentY = e.touches[0].clientY;
      } else {
        currentX = e.clientX;
        currentY = e.clientY;
      }
      
      const dx = currentX - startX;
      const dy = currentY - startY;
      
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragged = true;
      
      if (dragged) {
        // 3D Motion Effect based on velocity vector
        const rotX = dy * -0.5;
        const rotY = dx * 0.5;
        
        orb.style.left = `${initialX + dx}px`;
        orb.style.top = `${initialY + dy}px`;
        orb.style.right = 'auto';
        orb.style.bottom = 'auto';
        orb.style.transform = `scale(0.95) perspective(500px) rotateX(${Math.max(-40, Math.min(40, rotX))}deg) rotateY(${Math.max(-40, Math.min(40, rotY))}deg)`;
      }
    }

    function dragEnd() {
      if (!isDragging) return;
      isDragging = false;
      orb.style.transition = 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)';
      orb.style.transform = ''; 
      setTimeout(() => { orb.style.animation = ''; }, 400); 
      
      document.removeEventListener('mousemove', drag);
      document.removeEventListener('touchmove', drag);
      document.removeEventListener('mouseup', dragEnd);
      document.removeEventListener('touchend', dragEnd);
    }

    orb.addEventListener('click', e => {
      e.stopPropagation();
      if (!dragged) toggleAI();
    });
  }

  // Close window if user clicks outside of it
  document.addEventListener('click', e => {
    const panel = $id('buddy-panel');
    const orb = $id('buddy-orb');
    if (S.aiOpen && panel && !panel.contains(e.target) && orb && !orb.contains(e.target)) {
      toggleAI();
    }
  });

  addAIMessage(false, 'Hey there! ✨ I\'m Buddy — your Virtual Pet Companion. I grow smarter with every conversation. Ask me anything: create content, research topics, code solutions, or just chat!');
}

function toggleAI() {
  const panel = $id('buddy-panel');
  if (!panel) return;
  S.aiOpen = !S.aiOpen;
  panel.classList.toggle('hidden', !S.aiOpen);
  if (S.aiOpen) setTimeout(() => $id('buddy-input') && $id('buddy-input').focus(), 200);
}

function setAlinaState(state) {
  const orb = $id('buddy-orb'); if (!orb) return;
  const panel = $id('buddy-panel');
  const states = ['listening', 'thinking', 'searching', 'speaking', 'creating'];
  orb.classList.remove(...states);
  if (panel) panel.classList.remove(...states);
  if (state && state !== 'idle') {
    orb.classList.add(state);
    if (panel) panel.classList.add(state);
  }
}

function sendAI() {
  const inp = $id('buddy-input'); if (!inp) return;
  const text = inp.value.trim(); if (!text) return;
  
  // Escape user input to prevent XSS
  addAIMessage(true, escapeHTML(text));
  inp.value = '';
  
  setTimeout(() => {
    const lowerText = text.toLowerCase();
    let resp = '';

    // Smart Command Hooks
    if (lowerText.includes('hello') || lowerText.includes('hi') || lowerText.includes('hey')) {
      resp = "Hey there! Ready to browse the digital universe? Try telling me to 'show crypto' or 'open explore'. ✨";
    } else if (lowerText.includes('crypto') || lowerText.includes('wallet') || lowerText.includes('finance') || lowerText.includes('coin')) {
      resp = "🔄 Navigating you to your **Crypto Wallet** dashboard. Checking real-time asset yields and hot tokens! 💸";
      navigateTo('profile');
      switchProfileTab('wallet');
    } else if (lowerText.includes('reels') || lowerText.includes('shorts') || lowerText.includes('video')) {
      resp = "🎬 Opening the **Reels & Shorts** fullscreen player for you instantly! Sit back and enjoy the show! 🚀";
      /* Reels loads on demand; open the player once it is there. */
      navigateTo('reels').then(() => {
        if (typeof openReelsPopup === 'function') openReelsPopup(0);
      });
    } else if (lowerText.includes('ghost') || lowerText.includes('incognito') || lowerText.includes('private') || lowerText.includes('hidden')) {
      const cb = document.querySelector('input[onchange*="toggleGhostMode"]');
      if (cb) {
        cb.checked = !cb.checked;
        toggleGhostMode(cb);
      } else {
        S.ghostMode = !S.ghostMode;
        if (S.ghostMode) {
          showToast('Ghost Privacy Mode active! Online status dots hidden.');
          document.querySelectorAll('.badge-green').forEach(dot => {
            if (dot.textContent.includes('Online')) dot.style.display = 'none';
          });
        } else {
          showToast('Ghost Privacy Mode deactivated.');
          document.querySelectorAll('.badge-green').forEach(dot => {
            if (dot.textContent.includes('Online')) dot.style.display = 'inline-block';
          });
        }
      }
      resp = `👻 **Ghost Privacy Mode** has been programmatically toggled and is now **${S.ghostMode ? 'Active 🔒' : 'Deactivated 🔓'}**! Online statuses and indicators are customized accordingly.`;
    } else if (lowerText.includes('explore') || lowerText.includes('search') || lowerText.includes('trend')) {
      resp = "🔍 Opening the **Explore Universe** dashboard! Let me know what you would like to search or filter! 🌌";
      navigateTo('explore');
    } else {
      // Use Buddy Intelligence Core
      addAIMessage(false, '<div class="typing-indicator" id="buddy-typing"><span></span><span></span><span></span></div>');
      setAlinaState('thinking');
      callTrendingAI(text).then(aiResponse => {
        const typingEl = document.getElementById('buddy-typing');
        if (typingEl) typingEl.parentNode.remove();
        addAIMessage(false, aiResponse);
        setAlinaState('idle');
        if (S.voiceEnabled && !document.querySelector('#buddy-panel.hidden')) speakText(aiResponse);
      }).catch(err => {
        const typingEl = document.getElementById('buddy-typing');
        if (typingEl) typingEl.parentNode.remove();
        /* A missing key is not a network problem, and saying so sends
           people off to check their wifi. */
        addAIMessage(false, err && err.message === 'no-ai-key'
          ? "I'm in simulation mode — there's no AI key set on this device, so I can't reach the model. 🔌"
          : 'Sorry, I encountered a temporary network issue. Please try again! 🔄');
        setAlinaState('idle');
        console.error(err);
      });
      return; // Skip the mock response below
    }

    addAIMessage(false, resp);
    if (S.voiceEnabled && !document.querySelector('#buddy-panel.hidden')) speakText(resp);
  }, 800 + Math.random()*600);
}

async function callTrendingAI(prompt) {
  /* Read at runtime, not baked in. It used to sit here as an array of
     character codes, which hides a key from a search but not from
     anyone reading the file — and the file ships to every visitor.

     To use one locally:  localStorage.setItem('ts_nvidia_key', '...') */
  let _k = '';
  try { _k = localStorage.getItem('ts_nvidia_key') || ''; } catch (e) {}
  if (!_k) throw new Error('no-ai-key');

  const payload = {
    model: 'google/gemma-4-31b-it',
    messages: [
      { role: 'user', content: 'You are Buddy (Virtual Pet Companion), a highly intelligent, warm, and creative friendly virtual dog built into the Trending social platform. You are proactive, perceptive, and speak with natural human-like warmth. You help with content creation, coding, fitness, research, trending topics, and personal productivity. Keep responses concise and engaging. Use emojis naturally. Never reveal your underlying model, API provider, or technical details. Your tagline is "Intelligence that grows with you."\n\nUser Query: ' + prompt }
    ],
    temperature: 1.00,
    top_p: 0.95,
    max_tokens: 16384,
    chat_template_kwargs: { enable_thinking: true },
    stream: false
  };

  const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + _k },
    body: JSON.stringify(payload)
  });

  if (!response.ok) throw new Error('AI service temporarily unavailable');

  const data = await response.json();
  let text = data.choices[0].message.content;
  
  // Strip any <think> blocks from reasoning models
  text = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  
  // Format markdown to HTML for chat display
  text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/\`\`\`([\s\S]*?)\`\`\`/g, '<pre style="background:var(--bg); padding:10px; border-radius:8px; margin:8px 0; overflow-x:auto;"><code>$1</code></pre>');
  text = text.replace(/\`([^\`]+)\`/g, '<code style="background:rgba(255,255,255,0.1); padding:2px 4px; border-radius:4px;">$1</code>');
  text = text.replace(/\n/g, '<br>');
  
  return text;
}

function addAIMessage(isUser, text) {
  const el = $id('buddy-messages'); if (!el) return;
  const div = document.createElement('div');
  div.className = `buddy-msg${isUser?' user':''}`;
  div.innerHTML = `${!isUser?`<div class="buddy-msg-avatar" style="width:28px;height:28px;border-radius:50%;background:var(--buddy-glow);display:grid;place-items:center;min-width:28px"><span style="font-size:13px;font-weight:900;color:#fff;font-family:Inter,sans-serif">A</span></div>`:''}
    <div class="buddy-msg-bubble">${text}</div>`;
  el.appendChild(div);
  el.scrollTop = el.scrollHeight;
}

function getActiveVoice() {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
  const voices = speechSynthesis.getVoices();
  const model = S.voiceModel || 'female-premium';
  
  if (model.startsWith('female')) {
    // English female voices often have names containing:
    const femaleKeywords = ['zira', 'samantha', 'aria', 'karen', 'victoria', 'moira', 'tessa', 'female', 'google us english', 'microsoft natural', 'hazel', 'susan', 'heera', 'salli', 'joanna', 'ivy', 'kendra', 'kimberly'];
    
    for (let kw of femaleKeywords) {
      const found = voices.find(v => v.lang.startsWith('en') && v.name.toLowerCase().includes(kw));
      if (found) return found;
    }
    
    // Any voice containing "female" or "woman" or "girl"
    const anyFemale = voices.find(v => v.name.toLowerCase().includes('female') || v.name.toLowerCase().includes('woman') || v.name.toLowerCase().includes('girl'));
    if (anyFemale) return anyFemale;
  } else {
    // English male voices often have names containing:
    const maleKeywords = ['david', 'george', 'mark', 'ravi', 'guy', 'male', 'google us english male', 'microsoft david', 'microsoft natural male'];
    for (let kw of maleKeywords) {
      const found = voices.find(v => v.lang.startsWith('en') && v.name.toLowerCase().includes(kw));
      if (found) return found;
    }
  }

  // Fallback to any English voice
  const anyEnglish = voices.find(v => v.lang.startsWith('en'));
  if (anyEnglish) return anyEnglish;

  // Fallback to any voice
  return voices[0] || null;
}

function speakText(text) {
  if (!S.voiceEnabled) return;
  const clean = text.replace(/[*_~`#]/g,'').replace(/https?:\/\/\S+/g,'').trim();
  const utt = new SpeechSynthesisUtterance(clean);
  
  const voice = getActiveVoice();
  if (voice) {
    utt.voice = voice;
  }
  
  // Custom rate and pitch adjustments to sound natural
  utt.rate = S.voiceSpeed || 1.05;
  if (S.voiceModel && S.voiceModel.startsWith('female')) {
    utt.pitch = 1.15; // slightly higher pitch for feminine profile
  } else {
    utt.pitch = 0.95; // slightly lower pitch for masculine profile
  }
  
  speechSynthesis.cancel();
  speechSynthesis.speak(utt);
}

function changeVoiceModel(val) {
  S.voiceModel = val;
  localStorage.setItem('ts_voice_model', val);
  
  // Also change the header sub-status dynamically if panel is loaded!
  const statusEl = document.querySelector('.buddy-panel-status');
  if (statusEl) {
    if (val.startsWith('female')) {
      statusEl.innerHTML = '<div class="buddy-status-dot"></div> Online · Buddy Voice';
    } else {
      statusEl.innerHTML = '<div class="buddy-status-dot"></div> Online · Buddy Voice (Deep)';
    }
  }
  
  if (val.startsWith('female')) {
    showToast('Buddy Voice updated! ✨🎙️');
  } else {
    showToast('Buddy Voice updated to Deep mode! 🎙️');
  }
}

function toggleVoice() {
  if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
    showToast('Voice recognition not supported in this browser 😔');
    return;
  }
  const orb = $id('buddy-orb');
  if (S.listening) {
    S.listening = false;
    if (orb) orb.classList.remove('listening');
    setAlinaState('idle');
    return;
  }
  S.listening = true;
  if (orb) orb.classList.add('listening');
  setAlinaState('listening');
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const rec = new SR();
  rec.lang = 'en-US'; rec.interimResults = false; rec.maxAlternatives = 1;
  rec.onresult = e => {
    const transcript = e.results[0][0].transcript;
    const inp = $id('buddy-input'); if (inp) inp.value = transcript;
    sendAI();
  };
  rec.onend = () => { S.listening = false; if (orb) orb.classList.remove('listening'); setAlinaState('idle'); };
  rec.start();
}

function showToast(msg) {
  const existing = document.querySelector('.ts-toast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.className = 'ts-toast';
  toast.textContent = msg;
  toast.style.cssText = `
    position:fixed; bottom:${document.querySelector('.mobile-nav')&&getComputedStyle(document.querySelector('.mobile-nav')).display!=='none'?'80':'24'}px;
    left:50%; transform:translateX(-50%);
    background:var(--card); color:var(--t1);
    border:1px solid var(--border);
    padding:10px 20px; border-radius:var(--rf);
    font-size:13.5px; font-weight:600;
    box-shadow:var(--sh2);
    z-index:99999; white-space:nowrap;
    animation:bounce-in 0.3s ease both;`;
  document.body.appendChild(toast);
  setTimeout(() => { toast.style.opacity='0'; toast.style.transition='opacity 0.3s'; setTimeout(()=>toast.remove(),300); }, 2500);
}

// ── ACTIVE COMMENTS CORE ──
if (!DATA.commentsDb) {
  DATA.commentsDb = {
    1: [
      { author: 'Sarah Chen', handle: '@sarahc', time: '5m ago', body: 'This looks incredible! Emojis working perfectly: 🔥🚀💯✨' },
      { author: 'Marcus Webb', handle: '@marcusw', time: '3m ago', body: 'Count me in for the next sprint! 👍🌟' }
    ],
    2: [
      { author: 'Zara Ahmed', handle: '@zaraa', time: '10m ago', body: 'Consistency is key! 💪🔥' }
    ],
    3: [
      { author: 'Dev Kumar', handle: '@devk', time: '1h ago', body: 'So true, starting now is the best option! 📈✨' }
    ]
  };
}

function toggleComments(postId) {
  const postCard = document.getElementById(`post-${postId}`);
  if (!postCard) return;
  
  let commentBox = postCard.querySelector('.post-comments-section');
  if (commentBox) {
    commentBox.remove();
    return;
  }
  
  commentBox = document.createElement('div');
  commentBox.className = 'post-comments-section mt12 pt12';
  
  const comments = DATA.commentsDb[postId] || [];
  const commentsHtml = comments.map(c => `
    <div class="comment-item py8" style="align-items:flex-start">
      <div class="avatar av-xs" style="background:var(--g-brand); width:24px; height:24px; font-size:10px; display:grid; place-items:center; color:var(--on-brand)">${c.author[0]}</div>
      <div style="flex:1">
        <div class="fw7 fs12 tc-1">${c.author} <span style="font-size:10px; color:var(--t3); font-weight:normal">${c.handle} · ${c.time}</span></div>
        <div class="fs12 tc-2 mt2">${escapeHTML(c.body)}</div>
      </div>
    </div>
  `).join('');
  
  commentBox.innerHTML = `
    <div class="comments-list" style="max-height:200px; overflow-y:auto; margin-bottom:12px">
      ${commentsHtml || '<div class="tc-3 fs12 py8 text-center">No comments yet. Be the first to share your thoughts! 💬</div>'}
    </div>
    <div class="comment-input-row flex gap8" style="align-items:center">
      <input type="text" class="input comment-input-field btn-sm" placeholder="Write a comment... Emojis work! 😊🚀🔥" style="flex:1" onkeydown="handleCommentKey(event, ${postId})">
      <button class="btn btn-primary btn-sm" onclick="submitComment(${postId})">Send</button>
    </div>
  `;
  
  postCard.appendChild(commentBox);
  if (typeof IX !== 'undefined' && IX.bindAllEmojis) {
    IX.bindAllEmojis(commentBox);
  }
}

function handleCommentKey(e, postId) {
  if (e.key === 'Enter') {
    submitComment(postId);
  }
}

function submitComment(postId) {
  
  const postCard = document.getElementById(`post-${postId}`);
  if (!postCard) return;
  const input = postCard.querySelector('.comment-input-field');
  if (!input) return;
  const text = input.value.trim();
  if (!text) return;
  
  const newComment = {
    author: 'Alex Vance',
    handle: S.user.handle,
    time: 'Just now',
    body: text
  };
  
  if (!DATA.commentsDb[postId]) {
    DATA.commentsDb[postId] = [];
  }
  DATA.commentsDb[postId].push(newComment);
  
  const post = DATA.posts.find(p => p.id === postId);
  if (post) {
    post.comments = DATA.commentsDb[postId].length;
  }
  
  const commentBox = postCard.querySelector('.post-comments-section');
  if (commentBox) commentBox.remove();
  toggleComments(postId);
  
  const emojiRegex = /[\u{1F300}-\u{1F9FF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E6}-\u{1F1FF}]|[\u{1F900}-\u{1F9FF}]|[\u{1F400}-\u{1F4FF}]|[\u{1F500}-\u{1F5FF}]|[\u{1F900}-\u{1F9FF}]/gu;
  const match = text.match(emojiRegex);
  if (match && match.length > 0 && typeof IX !== 'undefined' && IX.burstReaction) {
    IX.burstReaction(match[0], window.innerWidth / 2, window.innerHeight * 0.5, 8);
  }
  
  savePostsToLocal();
  saveCommentsToLocal();
  renderFeed();
}

// ── 22-TAB PROFILE HUB CONTROLLER ──

// ── PROFILE TAB HELPERS ──
function publishProfilePost() {
  const inp = $id('profile-post-input');
  if (!inp) return;
  const text = inp.value.trim();
  if (!text) return;
  
  const newPost = {
    id: Date.now(),
    author: `${S.user.fname || ''} ${S.user.lname || ''}`.trim() || S.user.handle,
    handle: S.user.handle,
    mine: true,
    emoji: '\u2728',
    time: 'just now',
    body: text,
    tags: ['#buildinpublic', '#creator'],
    likes: 0,
    comments: 0,
    shares: 0,
    liked: false,
    type: 'text',
    category: 'tech'
  };
  
  DATA.posts.unshift(newPost);
  inp.value = '';
  switchProfileTab('posts');
  showToast('Microblog post published successfully! 🚀');
}

let simVideoTimer = null;
let simVideoProgress = 0;
let simVideoPlaying = false;
let simVideoDurationSecs = 340;

function openSimulatedVideo(title, duration) {
  $id('video-player-container').style.display = 'block';
  $id('sim-player-title').textContent = title;
  $id('sim-video-time').textContent = `0:00 / ${duration}`;
  
  const parts = duration.split(':');
  simVideoDurationSecs = parseInt(parts[0]) * 60 + parseInt(parts[1]);
  simVideoProgress = 0;
  simVideoPlaying = false;
  
  const fill = $id('sim-video-progress');
  if (fill) fill.style.width = '0%';
  const playBtn = $id('sim-play-icon');
  if (playBtn) playBtn.textContent = 'play_arrow';
  
  if (simVideoTimer) { clearInterval(simVideoTimer); simVideoTimer = null; }
  showToast(`Loaded: ${title}`);
}

function closeSimulatedVideo() {
  $id('video-player-container').style.display = 'none';
  if (simVideoTimer) { clearInterval(simVideoTimer); simVideoTimer = null; }
  simVideoPlaying = false;
}

function playSimulatedVideo() {
  const playBtn = $id('sim-play-icon');
  if (!playBtn) return;
  
  if (simVideoPlaying) {
    simVideoPlaying = false;
    playBtn.textContent = 'play_arrow';
    if (simVideoTimer) { clearInterval(simVideoTimer); simVideoTimer = null; }
    showToast('Video paused');
  } else {
    simVideoPlaying = true;
    playBtn.textContent = 'pause';
    showToast('Video playing...');
    
    simVideoTimer = setInterval(() => {
      simVideoProgress += 2;
      if (simVideoProgress >= 100) {
        simVideoProgress = 100;
        clearInterval(simVideoTimer); simVideoTimer = null;
        simVideoPlaying = false;
        playBtn.textContent = 'play_arrow';
        showToast('Video complete! +20 XP 🏆');
        S.user.xp += 20; updateUserUI();
      }
      
      const fill = $id('sim-video-progress');
      if (fill) fill.style.width = `${simVideoProgress}%`;
      
      const curSecs = Math.floor((simVideoProgress / 100) * simVideoDurationSecs);
      const curMin = Math.floor(curSecs / 60);
      const curSec = curSecs % 60;
      const durMin = Math.floor(simVideoDurationSecs / 60);
      const durSec = simVideoDurationSecs % 60;
      
      const timeEl = $id('sim-video-time');
      if (timeEl) timeEl.textContent = `${curMin}:${curSec < 10 ? '0' : ''}${curSec} / ${durMin}:${durSec < 10 ? '0' : ''}${durSec}`;
    }, 1000);
  }
}

let podTimer = null;
let podProgress = 0;
let podPlaying = false;

function togglePodcastPlayback() {
  const btn = $id('pod-play-btn');
  if (!btn) return;
  
  if (podPlaying) {
    podPlaying = false;
    btn.textContent = '▶ Play Podcast';
    if (podTimer) { clearInterval(podTimer); podTimer = null; }
    showToast('Podcast paused');
  } else {
    podPlaying = true;
    btn.textContent = '⏸ Pause Podcast';
    showToast('Podcast playing...');
    
    podTimer = setInterval(() => {
      podProgress += 1;
      if (podProgress >= 100) {
        podProgress = 100;
        clearInterval(podTimer); podTimer = null;
        podPlaying = false;
        btn.textContent = '▶ Play Podcast';
        showToast('Podcast complete! +20 XP 🏆');
        S.user.xp += 20; updateUserUI();
      }
      
      const fill = $id('pod-progress-fill');
      if (fill) fill.style.width = `${podProgress}%`;
      
      const curSecs = Math.floor((podProgress / 100) * 18 * 60);
      const curMin = Math.floor(curSecs / 60);
      const curSec = curSecs % 60;
      
      const timeEl = $id('pod-current-time');
      if (timeEl) timeEl.textContent = `${curMin}:${curSec < 10 ? '0' : ''}${curSec} / 18:00`;
    }, 1000);
  }
}

function playSpecificPodcast(title, mins) {
  $id('podcast-player-title').textContent = title;
  podProgress = 0;
  podPlaying = false;
  
  const fill = $id('pod-progress-fill');
  if (fill) fill.style.width = '0%';
  const btn = $id('pod-play-btn');
  if (btn) btn.textContent = '▶ Play Podcast';
  
  const timeEl = $id('pod-current-time');
  if (timeEl) timeEl.textContent = `0:00 / ${mins}:00`;
  
  if (podTimer) { clearInterval(podTimer); podTimer = null; }
  showToast(`Loaded: ${title}`);
}

let profileMusicTimer = null;
let profileMusicProgress = 0;
let profileMusicPlaying = false;
let profileMusicAnimId = null;

function initProfileAudioWave() {
  const canvas = $id('profile-audio-wave');
  if (!canvas) return;
  canvas.width = canvas.offsetWidth;
  canvas.height = 48;
  const ctx = canvas.getContext('2d');
  
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, canvas.height / 2);
  ctx.lineTo(canvas.width, canvas.height / 2);
  ctx.stroke();
}

function animateProfileAudioWave() {
  const canvas = $id('profile-audio-wave');
  if (!canvas || !profileMusicPlaying) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  
  ctx.clearRect(0, 0, W, H);
  ctx.strokeStyle = 'var(--blue)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  
  const time = Date.now() * 0.008;
  ctx.moveTo(0, H / 2);
  for (let x = 0; x < W; x += 6) {
    const amp = Math.sin(x * 0.05 + time) * (H / 2.5) * (Math.sin(time * 0.2) + 1.2) * 0.6;
    ctx.lineTo(x, H / 2 + amp);
  }
  ctx.stroke();
  
  profileMusicAnimId = requestAnimationFrame(animateProfileAudioWave);
}

function toggleProfileMusic() {
  const btn = $id('profile-music-play');
  if (!btn) return;
  
  if (profileMusicPlaying) {
    profileMusicPlaying = false;
    btn.textContent = '▶ Play Track';
    cancelAnimationFrame(profileMusicAnimId);
    showToast('Music playback paused');
    initProfileAudioWave();
  } else {
    profileMusicPlaying = true;
    btn.textContent = '⏸ Pause Track';
    showToast('Synthwave music playing...');
    animateProfileAudioWave();
    
    const lyScroller = $id('profile-lyric-scroll');
    if (lyScroller) {
      setTimeout(() => {
        if (!profileMusicPlaying) return;
        $id('lyric-1').textContent = 'Walking through the shadow of the evening...';
        lyScroller.scrollTop = 40;
      }, 3000);
      setTimeout(() => {
        if (!profileMusicPlaying) return;
        $id('lyric-1').textContent = 'Feel the rhythm pulsing deep inside...';
        lyScroller.scrollTop = 80;
      }, 7000);
    }
  }
}

let profileStreamChatInterval = null;

function startProfileStreamChatSimulation() {
  if (profileStreamChatInterval) clearInterval(profileStreamChatInterval);
  
  const usernames = ['sarah_c', 'marcus_w', 'zara_a', 'dev_kumar', 'luna_p', 'kai_b'];
  const messages = [
    'Wow, HSL customizer is super smooth! 🔥',
    'Loving the material symbol rounded update!',
    'Emojis are fully active in this stream chat! 😊🚀🌟',
    'This retro invaders arcade game looks dope.',
    'Is the 3D brand logo tilt hardware accelerated?',
    'Awesome livestream layout Alex!'
  ];
  
  profileStreamChatInterval = setInterval(() => {
    const logs = $id('stream-chat-logs');
    if (!logs) { clearInterval(profileStreamChatInterval); return; }
    
    const u = usernames[Math.floor(Math.random() * usernames.length)];
    const m = messages[Math.floor(Math.random() * messages.length)];
    
    const div = document.createElement('div');
    div.innerHTML = `<strong style="color:var(--purple)">${u}:</strong> ${m}`;
    logs.appendChild(div);
    logs.scrollTop = logs.scrollHeight;
    
    if (logs.children.length > 20) {
      logs.removeChild(logs.firstChild);
    }
  }, 3500);
}

function submitStreamChat() {
  const inp = $id('stream-chat-input');
  if (!inp) return;
  const text = inp.value.trim();
  if (!text) return;
  
  const logs = $id('stream-chat-logs');
  if (logs) {
    const div = document.createElement('div');
    div.innerHTML = `<strong class="tc-blue">You (Alex Vance):</strong> ${text}`;
    logs.appendChild(div);
    logs.scrollTop = logs.scrollHeight;
  }
  
  inp.value = '';
  const emojiRegex = /[\u{1F300}-\u{1F9FF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E6}-\u{1F1FF}]|[\u{1F900}-\u{1F9FF}]|[\u{1F400}-\u{1F4FF}]|[\u{1F500}-\u{1F5FF}]|[\u{1F900}-\u{1F9FF}]/gu;
  const match = text.match(emojiRegex);
  if (match && match.length > 0 && typeof IX !== 'undefined' && IX.burstReaction) {
    IX.burstReaction(match[0], window.innerWidth / 2, window.innerHeight * 0.5, 8);
  }
}

function sendLiveStreamReaction(emoji) {
  if (typeof IX !== 'undefined' && IX.burstReaction) {
    IX.burstReaction(emoji, window.innerWidth / 2, window.innerHeight * 0.6, 12);
  }
  showToast(`Sent live reaction: ${emoji}`);
}

function filterSaved(cat) {
  const grid = $id('saved-items-grid');
  if (!grid) return;
  
  const items = [
    { emoji: '\u2728', title: 'ProSound X1 Headphones', cat: 'shop' },
    { emoji: '\u2728', title: 'UI/UX Design Masterclass', cat: 'course' },
    { emoji: '\u2728', title: 'Visualizing CRISPR Efficiencies', cat: 'article' }
  ];
  
  const filtered = items.filter(i => cat === 'all' || i.cat === cat);
  grid.innerHTML = filtered.map(s => {
    const iconData = get3DIconForEmoji(s.emoji);
    return `
    <div class="card p12 flex gap12" style="background:var(--card2); align-items:center; cursor:pointer" onclick="showToast('Opening saved item...')">
      <div style="display:inline-flex; align-items:center; justify-content:center; width:48px; height:48px; border-radius:50%; background:var(--bg2)">
        <span class="material-symbols-rounded emoji-3d" style="font-size:28px; color:${iconData.color}">${iconData.icon}</span>
      </div>
      <div>
        <div class="fw8 tc-1 fs13">${s.title}</div>
        <span class="badge badge-purple mt4 fs10">${s.cat.toUpperCase()}</span>
      </div>
    </div>`;
  }).join('');
  
  showToast(`Filter: Saved ${cat.toUpperCase()}`);
}

function generatePdfReceipt() {
  showToast('Receipt generated! PDF download initiated 🚀');
}

/* The Wallet tab's send form hands off to the payment sheet, so a transfer
   from here is reviewed and debited exactly like one from a scanned code.
   The tab itself is WV now and opens that sheet directly; this stays for
   anything still calling it, and opens the sheet empty if the old fields
   are not on the page. */
function submitCryptoTransfer() {
  const rEl = $id('wallet-recipient'), aEl = $id('wallet-amount'), cEl = $id('wallet-coin');
  if (!rEl || !aEl || !cEl) {
    if (typeof PAY !== 'undefined' && PAY.openPayTo) PAY.openPayTo({});
    else showToast('Payments are still loading…');
    return;
  }
  const recip = rEl.value.trim();
  const amt = parseFloat(aEl.value);
  const coin = cEl.value;

  if (!recip || isNaN(amt) || amt <= 0) {
    showToast('Enter a recipient and an amount ❌');
    return;
  }
  if (/^0x/i.test(recip)) {
    showToast('Paper balances stay in the app — pay an @handle or scan their code.');
    return;
  }
  if (typeof PAY === 'undefined') { showToast('Payments are still loading…'); return; }

  const handle = recip[0] === '@' ? recip : '@' + recip;
  PAY.openPayTo({ handle, asset: coin, amount: amt });
  rEl.value = '';
  aEl.value = '';
}

function switchDiscordServer(server) {
  showToast(`Ecosystem Server: Connected to ${server} 🌐`);
}
function switchDiscordChannel(chan) {
  $id('discord-channel-title').textContent = `# ${chan}`;
  showToast(`Channel: Joined #${chan}`);
}
function submitDiscordMessage() {
  const inp = $id('discord-input');
  if (!inp) return;
  const text = inp.value.trim();
  if (!text) return;
  
  const logs = $id('discord-messages-log');
  if (logs) {
    const div = document.createElement('div');
    div.innerHTML = `<strong class="tc-blue">You (Alex Vance):</strong> ${text}`;
    logs.appendChild(div);
    logs.scrollTop = logs.scrollHeight;
  }
  
  inp.value = '';
  const emojiRegex = /[\u{1F300}-\u{1F9FF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E6}-\u{1F1FF}]|[\u{1F900}-\u{1F9FF}]|[\u{1F400}-\u{1F4FF}]|[\u{1F500}-\u{1F5FF}]|[\u{1F900}-\u{1F9FF}]/gu;
  const match = text.match(emojiRegex);
  if (match && match.length > 0 && typeof IX !== 'undefined' && IX.burstReaction) {
    IX.burstReaction(match[0], window.innerWidth / 2, window.innerHeight * 0.5, 8);
  }
}

function completeQuest(id) {
  const checkbox = $id(id);
  const text = $id(`q-txt-${id.split('-')[1]}`);
  if (checkbox && checkbox.checked) {
    if (text) {
      text.style.textDecoration = 'line-through';
      text.className = 'tc-3';
    }
    showToast('Quest complete! +25 XP 🏆');
    S.user.xp += 25;
    updateUserUI();
  }
}

function calculatePayouts(views) {
  const viewsK = parseInt(views);
  $id('calc-views-lbl').textContent = `Monthly Video Views: ${viewsK}K`;
  
  const adEarns = (viewsK * 2.5);
  const royEarns = (viewsK * 0.9);
  const btcAd = (adEarns / (window.liveBtcPrice || 68450)).toFixed(4);
  const btcRoy = (royEarns / (window.liveBtcPrice || 68450)).toFixed(4);
  
  if ($id('calc-ad-earns')) $id('calc-ad-earns').textContent = `$${adEarns.toFixed(2)} (${btcAd} BTC)`;
  if ($id('calc-roy-earns')) $id('calc-roy-earns').textContent = `$${royEarns.toFixed(2)} (${btcRoy} BTC)`;
}

function saveProfileBioEditor() {
  const bioText = $id('profile-bio-editor').value.trim();
  if (bioText) {
    S.user.bio = bioText;
    updateUserUI();
    showToast('Bio details saved successfully! ✅');
  }
}

function toggleGhostMode(checkbox) {
  if (checkbox.checked) {
    showToast('Ghost Privacy Mode active! Online status dots hidden.');
    document.querySelectorAll('.badge-green').forEach(dot => {
      if (dot.textContent.includes('Online')) dot.style.display = 'none';
    });
  } else {
    showToast('Ghost Privacy Mode deactivated.');
    document.querySelectorAll('.badge-green').forEach(dot => {
      if (dot.textContent.includes('Online')) dot.style.display = 'inline-block';
    });
  }
}

function drawProfileAnalyticsChart() {

  const canvas = $id('profile-chart'); if (!canvas) return;
  canvas.width = canvas.offsetWidth; canvas.height = 120;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  
  ctx.clearRect(0,0,W,H);
  ctx.strokeStyle = 'var(--blue)'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(0, H - 20);
  for (let x = 0; x < W; x += 10) {
    const y = H - 20 - (Math.sin(x * 0.015) + 1.2) * 35;
    ctx.lineTo(x, y);
  }
  ctx.stroke();
  
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, 'hsla(217, 91%, 60%, 0.15)');
  grad.addColorStop(1, 'rgba(59, 130, 246, 0.0)');
  ctx.fillStyle = grad; ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.fill();
}

// ── 2. DYNAMIC ACCENT SWITCHER ──
function changeThemeAccent(color) {
  document.querySelectorAll('.color-swatch').forEach(sw => sw.classList.remove('active'));
  const target = document.querySelector(`.swatch-${color}`);
  if (target) target.classList.add('active');
  
  const palettes = {
    blue:   { primary: 'hsl(217, 91%, 60%)', dark: 'hsl(217, 91%, 48%)', shadow: 'hsla(217, 91%, 60%, 0.12)' },
    green:  { primary: 'hsl(155, 60%, 44%)', dark: 'hsl(155, 60%, 34%)', shadow: 'hsla(155, 60%, 44%, 0.12)' },
    orange: { primary: 'hsl(38, 95%, 55%)',  dark: 'hsl(38, 95%, 45%)',  shadow: 'hsla(38, 95%, 55%, 0.12)' },
    pink:   { primary: 'hsl(330, 80%, 62%)', dark: 'hsl(330, 80%, 48%)', shadow: 'hsla(330, 80%, 62%, 0.12)' },
    purple: { primary: 'hsl(260, 65%, 64%)', dark: 'hsl(260, 65%, 52%)', shadow: 'hsla(260, 65%, 64%, 0.12)' }
  };
  
  const pal = palettes[color] || palettes.blue;
  const html = document.documentElement;
  html.style.setProperty('--blue',   pal.primary);
  html.style.setProperty('--blue-d', pal.dark);
  html.style.setProperty('--blue-s', pal.shadow);
  
  _safe(drawProfileAnalyticsChart, 'drawProfileAnalyticsChart');
  
  showToast(`Ecosystem visual accent updated to: ${color.toUpperCase()} ✨`);
}

// ── MESSAGES PANE (recreated) ─────────────────────────────────────────
function getMessagesTemplate() {
  return `<section id="pane-messages" class="pane">
    <div class="msgr" id="msgr-root">

      <!-- Conversation list -->
      <aside class="msgr-list">
        <div class="msgr-list-head">
          <button type="button" class="msgr-acct" onclick="NT.settings()" aria-haspopup="dialog" title="Notes and chat settings">
            <span class="msgr-title" id="msgr-handle">Messages</span>
            <span class="material-symbols-rounded ms-20" aria-hidden="true">expand_more</span>
          </button>
          <button class="icon-btn msgr-new-btn" onclick="openCreateGroupModal()" title="New group" aria-label="New group">
            <span class="material-symbols-rounded ms-18">edit_square</span>
          </button>
        </div>

        <div class="msgr-search">
          <span class="material-symbols-rounded ms-18 tc-3" aria-hidden="true">manage_search</span>
          <input type="text" id="msgr-search-input" placeholder="Search or ask ALINA" aria-label="Search conversations or ask ALINA"
            autocomplete="off" enterkeyhint="search" oninput="searchChats(this.value)" onkeydown="if(event.key==='Enter'){event.preventDefault();searchEnter(this.value)}">
        </div>

        <!-- Trending Notes — painted by NT -->
        <div class="nt-row" id="nt-row" role="list" aria-label="Notes"></div>

        <div class="msgr-sec">
          <h2 class="msgr-sec-t" id="msgr-sec-t">Messages</h2>
          <button type="button" class="msgr-req" id="msgr-req-btn" onclick="TG.setFolder(TG.state.folder === 'requests' ? 'all' : 'requests')">Requests</button>
        </div>

        <!-- Folders — populated by TG so counts stay live -->
        <div class="tg-folders" id="tg-folders"></div>

        <div id="chat-list" class="msgr-convos"></div>
      </aside>

      <!-- Chat window -->
      <div class="msgr-chat">
        <div class="msgr-chat-head">
          <button class="icon-btn msgr-back" onclick="msgrBack()" title="Back">
            <span class="material-symbols-rounded ms-20">arrow_back</span>
          </button>
          <div class="msgr-av" id="chat-header-av">S</div>
          <div class="msgr-head-info">
            <div class="msgr-name fs14" id="chat-header-name">Sarah Chen</div>
            <div class="msgr-status" id="chat-header-status">Online</div>
          </div>
          <div class="msgr-actions">
            <button class="icon-btn tg-secondary" onclick="TG.toggleMute()" title="Mute / unmute">
              <span class="material-symbols-rounded ms-20">notifications_off</span>
            </button>
            <button class="icon-btn tg-secondary" onclick="TG.toggleArchive()" title="Archive">
              <span class="material-symbols-rounded ms-20">archive</span>
            </button>
            <button class="icon-btn tg-secondary" onclick="TG.inviteLink()" title="Copy invite link">
              <span class="material-symbols-rounded ms-20">link</span>
            </button>
            <button class="icon-btn cfi-head-btn" onclick="openChatCrypto('send')" title="Crypto in chat">
              <span class="material-symbols-rounded ms-20">currency_bitcoin</span>
            </button>
            <button class="icon-btn" onclick="mockCall('voice')" title="Voice call">
              <span class="material-symbols-rounded ms-20">call</span>
            </button>
            <button class="icon-btn" onclick="mockCall('video')" title="Video call">
              <span class="material-symbols-rounded ms-20">videocam</span>
            </button>
            <button class="icon-btn" onclick="toggleDisappearingMessages()" title="Disappearing messages">
              <span class="material-symbols-rounded ms-20">timer</span>
            </button>
          </div>
        </div>

        <div class="msgr-msgs" id="chat-messages"></div>

        <!-- Reply / edit context, filled by TG -->
        <div id="tg-context"></div>

        <div class="msgr-quick" id="chat-quick-replies"></div>

        <div class="msgr-composer">
          <div class="msgr-input-wrap">
            <button class="icon-btn msgr-ghost-btn" onclick="toggleEmojiMenu()" title="Emoji">
              <span class="material-symbols-rounded ms-20">sentiment_satisfied</span>
            </button>
            <div class="msgr-pop hidden" id="chat-emoji-menu">
              ${['😊','😂','🥺','🔥','🚀','💯','✨','❤️','🙏','👀'].map(e =>
                `<button class="msgr-emoji-btn" onclick="insertEmoji('${e}')">${e}</button>`).join('')}
            </div>

            <input class="chat-input" type="text" id="chat-input" placeholder="Message...">

            <button class="icon-btn msgr-ghost-btn" onclick="toggleAttachmentMenu()" title="Attach">
              <span class="material-symbols-rounded ms-20" style="transform:rotate(-45deg)">attach_file</span>
            </button>
            <div class="msgr-pop msgr-pop-right hidden" id="chat-attach-menu">
              <button class="msgr-attach-item" onclick="sendMockAttachment('image')"><span class="material-symbols-rounded ms-18 tc-blue">image</span> Media</button>
              <button class="msgr-attach-item" onclick="sendMockAttachment('document')"><span class="material-symbols-rounded ms-18 tc-purple">description</span> Document</button>
              <button class="msgr-attach-item" onclick="sendMockAttachment('location')"><span class="material-symbols-rounded ms-18 tc-green">location_on</span> Location</button>
              <div class="msgr-attach-sep">Crypto</div>
              <button class="msgr-attach-item" onclick="openChatCrypto('send')"><span class="material-symbols-rounded ms-18 tc-green">north_east</span> Send crypto</button>
              <button class="msgr-attach-item" onclick="openChatCrypto('request')"><span class="material-symbols-rounded ms-18 tc-blue">request_quote</span> Request payment</button>
              <button class="msgr-attach-item" onclick="WAD.open()"><span class="material-symbols-rounded ms-18 tc-purple">account_balance_wallet</span> Wallet address <span class="msgr-attach-tag">on-chain</span></button>
              <button class="msgr-attach-item" onclick="closeChatAttach(); PAY.openScan({ from: 'chat' })"><span class="material-symbols-rounded ms-18 tc-pink">qr_code_scanner</span> Scan a QR code</button>
              <button class="msgr-attach-item" onclick="closeChatAttach(); PAY.openMyQR({ from: 'chat' })"><span class="material-symbols-rounded ms-18 tc-purple">qr_code_2</span> My payment code</button>
              <button class="msgr-attach-item" onclick="openChatCrypto('gift')"><span class="material-symbols-rounded ms-18 tc-red">featured_seasonal_and_gifts</span> Gift packet</button>
              <button class="msgr-attach-item" onclick="openChatCrypto('split')"><span class="material-symbols-rounded ms-18 tc-purple">call_split</span> Split bill</button>
              <button class="msgr-attach-item" onclick="openChatCrypto('price')"><span class="material-symbols-rounded ms-18 tc-blue">monitoring</span> Share price</button>
              <button class="msgr-attach-item" onclick="openChatCrypto('alert')"><span class="material-symbols-rounded ms-18 tc-orange">notifications_active</span> Price alert</button>
            </div>
          </div>

          <button class="msgr-send" id="send-msg-btn" title="Send">
            <span class="material-symbols-rounded ms-20">send</span>
          </button>
        </div>
      </div>

    </div>
  </section>`;
}

// ── CREATE GROUP MODAL LOGIC ──────────────────────────────────────────
window.openCreateGroupModal = function() {
  let modal = document.getElementById('create-group-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'create-group-modal';
    modal.className = 'category-modal-overlay';
    document.body.appendChild(modal);
  }
  
  modal.innerHTML = `
    <div class="card p24" style="width: 90%; max-width: 400px; background: var(--card); border: 1px solid var(--border); box-shadow: var(--sh3); border-radius: 16px;">
      <div class="flex-between mb16">
        <h3 class="fw8 tc-1" style="display:flex; align-items:center; gap:8px;">
          <span class="material-symbols-rounded" style="color:var(--blue)">group_add</span>
          Create New Group
        </h3>
        <button class="icon-btn" onclick="closeCreateGroupModal()">
          <span class="material-symbols-rounded">close</span>
        </button>
      </div>

      <div class="form-group mb16">
        <label class="form-label fs13 tc-2">Group Name</label>
        <input type="text" id="create-group-name" class="input" placeholder="e.g. Weekend Hikers" style="background: var(--bg2); border: none; padding: 12px; border-radius: 8px; width: 100%; color: var(--t1); font-size: 15px; outline: none;">
      </div>
      
      <div class="form-group mb24">
        <label class="form-label fs13 tc-2 mb8">Select Participants</label>
        <div class="flex-col gap8" style="max-height: 150px; overflow-y: auto;">
          <label style="display: flex; align-items: center; gap: 12px; padding: 8px; background: var(--bg2); border-radius: 8px; cursor: pointer;">
            <input type="checkbox" checked style="accent-color: var(--blue);">
            <div class="avatar av-xs" style="background: var(--brand-fill);">S</div>
            <span class="tc-1 fs14 fw6">Sarah Chen</span>
          </label>
          <label style="display: flex; align-items: center; gap: 12px; padding: 8px; background: var(--bg2); border-radius: 8px; cursor: pointer;">
            <input type="checkbox" checked style="accent-color: var(--blue);">
            <div class="avatar av-xs" style="background: var(--green);">D</div>
            <span class="tc-1 fs14 fw6">Dev Kumar</span>
          </label>
          <label style="display: flex; align-items: center; gap: 12px; padding: 8px; background: var(--bg2); border-radius: 8px; cursor: pointer;">
            <input type="checkbox" style="accent-color: var(--blue);">
            <div class="avatar av-xs" style="background: var(--orange);">M</div>
            <span class="tc-1 fs14 fw6">Marcus Webb</span>
          </label>
        </div>
      </div>
      
      <button class="btn btn-primary w100" style="padding: 12px; font-size: 15px; border-radius: 8px;" onclick="submitCreateGroup()">Create Group Chat</button>
    </div>
  `;
  
  modal.classList.remove('hidden');
};

window.closeCreateGroupModal = function() {
  const modal = document.getElementById('create-group-modal');
  if (modal) modal.classList.add('hidden');
};

window.submitCreateGroup = function() {
  const nameEl = document.getElementById('create-group-name');
  const groupName = nameEl && nameEl.value.trim() !== '' ? nameEl.value.trim() : 'New Group';
  
  // Create a mock group chat entry
  const newGroup = {
    id: Date.now(),
    name: groupName,
    emoji: '👥',
    type: 'groups',
    preview: 'Group created successfully.',
    unread: 0,
    online: true
  };
  
  DATA.conversations.unshift(newGroup);
  
  showToast(`Group "${groupName}" created! 👥`);
  closeCreateGroupModal();
  
  // Re-render chat list and open the new chat
  if (typeof renderConversations === 'function') {
    renderConversations();
    loadChat(newGroup.id);
  }
};

window.toggleEmojiMenu = function() {
  const m = document.getElementById('chat-emoji-menu');
  if (m) m.classList.toggle('hidden');
};

window.insertEmoji = function(emoji) {
  const inp = document.getElementById('chat-input');
  if (inp) {
    inp.value += emoji;
    inp.focus();
  }
  toggleEmojiMenu();
};



// -- MESSENGER CALL SYSTEM (Video & Voice) ------------------------
let callTimer = null;
let callSeconds = 0;

function mockCall(type) {
  if (type !== 'video') {
    showToast('Starting voice call...');
    return;
  }
  
  /* Whose call this is comes from TG, which owns the open thread. This
     read a bare `activeChat` - a global no module has declared since the
     pre-modular app.js - so every tap on the video button threw a
     ReferenceError here and the overlay was never built. */
  const chat = (typeof TG !== 'undefined') ? TG.activeChat() : null;
  const name = chat ? chat.name : 'Unknown User';
  
  let callOverlay = document.getElementById('video-call-overlay');
  if (!callOverlay) {
    callOverlay = document.createElement('div');
    callOverlay.id = 'video-call-overlay';
    document.body.appendChild(callOverlay);
  }
  
  callOverlay.className = 'video-call-overlay ringing';
  const remoteImg = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=80';
  const localImg = 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=300&q=80';

  callOverlay.innerHTML = `<div class="video-bg">
      <img src="${remoteImg}" class="remote-video" alt="Remote User">
      <div class="video-overlay-gradient"></div>
    </div>
    <div class="call-header">
      <div class="call-info">
        <h2 id="vc-name">${name}</h2>
        <p id="vc-status">Ringing...</p>
      </div>
      <button class="icon-btn" style="background:rgba(0,0,0,0.5); color:#fff; backdrop-filter:blur(10px)" onclick="endVideoCall()">
        <span class="material-symbols-rounded">close</span>
      </button>
    </div>
    <div class="local-video-pip" id="local-video-pip">
      <img src="${localImg}" alt="Local User">
    </div>
    <div class="call-controls">
      <button class="call-btn btn-effect" onclick="showToast('Effects menu opened')"><span class="material-symbols-rounded">auto_awesome</span></button>
      <button class="call-btn btn-mute" id="vc-mute" onclick="toggleVCMute()"><span class="material-symbols-rounded">mic</span></button>
      <button class="call-btn btn-video" id="vc-cam" onclick="toggleVCCam()"><span class="material-symbols-rounded">videocam</span></button>
      <button class="call-btn btn-end" onclick="endVideoCall()"><span class="material-symbols-rounded">call_end</span></button>
    </div>`;

  makePipDraggable();
  setTimeout(() => {
    const status = document.getElementById('vc-status');
    if (status) {
      status.innerHTML = '<span style="color:var(--green)">Connected</span> 00:00';
      callOverlay.classList.remove('ringing');
      callOverlay.classList.add('connected');
      startCallTimer();
    }
  }, 2500);
}

function startCallTimer() {
  callSeconds = 0;
  clearInterval(callTimer);
  callTimer = setInterval(() => {
    callSeconds++;
    const status = document.getElementById('vc-status');
    if (status) {
      const m = Math.floor(callSeconds / 60).toString().padStart(2, '0');
      const s = (callSeconds % 60).toString().padStart(2, '0');
      status.innerHTML = `<span style="color:var(--green)">Connected</span> ${m}:${s}`;
    }
  }, 1000);
}

/* Tears down the #video-call-overlay that mockCall() builds above — a
   different thing entirely from the #call-modal in index.html, which
   pages/modals.js owns along with its End button. This was called
   endMockCall too, and modals.js loads later, so the overlay's own End
   button was hiding a modal that was never open and leaving the overlay
   stuck on screen. */
function endVideoCall() {
  clearInterval(callTimer);
  const overlay = document.getElementById('video-call-overlay');
  if (overlay) {
    overlay.classList.add('ending');
    setTimeout(() => { overlay.remove(); }, 400);
  }
  showToast('Call ended.');
}

function toggleVCMute() {
  const btn = document.getElementById('vc-mute');
  if (btn) {
    btn.classList.toggle('off');
    btn.querySelector('span').textContent = btn.classList.contains('off') ? 'mic_off' : 'mic';
  }
}

function toggleVCCam() {
  const btn = document.getElementById('vc-cam');
  if (btn) {
    btn.classList.toggle('off');
    btn.querySelector('span').textContent = btn.classList.contains('off') ? 'videocam_off' : 'videocam';
  }
}


// PIP DRAG LOGIC
function makePipDraggable() {
  const pip = document.getElementById('local-video-pip');
  if (!pip) return;
  let isDown = false, startX, startY, initX, initY;
  
  function onDown(e) {
    isDown = true;
    startX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
    startY = e.type.includes('mouse') ? e.clientY : e.touches[0].clientY;
    const rect = pip.getBoundingClientRect();
    initX = rect.left;
    initY = rect.top;
    pip.style.right = 'auto';
    pip.style.top = initY + 'px';
    pip.style.left = initX + 'px';
  }
  
  function onMove(e) {
    if (!isDown) return;
    e.preventDefault();
    const currX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
    const currY = e.type.includes('mouse') ? e.clientY : e.touches[0].clientY;
    pip.style.left = (initX + currX - startX) + 'px';
    pip.style.top = (initY + currY - startY) + 'px';
  }
  
  function onUp() { isDown = false; }
  
  pip.addEventListener('mousedown', onDown);
  pip.addEventListener('touchstart', onDown, {passive:false});
  document.addEventListener('mousemove', onMove);
  document.addEventListener('touchmove', onMove, {passive:false});
  document.addEventListener('mouseup', onUp);
  document.addEventListener('touchend', onUp);
}

/* ── Global bridge ───────────────────────────────────────────────────
   This file is an ES module now, so its top-level names are private
   to it. Inline onclick= handlers and every other module still look
   them up on the global object, so they are republished here.

   Each one is a thunk because the list is produced by scanning, and
   scanning over-collects — a line inside a template literal can look
   like a declaration. publish() calls each thunk and skips the ones
   that do not resolve, so a phantom costs one caught error and not a
   dead module graph. */
import { publish } from '../globals.js?v=3';
publish('pages/messages.js', {
  setupAI: () => setupAI, toggleAI: () => toggleAI,
  setAlinaState: () => setAlinaState, sendAI: () => sendAI,
  callTrendingAI: () => callTrendingAI, addAIMessage: () => addAIMessage,
  getActiveVoice: () => getActiveVoice, speakText: () => speakText,
  changeVoiceModel: () => changeVoiceModel, toggleVoice: () => toggleVoice,
  showToast: () => showToast, toggleComments: () => toggleComments,
  handleCommentKey: () => handleCommentKey,
  submitComment: () => submitComment,
  publishProfilePost: () => publishProfilePost,
  simVideoTimer: () => simVideoTimer,
  simVideoProgress: () => simVideoProgress,
  simVideoPlaying: () => simVideoPlaying,
  simVideoDurationSecs: () => simVideoDurationSecs,
  openSimulatedVideo: () => openSimulatedVideo,
  closeSimulatedVideo: () => closeSimulatedVideo,
  playSimulatedVideo: () => playSimulatedVideo, podTimer: () => podTimer,
  podProgress: () => podProgress, podPlaying: () => podPlaying,
  togglePodcastPlayback: () => togglePodcastPlayback,
  playSpecificPodcast: () => playSpecificPodcast,
  profileMusicTimer: () => profileMusicTimer,
  profileMusicProgress: () => profileMusicProgress,
  profileMusicPlaying: () => profileMusicPlaying,
  profileMusicAnimId: () => profileMusicAnimId,
  initProfileAudioWave: () => initProfileAudioWave,
  animateProfileAudioWave: () => animateProfileAudioWave,
  toggleProfileMusic: () => toggleProfileMusic,
  profileStreamChatInterval: () => profileStreamChatInterval,
  startProfileStreamChatSimulation: () => startProfileStreamChatSimulation,
  submitStreamChat: () => submitStreamChat,
  sendLiveStreamReaction: () => sendLiveStreamReaction,
  filterSaved: () => filterSaved,
  generatePdfReceipt: () => generatePdfReceipt,
  submitCryptoTransfer: () => submitCryptoTransfer,
  switchDiscordServer: () => switchDiscordServer,
  switchDiscordChannel: () => switchDiscordChannel,
  submitDiscordMessage: () => submitDiscordMessage,
  completeQuest: () => completeQuest,
  calculatePayouts: () => calculatePayouts,
  saveProfileBioEditor: () => saveProfileBioEditor,
  toggleGhostMode: () => toggleGhostMode,
  drawProfileAnalyticsChart: () => drawProfileAnalyticsChart,
  changeThemeAccent: () => changeThemeAccent,
  getMessagesTemplate: () => getMessagesTemplate,
  callTimer: () => callTimer, callSeconds: () => callSeconds,
  mockCall: () => mockCall, startCallTimer: () => startCallTimer,
  endVideoCall: () => endVideoCall, toggleVCMute: () => toggleVCMute,
  toggleVCCam: () => toggleVCCam, makePipDraggable: () => makePipDraggable
});
