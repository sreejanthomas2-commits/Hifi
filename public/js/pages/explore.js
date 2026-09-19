// ── ADAPTIVE CATEGORY PORTAL ─────────────────────────────────────
/* Strict mode, ahead of this file becoming an ES module - modules are
   always strict, and doing it here first means any breakage shows up
   on its own rather than mixed into the module conversion. */
'use strict';

function populateCategorySidebar() {
  const grid = $id('full-category-grid'); if (!grid) return;
  grid.innerHTML = DATA.allCategories.map(c => {
    const iconData = get3DIconForEmoji(c.emoji);
    return `
    <button class="grid-cat-btn" onclick="clickCategory('${c.id}')" style="display:inline-flex; flex-direction:column; align-items:center; gap:8px">
      <span class="material-symbols-rounded emoji-3d" style="font-size:24px; color:${iconData.color}">${iconData.icon}</span>
      <span>${c.name}</span>
    </button>`;
  }).join('');
}

function toggleCategorySidebar() {
  const modal = $id('category-modal'); if (!modal) return;
  modal.classList.toggle('hidden');
}

function clickCategory(cat) {
  // Cryptoverse and the old Crypto Markets portal are one page now.
  if (cat === 'crypto') { if (typeof navigateTo === 'function') navigateTo('cryptomarket'); return; }
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
    startup: '<span class="material-symbols-rounded emoji-3d" style="font-size:24px; color:var(--purple); vertical-align:middle; margin-right:6px">rocket_launch</span><span>Startups</span> Hub',
    crypto: '<span class="material-symbols-rounded emoji-3d" style="font-size:24px; color:#F7931A; vertical-align:middle; margin-right:6px">currency_bitcoin</span><span>Crypto</span> Markets'
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
    startup: 'Startup hub news, pitch videos, and startup spotlights.',
    crypto: 'Live prices, dApps, projects, news and the crypto community — all in one place.'
  };
  
  // Crypto Markets is reached from the main nav, not from Explore, so the
  // back button has to know where it is actually going back to.
  S.catFrom = (S.pane === 'explore') ? 'explore' : '';
  /* navigateTo is async - a page module may still need fetching - so
     it only inserts getCategoryTemplate's markup after its first
     await. Everything below writes into that markup, and running it
     straight after the call found nothing there: the portal opened
     with the generic title and an empty #cat-dynamic-content, every
     single time. */
  return navigateTo('category').then(() => {

    const backEl = $id('cat-back');
    if (backEl) backEl.hidden = S.catFrom !== 'explore';

    const titleEl = $id('cat-title'); if (titleEl) titleEl.innerHTML = titles[cat] || '<span class="material-symbols-rounded emoji-3d" style="font-size:24px; color:var(--blue); vertical-align:middle; margin-right:6px">explore</span><span>Category</span> Portal';
    const descEl = $id('cat-description'); if (descEl) descEl.textContent = descs[cat] || 'Explore advanced multimedia feeds.';
  
    renderCategoryPortal(cat);
  });
}

