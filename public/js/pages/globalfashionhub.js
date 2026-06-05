// ═══════════════════════════════════════════════════════════════════════
// GLOBAL FASHION HUB — Digital Fashion Magazine Experience
// ═══════════════════════════════════════════════════════════════════════

/* ── Magazine Data ───────────────────────────────────────────────────── */
const MAGAZINE = {
  issue: 'ISSUE 47 · SUMMER 2026',
  coverTitle: 'THE FUTURE IS WEARABLE',
  coverSubtitle: 'Where Code Meets Couture',

  sections: [
    { id: 'cover', label: 'Cover' },
    { id: 'editorials', label: 'Editorials' },
    { id: 'runway', label: 'Runway' },
    { id: 'trends', label: 'Trends' },
    { id: 'culture', label: 'Culture' },
    { id: 'ailab', label: 'AI Lab' }
  ],

  editorials: [
    {
      id: 'ed1', category: 'COVER STORY',
      title: 'Holographic Horizons',
      subtitle: 'The New Wave of Digital Haute Couture',
      author: 'Luna Park', authorHandle: '@lunap', readTime: '8 min read',
      image: 'fashion-cover.png',
      excerpt: 'From the runways of Milan to the metaverse, holographic fabrics are redefining luxury. We spoke with the designers who are weaving light itself into garments that exist both physically and digitally.',
      body: `The intersection of technology and fashion has always produced its most exciting innovations at the margins. But in 2026, those margins have moved to center stage.\n\nDesigners like Iris van Herpen, RTFKT, and a new generation of digital-first creators are crafting garments that shimmer with iridescent holographic materials — fabrics that shift color with every movement, every angle, every lighting condition.\n\n"We're not just designing clothes anymore," says Mira Nakamura, founder of Phantom Atelier. "We're designing experiences. A dress that changes color based on the wearer's mood isn't science fiction — it's our Fall collection."\n\nThe technology behind these creations combines thermochromic inks, embedded micro-LEDs, and responsive fiber optics woven directly into the textile at a molecular level.`,
      tags: ['Digital Couture', 'Holographics', 'Innovation'],
      likes: 4820, comments: 312
    },
    {
      id: 'ed2', category: 'STREET STYLE',
      title: 'Neo-Tokyo After Dark',
      subtitle: 'Cyberpunk Streetwear Conquers the Global Scene',
      author: 'Tyler Ross', authorHandle: '@tylerr', readTime: '6 min read',
      image: 'fashion-edit1.png',
      excerpt: 'The underground fashion movement blending Japanese street culture with cyberpunk aesthetics has exploded onto the mainstream. Oversized silhouettes, neon accents, and utility-first design are now the lingua franca of global streetwear.',
      body: `Walk through Harajuku at 2 AM and you'll see it — the future of fashion isn't being decided in Parisian ateliers or New York showrooms. It's being born on the streets of Tokyo, Seoul, and Lagos.\n\nThe neo-cyberpunk movement prioritizes function and self-expression in equal measure. Think oversized techwear jackets with integrated LED strips, cargo pants with modular attachment systems, and sneakers that generate electricity from kinetic energy.`,
      tags: ['Streetwear', 'Cyberpunk', 'Tokyo'],
      likes: 3240, comments: 198
    },
    {
      id: 'ed3', category: 'LUXURY',
      title: 'The Emerald Renaissance',
      subtitle: 'Why Green Is the New Black in Luxury Fashion',
      author: 'Sarah Chen', authorHandle: '@sarahc', readTime: '5 min read',
      image: 'fashion-edit2.png',
      excerpt: 'From the runways of Gucci to the boutiques of Brunello Cucinelli, rich emerald green has emerged as the definitive color of the season. But this isn\'t just a trend — it\'s a statement about sustainable luxury.',
      body: `Every few years, a color transcends its status as a mere trend and becomes a cultural statement. In 2026, that color is emerald green.\n\nThe shade carries layers of meaning: environmental consciousness, wealth, renewal, and a bold departure from the muted earth tones that have dominated luxury fashion since 2023. Major houses have embraced it with abandon.`,
      tags: ['Luxury', 'Color Trends', 'Sustainability'],
      likes: 2890, comments: 156
    },
    {
      id: 'ed4', category: 'ACCESSORIES',
      title: 'The Art of Adornment',
      subtitle: 'Curating the Perfect Accessories Edit',
      author: 'Zara Ahmed', authorHandle: '@zaraa', readTime: '4 min read',
      image: 'fashion-edit3.png',
      excerpt: 'In a world of digital minimalism, physical accessories have become the ultimate luxury statement. We explore the return of the curated accessory — from heritage timepieces to bespoke leather goods.',
      body: `There's a fascinating paradox emerging in fashion: as our digital lives become more streamlined and minimal, our physical adornments are becoming more intentional, more considered, more personal.\n\nThe era of logo-splashed excess is fading. In its place, a new philosophy of curation has emerged — fewer pieces, higher quality, deeper personal significance.`,
      tags: ['Accessories', 'Luxury Goods', 'Curation'],
      likes: 1950, comments: 87
    }
  ],

  runwayShows: [
    { designer: 'Phantom Atelier', season: 'FW26', city: 'Milan', status: 'LIVE', viewers: '14.2K', gradient: 'linear-gradient(135deg, #ff0055, #20002c)' },
    { designer: 'RTFKT Studios', season: 'SS27', city: 'Virtual', status: 'UPCOMING', time: 'Tomorrow, 8PM', gradient: 'linear-gradient(135deg, #00c9ff, #0044ff)' },
    { designer: 'Balenciaga Digital', season: 'FW26', city: 'Paris', status: 'UPCOMING', time: 'Friday, 10PM', gradient: 'linear-gradient(135deg, #fce38a, #f38181)' },
    { designer: 'Iris van Herpen', season: 'HC26', city: 'Amsterdam', status: 'REPLAY', time: '2 days ago', gradient: 'linear-gradient(135deg, #a18cd1, #fbc2eb)' }
  ],

  trendingNow: [
    { tag: '#DigitalCouture', posts: '142K', change: '+28%' },
    { tag: '#HolographicFashion', posts: '98K', change: '+45%' },
    { tag: '#NeoStreet', posts: '76K', change: '+12%' },
    { tag: '#SustainableLuxury', posts: '65K', change: '+31%' },
    { tag: '#AIFashion', posts: '54K', change: '+67%' },
    { tag: '#MetaverseRunway', posts: '43K', change: '+19%' }
  ],

  designers: [
    { name: 'Mira Nakamura', handle: '@mirandesign', followers: '2.4M', specialty: 'Digital Couture', verified: true },
    { name: 'Kai Westwood', handle: '@kaiwest', followers: '1.8M', specialty: 'Sustainable Luxury', verified: true },
    { name: 'Zoe Laurent', handle: '@zoelaurent', followers: '3.1M', specialty: 'Avant-Garde', verified: true },
    { name: 'Ryu Tanaka', handle: '@ryutanaka', followers: '1.2M', specialty: 'Cyberpunk Street', verified: false }
  ]
};

