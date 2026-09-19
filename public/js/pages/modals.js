/* ── LEGACY FEATURE MODALS ────────────────────────────────────────
   Recovered from the pre-modular app.js: handlers for the call, course
   detail, gig workspace, cloud stream, play store, edu reels and
   breathing-guide modals whose markup lives in index.html.
   ───────────────────────────────────────────────────────────────── */

'use strict';

function switchCourseDetailTab(tab) {
  activeCDTab = tab;
  document.querySelectorAll('#cd-tabs button').forEach(btn => {
    btn.classList.toggle('active', btn.id === `cdt-${tab}`);
  });
  $id('cd-tutor-tab').classList.toggle('hidden', tab !== 'tutor');
  $id('cd-quiz-tab').classList.toggle('hidden', tab !== 'quiz');
}

function swipeStartup(direction) {
  const card = $id('startup-swiper-node');
  const feedback = $id('su-feedback'); if (!card) return;
  
  const startup = startupsList[currentStartupIndex];
  card.style.transition = 'transform 0.4s ease, opacity 0.4s ease';
  
  if (direction === 'right') {
    card.style.transform = 'translateX(150px) rotate(15deg)';
    card.style.opacity = '0';
    if (feedback) feedback.innerHTML = `<span class="material-symbols-rounded" style="font-size:16px; color:var(--green); vertical-align:middle; margin-right:4px">handshake</span> <span class="tc-green fw8">MATCH FOUND!</span> AI matched your investor portfolio with <strong>${startup.name}</strong>! Pitch deck invitation sent.`;
    S.user.xp += 30; updateUserUI();
  } else {
    card.style.transform = 'translateX(-150px) rotate(-15deg)';
    card.style.opacity = '0';
    if (feedback) feedback.innerHTML = `<span class="material-symbols-rounded" style="font-size:16px; color:var(--pink); vertical-align:middle; margin-right:4px">close</span> <span class="tc-pink fw8">Skipped</span> <strong>${startup.name}</strong>. Loading next startup pitch...`;
  }
  
  setTimeout(() => {
    currentStartupIndex = (currentStartupIndex + 1) % startupsList.length;
    renderStartupCard();
  }, 800);
}

function toggleCallMute() {
  S.callMuted = !S.callMuted;
  const icon = $id('call-mute-icon');
  const btn = $id('call-mute-btn');
  if (icon) icon.textContent = S.callMuted ? 'mic_off' : 'mic';
  if (btn) btn.classList.toggle('active', S.callMuted);
  showToast(S.callMuted ? '🔇 Microphone muted' : '🎙️ Microphone on');
}

function toggleCallCamera() {
  S.callCameraOn = !S.callCameraOn;
  const icon = $id('call-camera-icon');
  const btn = $id('call-camera-btn');
  const selfFeed = $id('call-self-feed');
  if (icon) icon.textContent = S.callCameraOn ? 'videocam' : 'videocam_off';
  if (btn) btn.classList.toggle('active', !S.callCameraOn);
  if (selfFeed) selfFeed.classList.toggle('video-active', S.callCameraOn);
  showToast(S.callCameraOn ? '📹 Camera on' : '📷 Camera off');
}

function toggleCallSpeaker() {
  S.callSpeakerOn = !S.callSpeakerOn;
  const icon = $id('call-speaker-icon');
  const btn = $id('call-speaker-btn');
  if (icon) icon.textContent = S.callSpeakerOn ? 'speaker' : 'volume_up';
  if (btn) btn.classList.toggle('active', S.callSpeakerOn);
  showToast(S.callSpeakerOn ? '🔊 Speaker on' : '🔉 Earpiece mode');
}