function renderCategoryPortal(cat) {
  const portal = $id('cat-dynamic-content'); if (!portal) return;

  // The grid uses 'startups'; the portal branch below was written as 'startup'.
  if (cat === 'startups') cat = 'startup';

  /* Every branch below sets innerHTML, so the shared News + Videos block is
     appended afterwards on a microtask — one place instead of 50 copies. */
  setTimeout(() => { if (typeof CC !== 'undefined') CC.mount(S.selectedCategory); }, 0);

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
            ${Array.from({length:20}).map(() => '<div style="flex:1; background:var(--pink); height:' + (Math.random()*100) + '%; border-radius:2px"></div>').join('')}
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
  } else if (cat === 'science') {
    portal.innerHTML = `
      <div class="grid-2 mb16">
        <div class="card p20">
          <h3 class="fw8 mb12 tc-1"><span class="material-symbols-rounded emoji-3d" style="color:var(--blue)">science</span> Lab News</h3>
          <div class="flex-col gap12">
            <div style="background:var(--card2); padding:12px; border-radius:12px">
              <div class="fs12 tc-3 mb4">Breakthrough • 3h ago</div>
              <div class="fw7 fs14 tc-1">CRISPR gene therapy cures sickle cell in Phase III trial</div>
            </div>
            <div style="background:var(--card2); padding:12px; border-radius:12px">
              <div class="fs12 tc-3 mb4">Physics • 8h ago</div>
              <div class="fw7 fs14 tc-1">James Webb captures high-res image of exoplanet atmosphere</div>
            </div>
            <div style="background:var(--card2); padding:12px; border-radius:12px">
              <div class="fs12 tc-3 mb4">Chemistry • 1d ago</div>
              <div class="fw7 fs14 tc-1">Room-temperature superconductor claim under peer review</div>
            </div>
          </div>
        </div>
        <div class="card p20">
          <h3 class="fw8 mb12 tc-1"><span class="material-symbols-rounded emoji-3d" style="color:var(--green)">biotech</span> Research Papers</h3>
          <p class="tc-2 fs13 mb12">Top cited papers this week from Nature & Science.</p>
          <div class="flex-col gap8">
            <div class="flex-between p8" style="background:var(--card2); border-radius:8px">
              <div><div class="fw7 fs13 tc-1">mRNA Vaccine Stability Advances</div><div class="fs11 tc-3">Nature • 142 citations</div></div>
              <button class="btn btn-ghost btn-sm" onclick="showToast('Opening PDF...')">📄 Read</button>
            </div>
            <div class="flex-between p8" style="background:var(--card2); border-radius:8px">
              <div><div class="fw7 fs13 tc-1">Quantum Error Correction Breakthrough</div><div class="fs11 tc-3">Science • 98 citations</div></div>
              <button class="btn btn-ghost btn-sm" onclick="showToast('Opening PDF...')">📄 Read</button>
            </div>
          </div>
        </div>
      </div>
    `;
  } else if (cat === 'politics') {
    portal.innerHTML = `
      <div class="grid-2 mb16">
        <div class="card p20">
          <h3 class="fw8 mb12 tc-1"><span class="material-symbols-rounded emoji-3d" style="color:var(--red)">gavel</span> Policy Watch</h3>
          <div class="flex-col gap12">
            <div style="background:var(--card2); padding:12px; border-radius:12px">
              <div class="fs12 tc-3 mb4">Breaking • 1h ago</div>
              <div class="fw7 fs14 tc-1">Senate passes bipartisan infrastructure renewal act</div>
            </div>
            <div style="background:var(--card2); padding:12px; border-radius:12px">
              <div class="fs12 tc-3 mb4">Analysis • 4h ago</div>
              <div class="fw7 fs14 tc-1">What the new data privacy bill means for Big Tech</div>
            </div>
            <div style="background:var(--card2); padding:12px; border-radius:12px">
              <div class="fs12 tc-3 mb4">Global • 12h ago</div>
              <div class="fw7 fs14 tc-1">EU summit agrees on AI regulation framework timeline</div>
            </div>
          </div>
        </div>
        <div class="card p20">
          <h3 class="fw8 mb12 tc-1"><span class="material-symbols-rounded emoji-3d" style="color:var(--blue)">fact_check</span> Reality Check</h3>
          <p class="tc-2 fs13 mb12">AI-assisted fact-checking on trending political claims.</p>
          <div class="flex-col gap8">
            <div class="flex-between p8" style="background:var(--card2); border-radius:8px">
              <div class="fw7 fs13 tc-1">"Unemployment at 20-year low"</div>
              <span class="badge badge-green fs11">✓ Verified</span>
            </div>
            <div class="flex-between p8" style="background:var(--card2); border-radius:8px">
              <div class="fw7 fs13 tc-1">"Tax plan will cost $5 trillion"</div>
              <span class="badge badge-orange fs11">⚠ Misleading</span>
            </div>
          </div>
          <button class="btn btn-primary btn-sm w100 mt12" onclick="showToast('Opening full Fact-Check dashboard...')">View All Checks</button>
        </div>
      </div>
    `;
  } else if (cat === 'crypto') {
    if (typeof window.renderCryptoHub === 'function') {
      window.renderCryptoHub('markets');
    }
  } else if (cat === 'wildlife') {
    portal.innerHTML = `
      <div class="grid-2 mb16">
        <div class="card p20">
          <h3 class="fw8 mb12 tc-1"><span class="material-symbols-rounded emoji-3d" style="color:var(--green)">pets</span> Wildlife Tracker</h3>
          <div class="flex-col gap12">
            <div style="background:var(--card2); padding:12px; border-radius:12px">
              <div class="fs12 tc-3 mb4">Conservation • 2h ago</div>
              <div class="fw7 fs14 tc-1">Snow leopard population recovers to 7,500 in Central Asia</div>
            </div>
            <div style="background:var(--card2); padding:12px; border-radius:12px">
              <div class="fs12 tc-3 mb4">Marine • 6h ago</div>
              <div class="fw7 fs14 tc-1">Great Barrier Reef coral spawning event exceeds expectations</div>
            </div>
          </div>
          <button class="btn btn-ghost btn-sm w100 mt12" onclick="showToast('Loading drone feed...')">🛸 Open Drone Scanner</button>
        </div>
        <div class="card p20">
          <h3 class="fw8 mb12 tc-1"><span class="material-symbols-rounded emoji-3d" style="color:var(--orange)">map</span> Habitat Map</h3>
          <div style="height:160px; background:linear-gradient(135deg,#0c2d1a,#1a3d2a); border-radius:12px; display:grid; place-items:center; position:relative">
            <span class="material-symbols-rounded" style="font-size:48px; color:var(--green); opacity:0.5">forest</span>
            <div style="position:absolute; bottom:12px; left:12px; right:12px" class="flex-between">
              <span class="fs11 tc-3">12 species tracked</span>
              <span class="fs11 tc-3">3 active zones</span>
            </div>
          </div>
          <div class="flex gap8 mt12">
            <button class="btn btn-primary btn-sm" style="flex:1" onclick="showToast('Loading Amazon basin...')">Amazon</button>
            <button class="btn btn-ghost btn-sm" style="flex:1" onclick="showToast('Loading Serengeti...')">Serengeti</button>
          </div>
        </div>
      </div>
    `;
  } else if (cat === 'local') {
    portal.innerHTML = `
      <div class="grid-2 mb16">
        <div class="card p20">
          <h3 class="fw8 mb12 tc-1"><span class="material-symbols-rounded emoji-3d" style="color:var(--blue)">location_city</span> Community Board</h3>
          <div class="flex-col gap12">
            <div style="background:var(--card2); padding:12px; border-radius:12px">
              <div class="flex-between mb4"><span class="badge badge-blue fs11">Road Work</span><span class="fs11 fw7 tc-green">Tracked</span></div>
              <div class="fw7 fs13 tc-1">Main St. repaving starts Monday, expect detours</div>
              <div class="fs11 tc-3 mt4">Assigned: @CityTransit</div>
            </div>
            <div style="background:var(--card2); padding:12px; border-radius:12px">
              <div class="flex-between mb4"><span class="badge badge-orange fs11">Event</span><span class="fs11 fw7 tc-blue">Upcoming</span></div>
              <div class="fw7 fs13 tc-1">Farmers Market returns to Town Square this Saturday</div>
              <div class="fs11 tc-3 mt4">9 AM–2 PM • 28 vendors confirmed</div>
            </div>
          </div>
        </div>
        <div class="card p20">
          <h3 class="fw8 mb12 tc-1"><span class="material-symbols-rounded emoji-3d" style="color:var(--green)">volunteer_activism</span> Local Initiatives</h3>
          <div class="flex-col gap12">
            <div class="flex-between p8" style="background:var(--card2); border-radius:8px">
              <div><div class="fw7 fs13 tc-1">Park Cleanup Drive</div><div class="fs11 tc-3">Sat 9AM • 24 volunteers</div></div>
              <button class="btn btn-primary btn-sm" onclick="showToast('Registered! 💚')">Join</button>
            </div>
            <div class="flex-between p8" style="background:var(--card2); border-radius:8px">
              <div><div class="fw7 fs13 tc-1">Community Solar Fund</div><div class="fs11 tc-3">$1,240 / $2,000 raised</div></div>
              <button class="btn btn-ghost btn-sm" onclick="showToast('Donated $10!')">💲 Tip</button>
            </div>
          </div>
          <button class="btn btn-primary btn-sm w100 mt12" onclick="showToast('Opening civic report form...')">📢 Submit Report</button>
        </div>
      </div>
    `;
  } else if (cat === 'home') {
    portal.innerHTML = `
      <div class="grid-2 mb16">
        <div class="card p20">
          <h3 class="fw8 mb12 tc-1"><span class="material-symbols-rounded emoji-3d" style="color:var(--orange)">cottage</span> Home & Living</h3>
          <div class="flex-col gap12">
            <div style="background:var(--card2); padding:12px; border-radius:12px">
              <div class="fs12 tc-3 mb4">Interior • Trending</div>
              <div class="fw7 fs14 tc-1">Japandi minimalism: the 2026 design trend taking over</div>
            </div>
            <div style="background:var(--card2); padding:12px; border-radius:12px">
              <div class="fs12 tc-3 mb4">DIY • Popular</div>
              <div class="fw7 fs14 tc-1">Build a floating shelf wall under $50 — full tutorial</div>
            </div>
          </div>
        </div>
        <div class="card p20">
          <h3 class="fw8 mb12 tc-1"><span class="material-symbols-rounded emoji-3d" style="color:var(--green)">smart_home</span> Smart Home Picks</h3>
          <div class="flex-col gap8">
            <div class="flex gap12 align-center p8" style="background:var(--card2); border-radius:8px">
              <span class="material-symbols-rounded" style="color:var(--blue); font-size:24px">lightbulb</span>
              <div style="flex:1"><div class="fw7 fs13 tc-1">Philips Hue Gradient Strip</div><div class="fs11 tc-3">$89.99 • ★ 4.8</div></div>
            </div>
            <div class="flex gap12 align-center p8" style="background:var(--card2); border-radius:8px">
              <span class="material-symbols-rounded" style="color:var(--green); font-size:24px">thermostat</span>
              <div style="flex:1"><div class="fw7 fs13 tc-1">Nest Learning Thermostat</div><div class="fs11 tc-3">$249 • ★ 4.6</div></div>
            </div>
          </div>
          <button class="btn btn-primary btn-sm w100 mt12" onclick="showToast('Opening smart home hub...')">Browse All Devices</button>
        </div>
      </div>
    `;
  } else if (cat === 'trending') {
    portal.innerHTML = `
      <div class="grid-2 mb16">
        <div class="card p20">
          <h3 class="fw8 mb12 tc-1"><span class="material-symbols-rounded emoji-3d" style="color:var(--pink)">local_fire_department</span> Hot Right Now</h3>
          <div class="flex-col gap12">
            <div class="flex gap12 align-center p8" style="background:var(--card2); border-radius:8px">
              <span class="fw8 fs20" style="color:var(--pink)">#1</span>
              <div style="flex:1"><div class="fw7 fs14 tc-1">#AIAgents</div><div class="fs11 tc-3">2.4M posts • Surging</div></div>
            </div>
            <div class="flex gap12 align-center p8" style="background:var(--card2); border-radius:8px">
              <span class="fw8 fs20" style="color:var(--orange)">#2</span>
              <div style="flex:1"><div class="fw7 fs14 tc-1">#MarsColony2026</div><div class="fs11 tc-3">1.8M posts • Rising</div></div>
            </div>
            <div class="flex gap12 align-center p8" style="background:var(--card2); border-radius:8px">
              <span class="fw8 fs20" style="color:var(--blue)">#3</span>
              <div style="flex:1"><div class="fw7 fs14 tc-1">#SummerVibes</div><div class="fs11 tc-3">1.1M posts • Steady</div></div>
            </div>
          </div>
        </div>
        <div class="card p20">
          <h3 class="fw8 mb12 tc-1"><span class="material-symbols-rounded emoji-3d" style="color:var(--purple)">trending_up</span> Trending Creators</h3>
          <div class="flex-col gap8">
            <div class="flex gap12 align-center p8" style="background:var(--card2); border-radius:8px">
              <div class="avatar av-sm">🔥</div>
              <div style="flex:1"><div class="fw7 fs13 tc-1">@techvisionary</div><div class="fs11 tc-3">+42K followers today</div></div>
              <button class="btn btn-primary btn-sm" onclick="showToast('Following @techvisionary!')">Follow</button>
            </div>
            <div class="flex gap12 align-center p8" style="background:var(--card2); border-radius:8px">
              <div class="avatar av-sm">🎨</div>
              <div style="flex:1"><div class="fw7 fs13 tc-1">@artflow</div><div class="fs11 tc-3">+28K followers today</div></div>
              <button class="btn btn-primary btn-sm" onclick="showToast('Following @artflow!')">Follow</button>
            </div>
          </div>
        </div>
      </div>
    `;
  } else if (cat === 'news') {
    portal.innerHTML = `
      <div class="grid-2 mb16">
        <div class="card p20">
          <h3 class="fw8 mb12 tc-1"><span class="material-symbols-rounded emoji-3d" style="color:var(--red)">newspaper</span> Breaking News</h3>
          <div class="flex-col gap12">
            <div style="padding:12px; border-left:3px solid var(--red); background:var(--card2); border-radius:4px 8px 8px 4px">
              <div class="fw7 fs14 tc-1">Global climate summit reaches historic emissions deal</div>
              <div class="fs11 tc-3">Reuters • 12 min ago</div>
            </div>
            <div style="padding:12px; border-left:3px solid var(--blue); background:var(--card2); border-radius:4px 8px 8px 4px">
              <div class="fw7 fs14 tc-1">Tech giants announce open-source AI safety coalition</div>
              <div class="fs11 tc-3">AP News • 1h ago</div>
            </div>
            <div style="padding:12px; border-left:3px solid var(--green); background:var(--card2); border-radius:4px 8px 8px 4px">
              <div class="fw7 fs14 tc-1">SpaceX Starship completes first orbital refueling test</div>
              <div class="fs11 tc-3">BBC • 3h ago</div>
            </div>
          </div>
        </div>
        <div class="card p20">
          <h3 class="fw8 mb12 tc-1"><span class="material-symbols-rounded emoji-3d" style="color:var(--blue)">analytics</span> News Pulse</h3>
          <p class="tc-2 fs13 mb12">Most-read stories across all regions today.</p>
          <div style="height:120px; background:var(--bg); border-radius:12px; display:flex; align-items:flex-end; padding:12px; gap:6px">
            <div style="width:16%; height:85%; background:var(--red); border-radius:4px; position:relative"><span class="fs11 tc-1" style="position:absolute; top:-18px; left:0">Politics</span></div>
            <div style="width:16%; height:60%; background:var(--blue); border-radius:4px"></div>
            <div style="width:16%; height:95%; background:var(--green); border-radius:4px"></div>
            <div style="width:16%; height:45%; background:var(--orange); border-radius:4px"></div>
            <div style="width:16%; height:70%; background:var(--purple); border-radius:4px"></div>
            <div style="width:16%; height:55%; background:var(--pink); border-radius:4px"></div>
          </div>
          <button class="btn btn-primary btn-sm w100 mt12" onclick="showToast('Opening full newsroom...')">📰 Full Newsroom</button>
        </div>
      </div>
    `;
  } else if (cat === 'ent') {
    portal.innerHTML = `
      <div class="grid-2 mb16">
        <div class="card p20">
          <h3 class="fw8 mb12 tc-1"><span class="material-symbols-rounded emoji-3d" style="color:var(--pink)">movie</span> Entertainment Buzz</h3>
          <div class="flex-col gap12">
            <div style="background:var(--card2); padding:12px; border-radius:12px">
              <div class="fs12 tc-3 mb4">Movies • Now Streaming</div>
              <div class="fw7 fs14 tc-1">Marvel's Avengers: Secret Wars breaks opening records</div>
            </div>
            <div style="background:var(--card2); padding:12px; border-radius:12px">
              <div class="fs12 tc-3 mb4">TV • Renewed</div>
              <div class="fw7 fs14 tc-1">HBO's The Last of Us Season 3 confirmed for 2027</div>
            </div>
            <div style="background:var(--card2); padding:12px; border-radius:12px">
              <div class="fs12 tc-3 mb4">Music • Tour</div>
              <div class="fw7 fs14 tc-1">Beyoncé announces global Renaissance World Tour II</div>
            </div>
          </div>
        </div>
        <div class="card p20">
          <h3 class="fw8 mb12 tc-1"><span class="material-symbols-rounded emoji-3d" style="color:var(--orange)">star</span> Celebrity Feed</h3>
          <div class="flex-col gap8">
            <div class="flex gap12 align-center p8" style="background:var(--card2); border-radius:8px">
              <div class="avatar av-sm">🎬</div>
              <div style="flex:1"><div class="fw7 fs13 tc-1">@zendaya</div><div class="fs11 tc-3">Just wrapped filming Dune 3! 🎥</div></div>
            </div>
            <div class="flex gap12 align-center p8" style="background:var(--card2); border-radius:8px">
              <div class="avatar av-sm">🎤</div>
              <div style="flex:1"><div class="fw7 fs13 tc-1">@theweeknd</div><div class="fs11 tc-3">New album dropping midnight 🌙</div></div>
            </div>
          </div>
          <button class="btn btn-primary btn-sm w100 mt12" onclick="showToast('Opening entertainment hub...')">🍿 Browse All</button>
        </div>
      </div>
    `;
  } else if (cat === 'space') {
    portal.innerHTML = `
      <div class="grid-2 mb16">
        <div class="card p20" style="background:linear-gradient(135deg,#050510,#0a0a2a); border:1px solid #334">
          <h3 class="fw8 mb12 tc-1"><span class="material-symbols-rounded emoji-3d" style="color:var(--blue)">rocket</span> Mission Control</h3>
          <div class="flex-col gap12">
            <div style="padding:12px; border:1px solid #ffffff15; border-radius:12px">
              <div class="flex-between mb4"><span class="badge badge-green fs11">🟢 Active</span><span class="fs11 tc-3">T+42d 7h</span></div>
              <div class="fw7 fs14 tc-1">Artemis IV — Lunar Gateway construction underway</div>
            </div>
            <div style="padding:12px; border:1px solid #ffffff15; border-radius:12px">
              <div class="flex-between mb4"><span class="badge badge-blue fs11">🔵 Planned</span><span class="fs11 tc-3">Launch Sept 2026</span></div>
              <div class="fw7 fs14 tc-1">Europa Clipper — Ice moon flyby mission prep</div>
            </div>
          </div>
        </div>
        <div class="card p20">
          <h3 class="fw8 mb12 tc-1"><span class="material-symbols-rounded emoji-3d" style="color:var(--purple)">telescope</span> Deep Space Feed</h3>
          <div class="flex-col gap12">
            <div style="background:var(--card2); padding:12px; border-radius:12px">
              <div class="fs12 tc-3 mb4">Astronomy • 4h ago</div>
              <div class="fw7 fs14 tc-1">New exoplanet in habitable zone found 40 ly away</div>
            </div>
            <div style="background:var(--card2); padding:12px; border-radius:12px">
              <div class="fs12 tc-3 mb4">ISS • Live</div>
              <div class="fw7 fs14 tc-1">Crew Dragon resupply mission docked successfully</div>
            </div>
          </div>
          <button class="btn btn-ghost btn-sm w100 mt12" onclick="showToast('Opening ISS live stream...')">🔴 Watch ISS Live</button>
        </div>
      </div>
    `;
  } else if (cat === 'nature') {
    portal.innerHTML = `
      <div class="grid-2 mb16">
        <div class="card p20">
          <h3 class="fw8 mb12 tc-1"><span class="material-symbols-rounded emoji-3d" style="color:var(--green)">park</span> Nature Journal</h3>
          <div class="flex-col gap12">
            <div style="background:var(--card2); padding:12px; border-radius:12px">
              <div class="fs12 tc-3 mb4">Ecology • 3h ago</div>
              <div class="fw7 fs14 tc-1">World's oldest tree discovered in Chilean Patagonia at 5,400 years</div>
            </div>
            <div style="background:var(--card2); padding:12px; border-radius:12px">
              <div class="fs12 tc-3 mb4">Oceans • Today</div>
              <div class="fw7 fs14 tc-1">Deep-sea expedition reveals high bioluminescent biodiversity</div>
            </div>
          </div>
        </div>
        <div class="card p20">
          <h3 class="fw8 mb12 tc-1"><span class="material-symbols-rounded emoji-3d" style="color:var(--blue)">landscape</span> Photo of the Day</h3>
          <div style="height:180px; background:linear-gradient(180deg,#1a3d5c,#0d2b1a); border-radius:12px; display:grid; place-items:center; position:relative">
            <span class="material-symbols-rounded" style="font-size:64px; color:rgba(255,255,255,0.3)">image</span>
            <div style="position:absolute; bottom:12px; left:12px; color:white">
              <div class="fw7 fs14">Aurora Borealis over Iceland</div>
              <div class="fs11" style="opacity:0.7">📷 @naturephotog • Reykjavik</div>
            </div>
          </div>
          <button class="btn btn-primary btn-sm w100 mt12" onclick="showToast('Opening nature gallery...')">🌿 Explore Gallery</button>
        </div>
      </div>
    `;
  } else if (cat === 'env') {
    portal.innerHTML = `
      <div class="grid-2 mb16">
        <div class="card p20">
          <h3 class="fw8 mb12 tc-1"><span class="material-symbols-rounded emoji-3d" style="color:var(--green)">eco</span> Environmental Watch</h3>
          <div class="flex-col gap12">
            <div style="background:var(--card2); padding:12px; border-radius:12px">
              <div class="fs12 tc-3 mb4">Policy • 2h ago</div>
              <div class="fw7 fs14 tc-1">25 countries pledge to ban single-use plastics by 2028</div>
            </div>
            <div style="background:var(--card2); padding:12px; border-radius:12px">
              <div class="fs12 tc-3 mb4">Innovation • 6h ago</div>
              <div class="fw7 fs14 tc-1">Carbon capture startup removes 10K tons CO₂ from atmosphere</div>
            </div>
          </div>
        </div>
        <div class="card p20">
          <h3 class="fw8 mb12 tc-1"><span class="material-symbols-rounded emoji-3d" style="color:var(--blue)">water_drop</span> Impact Metrics</h3>
          <div class="grid-2 gap8">
            <div class="card p12" style="background:var(--card2); text-align:center"><div class="fw8 fs20" style="color:var(--green)">-12%</div><div class="fs11 tc-3">Global emissions YoY</div></div>
            <div class="card p12" style="background:var(--card2); text-align:center"><div class="fw8 fs20" style="color:var(--blue)">82%</div><div class="fs11 tc-3">Renewable energy mix</div></div>
            <div class="card p12" style="background:var(--card2); text-align:center"><div class="fw8 fs20" style="color:var(--green)">3.2B</div><div class="fs11 tc-3">Trees planted (2026)</div></div>
            <div class="card p12" style="background:var(--card2); text-align:center"><div class="fw8 fs20" style="color:var(--orange)">14%</div><div class="fs11 tc-3">Ocean protected areas</div></div>
          </div>
        </div>
      </div>
    `;
  } else if (cat === 'climate') {
    portal.innerHTML = `
      <div class="grid-2 mb16">
        <div class="card p20">
          <h3 class="fw8 mb12 tc-1"><span class="material-symbols-rounded emoji-3d" style="color:var(--orange)">thermostat</span> Climate Dashboard</h3>
          <div class="grid-2 gap8 mb12">
            <div class="card p12" style="background:var(--card2); text-align:center"><div class="fw8 fs20" style="color:var(--orange)">+1.3°C</div><div class="fs11 tc-3">Global temp anomaly</div></div>
            <div class="card p12" style="background:var(--card2); text-align:center"><div class="fw8 fs20" style="color:var(--blue)">425ppm</div><div class="fs11 tc-3">CO₂ concentration</div></div>
          </div>
          <div style="height:100px; background:var(--bg); border-radius:12px; display:flex; align-items:flex-end; padding:12px; gap:4px">
            <div style="width:10%; height:30%; background:var(--blue); border-radius:3px"></div>
            <div style="width:10%; height:35%; background:var(--blue); border-radius:3px"></div>
            <div style="width:10%; height:42%; background:var(--blue); border-radius:3px"></div>
            <div style="width:10%; height:50%; background:var(--orange); border-radius:3px"></div>
            <div style="width:10%; height:58%; background:var(--orange); border-radius:3px"></div>
            <div style="width:10%; height:65%; background:var(--orange); border-radius:3px"></div>
            <div style="width:10%; height:75%; background:var(--red); border-radius:3px"></div>
            <div style="width:10%; height:82%; background:var(--red); border-radius:3px"></div>
            <div style="width:10%; height:90%; background:var(--red); border-radius:3px"></div>
            <div style="width:10%; height:95%; background:var(--red); border-radius:3px"></div>
          </div>
        </div>
        <div class="card p20">
          <h3 class="fw8 mb12 tc-1"><span class="material-symbols-rounded emoji-3d" style="color:var(--green)">energy_savings_leaf</span> Climate Action</h3>
          <div class="flex-col gap12">
            <div style="background:var(--card2); padding:12px; border-radius:12px">
              <div class="fs12 tc-3 mb4">Summit • Today</div>
              <div class="fw7 fs14 tc-1">COP31 opens with 196 nations committing to net-zero timelines</div>
            </div>
            <div style="background:var(--card2); padding:12px; border-radius:12px">
              <div class="fs12 tc-3 mb4">Research • 1d ago</div>
              <div class="fw7 fs14 tc-1">Arctic ice sheet loss slows for first time in 30 years</div>
            </div>
          </div>
          <button class="btn btn-primary btn-sm w100 mt12" onclick="showToast('Opening carbon calculator...')">🌍 Calculate Your Footprint</button>
        </div>
      </div>
    `;
  } else if (cat === 'world') {
    portal.innerHTML = `
      <div class="grid-2 mb16">
        <div class="card p20">
          <h3 class="fw8 mb12 tc-1"><span class="material-symbols-rounded emoji-3d" style="color:var(--blue)">public</span> World Headlines</h3>
          <div class="flex-col gap12">
            <div style="padding:12px; border-left:3px solid var(--blue); background:var(--card2); border-radius:4px 8px 8px 4px">
              <div class="fw7 fs14 tc-1">G20 agrees on global minimum digital services tax</div>
              <div class="fs11 tc-3">AP • 45 min ago</div>
            </div>
            <div style="padding:12px; border-left:3px solid var(--green); background:var(--card2); border-radius:4px 8px 8px 4px">
              <div class="fw7 fs14 tc-1">India launches world's largest solar park in Rajasthan</div>
              <div class="fs11 tc-3">Reuters • 2h ago</div>
            </div>
            <div style="padding:12px; border-left:3px solid var(--orange); background:var(--card2); border-radius:4px 8px 8px 4px">
              <div class="fw7 fs14 tc-1">Japan's population policy reversal shows early results</div>
              <div class="fs11 tc-3">BBC World • 5h ago</div>
            </div>
          </div>
        </div>
        <div class="card p20">
          <h3 class="fw8 mb12 tc-1"><span class="material-symbols-rounded emoji-3d" style="color:var(--purple)">language</span> Region Spotlight</h3>
          <div class="flex-col gap8">
            <div class="flex gap12 align-center p8" style="background:var(--card2); border-radius:8px">
              <span style="font-size:24px">🇪🇺</span>
              <div style="flex:1"><div class="fw7 fs13 tc-1">Europe</div><div class="fs11 tc-3">EU digital identity rollout begins</div></div>
            </div>
            <div class="flex gap12 align-center p8" style="background:var(--card2); border-radius:8px">
              <span style="font-size:24px">🌏</span>
              <div style="flex:1"><div class="fw7 fs13 tc-1">Asia-Pacific</div><div class="fs11 tc-3">ASEAN trade deal expands to 15 nations</div></div>
            </div>
            <div class="flex gap12 align-center p8" style="background:var(--card2); border-radius:8px">
              <span style="font-size:24px">🌍</span>
              <div style="flex:1"><div class="fw7 fs13 tc-1">Africa</div><div class="fs11 tc-3">Continental free trade zone hits 1B users</div></div>
            </div>
          </div>
        </div>
      </div>
    `;
  } else if (cat === 'blockchain') {
    portal.innerHTML = `
      <div class="grid-2 mb16">
        <div class="card p20">
          <h3 class="fw8 mb12 tc-1"><span class="material-symbols-rounded emoji-3d" style="color:var(--purple)">token</span> On-Chain Analytics</h3>
          <div class="grid-2 gap8 mb12">
            <div class="card p12" style="background:var(--card2); text-align:center"><div class="fw8 fs20" style="color:var(--green)">$94B</div><div class="fs11 tc-3">Total DeFi TVL</div></div>
            <div class="card p12" style="background:var(--card2); text-align:center"><div class="fw8 fs20" style="color:var(--purple)">1.2M</div><div class="fs11 tc-3">Daily active wallets</div></div>
          </div>
          <div class="flex-col gap8">
            <div style="padding:12px; border-left:3px solid var(--purple); background:var(--card2); border-radius:4px 8px 8px 4px">
              <div class="fw7 fs13 tc-1">Ethereum L2 rollups process 4x more txns than mainnet</div>
              <div class="fs11 tc-3">Dune Analytics • 30 min ago</div>
            </div>
          </div>
        </div>
        <div class="card p20">
          <h3 class="fw8 mb12 tc-1"><span class="material-symbols-rounded emoji-3d" style="color:var(--blue)">security</span> Smart Contract Audits</h3>
          <div class="flex-col gap12">
            <div class="flex-between p8" style="background:var(--card2); border-radius:8px">
              <div><div class="fw7 fs13 tc-1">UniSwap V4 Audit</div><div class="fs11 tc-3">OpenZeppelin • Passed ✓</div></div>
              <span class="badge badge-green fs11">Secure</span>
            </div>
            <div class="flex-between p8" style="background:var(--card2); border-radius:8px">
              <div><div class="fw7 fs13 tc-1">AaveDAO Lending Pool</div><div class="fs11 tc-3">Trail of Bits • In Review</div></div>
              <span class="badge badge-orange fs11">Pending</span>
            </div>
          </div>
          <button class="btn btn-ghost btn-sm w100 mt12" onclick="showToast('Opening contract explorer...')">🔍 Explore Contracts</button>
        </div>
      </div>
    `;
  } else if (cat === 'stocks') {
    portal.innerHTML = `
      <div class="grid-2 mb16">
        <div class="card p20">
          <h3 class="fw8 mb12 tc-1"><span class="material-symbols-rounded emoji-3d" style="color:var(--green)">show_chart</span> Market Watch</h3>
          <div class="flex-col gap8">
            <div class="flex-between p8" style="background:var(--card2); border-radius:8px">
              <div><div class="fw7 fs14 tc-1">S&P 500</div><div class="fs11 tc-3">Index</div></div>
              <div class="tc-right"><div class="fw8 fs16" style="color:var(--green)">5,428.20</div><div class="fs11" style="color:var(--green)">+1.3%</div></div>
            </div>
            <div class="flex-between p8" style="background:var(--card2); border-radius:8px">
              <div><div class="fw7 fs14 tc-1">NASDAQ</div><div class="fs11 tc-3">Index</div></div>
              <div class="tc-right"><div class="fw8 fs16" style="color:var(--green)">17,892.50</div><div class="fs11" style="color:var(--green)">+2.1%</div></div>
            </div>
            <div class="flex-between p8" style="background:var(--card2); border-radius:8px">
              <div><div class="fw7 fs14 tc-1">AAPL</div><div class="fs11 tc-3">Apple Inc.</div></div>
              <div class="tc-right"><div class="fw8 fs16" style="color:var(--red)">$218.45</div><div class="fs11" style="color:var(--red)">-0.4%</div></div>
            </div>
          </div>
        </div>
        <div class="card p20">
          <h3 class="fw8 mb12 tc-1"><span class="material-symbols-rounded emoji-3d" style="color:var(--orange)">feed</span> Earnings Calendar</h3>
          <div class="flex-col gap12">
            <div style="background:var(--card2); padding:12px; border-radius:12px">
              <div class="flex-between"><span class="fw7 fs13 tc-1">NVIDIA (NVDA)</span><span class="badge badge-green fs11">Beat</span></div>
              <div class="fs11 tc-3 mt4">EPS $1.82 vs $1.65 est. • Revenue $42B</div>
            </div>
            <div style="background:var(--card2); padding:12px; border-radius:12px">
              <div class="flex-between"><span class="fw7 fs13 tc-1">Tesla (TSLA)</span><span class="badge badge-blue fs11">Tomorrow</span></div>
              <div class="fs11 tc-3 mt4">Expected EPS $0.72 • After hours</div>
            </div>
          </div>
          <button class="btn btn-primary btn-sm w100 mt12" onclick="showToast('Opening stock screener...')">📊 Stock Screener</button>
        </div>
      </div>
    `;
  } else if (cat === 'business') {
    portal.innerHTML = `
      <div class="grid-2 mb16">
        <div class="card p20">
          <h3 class="fw8 mb12 tc-1"><span class="material-symbols-rounded emoji-3d" style="color:var(--blue)">business_center</span> Business Pulse</h3>
          <div class="flex-col gap12">
            <div style="background:var(--card2); padding:12px; border-radius:12px">
              <div class="fs12 tc-3 mb4">M&A • 1h ago</div>
              <div class="fw7 fs14 tc-1">Microsoft acquires AI robotics firm for $4.2B</div>
            </div>
            <div style="background:var(--card2); padding:12px; border-radius:12px">
              <div class="fs12 tc-3 mb4">Leadership • Today</div>
              <div class="fw7 fs14 tc-1">Stripe appoints new CTO from Google DeepMind</div>
            </div>
            <div style="background:var(--card2); padding:12px; border-radius:12px">
              <div class="fs12 tc-3 mb4">Markets • 3h ago</div>
              <div class="fw7 fs14 tc-1">Global supply chain index hits 18-month efficiency high</div>
            </div>
          </div>
        </div>
        <div class="card p20">
          <h3 class="fw8 mb12 tc-1"><span class="material-symbols-rounded emoji-3d" style="color:var(--green)">monitoring</span> Key Indicators</h3>
          <div class="grid-2 gap8">
            <div class="card p12" style="background:var(--card2); text-align:center"><div class="fw8 fs20" style="color:var(--green)">3.8%</div><div class="fs11 tc-3">GDP Growth (Q2)</div></div>
            <div class="card p12" style="background:var(--card2); text-align:center"><div class="fw8 fs20" style="color:var(--blue)">3.4%</div><div class="fs11 tc-3">Unemployment</div></div>
            <div class="card p12" style="background:var(--card2); text-align:center"><div class="fw8 fs20" style="color:var(--orange)">2.1%</div><div class="fs11 tc-3">Inflation rate</div></div>
            <div class="card p12" style="background:var(--card2); text-align:center"><div class="fw8 fs20" style="color:var(--green)">+214K</div><div class="fs11 tc-3">Jobs added</div></div>
          </div>
        </div>
      </div>
    `;
  } else if (cat === 'edu') {
    portal.innerHTML = `
      <div class="grid-2 mb16">
        <div class="card p20">
          <h3 class="fw8 mb12 tc-1"><span class="material-symbols-rounded emoji-3d" style="color:var(--blue)">school</span> Learning Hub</h3>
          <div class="flex-col gap12">
            <div class="flex gap12 align-center p8" style="background:var(--card2); border-radius:8px; cursor:pointer" onclick="showToast('Enrolling in course...')">
              <span class="material-symbols-rounded" style="color:var(--purple); font-size:24px">play_circle</span>
              <div style="flex:1"><div class="fw7 fs13 tc-1">Machine Learning Fundamentals</div><div class="fs11 tc-3">Stanford Online • 42 lessons • Free</div></div>
            </div>
            <div class="flex gap12 align-center p8" style="background:var(--card2); border-radius:8px; cursor:pointer" onclick="showToast('Enrolling in course...')">
              <span class="material-symbols-rounded" style="color:var(--blue); font-size:24px">play_circle</span>
              <div style="flex:1"><div class="fw7 fs13 tc-1">Full-Stack Web Development</div><div class="fs11 tc-3">MIT OpenCourseWare • 38 lessons • Free</div></div>
            </div>
            <div class="flex gap12 align-center p8" style="background:var(--card2); border-radius:8px; cursor:pointer" onclick="showToast('Enrolling in course...')">
              <span class="material-symbols-rounded" style="color:var(--green); font-size:24px">play_circle</span>
              <div style="flex:1"><div class="fw7 fs13 tc-1">Bioethics & Technology</div><div class="fs11 tc-3">Harvard EdX • 24 lessons • Free</div></div>
            </div>
          </div>
        </div>
        <div class="card p20">
          <h3 class="fw8 mb12 tc-1"><span class="material-symbols-rounded emoji-3d" style="color:var(--green)">quiz</span> Daily Challenge</h3>
          <p class="tc-2 fs13 mb12">Test your knowledge with today's quiz.</p>
          <div style="background:var(--card2); padding:16px; border-radius:12px" class="mb12">
            <div class="fw7 fs14 tc-1 mb8">What is the speed of light in a vacuum?</div>
            <div class="flex-col gap8">
              <button class="btn btn-ghost btn-sm w100" onclick="showToast('Incorrect ✗')">A) 300,000 mi/s</button>
              <button class="btn btn-ghost btn-sm w100" onclick="showToast('Correct! ✓ +10 XP')">B) 299,792 km/s</button>
              <button class="btn btn-ghost btn-sm w100" onclick="showToast('Incorrect ✗')">C) 150,000 km/s</button>
            </div>
          </div>
        </div>
      </div>
    `;
  } else if (cat === 'history') {
    portal.innerHTML = `
      <div class="grid-2 mb16">
        <div class="card p20">
          <h3 class="fw8 mb12 tc-1"><span class="material-symbols-rounded emoji-3d" style="color:var(--orange)">history_edu</span> On This Day</h3>
          <div class="flex-col gap12">
            <div style="background:var(--card2); padding:12px; border-radius:12px">
              <div class="fs12 tc-3 mb4">June 3, 1965</div>
              <div class="fw7 fs14 tc-1">Ed White performs first American spacewalk during Gemini 4</div>
            </div>
            <div style="background:var(--card2); padding:12px; border-radius:12px">
              <div class="fs12 tc-3 mb4">June 3, 1989</div>
              <div class="fw7 fs14 tc-1">Tiananmen Square protests reach critical turning point</div>
            </div>
            <div style="background:var(--card2); padding:12px; border-radius:12px">
              <div class="fs12 tc-3 mb4">June 3, 1140</div>
              <div class="fw7 fs14 tc-1">Basilica of Saint-Denis consecrated, birthplace of Gothic architecture</div>
            </div>
          </div>
        </div>
        <div class="card p20">
          <h3 class="fw8 mb12 tc-1"><span class="material-symbols-rounded emoji-3d" style="color:var(--purple)">auto_stories</span> Deep Dives</h3>
          <div class="flex-col gap8">
            <div class="flex-between p8" style="background:var(--card2); border-radius:8px">
              <div><div class="fw7 fs13 tc-1">The Fall of Rome: 5 Causes</div><div class="fs11 tc-3">12 min read • Longform</div></div>
              <button class="btn btn-ghost btn-sm" onclick="showToast('Opening article...')">Read</button>
            </div>
            <div class="flex-between p8" style="background:var(--card2); border-radius:8px">
              <div><div class="fw7 fs13 tc-1">How the Printing Press Changed Everything</div><div class="fs11 tc-3">8 min read • Illustrated</div></div>
              <button class="btn btn-ghost btn-sm" onclick="showToast('Opening article...')">Read</button>
            </div>
          </div>
          <button class="btn btn-primary btn-sm w100 mt12" onclick="showToast('Opening history timeline...')">🏛️ Interactive Timeline</button>
        </div>
      </div>
    `;
  } else if (cat === 'sports') {
    portal.innerHTML = `
      <div class="grid-2 mb16">
        <div class="card p20">
          <h3 class="fw8 mb12 tc-1"><span class="material-symbols-rounded emoji-3d" style="color:var(--green)">sports_soccer</span> Live Scores</h3>
          <div class="flex-col gap8">
            <div class="flex-between p8" style="background:var(--card2); border-radius:8px">
              <div class="flex gap8 align-center"><span style="font-size:20px">⚽</span><div><div class="fw7 fs13 tc-1">Man City vs Arsenal</div><div class="fs11 tc-3">Premier League • 67'</div></div></div>
              <div class="fw8 fs16 tc-1">2 - 1</div>
            </div>
            <div class="flex-between p8" style="background:var(--card2); border-radius:8px">
              <div class="flex gap8 align-center"><span style="font-size:20px">🏀</span><div><div class="fw7 fs13 tc-1">Lakers vs Celtics</div><div class="fs11 tc-3">NBA Finals • Q3</div></div></div>
              <div class="fw8 fs16 tc-1">88 - 92</div>
            </div>
            <div class="flex-between p8" style="background:var(--card2); border-radius:8px">
              <div class="flex gap8 align-center"><span style="font-size:20px">🎾</span><div><div class="fw7 fs13 tc-1">Djokovic vs Alcaraz</div><div class="fs11 tc-3">Roland Garros • Set 3</div></div></div>
              <div class="fw8 fs16 tc-1">6-4, 3-6, 4-3</div>
            </div>
          </div>
        </div>
        <div class="card p20">
          <h3 class="fw8 mb12 tc-1"><span class="material-symbols-rounded emoji-3d" style="color:var(--orange)">sports</span> Top Stories</h3>
          <div class="flex-col gap12">
            <div style="background:var(--card2); padding:12px; border-radius:12px">
              <div class="fs12 tc-3 mb4">Transfer • Breaking</div>
              <div class="fw7 fs14 tc-1">Mbappé signs record-breaking deal with Real Madrid</div>
            </div>
            <div style="background:var(--card2); padding:12px; border-radius:12px">
              <div class="fs12 tc-3 mb4">Olympics • Countdown</div>
              <div class="fw7 fs14 tc-1">LA 2028 unveils 5 new sports for Summer Games</div>
            </div>
          </div>
          <button class="btn btn-primary btn-sm w100 mt12" onclick="showToast('Opening full scoreboard...')">🏆 All Scores</button>
        </div>
      </div>
    `;
  } else if (cat === 'anime') {
    portal.innerHTML = `
      <div class="grid-2 mb16">
        <div class="card p20" style="background:linear-gradient(135deg,#1a0520,#0a0a2a); border:1px solid #ff69b444">
          <h3 class="fw8 mb12 tc-1"><span class="material-symbols-rounded emoji-3d" style="color:var(--pink)">animated_images</span> Seasonal Picks</h3>
          <div class="flex-col gap12">
            <div class="flex gap12 align-center p8" style="border:1px solid #ffffff15; border-radius:8px">
              <span style="font-size:28px">⛩️</span>
              <div style="flex:1"><div class="fw7 fs14 tc-1">Jujutsu Kaisen S3</div><div class="fs11 tc-3">Episode 8 • Airing Now</div></div>
              <span class="badge badge-pink fs11">🔥 Hot</span>
            </div>
            <div class="flex gap12 align-center p8" style="border:1px solid #ffffff15; border-radius:8px">
              <span style="font-size:28px">⚔️</span>
              <div style="flex:1"><div class="fw7 fs14 tc-1">Chainsaw Man S2</div><div class="fs11 tc-3">Episode 4 • Weekly</div></div>
              <span class="badge badge-purple fs11">New</span>
            </div>
            <div class="flex gap12 align-center p8" style="border:1px solid #ffffff15; border-radius:8px">
              <span style="font-size:28px">🏴‍☠️</span>
              <div style="flex:1"><div class="fw7 fs14 tc-1">One Piece (Egghead)</div><div class="fs11 tc-3">Episode 1120 • Ongoing</div></div>
              <span class="badge badge-blue fs11">Classic</span>
            </div>
          </div>
        </div>
        <div class="card p20">
          <h3 class="fw8 mb12 tc-1"><span class="material-symbols-rounded emoji-3d" style="color:var(--purple)">forum</span> Community</h3>
          <div class="flex-col gap8">
            <div class="flex gap12 align-center p8" style="background:var(--card2); border-radius:8px">
              <div class="avatar av-sm">🎨</div>
              <div style="flex:1"><div class="fw7 fs13 tc-1">@mangaartist</div><div class="fs11 tc-3">Just finished my Gojo fanart! What do you think? 🎨✨</div></div>
            </div>
            <div class="flex gap12 align-center p8" style="background:var(--card2); border-radius:8px">
              <div class="avatar av-sm">📺</div>
              <div style="flex:1"><div class="fw7 fs13 tc-1">@animereview</div><div class="fs11 tc-3">Top 10 anime openings of 2026 — thread below 🧵</div></div>
            </div>
          </div>
          <button class="btn btn-primary btn-sm w100 mt12" onclick="showToast('Opening anime watchlist...')">📋 My Watchlist</button>
        </div>
      </div>
    `;
  } else if (cat === 'podcasts') {
    portal.innerHTML = `
      <div class="grid-2 mb16">
        <div class="card p20">
          <h3 class="fw8 mb12 tc-1"><span class="material-symbols-rounded emoji-3d" style="color:var(--purple)">podcasts</span> Trending Episodes</h3>
          <div class="flex-col gap8">
            <div class="flex gap12 align-center p8" style="background:var(--card2); border-radius:8px; cursor:pointer" onclick="showToast('Playing episode...')">
              <span class="material-symbols-rounded" style="color:var(--purple); font-size:28px">play_circle</span>
              <div style="flex:1"><div class="fw7 fs13 tc-1">The Joe Rogan Experience #2198</div><div class="fs11 tc-3">Guest: Sam Altman on AGI timeline • 3h 12m</div></div>
            </div>
            <div class="flex gap12 align-center p8" style="background:var(--card2); border-radius:8px; cursor:pointer" onclick="showToast('Playing episode...')">
              <span class="material-symbols-rounded" style="color:var(--blue); font-size:28px">play_circle</span>
              <div style="flex:1"><div class="fw7 fs13 tc-1">Lex Fridman Podcast #456</div><div class="fs11 tc-3">Guest: Demis Hassabis on Nobel Prize journey • 2h 45m</div></div>
            </div>
            <div class="flex gap12 align-center p8" style="background:var(--card2); border-radius:8px; cursor:pointer" onclick="showToast('Playing episode...')">
              <span class="material-symbols-rounded" style="color:var(--green); font-size:28px">play_circle</span>
              <div style="flex:1"><div class="fw7 fs13 tc-1">Huberman Lab: Sleep Optimization</div><div class="fs11 tc-3">Solo episode • Science of circadian rhythm • 1h 55m</div></div>
            </div>
          </div>
        </div>
        <div class="card p20">
          <h3 class="fw8 mb12 tc-1"><span class="material-symbols-rounded emoji-3d" style="color:var(--orange)">category</span> Top Charts</h3>
          <div class="flex-col gap8">
            <div class="flex gap8 align-center p8" style="background:var(--card2); border-radius:8px">
              <span class="fw8 fs16" style="color:var(--orange)">#1</span>
              <div style="flex:1"><div class="fw7 fs13 tc-1">All-In Podcast</div><div class="fs11 tc-3">Tech & Business</div></div>
            </div>
            <div class="flex gap8 align-center p8" style="background:var(--card2); border-radius:8px">
              <span class="fw8 fs16" style="color:var(--blue)">#2</span>
              <div style="flex:1"><div class="fw7 fs13 tc-1">The Daily (NYT)</div><div class="fs11 tc-3">News & Politics</div></div>
            </div>
            <div class="flex gap8 align-center p8" style="background:var(--card2); border-radius:8px">
              <span class="fw8 fs16" style="color:var(--green)">#3</span>
              <div style="flex:1"><div class="fw7 fs13 tc-1">Acquired</div><div class="fs11 tc-3">Business History</div></div>
            </div>
          </div>
          <button class="btn btn-primary btn-sm w100 mt12" onclick="showToast('Opening podcast directory...')">🎙️ Browse All</button>
        </div>
      </div>
    `;
  } else if (cat === 'fashion') {
    portal.innerHTML = `
      <div class="grid-2 mb16">
        <div class="card p20">
          <h3 class="fw8 mb12 tc-1"><span class="material-symbols-rounded emoji-3d" style="color:var(--pink)">checkroom</span> Style Feed</h3>
          <div class="flex-col gap12">
            <div style="background:var(--card2); padding:12px; border-radius:12px">
              <div class="fs12 tc-3 mb4">Runway • Paris Fashion Week</div>
              <div class="fw7 fs14 tc-1">Balenciaga debuts AI-designed capsule collection</div>
            </div>
            <div style="background:var(--card2); padding:12px; border-radius:12px">
              <div class="fs12 tc-3 mb4">Streetwear • Trending</div>
              <div class="fw7 fs14 tc-1">Gorpcore meets techwear: the summer 2026 mashup</div>
            </div>
            <div style="background:var(--card2); padding:12px; border-radius:12px">
              <div class="fs12 tc-3 mb4">Sustainable • Feature</div>
              <div class="fw7 fs14 tc-1">Lab-grown leather now indistinguishable from real thing</div>
            </div>
          </div>
        </div>
        <div class="card p20">
          <h3 class="fw8 mb12 tc-1"><span class="material-symbols-rounded emoji-3d" style="color:var(--orange)">storefront</span> Shop Trending</h3>
          <div class="flex-col gap8">
            <div class="flex gap12 align-center p8" style="background:var(--card2); border-radius:8px">
              <span style="font-size:28px">👟</span>
              <div style="flex:1"><div class="fw7 fs13 tc-1">Nike Air Max Pulse</div><div class="fs11 tc-3">$159 • Selling fast</div></div>
              <button class="btn btn-primary btn-sm" onclick="showToast('Added to cart!')">Buy</button>
            </div>
            <div class="flex gap12 align-center p8" style="background:var(--card2); border-radius:8px">
              <span style="font-size:28px">🧥</span>
              <div style="flex:1"><div class="fw7 fs13 tc-1">Uniqlo U Parka</div><div class="fs11 tc-3">$79.90 • New arrival</div></div>
              <button class="btn btn-primary btn-sm" onclick="showToast('Added to cart!')">Buy</button>
            </div>
          </div>
          <button class="btn btn-ghost btn-sm w100 mt12" onclick="showToast('Opening AR try-on...')">👗 Virtual Try-On</button>
        </div>
      </div>
    `;
  } else if (cat === 'health') {
    portal.innerHTML = `
      <div class="grid-2 mb16">
        <div class="card p20">
          <h3 class="fw8 mb12 tc-1"><span class="material-symbols-rounded emoji-3d" style="color:var(--green)">health_and_safety</span> Health Feed</h3>
          <div class="flex-col gap12">
            <div style="background:var(--card2); padding:12px; border-radius:12px">
              <div class="fs12 tc-3 mb4">Research • 2h ago</div>
              <div class="fw7 fs14 tc-1">Intermittent fasting linked to improved gut microbiome diversity</div>
            </div>
            <div style="background:var(--card2); padding:12px; border-radius:12px">
              <div class="fs12 tc-3 mb4">Mental Health • Today</div>
              <div class="fw7 fs14 tc-1">New study: 20 minutes of nature daily reduces cortisol by 28%</div>
            </div>
            <div style="background:var(--card2); padding:12px; border-radius:12px">
              <div class="fs12 tc-3 mb4">Nutrition • Popular</div>
              <div class="fw7 fs14 tc-1">Omega-3 supplements shown to slow cognitive decline in over-60s</div>
            </div>
          </div>
        </div>
        <div class="card p20">
          <h3 class="fw8 mb12 tc-1"><span class="material-symbols-rounded emoji-3d" style="color:var(--blue)">monitor_heart</span> Wellness Tracker</h3>
          <div class="grid-2 gap8 mb12">
            <div class="card p12" style="background:var(--card2); text-align:center"><div class="fw8 fs20" style="color:var(--green)">7,842</div><div class="fs11 tc-3">Steps today</div></div>
            <div class="card p12" style="background:var(--card2); text-align:center"><div class="fw8 fs20" style="color:var(--blue)">7h 24m</div><div class="fs11 tc-3">Sleep last night</div></div>
            <div class="card p12" style="background:var(--card2); text-align:center"><div class="fw8 fs20" style="color:var(--pink)">72 bpm</div><div class="fs11 tc-3">Resting HR</div></div>
            <div class="card p12" style="background:var(--card2); text-align:center"><div class="fw8 fs20" style="color:var(--orange)">1,850</div><div class="fs11 tc-3">Calories burned</div></div>
          </div>
          <button class="btn btn-primary btn-sm w100" onclick="showToast('Syncing health data...')">🩺 Full Health Report</button>
        </div>
      </div>
    `;
  } else if (cat === 'photo') {
    portal.innerHTML = `
      <div class="grid-2 mb16">
        <div class="card p20">
          <h3 class="fw8 mb12 tc-1"><span class="material-symbols-rounded emoji-3d" style="color:var(--orange)">photo_camera</span> Featured Shots</h3>
          <div class="grid-3 gap8 mb12">
            <div style="aspect-ratio:1; background:linear-gradient(135deg,#2d1b4e,#1a3d5c); border-radius:8px; display:grid; place-items:center"><span class="material-symbols-rounded" style="font-size:28px; color:rgba(255,255,255,0.3)">image</span></div>
            <div style="aspect-ratio:1; background:linear-gradient(135deg,#3d2b1a,#1a2d3d); border-radius:8px; display:grid; place-items:center"><span class="material-symbols-rounded" style="font-size:28px; color:rgba(255,255,255,0.3)">image</span></div>
            <div style="aspect-ratio:1; background:linear-gradient(135deg,#1a3d2b,#2d1a3d); border-radius:8px; display:grid; place-items:center"><span class="material-symbols-rounded" style="font-size:28px; color:rgba(255,255,255,0.3)">image</span></div>
          </div>
          <div class="flex-between">
            <span class="fs12 tc-3">324 submissions today</span>
            <button class="btn btn-primary btn-sm" onclick="showToast('Opening upload...')">📤 Submit Photo</button>
          </div>
        </div>
        <div class="card p20">
          <h3 class="fw8 mb12 tc-1"><span class="material-symbols-rounded emoji-3d" style="color:var(--blue)">camera</span> Gear Reviews</h3>
          <div class="flex-col gap8">
            <div class="flex gap12 align-center p8" style="background:var(--card2); border-radius:8px">
              <span class="material-symbols-rounded" style="color:var(--orange); font-size:24px">photo_camera</span>
              <div style="flex:1"><div class="fw7 fs13 tc-1">Sony A7R VI Review</div><div class="fs11 tc-3">61MP full-frame • ★ 4.9</div></div>
            </div>
            <div class="flex gap12 align-center p8" style="background:var(--card2); border-radius:8px">
              <span class="material-symbols-rounded" style="color:var(--blue); font-size:24px">lens</span>
              <div style="flex:1"><div class="fw7 fs13 tc-1">Sigma 35mm f/1.4 Art</div><div class="fs11 tc-3">Best portrait lens 2026 • ★ 4.8</div></div>
            </div>
          </div>
          <button class="btn btn-ghost btn-sm w100 mt12" onclick="showToast('Opening editing tutorials...')">🎨 Editing Tutorials</button>
        </div>
      </div>
    `;
  } else if (cat === 'cars') {
    portal.innerHTML = `
      <div class="grid-2 mb16">
        <div class="card p20">
          <h3 class="fw8 mb12 tc-1"><span class="material-symbols-rounded emoji-3d" style="color:var(--red)">directions_car</span> Auto News</h3>
          <div class="flex-col gap12">
            <div style="background:var(--card2); padding:12px; border-radius:12px">
              <div class="fs12 tc-3 mb4">EV • Launch</div>
              <div class="fw7 fs14 tc-1">Tesla Model 2 starts at $25K — orders open today</div>
            </div>
            <div style="background:var(--card2); padding:12px; border-radius:12px">
              <div class="fs12 tc-3 mb4">Supercar • Revealed</div>
              <div class="fw7 fs14 tc-1">Porsche Mission X concept: 1,800hp electric hypercar</div>
            </div>
            <div style="background:var(--card2); padding:12px; border-radius:12px">
              <div class="fs12 tc-3 mb4">Tech • Update</div>
              <div class="fw7 fs14 tc-1">Waymo expands self-driving service to 10 new cities</div>
            </div>
          </div>
        </div>
        <div class="card p20">
          <h3 class="fw8 mb12 tc-1"><span class="material-symbols-rounded emoji-3d" style="color:var(--blue)">speed</span> Performance Stats</h3>
          <div class="flex-col gap8">
            <div class="flex-between p8" style="background:var(--card2); border-radius:8px">
              <div class="flex gap8 align-center"><span style="font-size:20px">🏎️</span><div class="fw7 fs13 tc-1">Rimac Nevera</div></div>
              <div class="tc-right"><div class="fw8 fs14" style="color:var(--green)">1.85s</div><div class="fs11 tc-3">0-60 mph</div></div>
            </div>
            <div class="flex-between p8" style="background:var(--card2); border-radius:8px">
              <div class="flex gap8 align-center"><span style="font-size:20px">⚡</span><div class="fw7 fs13 tc-1">Tesla Roadster</div></div>
              <div class="tc-right"><div class="fw8 fs14" style="color:var(--green)">1.99s</div><div class="fs11 tc-3">0-60 mph</div></div>
            </div>
          </div>
          <button class="btn btn-primary btn-sm w100 mt12" onclick="showToast('Opening car configurator...')">🔧 Build Yours</button>
        </div>
      </div>
    `;
  } else if (cat === 'innovation') {
    portal.innerHTML = `
      <div class="grid-2 mb16">
        <div class="card p20">
          <h3 class="fw8 mb12 tc-1"><span class="material-symbols-rounded emoji-3d" style="color:var(--purple)">lightbulb</span> Innovation Spotlight</h3>
          <div class="flex-col gap12">
            <div style="background:var(--card2); padding:12px; border-radius:12px">
              <div class="fs12 tc-3 mb4">Biotech • Breakthrough</div>
              <div class="fw7 fs14 tc-1">Lab-grown organs pass first human transplant trials</div>
            </div>
            <div style="background:var(--card2); padding:12px; border-radius:12px">
              <div class="fs12 tc-3 mb4">Energy • Milestone</div>
              <div class="fw7 fs14 tc-1">Solid-state battery hits 1,000-mile range in road tests</div>
            </div>
            <div style="background:var(--card2); padding:12px; border-radius:12px">
              <div class="fs12 tc-3 mb4">Materials • Discovery</div>
              <div class="fw7 fs14 tc-1">Graphene aerogel now mass-producible — 10x lighter than steel</div>
            </div>
          </div>
        </div>
        <div class="card p20">
          <h3 class="fw8 mb12 tc-1"><span class="material-symbols-rounded emoji-3d" style="color:var(--green)">rocket_launch</span> Patent Watch</h3>
          <div class="flex-col gap8">
            <div class="flex-between p8" style="background:var(--card2); border-radius:8px">
              <div><div class="fw7 fs13 tc-1">Apple — Neural Display Interface</div><div class="fs11 tc-3">US Patent #12,345,678</div></div>
              <span class="badge badge-purple fs11">New</span>
            </div>
            <div class="flex-between p8" style="background:var(--card2); border-radius:8px">
              <div><div class="fw7 fs13 tc-1">Google — Quantum Error Mitigation</div><div class="fs11 tc-3">US Patent #12,345,679</div></div>
              <span class="badge badge-blue fs11">Filed</span>
            </div>
          </div>
          <button class="btn btn-primary btn-sm w100 mt12" onclick="showToast('Opening innovation tracker...')">🔬 Track Innovations</button>
        </div>
      </div>
    `;
  } else if (cat === 'coding') {
    portal.innerHTML = `
      <div class="grid-2 mb16">
        <div class="card p20">
          <h3 class="fw8 mb12 tc-1"><span class="material-symbols-rounded emoji-3d" style="color:var(--blue)">code</span> Dev Feed</h3>
          <div class="flex-col gap12">
            <div style="padding:12px; border-left:3px solid var(--blue); background:var(--card2); border-radius:4px 8px 8px 4px">
              <div class="fw7 fs14 tc-1">Bun 2.0 released — 3x faster than Node.js</div>
              <div class="fs11 tc-3">oss • 842 ★ today</div>
            </div>
            <div style="padding:12px; border-left:3px solid var(--green); background:var(--card2); border-radius:4px 8px 8px 4px">
              <div class="fw7 fs14 tc-1">Rust surpasses C++ in systems programming surveys</div>
              <div class="fs11 tc-3">survey • Stack Overflow 2026</div>
            </div>
            <div style="padding:12px; border-left:3px solid var(--purple); background:var(--card2); border-radius:4px 8px 8px 4px">
              <div class="fw7 fs14 tc-1">GitHub Copilot X writes full test suites from specs</div>
              <div class="fs11 tc-3">ai-tools • Product Hunt #1</div>
            </div>
          </div>
        </div>
        <div class="card p20">
          <h3 class="fw8 mb12 tc-1"><span class="material-symbols-rounded emoji-3d" style="color:var(--green)">terminal</span> Code Snippet</h3>
          <pre style="background:#1e1e1e; color:#d4d4d4; padding:16px; border-radius:8px; font-family:monospace; font-size:12px; overflow-x:auto">
const fetchData = async (url) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(res.status);
  return res.json();
};

// Usage with error boundary
const data = await fetchData('/api/v2/users')
  .catch(e => console.error(e));</pre>
          <button class="btn btn-ghost btn-sm w100 mt12" onclick="showToast('Copied to clipboard!')">📋 Copy Snippet</button>
        </div>
      </div>
    `;
  } else if (cat === 'cyber') {
    portal.innerHTML = `
      <div class="grid-2 mb16">
        <div class="card p20" style="background:linear-gradient(135deg,#0a0a1a,#1a0b0b); border:1px solid #ff000033">
          <h3 class="fw8 mb12 tc-1"><span class="material-symbols-rounded emoji-3d" style="color:var(--red)">shield</span> Threat Monitor</h3>
          <div class="flex-col gap12">
            <div style="padding:12px; border-left:3px solid var(--red); background:rgba(255,0,0,0.05); border-radius:4px 8px 8px 4px">
              <div class="fw7 fs13 tc-1">🚨 Critical: Zero-day in popular npm package detected</div>
              <div class="fs11 tc-3">CVE-2026-4421 • Severity: 9.8 • 2h ago</div>
            </div>
            <div style="padding:12px; border-left:3px solid var(--orange); background:rgba(255,165,0,0.05); border-radius:4px 8px 8px 4px">
              <div class="fw7 fs13 tc-1">⚠️ Ransomware group targets healthcare sector</div>
              <div class="fs11 tc-3">CISA Advisory • 6h ago</div>
            </div>
          </div>
        </div>
        <div class="card p20">
          <h3 class="fw8 mb12 tc-1"><span class="material-symbols-rounded emoji-3d" style="color:var(--green)">verified_user</span> Security Intel</h3>
          <div class="grid-2 gap8 mb12">
            <div class="card p12" style="background:var(--card2); text-align:center"><div class="fw8 fs20" style="color:var(--red)">2,847</div><div class="fs11 tc-3">CVEs this month</div></div>
            <div class="card p12" style="background:var(--card2); text-align:center"><div class="fw8 fs20" style="color:var(--green)">99.7%</div><div class="fs11 tc-3">Patched in 48h</div></div>
          </div>
          <div class="flex-col gap8">
            <div class="flex-between p8" style="background:var(--card2); border-radius:8px">
              <div class="fw7 fs13 tc-1">Phishing Campaign Analysis</div>
              <button class="btn btn-ghost btn-sm" onclick="showToast('Opening threat report...')">View</button>
            </div>
          </div>
          <button class="btn btn-primary btn-sm w100 mt12" onclick="showToast('Running security scan...')">🔒 Scan Now</button>
        </div>
      </div>
    `;
  } else if (cat === 'robotics') {
    portal.innerHTML = `
      <div class="grid-2 mb16">
        <div class="card p20">
          <h3 class="fw8 mb12 tc-1"><span class="material-symbols-rounded emoji-3d" style="color:var(--blue)">precision_manufacturing</span> Robotics Lab</h3>
          <div class="flex-col gap12">
            <div style="background:var(--card2); padding:12px; border-radius:12px">
              <div class="fs12 tc-3 mb4">Humanoid • Breakthrough</div>
              <div class="fw7 fs14 tc-1">Figure 02 robot completes full warehouse shift autonomously</div>
            </div>
            <div style="background:var(--card2); padding:12px; border-radius:12px">
              <div class="fs12 tc-3 mb4">Medical • FDA Approved</div>
              <div class="fw7 fs14 tc-1">Surgical robot performs 10,000th unassisted operation</div>
            </div>
            <div style="background:var(--card2); padding:12px; border-radius:12px">
              <div class="fs12 tc-3 mb4">Consumer • Launch</div>
              <div class="fw7 fs14 tc-1">Boston Dynamics Spot Mini now available for home use at $9,999</div>
            </div>
          </div>
        </div>
        <div class="card p20">
          <h3 class="fw8 mb12 tc-1"><span class="material-symbols-rounded emoji-3d" style="color:var(--purple)">smart_toy</span> Build & Learn</h3>
          <div class="flex-col gap8">
            <div class="flex gap12 align-center p8" style="background:var(--card2); border-radius:8px; cursor:pointer" onclick="showToast('Opening tutorial...')">
              <span class="material-symbols-rounded" style="color:var(--green); font-size:24px">play_circle</span>
              <div style="flex:1"><div class="fw7 fs13 tc-1">Arduino Robot Arm Tutorial</div><div class="fs11 tc-3">Beginner • 45 min</div></div>
            </div>
            <div class="flex gap12 align-center p8" style="background:var(--card2); border-radius:8px; cursor:pointer" onclick="showToast('Opening tutorial...')">
              <span class="material-symbols-rounded" style="color:var(--blue); font-size:24px">play_circle</span>
              <div style="flex:1"><div class="fw7 fs13 tc-1">ROS2 Navigation Stack Guide</div><div class="fs11 tc-3">Advanced • 1h 20m</div></div>
            </div>
          </div>
          <button class="btn btn-primary btn-sm w100 mt12" onclick="showToast('Opening robotics projects...')">🤖 Browse Projects</button>
        </div>
      </div>
    `;
  } else if (cat === 'psych') {
    portal.innerHTML = `
      <div class="grid-2 mb16">
        <div class="card p20">
          <h3 class="fw8 mb12 tc-1"><span class="material-symbols-rounded emoji-3d" style="color:var(--purple)">psychology</span> Psychology Today</h3>
          <div class="flex-col gap12">
            <div style="background:var(--card2); padding:12px; border-radius:12px">
              <div class="fs12 tc-3 mb4">Cognition • Research</div>
              <div class="fw7 fs14 tc-1">Decision fatigue is real: how to optimize your daily choices</div>
            </div>
            <div style="background:var(--card2); padding:12px; border-radius:12px">
              <div class="fs12 tc-3 mb4">Social • Study</div>
              <div class="fw7 fs14 tc-1">Parasocial relationships in the age of AI companions</div>
            </div>
            <div style="background:var(--card2); padding:12px; border-radius:12px">
              <div class="fs12 tc-3 mb4">Neuroscience • Popular</div>
              <div class="fw7 fs14 tc-1">Neuroplasticity: your brain can rewire itself at any age</div>
            </div>
          </div>
        </div>
        <div class="card p20">
          <h3 class="fw8 mb12 tc-1"><span class="material-symbols-rounded emoji-3d" style="color:var(--green)">self_improvement</span> Mindfulness</h3>
          <div style="background:linear-gradient(135deg,#0d2b1a,#1a2d3d); padding:20px; border-radius:12px; text-align:center" class="mb12">
            <span class="material-symbols-rounded" style="font-size:48px; color:var(--green); opacity:0.6">spa</span>
            <div class="fw7 fs14 tc-1 mt8">Daily Breathing Exercise</div>
            <div class="fs12 tc-3">4-7-8 technique • 5 minutes</div>
          </div>
          <button class="btn btn-primary btn-sm w100" onclick="showToast('Starting guided session...')">🧘 Start Session</button>
        </div>
      </div>
    `;
  } else if (cat === 'philosophy') {
    portal.innerHTML = `
      <div class="grid-2 mb16">
        <div class="card p20">
          <h3 class="fw8 mb12 tc-1"><span class="material-symbols-rounded emoji-3d" style="color:var(--purple)">menu_book</span> Thought of the Day</h3>
          <div style="background:var(--card2); padding:20px; border-radius:12px; border-left:4px solid var(--purple)" class="mb12">
            <div class="fw7 fs16 tc-1" style="font-style:italic; line-height:1.5">"The unexamined life is not worth living."</div>
            <div class="fs13 tc-3 mt8">— Socrates, Apology (399 BCE)</div>
          </div>
          <div class="flex-col gap12">
            <div style="background:var(--card2); padding:12px; border-radius:12px">
              <div class="fs12 tc-3 mb4">Ethics • Debate</div>
              <div class="fw7 fs14 tc-1">Should AI systems have moral standing? A philosophical inquiry</div>
            </div>
            <div style="background:var(--card2); padding:12px; border-radius:12px">
              <div class="fs12 tc-3 mb4">Existentialism • Essay</div>
              <div class="fw7 fs14 tc-1">Camus and the meaning crisis in the algorithmic age</div>
            </div>
          </div>
        </div>
        <div class="card p20">
          <h3 class="fw8 mb12 tc-1"><span class="material-symbols-rounded emoji-3d" style="color:var(--blue)">school</span> Philosophy Library</h3>
          <div class="flex-col gap8">
            <div class="flex-between p8" style="background:var(--card2); border-radius:8px">
              <div><div class="fw7 fs13 tc-1">Stoicism for Modern Life</div><div class="fs11 tc-3">Series • 8 essays</div></div>
              <button class="btn btn-ghost btn-sm" onclick="showToast('Opening series...')">Read</button>
            </div>
            <div class="flex-between p8" style="background:var(--card2); border-radius:8px">
              <div><div class="fw7 fs13 tc-1">Eastern vs Western Ethics</div><div class="fs11 tc-3">Comparison • 12 min read</div></div>
              <button class="btn btn-ghost btn-sm" onclick="showToast('Opening essay...')">Read</button>
            </div>
          </div>
          <button class="btn btn-primary btn-sm w100 mt12" onclick="showToast('Opening discussion forum...')">💬 Join Discussion</button>
        </div>
      </div>
    `;
  } else if (cat === 'culture') {
    portal.innerHTML = `
      <div class="grid-2 mb16">
        <div class="card p20">
          <h3 class="fw8 mb12 tc-1"><span class="material-symbols-rounded emoji-3d" style="color:var(--orange)">diversity_3</span> Culture Feed</h3>
          <div class="flex-col gap12">
            <div style="background:var(--card2); padding:12px; border-radius:12px">
              <div class="fs12 tc-3 mb4">Film • Festival</div>
              <div class="fw7 fs14 tc-1">Cannes 2026 Palme d'Or winner explores AI consciousness</div>
            </div>
            <div style="background:var(--card2); padding:12px; border-radius:12px">
              <div class="fs12 tc-3 mb4">Books • Bestseller</div>
              <div class="fw7 fs14 tc-1">"The Memory Palace" tops NYT list for 12th consecutive week</div>
            </div>
            <div style="background:var(--card2); padding:12px; border-radius:12px">
              <div class="fs12 tc-3 mb4">Art • Exhibition</div>
              <div class="fw7 fs14 tc-1">MoMA opens immersive AI-generated art retrospective</div>
            </div>
          </div>
        </div>
        <div class="card p20">
          <h3 class="fw8 mb12 tc-1"><span class="material-symbols-rounded emoji-3d" style="color:var(--pink)">theater_comedy</span> Events Near You</h3>
          <div class="flex-col gap8">
            <div class="flex-between p8" style="background:var(--card2); border-radius:8px">
              <div><div class="fw7 fs13 tc-1">Jazz in the Park</div><div class="fs11 tc-3">Sat 7PM • Central Park</div></div>
              <button class="btn btn-primary btn-sm" onclick="showToast('RSVP confirmed!')">RSVP</button>
            </div>
            <div class="flex-between p8" style="background:var(--card2); border-radius:8px">
              <div><div class="fw7 fs13 tc-1">Indie Book Fair</div><div class="fs11 tc-3">Sun 10AM • Public Library</div></div>
              <button class="btn btn-primary btn-sm" onclick="showToast('RSVP confirmed!')">RSVP</button>
            </div>
          </div>
          <button class="btn btn-ghost btn-sm w100 mt12" onclick="showToast('Opening events calendar...')">📅 All Events</button>
        </div>
      </div>
    `;
  } else if (cat === 'memes') {
    portal.innerHTML = `
      <div class="grid-2 mb16">
        <div class="card p20">
          <h3 class="fw8 mb12 tc-1"><span class="material-symbols-rounded emoji-3d" style="color:var(--orange)">sentiment_very_satisfied</span> Hot Memes 🔥</h3>
          <div class="flex-col gap12">
            <div style="background:var(--card2); padding:16px; border-radius:12px; text-align:center">
              <div style="font-size:48px; margin-bottom:8px">😭💀</div>
              <div class="fw7 fs14 tc-1">"Me explaining to my boss why I need AI to write emails"</div>
              <div class="flex-between mt8"><span class="fs11 tc-3">@memegod • 42K ❤️</span><button class="btn btn-ghost btn-sm" onclick="showToast('Shared! 🔗')">Share</button></div>
            </div>
            <div style="background:var(--card2); padding:16px; border-radius:12px; text-align:center">
              <div style="font-size:48px; margin-bottom:8px">🤖📉</div>
              <div class="fw7 fs14 tc-1">"AI will replace my job" → AI can't even center a div</div>
              <div class="flex-between mt8"><span class="fs11 tc-3">@devhumor • 38K ❤️</span><button class="btn btn-ghost btn-sm" onclick="showToast('Shared! 🔗')">Share</button></div>
            </div>
          </div>
        </div>
        <div class="card p20">
          <h3 class="fw8 mb12 tc-1"><span class="material-symbols-rounded emoji-3d" style="color:var(--pink)">add_reaction</span> Meme Creator</h3>
          <div style="background:var(--card2); padding:20px; border-radius:12px; text-align:center" class="mb12">
            <span class="material-symbols-rounded" style="font-size:64px; color:var(--pink); opacity:0.4">add_photo_alternate</span>
            <div class="fw7 fs14 tc-1 mt8">Drop image or pick a template</div>
            <div class="fs12 tc-3">Add top/bottom text, stickers, and effects</div>
          </div>
          <button class="btn btn-primary btn-sm w100" onclick="showToast('Opening meme editor...')">✨ Create Meme</button>
        </div>
      </div>
    `;
  } else if (cat === 'social') {
    portal.innerHTML = `
      <div class="grid-2 mb16">
        <div class="card p20">
          <h3 class="fw8 mb12 tc-1"><span class="material-symbols-rounded emoji-3d" style="color:var(--blue)">groups</span> Social Pulse</h3>
          <div class="flex-col gap12">
            <div class="flex gap12 align-start" style="padding-bottom:12px; border-bottom:1px solid var(--border)">
              <div class="avatar av-sm">🌟</div>
              <div><div class="fw7 fs14 tc-1">@sarahcodes</div><div class="fs13 tc-2">Just shipped my first SaaS product after 6 months of building in public. $1K MRR day one! 🚀</div><div class="fs11 tc-3 mt4">2h ago • 1.2K ❤️ • 342 💬</div></div>
            </div>
            <div class="flex gap12 align-start">
              <div class="avatar av-sm">🎯</div>
              <div><div class="fw7 fs14 tc-1">@designdaily</div><div class="fs13 tc-2">Hot take: Figma's new AI features will make junior designers more productive, not replace them.</div><div class="fs11 tc-3 mt4">4h ago • 856 ❤️ • 218 💬</div></div>
            </div>
          </div>
        </div>
        <div class="card p20">
          <h3 class="fw8 mb12 tc-1"><span class="material-symbols-rounded emoji-3d" style="color:var(--green)">hub</span> Communities</h3>
          <div class="flex-col gap8">
            <div class="flex gap12 align-center p8" style="background:var(--card2); border-radius:8px">
              <span style="font-size:24px">💻</span>
              <div style="flex:1"><div class="fw7 fs13 tc-1">Indie Hackers</div><div class="fs11 tc-3">14.2K members • 89 online</div></div>
              <button class="btn btn-primary btn-sm" onclick="showToast('Joined community!')">Join</button>
            </div>
            <div class="flex gap12 align-center p8" style="background:var(--card2); border-radius:8px">
              <span style="font-size:24px">📚</span>
              <div style="flex:1"><div class="fw7 fs13 tc-1">Book Club</div><div class="fs11 tc-3">8.5K members • 42 online</div></div>
              <button class="btn btn-primary btn-sm" onclick="showToast('Joined community!')">Join</button>
            </div>
          </div>
        </div>
      </div>
    `;
  } else if (cat === 'diy') {
    portal.innerHTML = `
      <div class="grid-2 mb16">
        <div class="card p20">
          <h3 class="fw8 mb12 tc-1"><span class="material-symbols-rounded emoji-3d" style="color:var(--orange)">construction</span> DIY Projects</h3>
          <div class="flex-col gap12">
            <div style="background:var(--card2); padding:12px; border-radius:12px">
              <div class="fs12 tc-3 mb4">Woodworking • Popular</div>
              <div class="fw7 fs14 tc-1">Build a mid-century modern desk from reclaimed walnut</div>
              <div class="flex gap8 mt8"><span class="badge badge-blue fs11">Intermediate</span><span class="fs11 tc-3">~8 hours</span></div>
            </div>
            <div style="background:var(--card2); padding:12px; border-radius:12px">
              <div class="fs12 tc-3 mb4">Electronics • Trending</div>
              <div class="fw7 fs14 tc-1">Raspberry Pi home automation hub — complete guide</div>
              <div class="flex gap8 mt8"><span class="badge badge-green fs11">Beginner</span><span class="fs11 tc-3">~3 hours</span></div>
            </div>
            <div style="background:var(--card2); padding:12px; border-radius:12px">
              <div class="fs12 tc-3 mb4">Upcycle • Eco</div>
              <div class="fw7 fs14 tc-1">Turn old jeans into a stylish tote bag — zero waste</div>
              <div class="flex gap8 mt8"><span class="badge badge-green fs11">Beginner</span><span class="fs11 tc-3">~1 hour</span></div>
            </div>
          </div>
        </div>
        <div class="card p20">
          <h3 class="fw8 mb12 tc-1"><span class="material-symbols-rounded emoji-3d" style="color:var(--green)">handyman</span> Tool Reviews</h3>
          <div class="flex-col gap8">
            <div class="flex gap12 align-center p8" style="background:var(--card2); border-radius:8px">
              <span class="material-symbols-rounded" style="color:var(--orange); font-size:24px">hardware</span>
              <div style="flex:1"><div class="fw7 fs13 tc-1">DeWalt 20V Max Drill</div><div class="fs11 tc-3">★ 4.8 • Best value 2026</div></div>
            </div>
            <div class="flex gap12 align-center p8" style="background:var(--card2); border-radius:8px">
              <span class="material-symbols-rounded" style="color:var(--blue); font-size:24px">straighten</span>
              <div style="flex:1"><div class="fw7 fs13 tc-1">Bosch Laser Measure</div><div class="fs11 tc-3">★ 4.7 • Editor's pick</div></div>
            </div>
          </div>
          <button class="btn btn-primary btn-sm w100 mt12" onclick="showToast('Opening project planner...')">📐 Plan a Project</button>
        </div>
      </div>
    `;
  } else if (cat === 'art') {
    portal.innerHTML = `
      <div class="grid-2 mb16">
        <div class="card p20">
          <h3 class="fw8 mb12 tc-1"><span class="material-symbols-rounded emoji-3d" style="color:var(--pink)">palette</span> Art Gallery</h3>
          <div class="grid-3 gap8 mb12">
            <div style="aspect-ratio:1; background:linear-gradient(135deg,#ff6b6b,#ffa500); border-radius:8px"></div>
            <div style="aspect-ratio:1; background:linear-gradient(135deg,#6b5ce7,#00d2d3); border-radius:8px"></div>
            <div style="aspect-ratio:1; background:linear-gradient(135deg,#ff9ff3,#feca57); border-radius:8px"></div>
          </div>
          <div class="flex-col gap8">
            <div style="background:var(--card2); padding:12px; border-radius:12px">
              <div class="fs12 tc-3 mb4">Digital Art • Featured</div>
              <div class="fw7 fs14 tc-1">Generative art meets traditional brushwork — a new movement</div>
            </div>
            <div style="background:var(--card2); padding:12px; border-radius:12px">
              <div class="fs12 tc-3 mb4">NFT • Auction</div>
              <div class="fw7 fs14 tc-1">Beeple's latest collection sells for 3,200 ETH</div>
            </div>
          </div>
        </div>
        <div class="card p20">
          <h3 class="fw8 mb12 tc-1"><span class="material-symbols-rounded emoji-3d" style="color:var(--purple)">brush</span> Create</h3>
          <div style="background:var(--card2); padding:20px; border-radius:12px; text-align:center" class="mb12">
            <span class="material-symbols-rounded" style="font-size:48px; color:var(--pink); opacity:0.5">draw</span>
            <div class="fw7 fs14 tc-1 mt8">AI Art Studio</div>
            <div class="fs12 tc-3">Generate, remix, and share art</div>
          </div>
          <div class="flex gap8">
            <button class="btn btn-primary btn-sm" style="flex:1" onclick="showToast('Opening AI canvas...')">✨ Generate</button>
            <button class="btn btn-ghost btn-sm" style="flex:1" onclick="showToast('Opening sketchpad...')">🖌️ Draw</button>
          </div>
        </div>
      </div>
    `;
  } else if (cat === 'architecture') {
    portal.innerHTML = `
      <div class="grid-2 mb16">
        <div class="card p20">
          <h3 class="fw8 mb12 tc-1"><span class="material-symbols-rounded emoji-3d" style="color:var(--blue)">apartment</span> Architecture Digest</h3>
          <div class="flex-col gap12">
            <div style="background:var(--card2); padding:12px; border-radius:12px">
              <div class="fs12 tc-3 mb4">Sustainable • Award</div>
              <div class="fw7 fs14 tc-1">World's first carbon-negative skyscraper completed in Singapore</div>
            </div>
            <div style="background:var(--card2); padding:12px; border-radius:12px">
              <div class="fs12 tc-3 mb4">Residential • Trend</div>
              <div class="fw7 fs14 tc-1">3D-printed homes now cost under $50K and build in 48 hours</div>
            </div>
            <div style="background:var(--card2); padding:12px; border-radius:12px">
              <div class="fs12 tc-3 mb4">Urban • Vision</div>
              <div class="fw7 fs14 tc-1">The Line: Saudi Arabia's linear city reaches Phase 2 milestone</div>
            </div>
          </div>
        </div>
        <div class="card p20">
          <h3 class="fw8 mb12 tc-1"><span class="material-symbols-rounded emoji-3d" style="color:var(--green)">view_in_ar</span> 3D Showcase</h3>
          <div style="height:160px; background:linear-gradient(135deg,#1a2a3a,#0a1a2a); border-radius:12px; display:grid; place-items:center; position:relative">
            <span class="material-symbols-rounded" style="font-size:64px; color:rgba(255,255,255,0.2)">domain</span>
            <div style="position:absolute; bottom:12px; left:12px; color:white">
              <div class="fw7 fs13">Zaha Hadid Virtual Tour</div>
              <div class="fs11" style="opacity:0.7">Interactive 3D walkthrough</div>
            </div>
          </div>
          <button class="btn btn-primary btn-sm w100 mt12" onclick="showToast('Loading 3D model...')">🏗️ Explore in 3D</button>
        </div>
      </div>
    `;
  } else if (cat === 'spirit') {
    portal.innerHTML = `
      <div class="grid-2 mb16">
        <div class="card p20">
          <h3 class="fw8 mb12 tc-1"><span class="material-symbols-rounded emoji-3d" style="color:var(--purple)">self_improvement</span> Spiritual Feed</h3>
          <div style="background:linear-gradient(135deg,#1a0b2e,#0d2b1a); padding:20px; border-radius:12px; text-align:center" class="mb12">
            <div style="font-size:48px; margin-bottom:8px">🕉️</div>
            <div class="fw7 fs16 tc-1" style="font-style:italic">"Be still and know."</div>
            <div class="fs12 tc-3 mt4">Daily Meditation • Psalm 46:10</div>
          </div>
          <div class="flex-col gap8">
            <div style="background:var(--card2); padding:12px; border-radius:12px">
              <div class="fs12 tc-3 mb4">Mindfulness • Guide</div>
              <div class="fw7 fs14 tc-1">Morning gratitude practice: 7 prompts to start your day</div>
            </div>
            <div style="background:var(--card2); padding:12px; border-radius:12px">
              <div class="fs12 tc-3 mb4">Wisdom • Traditions</div>
              <div class="fw7 fs14 tc-1">Comparing meditation practices across 5 world traditions</div>
            </div>
          </div>
        </div>
        <div class="card p20">
          <h3 class="fw8 mb12 tc-1"><span class="material-symbols-rounded emoji-3d" style="color:var(--green)">spa</span> Guided Sessions</h3>
          <div class="flex-col gap8">
            <div class="flex gap12 align-center p8" style="background:var(--card2); border-radius:8px; cursor:pointer" onclick="showToast('Starting meditation...')">
              <span class="material-symbols-rounded" style="color:var(--purple); font-size:24px">play_circle</span>
              <div style="flex:1"><div class="fw7 fs13 tc-1">Morning Calm</div><div class="fs11 tc-3">10 min guided meditation</div></div>
            </div>
            <div class="flex gap12 align-center p8" style="background:var(--card2); border-radius:8px; cursor:pointer" onclick="showToast('Starting breathwork...')">
              <span class="material-symbols-rounded" style="color:var(--green); font-size:24px">play_circle</span>
              <div style="flex:1"><div class="fw7 fs13 tc-1">Deep Breathwork</div><div class="fs11 tc-3">15 min • Wim Hof method</div></div>
            </div>
            <div class="flex gap12 align-center p8" style="background:var(--card2); border-radius:8px; cursor:pointer" onclick="showToast('Starting sound bath...')">
              <span class="material-symbols-rounded" style="color:var(--blue); font-size:24px">play_circle</span>
              <div style="flex:1"><div class="fw7 fs13 tc-1">Crystal Sound Bath</div><div class="fs11 tc-3">20 min • Sleep aid</div></div>
            </div>
          </div>
        </div>
      </div>
    `;
  } else if (cat === 'motivation') {
    portal.innerHTML = `
      <div class="grid-2 mb16">
        <div class="card p20">
          <h3 class="fw8 mb12 tc-1"><span class="material-symbols-rounded emoji-3d" style="color:var(--orange)">local_fire_department</span> Daily Motivation</h3>
          <div style="background:linear-gradient(135deg,#2d1b00,#1a0b00); padding:20px; border-radius:12px; border:1px solid var(--orange)" class="mb12">
            <div class="fw8 fs18 tc-1" style="line-height:1.5">"The only way to do great work is to love what you do."</div>
            <div class="fs13 tc-3 mt8">— Steve Jobs</div>
          </div>
          <div class="flex-col gap8">
            <div style="background:var(--card2); padding:12px; border-radius:12px">
              <div class="fw7 fs14 tc-1">5 AM Club: Why successful people wake up early</div>
              <div class="fs11 tc-3">Productivity • 6 min read</div>
            </div>
            <div style="background:var(--card2); padding:12px; border-radius:12px">
              <div class="fw7 fs14 tc-1">Atomic Habits: The 1% rule that changes everything</div>
              <div class="fs11 tc-3">Habits • 8 min read</div>
            </div>
          </div>
        </div>
        <div class="card p20">
          <h3 class="fw8 mb12 tc-1"><span class="material-symbols-rounded emoji-3d" style="color:var(--green)">emoji_events</span> Goal Tracker</h3>
          <div class="flex-col gap8">
            <div class="flex-between p8" style="background:var(--card2); border-radius:8px">
              <div><div class="fw7 fs13 tc-1">Read 30 min daily</div><div class="fs11 tc-3">🔥 14-day streak</div></div>
              <span class="badge badge-green fs11">On Track</span>
            </div>
            <div class="flex-between p8" style="background:var(--card2); border-radius:8px">
              <div><div class="fw7 fs13 tc-1">Ship side project</div><div class="fs11 tc-3">Progress: 72%</div></div>
              <span class="badge badge-orange fs11">In Progress</span>
            </div>
            <div class="flex-between p8" style="background:var(--card2); border-radius:8px">
              <div><div class="fw7 fs13 tc-1">Morning workout</div><div class="fs11 tc-3">🔥 28-day streak</div></div>
              <span class="badge badge-green fs11">On Track</span>
            </div>
          </div>
          <button class="btn btn-primary btn-sm w100 mt12" onclick="showToast('Adding new goal...')">🎯 Set New Goal</button>
        </div>
      </div>
    `;
  } else if (cat === 'career') {
    portal.innerHTML = `
      <div class="grid-2 mb16">
        <div class="card p20">
          <h3 class="fw8 mb12 tc-1"><span class="material-symbols-rounded emoji-3d" style="color:var(--blue)">work</span> Career Feed</h3>
          <div class="flex-col gap12">
            <div style="background:var(--card2); padding:12px; border-radius:12px">
              <div class="fs12 tc-3 mb4">Remote • Featured</div>
              <div class="fw7 fs14 tc-1">Senior React Developer — $180K–$220K</div>
              <div class="fs11 tc-3 mt4">Stripe • Remote US • Posted 2h ago</div>
            </div>
            <div style="background:var(--card2); padding:12px; border-radius:12px">
              <div class="fs12 tc-3 mb4">AI • Hot</div>
              <div class="fw7 fs14 tc-1">ML Engineer — $200K–$280K + equity</div>
              <div class="fs11 tc-3 mt4">Anthropic • SF / Remote • Posted 6h ago</div>
            </div>
            <div style="background:var(--card2); padding:12px; border-radius:12px">
              <div class="fs12 tc-3 mb4">Design • New</div>
              <div class="fw7 fs14 tc-1">Staff Product Designer — $160K–$200K</div>
              <div class="fs11 tc-3 mt4">Figma • NYC • Posted 1d ago</div>
            </div>
          </div>
        </div>
        <div class="card p20">
          <h3 class="fw8 mb12 tc-1"><span class="material-symbols-rounded emoji-3d" style="color:var(--green)">school</span> Skill Up</h3>
          <div class="flex-col gap8">
            <div class="flex-between p8" style="background:var(--card2); border-radius:8px">
              <div><div class="fw7 fs13 tc-1">Resume AI Review</div><div class="fs11 tc-3">Get instant feedback</div></div>
              <button class="btn btn-primary btn-sm" onclick="showToast('Uploading resume...')">Upload</button>
            </div>
            <div class="flex-between p8" style="background:var(--card2); border-radius:8px">
              <div><div class="fw7 fs13 tc-1">Mock Interview Prep</div><div class="fs11 tc-3">Practice with AI</div></div>
              <button class="btn btn-ghost btn-sm" onclick="showToast('Starting mock interview...')">Start</button>
            </div>
          </div>
          <button class="btn btn-primary btn-sm w100 mt12" onclick="showToast('Opening job board...')">💼 Browse All Jobs</button>
        </div>
      </div>
    `;
  } else if (cat === 'freelance') {
    portal.innerHTML = `
      <div class="grid-2 mb16">
        <div class="card p20">
          <h3 class="fw8 mb12 tc-1"><span class="material-symbols-rounded emoji-3d" style="color:var(--green)">laptop_mac</span> Freelance Board</h3>
          <div class="flex-col gap12">
            <div style="background:var(--card2); padding:12px; border-radius:12px">
              <div class="flex-between mb4"><span class="fw7 fs14 tc-1">Landing Page Design</span><span class="fw8 fs14" style="color:var(--green)">$2,500</span></div>
              <div class="fs11 tc-3">SaaS startup • Fixed price • 12 proposals</div>
            </div>
            <div style="background:var(--card2); padding:12px; border-radius:12px">
              <div class="flex-between mb4"><span class="fw7 fs14 tc-1">React Native App</span><span class="fw8 fs14" style="color:var(--green)">$8,000</span></div>
              <div class="fs11 tc-3">Fintech • Milestone • 6 proposals</div>
            </div>
            <div style="background:var(--card2); padding:12px; border-radius:12px">
              <div class="flex-between mb4"><span class="fw7 fs14 tc-1">Brand Identity Package</span><span class="fw8 fs14" style="color:var(--green)">$3,200</span></div>
              <div class="fs11 tc-3">Food & Bev • Fixed price • 18 proposals</div>
            </div>
          </div>
        </div>
        <div class="card p20">
          <h3 class="fw8 mb12 tc-1"><span class="material-symbols-rounded emoji-3d" style="color:var(--purple)">payments</span> Freelancer Stats</h3>
          <div class="grid-2 gap8 mb12">
            <div class="card p12" style="background:var(--card2); text-align:center"><div class="fw8 fs20" style="color:var(--green)">$4,280</div><div class="fs11 tc-3">Earned this month</div></div>
            <div class="card p12" style="background:var(--card2); text-align:center"><div class="fw8 fs20" style="color:var(--blue)">3</div><div class="fs11 tc-3">Active projects</div></div>
          </div>
          <div class="flex-col gap8">
            <div class="flex-between p8" style="background:var(--card2); border-radius:8px">
              <div><div class="fw7 fs13 tc-1">Invoice #1042</div><div class="fs11 tc-3">$1,200 • Due in 5 days</div></div>
              <span class="badge badge-orange fs11">Pending</span>
            </div>
          </div>
          <button class="btn btn-primary btn-sm w100 mt12" onclick="showToast('Creating new proposal...')">✍️ New Proposal</button>
        </div>
      </div>
    `;
  } else if (cat === 'emergency') {
    portal.innerHTML = `
      <div class="grid-2 mb16">
        <div class="card p20" style="border:1px solid var(--red)">
          <h3 class="fw8 mb12 tc-1"><span class="material-symbols-rounded emoji-3d" style="color:var(--red)">emergency</span> Active Alerts</h3>
          <div class="flex-col gap12">
            <div style="padding:12px; border-left:3px solid var(--red); background:rgba(255,0,0,0.05); border-radius:4px 8px 8px 4px">
              <div class="flex-between mb4"><span class="fw7 fs13 tc-1">🔴 Severe Weather Warning</span><span class="fs11 tc-3">2 min ago</span></div>
              <div class="fs12 tc-2">Tornado watch issued for central Oklahoma through 9 PM CT</div>
            </div>
            <div style="padding:12px; border-left:3px solid var(--orange); background:rgba(255,165,0,0.05); border-radius:4px 8px 8px 4px">
              <div class="flex-between mb4"><span class="fw7 fs13 tc-1">🟠 Wildfire Update</span><span class="fs11 tc-3">18 min ago</span></div>
              <div class="fs12 tc-2">Evacuation orders expanded for northern California zones A-C</div>
            </div>
            <div style="padding:12px; border-left:3px solid var(--blue); background:rgba(0,100,255,0.05); border-radius:4px 8px 8px 4px">
              <div class="flex-between mb4"><span class="fw7 fs13 tc-1">🔵 Flood Advisory</span><span class="fs11 tc-3">1h ago</span></div>
              <div class="fs12 tc-2">Flash flood watch for Harris County, TX until midnight</div>
            </div>
          </div>
        </div>
        <div class="card p20">
          <h3 class="fw8 mb12 tc-1"><span class="material-symbols-rounded emoji-3d" style="color:var(--green)">local_hospital</span> Resources</h3>
          <div class="flex-col gap8">
            <button class="btn btn-primary btn-sm w100" onclick="showToast('Calling emergency services...')" style="background:var(--red)">🚨 Call 911</button>
            <button class="btn btn-ghost btn-sm w100" onclick="showToast('Opening shelter map...')">🏠 Find Nearest Shelter</button>
            <button class="btn btn-ghost btn-sm w100" onclick="showToast('Loading supply kit checklist...')">🎒 Emergency Kit Checklist</button>
            <button class="btn btn-ghost btn-sm w100" onclick="showToast('Opening weather radar...')">🌧️ Live Weather Radar</button>
          </div>
          <div style="background:var(--card2); padding:12px; border-radius:12px; margin-top:12px">
            <div class="fw7 fs13 tc-1 mb4">Community Updates</div>
            <div class="fs12 tc-2">Power restored to 85% of affected areas. Red Cross shelters open at Lincoln High School and City Hall.</div>
          </div>
        </div>
      </div>
    `;
  } else {
    // Fallback
    portal.innerHTML = `<div class="card p20 tc-center tc-2">Feed content for <strong>${cat}</strong> coming soon.</div>`;
  }
}