let fhActiveSection = 'cover';
let fhActiveEditorial = null;

/* ── Template ────────────────────────────────────────────────────────── */
function getFashionhubTemplate() {
  return `<section id="pane-fashionhub" class="pane" style="padding:0; overflow:hidden;">
  <div class="fh-magazine">

    <!-- Magazine Nav Bar -->
    <header class="fh-mag-header">
      <div class="fh-mag-brand">
        <span class="material-symbols-rounded fh-mag-icon">checkroom</span>
        <div class="fh-mag-title-group">
          <span class="fh-mag-title">GLOBAL<span class="fh-accent">FASHION</span>HUB</span>
          <span class="fh-mag-issue">${MAGAZINE.issue}</span>
        </div>
      </div>
      <nav class="fh-mag-nav" id="fh-mag-nav">
        ${MAGAZINE.sections.map(s => `<button class="fh-nav-btn${s.id === 'cover' ? ' active' : ''}" data-sec="${s.id}" onclick="fhSwitchSection('${s.id}')">${s.label}</button>`).join('')}
      </nav>
      <div class="fh-mag-actions">
        <button class="fh-subscribe-btn" onclick="showToast('Subscribed to GlobalFashionHub!')">Subscribe</button>
      </div>
    </header>

    <!-- Scrollable Content Area -->
    <div class="fh-mag-content" id="fh-mag-content"></div>

  </div>
  </section>`;
}