function acceptMockCall() {
  S.callConnected = true;
  const statEl = $id('call-status');
  const timerEl = $id('call-timer');
  const timerText = $id('call-timer-text');
  const qualityBar = $id('call-quality-bar');
  const acceptBtn = $id('call-accept-btn');
  const remoteFeed = $id('call-remote-feed');
  const remoteAvatar = $id('call-remote-avatar');

  if (statEl) { statEl.textContent = 'Connected · End-to-End Encrypted'; statEl.classList.add('connected'); }
  if (timerEl) timerEl.style.display = '';
  if (qualityBar) qualityBar.style.display = '';
  if (acceptBtn) acceptBtn.style.display = 'none';

  // Activate remote video feed simulation
  if (remoteFeed) remoteFeed.classList.add('video-active');
  if (remoteAvatar) remoteAvatar.style.display = 'none';

  S.callSeconds = 0;
  if (timerText) timerText.textContent = '00:00';

  S.callTimerInterval = setInterval(() => {
    S.callSeconds++;
    const m = Math.floor(S.callSeconds / 60);
    const s = S.callSeconds % 60;
    if (timerText) timerText.textContent = `${(m+'').padStart(2,'0')}:${(s+'').padStart(2,'0')}`;
  }, 1000);

  showToast('✅ Call connected! HD stream active.');
}

function closeCourseDetails() {
  const modal = $id('course-detail-modal');
  if (modal) {
    modal.style.display = 'none';
    modal.classList.add('hidden');
  }
  stopCourseVideo();
}

function toggleCourseVideo() {
  const canvas = $id('course-video-canvas'); if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const playBtn = $id('course-video-play');
  
  if (courseVideoPlaying) {
    stopCourseVideo();
    if (playBtn) playBtn.innerHTML = '<span class="material-symbols-rounded" style="font-size:32px">play_arrow</span>';
    showToast('Video trailer paused.');
  } else {
    courseVideoPlaying = true;
    if (playBtn) playBtn.innerHTML = '<span class="material-symbols-rounded" style="font-size:32px">pause</span>';
    showToast('Autoplay trailer active.');
    
    let wave = 0;
    const draw = () => {
      if (!courseVideoPlaying) return;
      ctx.fillStyle = '#0a0a0f'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Floating glowing vector circles
      ctx.strokeStyle = 'hsla(217,91%,60%,0.2)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(canvas.width/2, canvas.height/2, 40 + Math.sin(wave)*12, 0, Math.PI*2); ctx.stroke();
      
      ctx.strokeStyle = 'hsla(260,65%,64%,0.15)';
      ctx.beginPath(); ctx.arc(canvas.width/2, canvas.height/2, 60 + Math.cos(wave)*15, 0, Math.PI*2); ctx.stroke();
      
      // Code streams overlay
      ctx.fillStyle = '#22c55e'; ctx.font = '8px Courier'; ctx.textAlign = 'left';
      for(let i=0; i<canvas.width; i+=40) {
        ctx.fillText((Math.random()>0.5?'1':'0') + ' ' + (Math.random()>0.5?'0':'1'), i, 20 + (Math.sin(wave+i)*30 + 30));
      }
      
      ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.font = 'bold 12px Inter'; ctx.textAlign = 'center';
      ctx.fillText(`Active Stream Node: Lecture 1 Trailer`, canvas.width/2, canvas.height - 20);
      
      wave += 0.05;
      courseVideoAnimId = requestAnimationFrame(draw);
    };
    draw();
  }
}

function mentorSpeakConcept() {
  if (!activeCourse) return;
  const explain = `Trending Study Buddy Concept Breakdown for ${activeCourse.title}. In this module, we focus heavily on: ${activeCourse.concepts}. These fundamentals prepare you directly for recruiter-verified freelance gigs in the zone. Let me know if you would like me to compile a study roadmap.`;
  $id('cd-tutor-output').textContent = explain;
  $id('cd-tutor-output').classList.remove('hidden');
  speakText(explain);
}

function mentorGenerateSchedule() {
  if (!activeCourse) return;
  const syllabusHTML = activeCourse.syllabus.map((syl, i) => `• Day ${i*2+1}-${i*2+2}: ${syl}`).join('\n');
  const schedule = `⚡ AI-GENERATED 7-DAY STUDY ROADMAP FOR ${activeCourse.title.toUpperCase()} 🚀\n\n` +
    syllabusHTML + `\n• Day 7: Complete dynamic Quiz in LearnHub and link your portfolio to active gig boards!`;
  $id('cd-tutor-output').innerHTML = schedule.replace(/\n/g, '<br>');
  $id('cd-tutor-output').classList.remove('hidden');
  showToast('Study Roadmap Synthesized!');
}