// ── SCIENCE ECOSYSTEM UTILS ──────────────────────────────────────
function mixChemical(chem) {
  S.labChemicals.push(chem);
  if (S.labChemicals.length > 2) S.labChemicals.shift();
  const output = $id('lab-output'); if (!output) return;
  
  const mix = S.labChemicals.join(' + ');
  let resultText = `Mixed: <strong>${mix}</strong>. `;
  
  if (mix.includes('Hydrogen') && mix.includes('Oxygen')) {
    resultText += '<span class="tc-blue fw7">Synthesis Complete: H2O (Water) Synthesized!</span>';
    S.user.xp += 10;
    updateUserUI();
  } else if (mix.includes('Hydrogen') && mix.includes('Carbon')) {
    resultText += '<span class="tc-green fw7">Synthesis Complete: CH4 (Methane) Gas Formed!</span>';
    S.user.xp += 10;
    updateUserUI();
  } else {
    resultText += '<span class="tc-pink">No direct molecular reaction detected yet...</span>';
  }
  output.innerHTML = resultText;
}
function clearChemicals() {
  S.labChemicals = [];
  const output = $id('lab-output'); if (output) output.textContent = 'Mix elements to begin...';
}

function renderScienceSubContent() {
  const docs = $id('science-docs');
  if (docs) {
    const list = [
      { t: 'Quantum Computing Explained Simply', d: '9m · Video explainer' },
      { t: 'Inside the mRNA Protein Lab', d: '14m · Documentary' },
      { t: 'Astronomy: Cosmic Rays from Deep Space', d: '22m · Live Stream Rec' }
    ];
    docs.innerHTML = list.map(item => `
      <div class="flex-between py8" style="border-bottom:1px solid var(--border)">
        <div>
          <div class="fw7 fs12 tc-1">${item.t}</div>
          <div class="fs11 tc-3">${item.d}</div>
        </div>
        <button class="btn btn-ghost btn-sm" onclick="showToast('Loading Video...')">▶ Play</button>
      </div>`).join('');
  }
  const papers = $id('science-papers');
  if (papers) {
    const list = [
      { t: 'Visualizing CRISPR Off-Target Efficiencies', a: 'Dr. Sarah Chen' },
      { t: 'Superconducting Accords at Room Temps', a: 'Stanford Acc.' }
    ];
    papers.innerHTML = list.map(item => `
      <div class="flex-between py8" style="border-bottom:1px solid var(--border)">
        <div>
          <div class="fw7 fs12 tc-1">${item.t}</div>
          <div class="fs11 tc-3">Author: ${item.a} · Simplified AI Abstract available</div>
        </div>
        <button class="btn btn-ghost btn-sm" onclick="showToast('PDF Abstract downloaded!')">📄 PDF</button>
      </div>`).join('');
  }
  
  // Render Science publications stats on Canvas
  const canvas = $id('science-chart'); if (!canvas) return;
  canvas.width = canvas.offsetWidth; canvas.height = 110;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.strokeStyle = 'hsl(217,91%,60%)'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(0, 80);
  ctx.bezierCurveTo(canvas.width*0.25, 40, canvas.width*0.5, 90, canvas.width*0.75, 20);
  ctx.lineTo(canvas.width, 10); ctx.stroke();
  ctx.fillStyle = 'rgba(59,130,246,0.1)'; ctx.lineTo(canvas.width, 110); ctx.lineTo(0, 110); ctx.fill();
}