/* ── Section Switcher ────────────────────────────────────────────────── */
function fhSwitchSection(id) {
  fhActiveSection = id;
  fhActiveEditorial = null;
  document.querySelectorAll('.fh-nav-btn').forEach(b => b.classList.toggle('active', b.dataset.sec === id));
  renderFashionHub();
}

/* ── Main Render ─────────────────────────────────────────────────────── */
function renderFashionHub() {
  const el = document.getElementById('fh-mag-content');
  if (!el) return;

  if (fhActiveEditorial) {
    el.innerHTML = renderFHArticle(fhActiveEditorial);
    el.scrollTop = 0;
    return;
  }

  const renderers = {
    cover: renderFHCover,
    editorials: renderFHEditorials,
    runway: renderFHRunway,
    trends: renderFHTrends,
    culture: renderFHCulture,
    ailab: renderFHAILab
  };

  el.innerHTML = (renderers[fhActiveSection] || renderFHCover)();
  el.scrollTop = 0;
}

/* ── Cover Page ──────────────────────────────────────────────────────── */
function renderFHCover() {
  const cover = MAGAZINE.editorials[0];
  return `
    <div class="fh-cover-page">
      <!-- Hero Cover -->
      <div class="fh-cover-hero" onclick="fhOpenArticle('${cover.id}')">
        <img src="${cover.image}" class="fh-cover-img" alt="${cover.title}">
        <div class="fh-cover-overlay">
          <span class="fh-cover-badge">${cover.category}</span>
          <h1 class="fh-cover-headline">${MAGAZINE.coverTitle}</h1>
          <p class="fh-cover-sub">${MAGAZINE.coverSubtitle}</p>
          <div class="fh-cover-cta">
            <span class="material-symbols-rounded">arrow_forward</span> Read the Cover Story
          </div>
        </div>
      </div>

      <!-- Featured Editorials Grid -->
      <div class="fh-section-header">
        <span class="fh-section-tag">FEATURED</span>
        <h2 class="fh-section-title">This Issue's Editorials</h2>
      </div>
      <div class="fh-editorial-grid">
        ${MAGAZINE.editorials.slice(1).map(ed => `
          <div class="fh-editorial-card" onclick="fhOpenArticle('${ed.id}')">
            <div class="fh-ed-image-wrap">
              <img src="${ed.image}" class="fh-ed-image" alt="${ed.title}">
              <span class="fh-ed-category">${ed.category}</span>
            </div>
            <div class="fh-ed-body">
              <h3 class="fh-ed-title">${ed.title}</h3>
              <p class="fh-ed-subtitle">${ed.subtitle}</p>
              <div class="fh-ed-meta">
                <span>${ed.author}</span>
                <span class="fh-dot">·</span>
                <span>${ed.readTime}</span>
              </div>
            </div>
          </div>
        `).join('')}
      </div>

      <!-- Runway Strip -->
      <div class="fh-section-header">
        <span class="fh-section-tag">LIVE</span>
        <h2 class="fh-section-title">Runway Now</h2>
      </div>
      <div class="fh-runway-strip">
        ${MAGAZINE.runwayShows.slice(0, 3).map(r => `
          <div class="fh-runway-card" style="background:${r.gradient}">
            <div class="fh-rw-status">${r.status}</div>
            <div class="fh-rw-designer">${r.designer}</div>
            <div class="fh-rw-info">${r.season} · ${r.city}</div>
            <div class="fh-rw-detail">${r.viewers ? r.viewers + ' watching' : r.time}</div>
          </div>
        `).join('')}
      </div>

      <!-- Trending -->
      <div class="fh-section-header">
        <span class="fh-section-tag">TRENDING</span>
        <h2 class="fh-section-title">What's Hot Right Now</h2>
      </div>
      <div class="fh-trending-bar">
        ${MAGAZINE.trendingNow.map(t => `
          <div class="fh-trend-chip">
            <span class="fh-trend-tag">${t.tag}</span>
            <span class="fh-trend-change">${t.change}</span>
          </div>
        `).join('')}
      </div>

      <div class="fh-mag-footer">
        <span class="fh-footer-text">GLOBALFASHIONHUB · ${MAGAZINE.issue}</span>
        <span class="fh-footer-text">A Trending Digital Publication</span>
      </div>
    </div>
  `;
}