function submitCDQuiz() {
  const selected = document.querySelector('input[name="cd-quiz-opt"]:checked');
  if (!selected) { showToast('Select an answer first! 📝'); return; }
  
  const courseQList = cdQuizzes[activeCourse.id] || cdQuizzes[1];
  const qObj = courseQList[activeCDQuizIdx % courseQList.length];
  const choice = parseInt(selected.value);
  
  if (choice === qObj.c) {
    showToast('🎉 Correct! +100 XP gained!');
    S.user.xp += 100;
    if (S.user.xp >= S.user.level * 1000) {
      S.user.level++;
      showToast(`🏆 LEVEL UP! You reached Level ${S.user.level}! 🎉`);
    }
    updateUserUI();
    
    // Trigger cursor heart burst reaction at the center of the screen
    if (typeof IX !== 'undefined' && IX.burstReaction) {
      IX.burstReaction('💖', window.innerWidth/2, window.innerHeight/2);
      setTimeout(() => IX.burstReaction('🌟', window.innerWidth/2, window.innerHeight/2), 150);
    }
    
    activeCDQuizIdx++;
    if (activeCDQuizIdx >= courseQList.length) {
      showToast('🏆 Quiz Complete! You mastered this module!');
      activeCDQuizIdx = 0;
    }
    loadCDQuiz();
  } else {
    showToast('❌ Incorrect answer. Try again! 💡');
  }
}

function closeGigWorkspace() {
  const modal = $id('gig-workspace-modal');
  if (modal) {
    modal.style.display = 'none';
    modal.classList.add('hidden');
  }
  stopWorkspaceVideoCall();
}

function clearWhiteboard() {
  if (!gwWhiteboardCtx) return;
  const canvas = $id('gw-whiteboard');
  gwWhiteboardCtx.fillStyle = '#ffffff';
  gwWhiteboardCtx.fillRect(0, 0, canvas.width, canvas.height);
}

function releaseEscrowFunds() {
  if (!gwActiveGig) return;
  showToast(`Escrow Released! ${gwActiveGig.pay} credited to Creator Wallet! 💰🏆`);
  $id('gw-escrow-status').innerHTML = `Status: Released & Credited ✅ (<strong class="tc-green">${gwActiveGig.pay}</strong>)`;
  $id('gw-release-btn').style.display = 'none';
  
  // Update global balance dynamically!
  const balanceEl = $id('ew-ad-share');
  if (balanceEl) {
    const currentVal = parseFloat(balanceEl.textContent.replace('$', ''));
    const payVal = parseFloat(gwActiveGig.pay.replace('$', '').replace(',', ''));
    balanceEl.textContent = `$${(currentVal + payVal).toFixed(2)}`;
  }
  
  // Add chat alert
  const chatLog = $id('gw-chat-log');
  if (chatLog) {
    chatLog.innerHTML += `
      <div style="background:hsla(155,60%,44%,0.1); padding:6px; border-radius:4px; margin-top:4px">
        <strong>System Milestone alert:</strong> Milestones verified. Escrow contract successfully executed. Funds released to Alex Vance. 🔒➡️💵
      </div>
    `;
    chatLog.scrollTop = chatLog.scrollHeight;
  }
  
  // Trigger satisfying cursor haptic burst
  if (typeof IX !== 'undefined' && IX.burstReaction) {
    IX.burstReaction('💵', window.innerWidth / 2, window.innerHeight / 2);
    setTimeout(() => IX.burstReaction('💎', window.innerWidth / 2, window.innerHeight / 2), 150);
    setTimeout(() => IX.burstReaction('🎉', window.innerWidth / 2, window.innerHeight / 2), 300);
  }
}