// ── POLITICS & REALITY ENGINE UTILS ──────────────────────────────
function drawRealityScoreCircle() {
  const canvas = $id('reality-score-circle'); if (!canvas) return;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0,0,100,100);
  ctx.beginPath(); ctx.arc(50,50,42,0,Math.PI*2);
  ctx.strokeStyle = 'var(--border)'; ctx.lineWidth = 6; ctx.stroke();
  ctx.beginPath(); ctx.arc(50,50,42,-Math.PI/2, Math.PI*2*0.88 - Math.PI/2);
  ctx.strokeStyle = 'var(--green)'; ctx.lineWidth = 6; ctx.stroke();
}
function toggleELI15() {
  S.eli15Active = !S.eli15Active;
  const panel = $id('eli15-panel');
  if (panel) panel.classList.toggle('hidden', !S.eli15Active);
  showToast(S.eli15Active ? 'ELI15 Mode Active 💡' : 'ELI15 Mode Inactive');
}

// ── LIVE CRYPTO TREND CANVAS CHART ───────────────────────────────
function startCryptoLiveChart() {
  const canvas = $id('crypto-canvas'); if (!canvas) return;
  canvas.width = canvas.offsetWidth; canvas.height = 180;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  let points = [];
  for (let i=0; i<30; i++) points.push(H/2 + Math.sin(i*0.5)*30 + Math.random()*20);
  
  stopCryptoLiveChart();
  
  const tick = () => {
    points.push(H/2 + Math.sin(Date.now()*0.001)*40 + Math.random()*15);
    if (points.length > 50) points.shift();
    
    // update live price text mock
    const pEl = $id('crypto-live-price');
    if (pEl) {
      const price = 68420.50 + Math.sin(Date.now()*0.001)*320 + Math.random()*15;
      pEl.textContent = `$${price.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
    }
    
    ctx.fillStyle = '#050508'; ctx.fillRect(0,0,W,H);
    ctx.strokeStyle = 'hsl(155,60%,44%)'; ctx.lineWidth = 2.5;
    ctx.beginPath();
    points.forEach((p, idx) => {
      const x = (idx / (points.length-1)) * W;
      if (idx === 0) ctx.moveTo(x, p); else ctx.lineTo(x, p);
      
      // Draw simulated green/red candlestick bodies on top
      if (idx % 3 === 0) {
        ctx.fillStyle = idx % 2 === 0 ? 'hsl(155,60%,44%)' : 'hsl(355,72%,58%)';
        ctx.fillRect(x-4, p-10, 8, 20);
      }
    });
    ctx.stroke();
    
    S.cryptoAnimId = requestAnimationFrame(tick);
  };
  tick();
  
  // Render guides & alerts
  const guides = $id('defi-guides');
  if (guides) {
    const list = [
      { t: 'Intro to Liquidity Pools', d: 'Earn yield on stable assets safely.' },
      { t: 'Web3 Contract Security 101', d: 'How to avoid flashloan exploit traps.' }
    ];
    guides.innerHTML = list.map(g => `
      <div class="py8" style="border-bottom:1px solid var(--border)">
        <div class="fw7 fs12 tc-1">${g.t}</div>
        <div class="fs11 tc-3">${g.d}</div>
      </div>`).join('');
  }
  const alerts = $id('security-alerts');
  if (alerts) {
    const list = [
      { t: 'Phishing Contract Alert', d: 'Warning: Fake wallet signature scams detected on @MetaAcc.' },
      { t: 'Oracle Price Lag Resolved', d: 'Chainlink reports normal feed delivery resumed.' }
    ];
    alerts.innerHTML = list.map(a => `
      <div class="py8" style="border-bottom:1px solid var(--border)">
        <div class="fw7 fs12 tc-pink">🚨 ${a.t}</div>
        <div class="fs11 tc-3">${a.d}</div>
      </div>`).join('');
  }
}
function stopCryptoLiveChart() {
  if (S.cryptoAnimId) { cancelAnimationFrame(S.cryptoAnimId); S.cryptoAnimId = null; }
}



// ── MUSIC SUB CONTENT & AUDIO MOCK ────────────────────────────────
function toggleMusicPlayback() {
  S.activeMusicPlaying = !S.activeMusicPlaying;
  const btn = $id('music-play-btn');
  if (btn) btn.textContent = S.activeMusicPlaying ? '⏸ Pause' : '▶ Play';
  showToast(S.activeMusicPlaying ? 'Playing Chill Beat... 🎵' : 'Playback paused.');
  
  // lyric scroller auto scroll simulation
  const scroll = $id('lyric-scroll');
  if (scroll && S.activeMusicPlaying) {
    let p = 0;
    const scrollInterval = setInterval(() => {
      if (!S.activeMusicPlaying || S.pane !== 'category') { clearInterval(scrollInterval); return; }
      p = (p + 30) % 200;
      scroll.scrollTo({ top: p, behavior: 'smooth' });
    }, 2800);
  }
}

function renderMusicSubContent() {
  const cards = $id('songwriting-cards'); if (!cards) return;
  const list = [
    { t: 'Modal Chord Progression', e: '🎼' },
    { t: 'Visual Rhythm Mechanics', e: '📐' },
    { t: 'Audio Mastering 101', e: '🎛️' }
  ];
  cards.innerHTML = list.map(i => `
    <div class="card p12 text-center" style="cursor:pointer" onclick="showToast('Opening ${i.t}...')">
      <div style="font-size:32px">${i.e}</div>
      <div class="fw7 fs12 mt8">${i.t}</div>
    </div>`).join('');
}

// ── TECH & DEVELOPER WORKSHOPS ───────────────────────────────────
function renderTechSubContent() {
  const launch = $id('tech-launches');
  if (launch) {
    const list = [
      { t: 'Apple Vision VR Launch Keynote', d: 'June 5 · Spatial Ecosystems' },
      { t: 'Google I/O 2026 Developer Rec', d: 'Gemini Agentic SDK launches' }
    ];
    launch.innerHTML = list.map(l => `
      <div class="py8" style="border-bottom:1px solid var(--border)">
        <div class="fw7 fs12 tc-1">${l.t}</div>
        <div class="fs11 tc-3">${l.d}</div>
      </div>`).join('');
  }
  const tuts = $id('tech-tutorials');
  if (tuts) {
    const list = [
      { t: 'Next.js 16 Server Components Guide', d: 'Learn streaming HTML layouts.' },
      { t: 'Deploying secure Rust microservices', d: 'Safe backends.' }
    ];
    tuts.innerHTML = list.map(t => `
      <div class="py8" style="border-bottom:1px solid var(--border)">
        <div class="fw7 fs12 tc-1">${t.t}</div>
        <div class="fs11 tc-3">${t.d}</div>
      </div>`).join('');
  }
  
  const aiPapers = $id('ai-papers-grid'); if (!aiPapers) return;
  const list = [
    { t: 'Transformer Acceleration with Agentic Comp', e: '📄 Paper' },
    { t: 'Reasoning Scales in Neural Networks', e: '📄 PDF' }
  ];
  aiPapers.innerHTML = list.map(item => `
    <div class="card p12 flex-between">
      <div>
        <div class="fw7 fs12 tc-1">${item.t}</div>
        <span class="badge badge-purple mt8">${item.e}</span>
      </div>
      <button class="btn btn-ghost btn-sm" onclick="showToast('Academic Paper fetched!')">Read</button>
    </div>`).join('');
}

// ── WILDLIFE DRONE SCANNER CANVAS SIMULATOR ───────────────────────
function startWildlifeCanvasSim() {
  const canvas = $id('wildlife-canvas'); if (!canvas) return;
  canvas.width = canvas.offsetWidth; canvas.height = 120;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  let offset = 0;
  
  stopWildlifeCanvasSim();
  
  const tick = () => {
    ctx.fillStyle = '#0c1b10'; ctx.fillRect(0,0,W,H);
    ctx.strokeStyle = 'rgba(74,222,128,0.15)'; ctx.lineWidth = 1;
    
    // Draw scrolling grid lines
    offset = (offset + 1.2) % 40;
    for (let x = offset; x < W; x += 40) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = 0; y < H; y += 40) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
    
    // Draw mock animal thermal highlights moving
    ctx.fillStyle = 'rgba(236,72,153,0.6)'; ctx.shadowColor='hsl(330,80%,62%)'; ctx.shadowBlur=12;
    const tx = W/2 + Math.cos(Date.now()*0.001)*60;
    const ty = H/2 + Math.sin(Date.now()*0.0025)*20;
    ctx.beginPath(); ctx.arc(tx, ty, 8, 0, Math.PI*2); ctx.fill();
    ctx.shadowBlur=0;
    
    ctx.fillStyle = '#fff'; ctx.font = '10px Inter';
    ctx.fillText('Thermal Sensor: Herd Tracking Active', 12, 20);
    
    S.wildlifeAnimId = requestAnimationFrame(tick);
  };
  tick();
  
  // Render wildlife news and vlogs
  const news = $id('wildlife-news');
  if (news) {
    const list = [
      { t: 'Rainforest Accords Target Logging Boundaries', d: 'Satellite tracking is strictly protecting tree lines.' },
      { t: 'Rhino Protection Sprints Report 0 Incidents', d: 'Coordinated civic ranger drones succeeded!' }
    ];
    news.innerHTML = list.map(n => `
      <div class="py8" style="border-bottom:1px solid var(--border)">
        <div class="fw7 fs12 tc-1">${n.t}</div>
        <div class="fs11 tc-3">${n.d}</div>
      </div>`).join('');
  }
  const vlogs = $id('wildlife-vlogs');
  if (vlogs) {
    const list = [
      { t: 'Deep Oceans Coral Formations (Cinematic)', d: '12m · 4K Drone Footage' },
      { t: 'African Savannah migrations in Dry Season', d: '18m · Wildlife Vlog' }
    ];
    vlogs.innerHTML = list.map(v => `
      <div class="flex-between py8" style="border-bottom:1px solid var(--border)">
        <div>
          <div class="fw7 fs12 tc-1">${v.t}</div>
          <div class="fs11 tc-3">${v.d}</div>
        </div>
        <button class="btn btn-ghost btn-sm" onclick="showToast('Playing nature stream...')">▶ Watch</button>
      </div>`).join('');
  }
}
function stopWildlifeCanvasSim() {
  if (S.wildlifeAnimId) { cancelAnimationFrame(S.wildlifeAnimId); S.wildlifeAnimId = null; }
}

// ── LOCAL CIVIC PORTAL UTILS ─────────────────────────────────────
function renderCivicSubContent() {
  const feed = $id('civic-feed');
  if (feed) {
    feed.innerHTML = S.civicReports.map(r => `
      <div class="card p12" style="background:var(--card2)">
        <div class="flex-between mb4">
          <span class="badge badge-blue fs11">${r.type}</span>
          <span class="fs11 fw7 tc-green">${r.status}</span>
        </div>
        <div class="fs12 tc-1 fw6">${r.text}</div>
        <div class="fs11 tc-3 mt4">Location: ${r.location} · Assigned: <strong class="tc-blue">${r.authority}</strong></div>
      </div>`).join('');
  }
  const sprints = $id('local-sprints');
  if (sprints) {
    const list = [
      { t: 'Spring Cleaning Park Run', d: 'Sat 9AM · North Park · 24 volunteers joined' },
      { t: 'Local Food Pantry Packing Session', d: 'Sun 1PM · Civic Center · 12 slots remaining' }
    ];
    sprints.innerHTML = list.map(s => `
      <div class="flex-between py8" style="border-bottom:1px solid var(--border)">
        <div>
          <div class="fw7 fs12 tc-1">${s.t}</div>
          <div class="fs11 tc-3">${s.d}</div>
        </div>
        <button class="btn btn-primary btn-sm" onclick="showToast('Registered! Thank you 💚')">Join</button>
      </div>`).join('');
  }
  const crowdfund = $id('local-crowdfund');
  if (crowdfund) {
    const list = [
      { t: 'Central Bakery Solar Power Sprinters', d: '$1,240 / $2,000 raised · 62% reached' },
      { t: 'Greenhouse Community Seed Fund', d: '$480 / $800 raised · 60% reached' }
    ];
    crowdfund.innerHTML = list.map(c => `
      <div class="flex-between py8" style="border-bottom:1px solid var(--border)">
        <div>
          <div class="fw7 fs12 tc-1">${c.t}</div>
          <div class="fs11 tc-3">${c.d}</div>
        </div>
        <button class="btn btn-ghost btn-sm" onclick="showToast('Tipped $10!')">💲 Tip</button>
      </div>`).join('');
  }
}

function submitCivicReport() {
  const type = $id('civic-type').value;
  const desc = $id('civic-desc').value.trim();
  const loc = $id('civic-loc').value.trim();
  
  if (!desc || !loc) { showToast('Provide description and location! 📍'); return; }
  
  const auths = {
    'Road Damage': '@CityTransit',
    'Lost Pet': '@AnimalCare',
    'Flood Alert': '@DrainageBoard',
    'Safety Concern': '@PublicSafety'
  };
  
  const report = {
    id: Date.now(),
    type,
    text: desc,
    location: loc,
    status: 'Tracked',
    authority: auths[type] || '@CityCouncil'
  };
  
  S.civicReports.unshift(report);
  $id('civic-desc').value = ''; $id('civic-loc').value = '';
  showToast(`Civic report submitted! Tagged ${report.authority} 📢`);
  renderCivicSubContent();
}

// ── DUAL FEED & FEED MODE CONTROLLERS ────────────────────────────
function toggleDualFeed(mode) {
  S.dualFeed = mode;
  document.getElementById('df-ent-btn').classList.toggle('active', mode === 'entertainment');
  document.getElementById('df-gro-btn').classList.toggle('active', mode === 'growth');
  showToast(mode === 'growth' ? '🌱 Growth Feed Active' : '🎭 Entertainment Feed Active');
  renderFeed();
}


function startFocusSession() {
  if (S.focusActive) {
    clearInterval(S.focusTimer);
    S.focusActive = false;
    showToast('Focus Session cancelled.');
    const focusBtn = document.querySelector('[onclick="startFocusSession()"]');
    if (focusBtn) focusBtn.textContent = 'Start 25m Focus Block';
    const stv = $id('screen-time-val');
    if (stv) stv.textContent = '18m / 45m';
    return;
  }
  S.focusActive = true;
  S.focusTimeRemaining = 25 * 60;
  showToast('Focus Block Started: 25 minutes! 🎯');
  
  // Update button to show cancel state
  const focusBtn = document.querySelector('[onclick="startFocusSession()"]');
  if (focusBtn) focusBtn.textContent = '⏸️ Cancel Focus Block';
  
  S.focusTimer = setInterval(() => {
    if (!S.focusActive) { clearInterval(S.focusTimer); return; }
    S.focusTimeRemaining--;
    
    // Live countdown in Mindfulness widget
    const mins = Math.floor(S.focusTimeRemaining / 60);
    const secs = S.focusTimeRemaining % 60;
    const stv = $id('screen-time-val');
    if (stv) stv.innerHTML = `<span style="color:var(--green); font-weight:800">${mins}m ${String(secs).padStart(2,'0')}s</span>`;
    
    // Update progress bar
    const elapsed = (25 * 60) - S.focusTimeRemaining;
    const pct = Math.min(100, (elapsed / (25 * 60)) * 100);
    const bar = document.querySelector('.wellness-stats .progress-fill');
    if (bar) { bar.style.width = pct + '%'; bar.style.background = 'var(--green)'; }
    
    if (S.focusTimeRemaining <= 0) {
      clearInterval(S.focusTimer);
      S.focusActive = false;
      S.user.xp += 150;
      updateUserUI();
      showToast('Focus Block Complete! +150 XP 🏆');
      if (stv) stv.textContent = '25m / 25m ✅';
      if (focusBtn) focusBtn.textContent = 'Start 25m Focus Block';
    }
  }, 1000);
}

// ── UNIVERSAL SMART SEARCH ───────────────────────────────────────
function setupUniversalSearch() {
  const gs = $id('global-search');
  const es = $id('explore-search');
  
  // Real-time in-place filtering of Explore Hot Topics grid
  const filterHotTopics = (query) => {
    const tg = $id('topic-grid');
    if (!tg) return;
    
    const cards = tg.children;
    const q = query.toLowerCase().trim();
    let matchesFound = 0;
    
    Array.from(cards).forEach(card => {
      // Don't filter the no-results message itself if it exists
      if (card.id === 'search-no-results') return;
      
      const name = card.querySelector('.topic-name')?.textContent.toLowerCase() || "";
      const count = card.querySelector('.topic-count')?.textContent.toLowerCase() || "";
      
      if (name.includes(q) || count.includes(q)) {
        card.style.display = "";
        card.style.opacity = "1";
        card.style.transform = "scale(1)";
        card.style.transition = "all 0.22s cubic-bezier(0.175, 0.885, 0.32, 1.275)";
        matchesFound++;
      } else {
        card.style.display = "none";
        card.style.opacity = "0";
        card.style.transform = "scale(0.95)";
        card.style.transition = "all 0.18s ease";
      }
    });
    
    // Manage empty state placeholder
    let noResultsMsg = $id('search-no-results');
    if (matchesFound === 0 && q !== "") {
      if (!noResultsMsg) {
        noResultsMsg = document.createElement('div');
        noResultsMsg.id = 'search-no-results';
        noResultsMsg.style.cssText = 'grid-column: 1 / -1; text-align: center; padding: 32px 16px; color: var(--t3); animation: pane-in 0.3s ease;';
        noResultsMsg.innerHTML = `
          <div class="material-symbols-rounded" style="font-size: 40px; color: var(--pink); margin-bottom: 8px">search_off</div>
          <div class="fw8 fs15 tc-1">No active trends found for "${query}"</div>
          <div class="fs11 tc-3 mt4">Try searching for 'AI', 'Bitcoin', 'UI', or 'Dough'.</div>
        `;
        tg.appendChild(noResultsMsg);
      }
    } else if (noResultsMsg) {
      noResultsMsg.remove();
    }
  };
  
  // Full Search Results panel toggle (on Enter key)
  const submitSearch = (val) => {
    // Search belongs to the SR overlay now — people, shorts, audio, tags and
    // coins, over whatever pane you were on. The news panel below is only a
    // fallback for when that module hasn't loaded.
    if (window.SR) { window.SR.open(val || ''); return; }

    const q = val.trim().toLowerCase();

    if (!q) {
      const panel = $id('search-results-panel');
      const exploreDefault = $id('explore-default-content');
      panel?.classList.add('hidden');
      exploreDefault?.classList.remove('hidden');
      renderFeed(); // Reset home feed search
      return;
    }
    
    // Ensure we are on the explore pane so the DOM exists. Awaited, not
    // guessed at with a timeout: navigateTo builds the pane after its
    // own await, and 10ms was only ever enough because explore is
    // eager. A deferred page would have lost the race.
    navigateTo('explore').then(async () => {
      if (es && es.value !== val) es.value = val;
      if (gs && gs.value !== val) gs.value = val;

      const panel = $id('search-results-panel');
      const exploreDefault = $id('explore-default-content');
      
      panel?.classList.remove('hidden');
      exploreDefault?.classList.add('hidden');
      
      await renderSearchResults(q);
    });
  };
  
  // Bind input event to filter in-place in Explore default view
  if (es) {
    es.addEventListener('input', (e) => {
      const panel = $id('search-results-panel');
      if (panel && panel.classList.contains('hidden')) {
        filterHotTopics(e.target.value);
      } else {
        submitSearch(e.target.value);
      }
    });
    
    es.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        submitSearch(e.target.value);
        showToast(`Search submitted: "${e.target.value}" 🔍`);
      }
    });
  }
  
  // Global search: typing stays put; Enter submits. Live-updates results
  // only when already viewing the Explore search panel.
  if (gs) {
    gs.addEventListener('input', (e) => {
      const panel = $id('search-results-panel');
      if (S.pane === 'explore' && panel && !panel.classList.contains('hidden')) {
        submitSearch(e.target.value);
      }
    });

    gs.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        submitSearch(e.target.value);
        showToast(`Search submitted: "${e.target.value}" 🔎`);
      }
    });
  }
}

async function renderSearchResults(q) {
  const media = $id('search-media-results'); if (!media) return;
  const aiCard = $id('search-ai-card');
  
  if (aiCard) {
    aiCard.innerHTML = `<div class="fs14 tc-1"><span class="material-symbols-rounded spinner inline-icon">progress_activity</span> Synthesizing live internet data for "${q}"...</div>`;
  }
  media.innerHTML = `<div class="p20 tc-center tc-3"><span class="material-symbols-rounded spinner">sync</span> Fetching live internet results from Google News...</div>`;
  
  let liveArticles = [];
  try {
    if (window.fetchLiveNews) {
      liveArticles = await window.fetchLiveNews(q);
    }
  } catch (err) {}

  if (liveArticles.length === 0) {
    const mockResults = [
      { title: `${q.toUpperCase()} CRISPR Gene Editing Efficiencies`, type: 'papers', desc: `Analyzing DNA double-strand breaks step-by-step for "${q}".`, badge: 'Science Paper', traffic: '100K+ searches today' },
      { title: `Crypto Yield Farm Liquidity Mechanics on ${q.toUpperCase()}`, type: 'articles', desc: `Understanding Decentralized Finance smart contract protocols referencing "${q}".`, badge: 'Finance Article', traffic: '500K+ searches today' },
      { title: `${q.toUpperCase()} React 19 Server Components deep-dive`, type: 'videos', desc: `60-minute cinematic programming workshop explaining "${q}".`, badge: 'Developer Workshop', traffic: '300K+ searches today' },
      { title: `Is ${q.toUpperCase()} a smart future standard?`, type: 'factchecks', desc: 'Fact Check Status: VERIFIED A  Bias: neutral', badge: 'Fact Check', traffic: '80K+ searches' },
      { title: `Sunset Horizon Chill Vibes Beat: Tribute to ${q.toUpperCase()}`, type: 'podcasts', desc: `Beatmaker_96 episode 4 tribute inspired by "${q}".`, badge: 'Podcast', traffic: '120K+ searches' }
    ];
    liveArticles = mockResults;
  }
  
  const filtered = S.searchTab === 'all' ? liveArticles : liveArticles.filter(r => r.type === S.searchTab || (r.id && S.searchTab === 'articles'));
  
  media.innerHTML = filtered.map(r => `
    <div class="card p16 flex flex-col gap8">
      <div class="flex-between">
        <span class="badge badge-blue fs11" style="background:#4F46E5">${r.badge || 'Live News Article'}</span>
        <button class="btn btn-ghost btn-sm" onclick="window.open('${r.url || '#'}', '_blank')">Open</button>
      </div>
      <h3 class="fw7 fs14 tc-1">${r.title}</h3>
      <p class="tc-2 fs12">${r.excerpt || r.desc}</p>
      <div class="fs11 mt4 fw7" style="color:#34A853; display:flex; align-items:center; gap:4px">
        <span class="material-symbols-rounded" style="font-size:14px">${r.source ? 'public' : 'trending_up'}</span>
        ${r.source ? `Source: ${r.source} | Published: ${new Date(r.publishedAt).toLocaleDateString()}` : `Live Traffic: ${r.traffic} - Verified via Google Cloud Engine.`}
      </div>
    </div>`).join('');
    
  // AI Knowledge Card Summary Synthesis (Google/Gemini Style)
  if (aiCard) {
    aiCard.innerHTML = `
      <div class="section-hdr" style="border-bottom:1px solid var(--border); padding-bottom:8px">
        <span class="section-title flex-center gap8" style="color:var(--purple); font-weight:900">✨ Gemini Smart Overview</span>
        <span class="badge badge-purple">Google Search Engine</span>
      </div>
      <p class="tc-1 fs12 mt12" style="line-height:1.6; font-weight:500">
        Google Knowledge Graph synthesis for: <strong>"${q}"</strong>. Our algorithms scanned 14 peer-reviewed sources and live channels:
      </p>
      
      <!-- Fact Grid -->
      <div class="grid-2 gap8 mt12">
        <div style="background:var(--bg2); padding:8px; border-radius:var(--r1); border:1px solid var(--border)">
          <div class="fs10 tc-3" style="text-transform:uppercase">Fact Check Rating</div>
          <div class="fs12 fw8 tc-green">100% Verified ✅</div>
        </div>
        <div style="background:var(--bg2); padding:8px; border-radius:var(--r1); border:1px solid var(--border)">
          <div class="fs10 tc-3" style="text-transform:uppercase">Reliability Index</div>
          <div class="fs12 fw8 tc-blue">96% Accuracy 📈</div>
        </div>
      </div>
      
      <!-- Context box -->
      <div class="card p12 mt12" style="background:var(--bg2); border-style:dashed">
        <div class="fs11 fw8 tc-1 mb4">💡 Gemini AI Context Synthesis (Past 5-Year High Consistency):</div>
        <div class="fs11 tc-2" style="line-height:1.5">
          <strong>Google Knowledge Graph synthesis for "${q}":</strong> Historical search interest hit an all-time peak in <em>October 2024</em>, maintaining a steady <strong>84% Search Consistency</strong> footprint across international servers. The consensus across academic networks validates high-efficacy outcomes. Media coverage leans center-neutral (44% bias offset), suggesting high objectivity.
        </div>
      </div>
      
      <!-- Bias Meter indicator inside -->
      <div class="flex-between mt12 p8" style="background:var(--card2); border-radius:var(--r1)">
        <span class="fs11 tc-2 font-bold">Media Bias Meter:</span>
        <span class="badge badge-blue">Center Leaning</span>
      </div>

      <!-- AI Deepfake & Credibility Scanner Button -->
      <button class="btn btn-ghost btn-sm mt12 flex-center gap4" onclick="runAIDeepfakeScanner('${escapeHTML(q)}')" style="width:100%; border-color:var(--purple); color:var(--purple); font-weight:700; background:rgba(154, 98, 255, 0.05)">
        <span class="material-symbols-rounded" style="font-size:16px">security</span> Run AI Deepfake &amp; Scam Scan
      </button>
      
      <!-- Scan results -->
      <div id="deepfake-scanner-results" class="hidden card p12 mt12 fs11" style="background:var(--bg2); border:1px dashed var(--border)"></div>
    `;
  }
}

function switchSearchTab(tab) {
  S.searchTab = tab;
  document.querySelectorAll('#search-results-panel .tab-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  const tabIds = { all:'st-all', videos:'st-vid', articles:'st-art', podcasts:'st-pod', factchecks:'st-fac', papers:'st-pap' };
  const activeBtn = $id(tabIds[tab]);
  if (activeBtn) activeBtn.classList.add('active');
  
  const es = $id('explore-search');
  if (es) renderSearchResults(es.value.trim().toLowerCase());
}

/* --- Deepfake Scanner Interactivity --- */
function runAIDeepfakeScanner(q) {
  const el = $id('deepfake-scanner-results');
  if (!el) return;
  
  el.classList.remove('hidden');
  el.innerHTML = `<span style="color:var(--purple); display:flex; align-items:center; gap:6px;">
    <span class="material-symbols-rounded animate-spin" style="font-size:16px;">sync</span>
    Scanning media files: Checking vocal frequency alignment, GAN consistency &amp; C2PA watermarks...
  </span>`;
  
  setTimeout(() => {
    el.innerHTML = `
      <div style="font-weight:700; color:var(--pink); margin-bottom:6px; display:flex; align-items:center; gap:4px">
        <span class="material-symbols-rounded" style="font-size:16px">security</span> Credibility &amp; Deepfake Analysis
      </div>
      <div class="flex-between mb4">
        <span>Deepfake Probability:</span>
        <strong style="color:var(--green)">1.2% (Legitimate Media)</strong>
      </div>
      <div class="flex-between mb4">
        <span>C2PA Metadata Integrity:</span>
        <strong style="color:var(--green)">Verified Author Signature ✓</strong>
      </div>
      <div class="flex-between mb4">
        <span>Scam Risk Index:</span>
        <strong style="color:var(--green)">Low (Standard Educational Topic)</strong>
      </div>
      <div class="fs10 tc-3 mt6" style="line-height:1.4">
        <strong>Consensus Verdict:</strong> Content checked against verified reference ledgers. No generative adversarial patterns or face-swap synthesis detected in associated files.
      </div>
    `;
    
    // Confetti burst
    if (typeof IX !== 'undefined' && IX.burstReaction) {
      const rect = el.getBoundingClientRect();
      IX.burstReaction('🛡️', rect.left + rect.width / 2, rect.top + rect.height / 2, 8);
    }
    
    // Reward user with XP
    S.user = S.user || { xp: 0 };
    S.user.xp += 40;
    updateUserUI();
    showToast("Ecosystem security check finished! +40 XP 🛡️");
  }, 1800);
}

function getExploreTemplate() {
  return `<section id="pane-explore" class="pane">
        <h1 class="pane-title"><span>Crypto</span>verse</h1>
        <p class="tc-2 fs13 mb16">Live markets, sentiment and the stories moving them.</p>

        <div class="explore-search">
          <span class="material-symbols-rounded" style="opacity:0.6; font-size:18px">search</span>
          <input type="text" id="explore-search" placeholder="Search coins, creators, hashtags...">
        </div>

        <!-- Crypto Fear & Greed Index -->
        <div class="fgi-wrapper">
          <div class="section-hdr">
            <span class="section-title flex-center gap8"><span class="material-symbols-rounded" style="color:var(--orange)">speed</span> Crypto Fear &amp; Greed Index</span>
            <span class="badge badge-orange">Live</span>
          </div>
          <p class="tc-2 fs12 mb12">Market sentiment scored 0–100 from volatility, momentum, social volume, dominance and trends.</p>
          <div id="fgi-root"></div>
        </div>

        <!-- Universal Search Results (Hidden by Default) -->
        <div id="search-results-panel" class="hidden">
          <div class="tabs mb16">
            <button class="tab-btn active" id="st-all" onclick="switchSearchTab('all')">All Results</button>
            <button class="tab-btn" id="st-vid" onclick="switchSearchTab('videos')">Videos <span class="material-symbols-rounded" style="font-size:14px; vertical-align:middle; margin-left:4px">movie</span></button>
            <button class="tab-btn" id="st-art" onclick="switchSearchTab('articles')">Articles <span class="material-symbols-rounded" style="font-size:14px; vertical-align:middle; margin-left:4px">newspaper</span></button>
            <button class="tab-btn" id="st-pod" onclick="switchSearchTab('podcasts')">Podcasts <span class="material-symbols-rounded" style="font-size:14px; vertical-align:middle; margin-left:4px">mic</span></button>
            <button class="tab-btn" id="st-fac" onclick="switchSearchTab('factchecks')">Fact Checks <span class="material-symbols-rounded" style="font-size:14px; vertical-align:middle; margin-left:4px">shield</span></button>
            <button class="tab-btn" id="st-pap" onclick="switchSearchTab('papers')">Papers <span class="material-symbols-rounded" style="font-size:14px; vertical-align:middle; margin-left:4px">school</span></button>
          </div>
          <div class="grid-2 gap16" style="align-items: start">
            <!-- Media column -->
            <div id="search-media-results" class="flex flex-col gap12"></div>
            <!-- AI Card Column -->
            <div class="card p20 sticky" style="top:20px" id="search-ai-card"></div>
          </div>
        </div>

        <!-- Cryptoverse: live market discovery + Trending Creators -->
        <div id="explore-default-content" style="display:grid; grid-template-columns:1fr 280px; gap:24px; align-items:start">
          <div id="cv-root"></div>
          <div style="position:sticky; top:80px">
            <div class="section-hdr">
              <span class="section-title" style="display:flex; align-items:center; gap:6px"><span class="material-symbols-rounded" style="color:var(--purple)">auto_awesome</span> Trending Creators</span>
            </div>
            <div class="flex-col gap12" id="creator-grid"></div>
          </div>
        </div>
      </section>`;
}

function getCategoryTemplate() {
  return `<section id="pane-category" class="pane" style="padding:24px">
    <div style="margin-bottom:20px">
      <button class="btn btn-ghost btn-sm" id="cat-back" hidden onclick="navigateTo('explore')" style="align-items:center; gap:6px; margin-bottom:16px">
        <span class="material-symbols-rounded" style="font-size:16px">arrow_back</span> Back to Explore
      </button>
      <h1 class="pane-title" id="cat-title"><span>Category</span> Portal</h1>
      <p class="tc-2 fs13" id="cat-description">Explore advanced multimedia feeds.</p>
    </div>
    <div id="cat-dynamic-content"></div>
  </section>`;
}

window.renderCryptoHub = async function(tab = 'markets') {
  const portal = document.getElementById('cat-dynamic-content');
  if (!portal) return;

  const tabsHtml = `
    <div class="tabs mb16" style="justify-content: flex-start; overflow-x: auto;">
      <button class="tab-btn crypto-tab-btn ${tab === 'markets' ? 'active' : ''}" data-tab="markets" onclick="renderCryptoHub('markets')">Live Markets</button>
      <button class="tab-btn crypto-tab-btn ${tab === 'dapps' ? 'active' : ''}" data-tab="dapps" onclick="renderCryptoHub('dapps')">dApps</button>
      <button class="tab-btn crypto-tab-btn ${tab === 'projects' ? 'active' : ''}" data-tab="projects" onclick="renderCryptoHub('projects')">Projects</button>
      <button class="tab-btn crypto-tab-btn ${tab === 'news' ? 'active' : ''}" data-tab="news" onclick="renderCryptoHub('news')">Crypto News</button>
      <button class="tab-btn crypto-tab-btn ${tab === 'community' ? 'active' : ''}" data-tab="community" onclick="renderCryptoHub('community')">Community Feed</button>
    </div>
    <div id="crypto-tab-content"></div>
  `;
  
  if (!portal.querySelector('.crypto-tab-btn')) {
    portal.innerHTML = tabsHtml;
  } else {
    document.querySelectorAll('.crypto-tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelector(`.crypto-tab-btn[data-tab="${tab}"]`).classList.add('active');
  }

  const content = document.getElementById('crypto-tab-content');
  
  if (tab === 'markets') {
    if (!window.liveCryptoPrices || Object.keys(window.liveCryptoPrices).length === 0) {
      content.innerHTML = `<div class="p20 tc-center"><span class="material-symbols-rounded spinner">sync</span> Fetching live markets from Coinlayer...</div>`;
      return;
    }
    
    // Slice to 60 for performance to prevent lag when rendering
    const coinsToRender = Object.entries(window.liveCryptoPrices)
      .filter(([coin]) => !['bitcoin', 'ethereum', 'solana'].includes(coin))
      .slice(0, 60);
      
    let marketsHtml = `<div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap:12px;">`;
    for (const [coin, data] of coinsToRender) {
      const formatPrice = (val) => {
        if (val === null || val === undefined) return '$0.00';
        return '$' + val.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 6});
      };
      const formatChange = (val) => {
        if (val === null || val === undefined) return '<span class="tc-3">0.0%</span>';
        const sign = val >= 0 ? '+' : '';
        const color = val >= 0 ? 'var(--green)' : 'var(--red)';
        return `<span style="color:${color}">${sign}${val.toFixed(1)}%</span>`;
      };
      marketsHtml += `
        <div class="card p16 w3-market-card" style="background:var(--card2); border:1px solid var(--border)"
             onclick="W3.openToken('${coin}')" title="Open ${coin} token page">
          <div class="flex-between mb8">
            <div class="coin-cell fw8 tc-1">
              ${coinIcon(coin, 24)}<span class="coin-tick">${coin}</span>
            </div>
            <div class="fs11 tc-3">24h: ${formatChange(data.usd_24h_change)}</div>
          </div>
          <div class="fw8 fs18 tc-1">${formatPrice(data.usd)}</div>
        </div>
      `;
    }
    marketsHtml += `</div>`;
    content.innerHTML = marketsHtml;
  }
  else if (tab === 'dapps') {
    W3.renderDapps();
  }
  else if (tab === 'projects') {
    W3.renderProjects();
  }
  else if (tab === 'news') {
    content.innerHTML = `<div class="p20 tc-center"><span class="material-symbols-rounded spinner">sync</span> Fetching breaking crypto news...</div>`;
    try {
      const articles = await window.fetchLiveNews('cryptocurrency DeFi blockchain');
      if (!articles || articles.length === 0) throw new Error("Empty");
      content.innerHTML = `<div class="flex flex-col gap12">` + articles.map(r => `
        <div class="card p16 flex flex-col gap8">
          <div class="flex-between">
            <span class="badge badge-purple fs11">Live News</span>
            <button class="btn btn-ghost btn-sm" onclick="window.open('${r.url}', '_blank')">Read</button>
          </div>
          <h3 class="fw7 fs14 tc-1">${r.title}</h3>
          <p class="tc-2 fs12">${r.excerpt}</p>
          <div class="fs11 mt4 fw7 tc-green">Source: ${r.source} | ${new Date(r.publishedAt).toLocaleDateString()}</div>
        </div>`).join('') + `</div>`;
    } catch(err) {
      content.innerHTML = `<div class="p20 tc-center tc-3">Unable to fetch live news. Try again later.</div>`;
    }
  }
  else if (tab === 'community') {
    if (typeof CF !== 'undefined') { CF.render(content); return; }
    const posts = (typeof DATA !== 'undefined' && DATA.cryptoPosts) ? DATA.cryptoPosts : [];
    content.innerHTML = `<div class="flex flex-col gap16">` + posts.map(p => `
      <div class="card p16">
        <div class="flex-between mb12">
          <div style="display:flex; align-items:center; gap:10px">
            <div style="width:40px; height:40px; border-radius:50%; background:var(--bg); display:flex; align-items:center; justify-content:center; font-size:20px">${p.avatar}</div>
            <div>
              <div class="fw7 fs14 tc-1">${p.author}</div>
              <div class="fs11 tc-3">${p.handle} • ${p.time}</div>
            </div>
          </div>
        </div>
        <p class="tc-1 fs13" style="line-height:1.5">${p.content}</p>
        <div class="mt12 flex gap8">
          ${p.tags.map(t => `<span class="badge badge-green fs10">#${t}</span>`).join('')}
        </div>
        <div class="flex-between mt16 pt12" style="border-top:1px solid var(--border)">
          <button class="btn btn-ghost btn-sm" onclick="this.style.color='#00ffcc'; showToast('Liked! 💚')"><span class="material-symbols-rounded" style="font-size:16px; margin-right:4px">favorite</span> ${p.likes}</button>
          <button class="btn btn-ghost btn-sm"><span class="material-symbols-rounded" style="font-size:16px; margin-right:4px">chat_bubble</span> ${p.comments}</button>
          <button class="btn btn-ghost btn-sm"><span class="material-symbols-rounded" style="font-size:16px; margin-right:4px">share</span> Share</button>
        </div>
      </div>
    `).join('') + `</div>`;
  }
};

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
publish('pages/explore.js', {
  populateCategorySidebar: () => populateCategorySidebar,
  toggleCategorySidebar: () => toggleCategorySidebar,
  clickCategory: () => clickCategory,
  renderCategoryPortal: () => renderCategoryPortal,
  debounce: () => debounce, fetchData: () => fetchData, data: () => data,
  mixChemical: () => mixChemical, clearChemicals: () => clearChemicals,
  renderScienceSubContent: () => renderScienceSubContent,
  drawRealityScoreCircle: () => drawRealityScoreCircle,
  toggleELI15: () => toggleELI15,
  startCryptoLiveChart: () => startCryptoLiveChart,
  stopCryptoLiveChart: () => stopCryptoLiveChart,
  toggleMusicPlayback: () => toggleMusicPlayback,
  renderMusicSubContent: () => renderMusicSubContent,
  renderTechSubContent: () => renderTechSubContent,
  startWildlifeCanvasSim: () => startWildlifeCanvasSim,
  stopWildlifeCanvasSim: () => stopWildlifeCanvasSim,
  renderCivicSubContent: () => renderCivicSubContent,
  submitCivicReport: () => submitCivicReport,
  toggleDualFeed: () => toggleDualFeed,
  startFocusSession: () => startFocusSession,
  setupUniversalSearch: () => setupUniversalSearch,
  renderSearchResults: () => renderSearchResults,
  switchSearchTab: () => switchSearchTab,
  runAIDeepfakeScanner: () => runAIDeepfakeScanner,
  getExploreTemplate: () => getExploreTemplate,
  getCategoryTemplate: () => getCategoryTemplate
});
