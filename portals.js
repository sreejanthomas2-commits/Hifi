function clickCategory(cat) {
  // Toggle chip active classes
  document.querySelectorAll('.cat-chip').forEach(c => c.classList.remove('active'));
  const activeChips = Array.from(document.querySelectorAll('.cat-chip')).filter(c => c.textContent.toLowerCase().includes(cat));
  if (activeChips.length) activeChips[0].classList.add('active');
  
  // Hide full category modal if open
  $id('category-modal')?.classList.add('hidden');
  
  if (cat === 'all') {
    navigateTo('feeds');
    return;
  }
  
  S.selectedCategory = cat;
  
  // 1. Navigation MUST happen first so the target pane/elements are appended to DOM!
  navigateTo('category');
  
  // Set headers dynamically
  const titles = {
    ai: '<span class="material-symbols-rounded emoji-3d" style="font-size:24px; color:var(--purple); vertical-align:middle; margin-right:6px">smart_toy</span><span>Artificial Intelligence</span>',
    fitness: '<span class="material-symbols-rounded emoji-3d" style="font-size:24px; color:var(--green); vertical-align:middle; margin-right:6px">fitness_center</span><span>Fitness & Wellness</span>',
    design: '<span class="material-symbols-rounded emoji-3d" style="font-size:24px; color:var(--pink); vertical-align:middle; margin-right:6px">palette</span><span>Design & Art</span>',
    tech: '<span class="material-symbols-rounded emoji-3d" style="font-size:24px; color:var(--blue); vertical-align:middle; margin-right:6px">terminal</span><span>Tech & Coding</span>',
    gaming: '<span class="material-symbols-rounded emoji-3d" style="font-size:24px; color:var(--orange); vertical-align:middle; margin-right:6px">sports_esports</span><span>Gaming</span> Feed',
    travel: '<span class="material-symbols-rounded emoji-3d" style="font-size:24px; color:var(--blue); vertical-align:middle; margin-right:6px">public</span><span>Travel & Culture</span>',
    music: '<span class="material-symbols-rounded emoji-3d" style="font-size:24px; color:var(--pink); vertical-align:middle; margin-right:6px">music_note</span><span>Music & Audio</span>',
    finance: '<span class="material-symbols-rounded emoji-3d" style="font-size:24px; color:var(--green); vertical-align:middle; margin-right:6px">trending_up</span><span>Finance & Business</span>',
    food: '<span class="material-symbols-rounded emoji-3d" style="font-size:24px; color:var(--orange); vertical-align:middle; margin-right:6px">local_pizza</span><span>Food & Lifestyle</span>',
    startup: '<span class="material-symbols-rounded emoji-3d" style="font-size:24px; color:var(--purple); vertical-align:middle; margin-right:6px">rocket_launch</span><span>Startups</span> Hub'
  };
  const descs = {
    ai: 'Tech news, new developments in AI, model releases.',
    fitness: 'Fitness feeds, workout posts, and related video guides.',
    design: 'Design posts, photo/video showcases, and creative community.',
    tech: 'Developer product sprints, coding guides, and tech feeds.',
    gaming: 'Play cyber retro console shooters, track skins, and mods listings.',
    travel: 'Travel vlogs, location posts, and cultural photo/video logs.',
    music: 'Live lyrically synchronized beats visualizer and songwriting workspace.',
    finance: 'Business news, real-time data, and live crypto market updates.',
    food: 'Food news, recipe posts, and lifestyle photography/video.',
    startup: 'Startup hub news, pitch videos, and startup spotlights.'
  };
  
  // 2. Element lookup will now succeed since navigateTo constructed them
  const titleEl = $id('cat-title'); if (titleEl) titleEl.innerHTML = titles[cat] || `<span class="material-symbols-rounded emoji-3d" style="font-size:24px; color:var(--blue); vertical-align:middle; margin-right:6px">explore</span><span>${cat.charAt(0).toUpperCase() + cat.slice(1)}</span> Portal`;
  const descEl = $id('cat-description'); if (descEl) descEl.textContent = descs[cat] || 'Explore advanced multimedia feeds.';
  
  renderCategoryPortal(cat);
}