function toggleWorkspaceVideoCall() {
  const frame = $id('gw-video-frame');
  const label = $id('gw-video-label');
  if (!frame) return;
  
  if (gwVideoCallActive) {
    stopWorkspaceVideoCall();
    showToast('Video meeting terminated.');
  } else {
    gwVideoCallActive = true;
    showToast('Connecting to secure peer meeting room... 📞');
    if (label) label.textContent = 'Connecting...';
    
    // Inject dynamic canvas for visual feedback
    let canvas = frame.querySelector('canvas');
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.style.position = 'absolute';
      canvas.style.inset = '0';
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      canvas.style.zIndex = '1';
      frame.appendChild(canvas);
    }
    canvas.width = frame.offsetWidth || 300;
    canvas.height = frame.offsetHeight || 120;
    const ctx = canvas.getContext('2d');
    canvas.style.display = 'block';
    if (label) label.style.zIndex = '2'; // keep label readable on top
    
    let phase = 0;
    const renderCallLoop = () => {
      if (!gwVideoCallActive) return;
      ctx.fillStyle = '#05050a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Draw flowing futuristic waveform lines
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let x = 0; x < canvas.width; x++) {
        const y = canvas.height / 2 + 
          Math.sin(x * 0.03 + phase) * 20 * Math.sin(phase * 0.05) + 
          Math.cos(x * 0.01 - phase * 0.8) * 8;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = 'hsla(217, 91%, 60%, 0.8)';
      ctx.stroke();
      
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 0; x < canvas.width; x++) {
        const y = canvas.height / 2 + 
          Math.sin(x * 0.04 - phase * 0.7) * 15 * Math.cos(phase * 0.04) + 
          Math.sin(x * 0.02 + phase) * 5;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = 'hsla(260, 65%, 64%, 0.5)';
      ctx.stroke();

      // Neural connection nodes
      ctx.fillStyle = 'hsla(155, 60%, 44%, 0.8)';
      const nodeX = canvas.width / 2 + Math.cos(phase * 0.03) * 60;
      const nodeY = canvas.height / 2 + Math.sin(phase * 0.05) * 30;
      ctx.beginPath();
      ctx.arc(nodeX, nodeY, 4, 0, Math.PI * 2);
      ctx.fill();
      
      // Node glow
      ctx.strokeStyle = 'hsla(155, 60%, 44%, 0.3)';
      ctx.beginPath();
      ctx.arc(nodeX, nodeY, 12 + Math.sin(phase)*4, 0, Math.PI * 2);
      ctx.stroke();
      
      if (label) label.innerHTML = `📞 <span style="color:var(--green)">Live Peer Connection: Active</span> · Latency: ${Math.floor(18 + Math.random()*8)}ms`;
      phase += 0.08;
      requestAnimationFrame(renderCallLoop);
    };
    setTimeout(renderCallLoop, 800);
  }
}

function sendWorkspaceChat() {
  const inp = $id('gw-chat-input'); if (!inp || !inp.value.trim()) return;
  const log = $id('gw-chat-log'); if (!log) return;
  
  log.innerHTML += `
    <div style="background:rgba(255,255,255,0.06); padding:6px; border-radius:4px; margin-top:4px; align-self:flex-end">
      <strong>You:</strong> ${escapeHTML(inp.value.trim())}
    </div>
  `;
  inp.value = '';
  log.scrollTop = log.scrollHeight;
}

function closeEduReels() {
  const modal = $id('edu-reels-modal'); if (modal) {
    modal.style.display = 'none';
    modal.classList.add('hidden');
  }
}

function toggleBreathingGuide() {
  const btn = $id('breath-start-btn');
  const bubble = $id('breath-bubble');
  const instr = $id('breath-instructions');
  
  if (breathingTimer) {
    clearTimeout(breathingTimer); breathingTimer = null;
    if (btn) btn.textContent = '▶ Start Guide';
    if (instr) instr.textContent = 'Guide paused. Click Start to resume.';
    if (bubble) {
      bubble.style.transform = 'scale(1.0)';
      bubble.style.background = 'var(--blue)';
      bubble.style.boxShadow = 'none';
      bubble.style.transition = 'all 0.8s ease';
    }
    showToast('Breathing guide paused.');
    return;
  }
  
  if (btn) btn.textContent = '⏸ Pause Guide';
  breathingCycle = 1;
  runBreathingSequence();
}