/* ── Editorials Page ─────────────────────────────────────────────────── */
function renderFHEditorials() {
  return `
    <div class="fh-page">
      <div class="fh-section-header fh-page-top">
        <span class="fh-section-tag">EDITORIALS</span>
        <h2 class="fh-section-title">All Stories This Issue</h2>
      </div>
      <div class="fh-editorial-list">
        ${MAGAZINE.editorials.map(ed => `
          <div class="fh-editorial-row" onclick="fhOpenArticle('${ed.id}')">
            <div class="fh-edrow-img-wrap">
              <img src="${ed.image}" class="fh-edrow-img" alt="${ed.title}">
            </div>
            <div class="fh-edrow-body">
              <span class="fh-ed-category-sm">${ed.category}</span>
              <h3 class="fh-edrow-title">${ed.title}</h3>
              <p class="fh-edrow-excerpt">${ed.excerpt}</p>
              <div class="fh-ed-meta">
                <span>${ed.author}</span>
                <span class="fh-dot">·</span>
                <span>${ed.readTime}</span>
                <span class="fh-dot">·</span>
                <span class="material-symbols-rounded" style="font-size:14px">favorite</span> ${ed.likes.toLocaleString()}
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

/* ── Full Article View ───────────────────────────────────────────────── */
function renderFHArticle(id) {
  const ed = MAGAZINE.editorials.find(e => e.id === id);
  if (!ed) return '<div class="fh-page"><p>Article not found.</p></div>';
  const paragraphs = ed.body.split('\n\n').map(p => `<p class="fh-article-p">${p}</p>`).join('');

  return `
    <div class="fh-article-page">
      <button class="fh-back-btn" onclick="fhActiveEditorial=null; renderFashionHub();">
        <span class="material-symbols-rounded">arrow_back</span> Back to Magazine
      </button>

      <div class="fh-article-hero">
        <img src="${ed.image}" class="fh-article-hero-img" alt="${ed.title}">
        <div class="fh-article-hero-overlay">
          <span class="fh-cover-badge">${ed.category}</span>
        </div>
      </div>

      <div class="fh-article-content">
        <h1 class="fh-article-title">${ed.title}</h1>
        <p class="fh-article-subtitle">${ed.subtitle}</p>
        <div class="fh-article-author-bar">
          <div class="fh-article-author-avatar">${ed.author[0]}</div>
          <div>
            <div class="fh-article-author-name">${ed.author} <span style="color:var(--t3)">${ed.authorHandle}</span></div>
            <div class="fh-article-meta-line">${ed.readTime} · ${ed.likes.toLocaleString()} likes · ${ed.comments} comments</div>
          </div>
        </div>

        <div class="fh-article-tags">
          ${ed.tags.map(t => `<span class="fh-article-tag">${t}</span>`).join('')}
        </div>

        <div class="fh-article-body">
          <p class="fh-article-dropcap">${ed.excerpt}</p>
          ${paragraphs}
        </div>

        <div class="fh-article-actions">
          <button class="fh-action-btn" onclick="showToast('Liked!')"><span class="material-symbols-rounded">favorite</span> Like</button>
          <button class="fh-action-btn" onclick="showToast('Shared!')"><span class="material-symbols-rounded">share</span> Share</button>
          <button class="fh-action-btn" onclick="showToast('Bookmarked!')"><span class="material-symbols-rounded">bookmark</span> Save</button>
        </div>
      </div>
    </div>
  `;
}

function fhOpenArticle(id) {
  fhActiveEditorial = id;
  renderFashionHub();
}

/* ── Runway Page ─────────────────────────────────────────────────────── */
function renderFHRunway() {
  return `
    <div class="fh-page">
      <div class="fh-section-header fh-page-top">
        <span class="fh-section-tag">LIVE & UPCOMING</span>
        <h2 class="fh-section-title">Digital Runways</h2>
      </div>
      <div class="fh-runway-grid">
        ${MAGAZINE.runwayShows.map(r => `
          <div class="fh-runway-big-card" style="background:${r.gradient}">
            <div class="fh-rw-status">${r.status}</div>
            <div class="fh-rw-play"><span class="material-symbols-rounded">play_arrow</span></div>
            <div class="fh-rw-bottom">
              <div class="fh-rw-designer">${r.designer}</div>
              <div class="fh-rw-info">${r.season} · ${r.city}</div>
              <div class="fh-rw-detail">${r.viewers ? r.viewers + ' watching' : r.time}</div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

/* ── Trends Page ─────────────────────────────────────────────────────── */
function renderFHTrends() {
  return `
    <div class="fh-page">
      <div class="fh-section-header fh-page-top">
        <span class="fh-section-tag">TRENDING</span>
        <h2 class="fh-section-title">Fashion Pulse</h2>
      </div>
      <div class="fh-trends-grid">
        ${MAGAZINE.trendingNow.map((t, i) => `
          <div class="fh-trend-row">
            <span class="fh-trend-rank">${i + 1}</span>
            <div class="fh-trend-info">
              <span class="fh-trend-name">${t.tag}</span>
              <span class="fh-trend-posts">${t.posts} posts</span>
            </div>
            <span class="fh-trend-badge">${t.change}</span>
          </div>
        `).join('')}
      </div>

      <div class="fh-section-header" style="margin-top:32px">
        <span class="fh-section-tag">DESIGNERS</span>
        <h2 class="fh-section-title">Rising Creators</h2>
      </div>
      <div class="fh-designers-grid">
        ${MAGAZINE.designers.map(d => `
          <div class="fh-designer-card">
            <div class="fh-designer-avatar">${d.name[0]}</div>
            <div class="fh-designer-info">
              <span class="fh-designer-name">${d.name} ${d.verified ? '<span class="material-symbols-rounded" style="font-size:14px;color:var(--blue)">verified</span>' : ''}</span>
              <span class="fh-designer-handle">${d.handle}</span>
              <span class="fh-designer-spec">${d.specialty} · ${d.followers} followers</span>
            </div>
            <button class="fh-follow-btn" onclick="this.textContent='Following';this.style.background='var(--card2)';this.style.color='var(--t2)';showToast('Following '+${JSON.stringify(d.name)}+'!')">Follow</button>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

/* ── Culture Page ────────────────────────────────────────────────────── */
function renderFHCulture() {
  return `
    <div class="fh-page">
      <div class="fh-section-header fh-page-top">
        <span class="fh-section-tag">CULTURE</span>
        <h2 class="fh-section-title">Fashion & Society</h2>
      </div>
      <div class="fh-culture-grid">
        <div class="fh-culture-card fh-culture-big">
          <img src="fashion-cover.png" class="fh-culture-img" alt="">
          <div class="fh-culture-overlay">
            <span class="fh-culture-cat">OPINION</span>
            <h3>Why Digital Fashion Is the Most Democratic Movement in Design History</h3>
            <p>From NFT wearables to AI-generated collections, anyone with a laptop can now become a fashion designer. We explore what this means for the industry.</p>
          </div>
        </div>
        <div class="fh-culture-card">
          <img src="fashion-edit1.png" class="fh-culture-img" alt="">
          <div class="fh-culture-overlay">
            <span class="fh-culture-cat">INTERVIEW</span>
            <h3>Mira Nakamura on Creating Without Limits</h3>
          </div>
        </div>
        <div class="fh-culture-card">
          <img src="fashion-edit2.png" class="fh-culture-img" alt="">
          <div class="fh-culture-overlay">
            <span class="fh-culture-cat">SUSTAINABILITY</span>
            <h3>Zero-Waste Couture: The Designers Making Fashion Circular</h3>
          </div>
        </div>
      </div>
    </div>
  `;
}

/* ── AI Lab Page ─────────────────────────────────────────────────────── */
function renderFHAILab() {
  return `
    <div class="fh-page">
      <div class="fh-section-header fh-page-top">
        <span class="fh-section-tag">AI DESIGN LAB</span>
        <h2 class="fh-section-title">Create with Intelligence</h2>
      </div>
      <div class="fh-ai-lab">
        <div class="fh-ai-prompt-area">
          <div class="fh-ai-icon-wrap"><span class="material-symbols-rounded" style="font-size:28px">auto_awesome</span></div>
          <h3 style="margin:0 0 4px; font-size:18px; font-weight:800">Describe Your Vision</h3>
          <p style="margin:0 0 16px; color:var(--t3); font-size:13px">Turn text into conceptual fashion designs using AI.</p>
          <textarea id="fh-ai-prompt" class="fh-ai-textarea" placeholder="e.g., Neon holographic cyberpunk trench coat with glowing collar and geometric cut-outs..."></textarea>
          <button class="fh-ai-generate-btn" onclick="generateAIDesign()">
            <span class="material-symbols-rounded">auto_awesome</span> Generate Design
          </button>
        </div>
        <div id="fh-ai-result" class="fh-ai-result" style="display:none">
          <div class="fh-ai-result-header">
            <span class="material-symbols-rounded" style="color:var(--green)">check_circle</span>
            <span style="font-weight:700">Design Generated</span>
          </div>
          <div class="fh-ai-result-img-wrap">
            <img id="fh-ai-img" src="" class="fh-ai-result-img" alt="AI Design">
            <button class="fh-publish-btn" onclick="publishAIDesign()">
              <span class="material-symbols-rounded">publish</span> Publish to Magazine
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}

/* ── Interactions ─────────────────────────────────────────────────────── */
let generatedAiImageUrl = '';

function generateAIDesign() {
  const prompt = document.getElementById('fh-ai-prompt');
  if (!prompt || !prompt.value.trim()) return showToast('Describe a garment first!');

  const btn = event.target.closest('button');
  const origHTML = btn.innerHTML;
  btn.innerHTML = '<span class="material-symbols-rounded" style="animation:spin 1s linear infinite">progress_activity</span> Generating...';
  btn.style.opacity = '0.7';
  btn.disabled = true;

  setTimeout(() => {
    const mocks = ['fashion-cover.png', 'fashion-edit1.png', 'fashion-edit2.png', 'fashion-edit3.png'];
    generatedAiImageUrl = mocks[Math.floor(Math.random() * mocks.length)];

    const result = document.getElementById('fh-ai-result');
    const img = document.getElementById('fh-ai-img');
    if (result) result.style.display = 'block';
    if (img) img.src = generatedAiImageUrl;

    btn.innerHTML = origHTML;
    btn.style.opacity = '1';
    btn.disabled = false;
    showToast('Design generated!');
  }, 1800);
}

function publishAIDesign() {
  if (!generatedAiImageUrl) return;
  DATA.fashionFeed.unshift({
    user: 'You', handle: '@me', type: 'image',
    content: 'Just created this concept in the AI Design Lab! 🚀✨',
    image: generatedAiImageUrl, timestamp: 'Just now', likes: 0
  });
  document.getElementById('fh-ai-prompt').value = '';
  document.getElementById('fh-ai-result').style.display = 'none';
  generatedAiImageUrl = '';
  showToast('Published to the magazine!');
}

function createFHPost() { /* legacy compatibility */ }