function renderCategoryPortal(cat) {
  const portal = $id('cat-dynamic-content'); if (!portal) return;
  
  if (cat === 'ai') {
    portal.innerHTML = `
      <div class="grid-2 mb16">
        <div class="card p20">
          <h3 class="fw8 mb12 tc-1"><span class="material-symbols-rounded emoji-3d" style="color:var(--purple)">newspaper</span> Latest AI News</h3>
          <div class="flex-col gap12">
            <div style="background:var(--card2); padding:12px; border-radius:12px">
              <div class="fs12 tc-3 mb4">Breaking • 2h ago</div>
              <div class="fw7 fs14 tc-1">DeepSeek releases Flash V4 with 1M context window</div>
            </div>
            <div style="background:var(--card2); padding:12px; border-radius:12px">
              <div class="fs12 tc-3 mb4">Tech • 5h ago</div>
              <div class="fw7 fs14 tc-1">OpenAI introduces Sora plugins for video editing</div>
            </div>
            <div style="background:var(--card2); padding:12px; border-radius:12px">
              <div class="fs12 tc-3 mb4">Research • 1d ago</div>
              <div class="fw7 fs14 tc-1">New breakthrough in autonomous agent reasoning</div>
            </div>
          </div>
        </div>
        <div class="card p20">
          <h3 class="fw8 mb12 tc-1"><span class="material-symbols-rounded emoji-3d" style="color:var(--blue)">code</span> Model Releases</h3>
          <p class="tc-2 fs13 mb12">Track real-time deployments of open-source models.</p>
          <div style="height:150px; background:var(--bg); border-radius:12px; display:flex; align-items:flex-end; padding:12px; gap:8px">
            <div style="width:20%; height:40%; background:var(--purple); border-radius:4px"></div>
            <div style="width:20%; height:60%; background:var(--purple); border-radius:4px"></div>
            <div style="width:20%; height:30%; background:var(--purple); border-radius:4px"></div>
            <div style="width:20%; height:90%; background:var(--purple); border-radius:4px"></div>
            <div style="width:20%; height:100%; background:var(--blue); border-radius:4px"></div>
          </div>
        </div>
      </div>
    `;
  } else if (cat === 'fitness') {
    portal.innerHTML = `
      <div class="grid-2 mb16">
        <div class="card p20">
          <h3 class="fw8 mb12 tc-1"><span class="material-symbols-rounded emoji-3d" style="color:var(--green)">play_circle</span> Workout Videos</h3>
          <div style="aspect-ratio:16/9; background:#111; border-radius:12px; position:relative; overflow:hidden" class="mb12">
            <img src="https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=500&q=80" style="width:100%; height:100%; object-fit:cover; opacity:0.6">
            <span class="material-symbols-rounded" style="position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); font-size:48px; color:white">play_circle</span>
            <div style="position:absolute; bottom:12px; left:12px; color:white; font-weight:700">15-Min Core Crusher</div>
          </div>
          <div class="flex gap8">
            <div style="flex:1; aspect-ratio:16/9; background:var(--card2); border-radius:8px"></div>
            <div style="flex:1; aspect-ratio:16/9; background:var(--card2); border-radius:8px"></div>
          </div>
        </div>
        <div class="card p20">
          <h3 class="fw8 mb12 tc-1"><span class="material-symbols-rounded emoji-3d" style="color:var(--orange)">forum</span> Fitness Feed</h3>
          <div class="flex-col gap12">
            <div class="flex gap12 align-start" style="padding-bottom:12px; border-bottom:1px solid var(--border)">
              <div class="avatar av-sm">💪</div>
              <div><div class="fw7 fs14 tc-1">@fitguru</div><div class="fs13 tc-2">Just hit a new PR on deadlifts! 405lbs for 3 reps. Consistency is key! 🔥</div></div>
            </div>
            <div class="flex gap12 align-start">
              <div class="avatar av-sm">🥗</div>
              <div><div class="fw7 fs14 tc-1">@healthylife</div><div class="fs13 tc-2">Don't forget your macros today. Try this high-protein avocado toast recipe...</div></div>
            </div>
          </div>
        </div>
      </div>
    `;
  } else if (cat === 'design') {
    portal.innerHTML = `
      <div class="card p20 mb16">
        <h3 class="fw8 mb12 tc-1"><span class="material-symbols-rounded emoji-3d" style="color:var(--pink)">collections</span> Design Showcase</h3>
        <div class="grid-3 gap8" style="margin-top:16px">
          <img src="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=300&q=80" style="width:100%; height:120px; object-fit:cover; border-radius:8px">
          <img src="https://images.unsplash.com/photo-1561070791-2526d30994b5?auto=format&fit=crop&w=300&q=80" style="width:100%; height:120px; object-fit:cover; border-radius:8px">
          <img src="https://images.unsplash.com/photo-1558655146-d09347e92766?auto=format&fit=crop&w=300&q=80" style="width:100%; height:120px; object-fit:cover; border-radius:8px">
        </div>
      </div>
      <div class="grid-2 mb16">
        <div class="card p20">
          <h3 class="fw8 mb12 tc-1"><span class="material-symbols-rounded emoji-3d" style="color:var(--blue)">article</span> Community Posts</h3>
          <div class="fs13 tc-2 mb12">Join the conversation with other creators.</div>
          <button class="btn btn-primary btn-sm w100">Join "UI/UX Masters" Group</button>
        </div>
        <div class="card p20">
          <h3 class="fw8 mb12 tc-1"><span class="material-symbols-rounded emoji-3d" style="color:var(--orange)">videocam</span> Process Videos</h3>
          <div style="aspect-ratio:16/9; background:var(--card2); border-radius:8px; display:grid; place-items:center">
            <span class="material-symbols-rounded" style="font-size:32px; color:var(--t2)">play_arrow</span>
          </div>
        </div>
      </div>
    `;
  } else if (cat === 'tech') {
    portal.innerHTML = `
      <div class="grid-2 mb16">
        <div class="card p20">
          <h3 class="fw8 mb12 tc-1"><span class="material-symbols-rounded emoji-3d" style="color:var(--blue)">code</span> Tech Feed</h3>
          <div class="flex-col gap12">
            <div style="padding:12px; border-left:3px solid var(--blue); background:var(--card2); border-radius:4px 8px 8px 4px">
              <div class="fw7 fs14 tc-1">React 19 Release Notes</div>
              <div class="fs12 tc-3">Read about the new compiler and hooks.</div>
            </div>
            <div style="padding:12px; border-left:3px solid var(--green); background:var(--card2); border-radius:4px 8px 8px 4px">
              <div class="fw7 fs14 tc-1">Optimizing Postgres Queries</div>
              <div class="fs12 tc-3">A guide to EXPLAIN ANALYZE.</div>
            </div>
          </div>
        </div>
        <div class="card p20">
          <h3 class="fw8 mb12 tc-1"><span class="material-symbols-rounded emoji-3d" style="color:var(--orange)">terminal</span> Code Snippets</h3>
          <pre style="background:#1e1e1e; color:#d4d4d4; padding:16px; border-radius:8px; font-family:monospace; font-size:12px; overflow-x:auto;">
function debounce(fn, t) {
  let timer;
  return function(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => {
      fn.apply(this, args);
    }, t);
  }
}</pre>
        </div>
      </div>
    `;
  } else if (cat === 'gaming') {
    portal.innerHTML = `
      <div class="card p20 mb16" style="background: linear-gradient(45deg, #1a0b2e, #000); border: 1px solid var(--purple)">
        <h3 class="fw8 mb12 tc-1" style="color: #00ffcc"><span class="material-symbols-rounded emoji-3d">sports_esports</span> Cyber Gaming Feed</h3>
        <div class="grid-2 gap16 mt16">
          <div style="border-radius:12px; overflow:hidden; border:1px solid #00ffcc44">
            <img src="https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=400&q=80" style="width:100%; aspect-ratio:16/9; object-fit:cover">
            <div style="padding:12px; background:#000">
              <div class="fw7 tc-1 fs13">Top 10 Plays of the Week</div>
              <div class="tc-3 fs11">Esports Arena</div>
            </div>
          </div>
          <div style="border-radius:12px; overflow:hidden; border:1px solid #ff00ff44">
            <img src="https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=400&q=80" style="width:100%; aspect-ratio:16/9; object-fit:cover">
            <div style="padding:12px; background:#000">
              <div class="fw7 tc-1 fs13">New Retro Shooters Mods</div>
              <div class="tc-3 fs11">Community Uploads</div>
            </div>
          </div>
        </div>
      </div>
    `;
  } else if (cat === 'travel') {
    portal.innerHTML = `
      <div class="card p20 mb16">
        <h3 class="fw8 mb12 tc-1"><span class="material-symbols-rounded emoji-3d" style="color:var(--blue)">flight_takeoff</span> Travel Vlogs & Photo</h3>
        <div style="aspect-ratio:21/9; border-radius:16px; overflow:hidden; position:relative" class="mb16">
          <img src="https://images.unsplash.com/photo-1499856871958-5b9627545d1a?auto=format&fit=crop&w=800&q=80" style="width:100%; height:100%; object-fit:cover">
          <div style="position:absolute; bottom:0; left:0; right:0; padding:32px 20px 20px; background:linear-gradient(transparent, rgba(0,0,0,0.8)); color:white">
            <div class="fw8 fs20">48 Hours in Paris</div>
            <div class="fs13 opacity-80">Cinematic Vlog by @wanderlust</div>
          </div>
        </div>
        <div class="grid-3 gap8">
          <img src="https://images.unsplash.com/photo-1506973035872-a4ec16b8e8d9?auto=format&fit=crop&w=200&q=80" style="width:100%; aspect-ratio:1; object-fit:cover; border-radius:8px">
          <img src="https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?auto=format&fit=crop&w=200&q=80" style="width:100%; aspect-ratio:1; object-fit:cover; border-radius:8px">
          <img src="https://images.unsplash.com/photo-1523906834658-6e24ef2386f9?auto=format&fit=crop&w=200&q=80" style="width:100%; aspect-ratio:1; object-fit:cover; border-radius:8px">
        </div>
      </div>
    `;
  } else if (cat === 'music') {
    portal.innerHTML = `
      <div class="grid-2 mb16">
        <div class="card p20">
          <h3 class="fw8 mb12 tc-1"><span class="material-symbols-rounded emoji-3d" style="color:var(--pink)">graphic_eq</span> Audio Visualizer</h3>
          <div style="height:120px; background:#111; border-radius:12px; display:flex; align-items:flex-end; padding:12px; gap:4px">
            ${Array.from({length:20}).map(() => `<div style="flex:1; background:var(--pink); height:${Math.random()*100}%; border-radius:2px"></div>`).join('')}
          </div>
          <div class="flex-between mt12">
            <span class="fs12 tc-2">Lo-Fi Study Beats</span>
            <span class="material-symbols-rounded" style="color:var(--pink)">play_circle</span>
          </div>
        </div>
        <div class="card p20">
          <h3 class="fw8 mb12 tc-1"><span class="material-symbols-rounded emoji-3d" style="color:var(--orange)">library_music</span> Music Feed</h3>
          <div class="flex-col gap8">
            <div class="flex gap12 align-center p8" style="background:var(--card2); border-radius:8px">
              <div class="avatar av-sm">🎹</div>
              <div style="flex:1"><div class="fw7 fs13 tc-1">New Synth Pack</div><div class="fs11 tc-3">@producer_x</div></div>
            </div>
            <div class="flex gap12 align-center p8" style="background:var(--card2); border-radius:8px">
              <div class="avatar av-sm">🎤</div>
              <div style="flex:1"><div class="fw7 fs13 tc-1">Vocal Mixing Tutorial</div><div class="fs11 tc-3">@audioeng</div></div>
            </div>
          </div>
        </div>
      </div>
    `;
  } else if (cat === 'finance') {
    portal.innerHTML = `
      <div class="grid-2 mb16">
        <div class="card p20">
          <h3 class="fw8 mb12 tc-1"><span class="material-symbols-rounded emoji-3d" style="color:var(--green)">candlestick_chart</span> Live Crypto Data</h3>
          <div class="flex-between mb12 pb12" style="border-bottom:1px solid var(--border)">
            <div>
              <div class="fs12 tc-3">BTC/USD</div>
              <div class="fw8 fs20" style="color:var(--green)">$64,230.50</div>
            </div>
            <div class="tc-right">
              <div class="fs12 tc-3">24h Change</div>
              <div class="fw8 fs16" style="color:var(--green)">+4.2% 📈</div>
            </div>
          </div>
          <div class="flex-between pb12">
            <div>
              <div class="fs12 tc-3">ETH/USD</div>
              <div class="fw8 fs16" style="color:var(--green)">$3,420.10</div>
            </div>
            <div class="tc-right">
              <div class="fs12 tc-3">24h Change</div>
              <div class="fw8 fs14" style="color:var(--green)">+2.8% 📈</div>
            </div>
          </div>
        </div>
        <div class="card p20">
          <h3 class="fw8 mb12 tc-1"><span class="material-symbols-rounded emoji-3d" style="color:var(--blue)">feed</span> Business News</h3>
          <div class="flex-col gap12">
            <div>
              <div class="fs11 tc-3 mb4">Markets • Just Now</div>
              <div class="fw7 fs13 tc-1">Federal Reserve announces new rate changes.</div>
            </div>
            <div>
              <div class="fs11 tc-3 mb4">Tech Finance • 1h ago</div>
              <div class="fw7 fs13 tc-1">AI startup valuations reach record highs in Q3.</div>
            </div>
          </div>
        </div>
      </div>
    `;
  } else if (cat === 'food') {
    portal.innerHTML = `
      <div class="card p20 mb16">
        <h3 class="fw8 mb12 tc-1"><span class="material-symbols-rounded emoji-3d" style="color:var(--orange)">restaurant</span> Food & Lifestyle Feed</h3>
        <div class="grid-2 gap12 mb16">
          <div style="aspect-ratio:4/5; border-radius:12px; overflow:hidden; position:relative">
            <img src="https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=300&q=80" style="width:100%; height:100%; object-fit:cover">
            <div style="position:absolute; bottom:0; left:0; right:0; padding:16px; background:linear-gradient(transparent, rgba(0,0,0,0.8)); color:white">
              <div class="fw7 fs14">Spicy Ramen Guide</div>
            </div>
          </div>
          <div class="flex-col gap12">
            <div style="border-radius:8px; overflow:hidden; flex:1; position:relative">
              <img src="https://images.unsplash.com/photo-1495474472201-41584c361eb2?auto=format&fit=crop&w=300&q=80" style="width:100%; height:100%; object-fit:cover">
            </div>
            <div style="border-radius:8px; overflow:hidden; flex:1; position:relative">
              <img src="https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=300&q=80" style="width:100%; height:100%; object-fit:cover">
            </div>
          </div>
        </div>
      </div>
    `;
  } else if (cat === 'startup') {
    portal.innerHTML = `
      <div class="card p20 mb16" style="background:var(--card2)">
        <div class="flex-between mb16">
          <h3 class="fw8 tc-1"><span class="material-symbols-rounded emoji-3d" style="color:var(--purple)">rocket_launch</span> Startup Hub</h3>
          <button class="btn btn-primary btn-sm">Submit Pitch</button>
        </div>
        <div class="grid-3 gap12">
          <div class="card p16" style="background:var(--bg)">
            <div class="avatar av-md mb8" style="background:var(--purple)">AI</div>
            <div class="fw7 fs14 tc-1 mb4">NeuroFlow AI</div>
            <div class="fs12 tc-2 mb8">Seed Round • $2M Raised</div>
            <button class="btn btn-ghost btn-sm w100">View Pitch Deck</button>
          </div>
          <div class="card p16" style="background:var(--bg)">
            <div class="avatar av-md mb8" style="background:var(--green)">ECO</div>
            <div class="fw7 fs14 tc-1 mb4">GreenGrid</div>
            <div class="fs12 tc-2 mb8">Series A • $10M Raised</div>
            <button class="btn btn-ghost btn-sm w100">View Pitch Deck</button>
          </div>
          <div class="card p16" style="background:var(--bg)">
            <div class="avatar av-md mb8" style="background:var(--blue)">FIN</div>
            <div class="fw7 fs14 tc-1 mb4">PayStream</div>
            <div class="fs12 tc-2 mb8">Pre-Seed • Raising</div>
            <button class="btn btn-ghost btn-sm w100">View Pitch Deck</button>
          </div>
        </div>
      </div>
    `;
  } else {
    // Fallback
    portal.innerHTML = `<div class="card p20 tc-center tc-2">Feed content for <strong>${cat}</strong> coming soon.</div>`;
  }
}