function resetBreathingGuide() {
  if (breathingTimer) { clearTimeout(breathingTimer); breathingTimer = null; }
  const btn = $id('breath-start-btn');       if (btn) btn.textContent = '▶ Start Guide';
  const instr = $id('breath-instructions');   if (instr) instr.textContent = 'Prepare to focus. Click Start.';
  const counter = $id('breath-cycle-count'); if (counter) counter.textContent = 'Cycle: 0 / 4';
  const bubble = $id('breath-bubble');
  if (bubble) {
    bubble.style.transition = 'all 0.5s ease';
    bubble.style.transform = 'scale(1.0)';
    bubble.style.background = 'var(--blue)';
    bubble.style.boxShadow = 'none';
  }
}

function narratePost(id) {
  const post = DATA.posts.find(p => p.id === id);
  if (!post) return;
  narrateText(post.body);
}

function endMockCall() {
  const modal = $id('call-modal');
  if (S.callTimerInterval) { clearInterval(S.callTimerInterval); S.callTimerInterval = null; }

  const duration = S.callSeconds || 0;
  const m = Math.floor(duration / 60);
  const s = duration % 60;

  if (modal) { modal.classList.add('hidden'); }

  S.callConnected = false;
  S.callSeconds = 0;

  if (duration > 0) {
    showToast(`📞 Call ended · Duration: ${(m+'').padStart(2,'0')}:${(s+'').padStart(2,'0')}`);

    // Add call log to chat history
    if (DATA.chatHistory[activeChat]) {
      const now = new Date();
      const time = now.getHours()+':'+(now.getMinutes()+'').padStart(2,'0')+' '+((now.getHours()>=12)?'PM':'AM');
      DATA.chatHistory[activeChat].push({
        me: true,
        text: `📞 Call ended · Duration ${(m+'').padStart(2,'0')}:${(s+'').padStart(2,'0')}`,
        time
      });
      renderMessages(activeChat);
    }
  } else {
    showToast('Call declined.');
  }
}

function openCourseDetails(id) {
  activeCourse = DATA.courses.find(c => c.id === id) || DATA.courses[0];
  const modal = $id('course-detail-modal');
  if (!modal) return;
  
  modal.style.display = 'grid';
  modal.classList.remove('hidden');
  
  $id('cd-title').textContent = activeCourse.title;
  const iconData = get3DIconForEmoji(activeCourse.emoji);
  const titleIcon = $id('cd-title-icon');
  if (titleIcon) {
    titleIcon.textContent = iconData.icon;
    titleIcon.style.color = iconData.color;
  }
  
  // Reset tutor & quiz state
  switchCourseDetailTab('tutor');
  $id('cd-tutor-output').classList.add('hidden');
  $id('cd-mentor-welcome').textContent = `Welcome! I am your Trending Study Buddy. Ask me to narrate core concepts of ${activeCourse.title} using my synthesized voice, or build your custom schedule.`;
  activeCDQuizIdx = 0;
  loadCDQuiz();
  
  // Init mock video trailer animation
  initCourseVideoCanvas();
}

function openGigWorkspace(id) {
  gwActiveGig = DATA.gigs.find(g => g.id === id) || DATA.gigs[0];
  const modal = $id('gig-workspace-modal'); if (!modal) return;
  
  modal.style.display = 'grid';
  modal.classList.remove('hidden');
  $id('gw-title').textContent = `${gwActiveGig.company} · Workspace`;
  
  // Reset escrow status & chats
  $id('gw-escrow-status').innerHTML = `Status: Locked in Escrow 🔒 (Accrued: <strong class="tc-green">${gwActiveGig.pay}</strong>)`;
  $id('gw-release-btn').style.display = 'inline-block';
  
  const chatLog = $id('gw-chat-log');
  if (chatLog) {
    chatLog.innerHTML = `
      <div style="background:rgba(255,255,255,0.04); padding:6px; border-radius:4px">
        <strong>Client [${gwActiveGig.client}]:</strong> Welcome to the ecosystem workspace! Please sketch out your initial wireframe or code flow on the whiteboard, and we can release the held escrow milestones! 🚀
      </div>
    `;
  }
  
  // Init whiteboard drawing canvas
  initWorkspaceWhiteboard();
}

function openEduReels() {
  const modal = $id('edu-reels-modal'); if (!modal) return;
  modal.style.display = 'grid';
  modal.classList.remove('hidden');
  renderEduReels();
}


/* ── GameVerse: Play Store detail + Cloud Stream ──────────────────
   These modals ship in index.html but their handlers were never
   written; implemented here against the existing element IDs. */

window.activePlayStoreGame = window.activePlayStoreGame || { id: 'neon-runner', title: 'Neon Runner Elite' };

function openPlayStoreGame(game) {
  if (game) {
    window.activePlayStoreGame = game;
    const set = (id, val) => { const el = $id(id); if (el && val != null) el.textContent = val; };
    set('ps-game-title', game.title);
    set('ps-game-developer', game.developer);
    set('ps-game-rating', game.rating);
    set('ps-game-downloads', game.downloads);
    if (game.icon) set('ps-game-icon', game.icon);
  }
  resetPlayStoreDownload();
  const m = $id('play-store-modal');
  if (m) { m.classList.remove('hidden'); m.style.display = 'grid'; }
}

function closePlayStoreGame() {
  stopPlayStoreVideo();
  const m = $id('play-store-modal');
  if (m) { m.classList.add('hidden'); m.style.display = 'none'; }
}

function resetPlayStoreDownload() {
  const status = $id('ps-download-status');
  const pct = $id('ps-download-percent');
  const bar = $id('ps-progress-bar-container');
  const fill = $id('ps-progress-bar-fill');
  const btn = $id('ps-install-btn');
  if (status) status.textContent = 'Available on GameVerse Cloud';
  if (pct) pct.textContent = 'Ready';
  if (bar) bar.style.display = 'none';
  if (fill) fill.style.width = '0%';
  if (btn) { btn.disabled = false; btn.style.opacity = '1'; }
}

let psDownloadTimer = null;
function startPlayStoreDownload() {
  if (psDownloadTimer) return;
  const status = $id('ps-download-status');
  const pct = $id('ps-download-percent');
  const bar = $id('ps-progress-bar-container');
  const fill = $id('ps-progress-bar-fill');
  const btn = $id('ps-install-btn');
  if (bar) bar.style.display = '';
  if (btn) { btn.disabled = true; btn.style.opacity = '0.6'; }
  let p = 0;
  psDownloadTimer = setInterval(() => {
    p = Math.min(100, p + Math.random() * 9 + 3);
    if (fill) fill.style.width = p.toFixed(0) + '%';
    if (pct) pct.textContent = p.toFixed(0) + '%';
    if (status) status.textContent = p < 70 ? 'Downloading APK…' : (p < 100 ? 'Verifying signature…' : 'Installed ✓');
    if (p >= 100) {
      clearInterval(psDownloadTimer); psDownloadTimer = null;
      if (pct) pct.textContent = 'Done';
      if (btn) { btn.disabled = false; btn.style.opacity = '1'; }
      if (typeof showToast === 'function') showToast('Installed! Launch from your library 🎮');
    }
  }, 320);
}

let psVideoAnim = null;
function togglePlayStoreVideo() {
  if (psVideoAnim) { stopPlayStoreVideo(); return; }
  const cv = $id('ps-video-canvas');
  const btn = $id('ps-video-play-btn');
  if (!cv) return;
  const ctx = cv.getContext('2d');
  cv.width = cv.clientWidth || 480; cv.height = cv.clientHeight || 270;
  if (btn) btn.innerHTML = '<span class="material-symbols-rounded ms-28">pause</span>';
  let t = 0;
  const draw = () => {
    t += 0.03;
    const g = ctx.createLinearGradient(0, 0, cv.width, cv.height);
    g.addColorStop(0, '#1a0b2e'); g.addColorStop(1, '#0b1a2e');
    ctx.fillStyle = g; ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.strokeStyle = 'rgba(124,77,255,0.55)'; ctx.lineWidth = 2;
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      for (let x = 0; x <= cv.width; x += 8) {
        const y = cv.height / 2 + Math.sin(x * 0.02 + t + i) * (18 + i * 7);
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    psVideoAnim = requestAnimationFrame(draw);
  };
  draw();
}

function stopPlayStoreVideo() {
  if (psVideoAnim) { cancelAnimationFrame(psVideoAnim); psVideoAnim = null; }
  const btn = $id('ps-video-play-btn');
  if (btn) btn.innerHTML = '<span class="material-symbols-rounded ms-28">play_arrow</span>';
}

let cpBootTimer = null, cpAnim = null;
function startCloudStream(gameId) {
  const m = $id('cloud-play-modal');
  if (!m) return;
  m.classList.remove('hidden'); m.style.display = 'grid';
  const title = $id('cp-title');
  const game = window.activePlayStoreGame || {};
  if (title) title.textContent = (game.title || 'GameVerse') + ' · Cloud Stream';
  const pre = $id('cp-precache');
  const status = $id('cp-precache-status');
  const canvas = $id('cp-canvas');
  const pad = $id('cp-virtual-controller');
  if (pre) pre.style.display = '';
  if (canvas) canvas.classList.add('hidden');
  if (pad) pad.classList.add('hidden');

  const steps = ['Connecting to Edge Cloud Node…', 'Allocating GPU slice…', 'Pre-caching APK assets…', 'Negotiating anti-cheat keys…', 'Stream ready — launching…'];
  let i = 0;
  clearInterval(cpBootTimer);
  cpBootTimer = setInterval(() => {
    i++;
    if (status && steps[i]) status.textContent = steps[i];
    if (i >= steps.length - 1) {
      clearInterval(cpBootTimer); cpBootTimer = null;
      if (pre) pre.style.display = 'none';
      if (canvas) canvas.classList.remove('hidden');
      if (pad) pad.classList.remove('hidden');
      runCloudStreamCanvas();
    }
  }, 850);
}

function runCloudStreamCanvas() {
  const cv = $id('cp-canvas'); if (!cv) return;
  const ctx = cv.getContext('2d');
  cv.width = cv.clientWidth || 760; cv.height = cv.clientHeight || 380;
  let t = 0;
  const draw = () => {
    t += 0.04;
    ctx.fillStyle = '#05050c'; ctx.fillRect(0, 0, cv.width, cv.height);
    // horizon grid
    ctx.strokeStyle = 'rgba(0,229,255,0.35)'; ctx.lineWidth = 1;
    const hy = cv.height * 0.55;
    for (let i = 0; i < 14; i++) {
      const y = hy + Math.pow(i / 14, 2) * (cv.height - hy);
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(cv.width, y); ctx.stroke();
    }
    for (let i = -10; i <= 10; i++) {
      ctx.beginPath(); ctx.moveTo(cv.width / 2 + i * 26, hy);
      ctx.lineTo(cv.width / 2 + i * 200, cv.height); ctx.stroke();
    }
    // runner
    const rx = cv.width / 2 + Math.sin(t) * 90;
    ctx.fillStyle = '#ff4081';
    ctx.fillRect(rx - 9, hy + 40 + Math.abs(Math.sin(t * 3)) * -14, 18, 28);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = '600 12px Inter, sans-serif';
    ctx.fillText('60 FPS · 12ms · Edge: Mumbai', 14, 22);
    cpAnim = requestAnimationFrame(draw);
  };
  draw();
}

function closeCloudStream() {
  clearInterval(cpBootTimer); cpBootTimer = null;
  if (cpAnim) { cancelAnimationFrame(cpAnim); cpAnim = null; }
  const m = $id('cloud-play-modal');
  if (m) { m.classList.add('hidden'); m.style.display = 'none'; }
}
