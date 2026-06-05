// ── AGRIHUB PLATFORM ──────────────────────────────────────────────
// AgriHub: Social-First Digital Agriculture Platform
// Replaces Democracy Enclave (pane key: 'learn')

let agriActiveTab = 'feed';
let agriMarketFilter = 'All';
let agriVideoFilter = 'All';
let agriChatHistory = [];
let agriCropPriceTicker = null;

// ── MAIN RENDER ──
function renderAgriHub() {
  const el = $id('pane-learn');
  if (!el) return;

  // Inject CSS
  _injectAgriHubCSS();

  // If the pane is empty (first render), populate it
  if (!el.querySelector('.agri-hero')) {
    el.innerHTML = getLearnTemplate().replace(/^<section[^>]*>/, '').replace(/<\/section>$/, '');
  }

  // Animate crop price ticker
  _startCropPriceTicker();

  // Render initial tab
  switchAgriTab('feed');
}

function switchAgriTab(tab) {
  agriActiveTab = tab;
  document.querySelectorAll('.agri-tab-btn').forEach(b => b.classList.remove('active'));
  const btn = document.querySelector(`.agri-tab-btn[data-tab="${tab}"]`);
  if (btn) btn.classList.add('active');

  document.querySelectorAll('.agri-tab-panel').forEach(p => p.classList.add('hidden'));
  const panel = $id(`agri-panel-${tab}`);
  if (panel) panel.classList.remove('hidden');

  // Tab-specific renders
  if (tab === 'feed') _renderAgriFeed();
  if (tab === 'videos') _renderAgriVideos();
  if (tab === 'market') _renderAgriMarket();
  if (tab === 'ai') _renderAgriAI();
  if (tab === 'knowledge') _renderAgriKnowledge();
  if (tab === 'data') _renderAgriData();
  if (tab === 'communities') _renderAgriCommunities();
}

// ── FEED ──
function _renderAgriFeed() {
  const posts = (typeof DATA !== 'undefined' && DATA.agriPosts) ? DATA.agriPosts : [];
  const container = $id('agri-feed-posts');
  if (!container) return;

  container.innerHTML = posts.map(p => `
    <div class="agri-post-card card" style="margin-bottom:16px; padding:20px; border-radius:var(--r2); border:1px solid var(--border); background:var(--card)">
      <div style="display:flex; align-items:center; gap:12px; margin-bottom:14px">
        <div style="width:44px; height:44px; border-radius:50%; background:linear-gradient(135deg,#1B5E20,#4CAF50); display:grid; place-items:center; font-size:22px; flex-shrink:0">${p.avatar}</div>
        <div style="flex:1; min-width:0">
          <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap">
            <span style="font-weight:800; font-size:14px">${p.author}</span>
            ${p.verified ? '<span style="color:#4CAF50; font-size:14px" class="material-symbols-rounded">verified</span>' : ''}
            <span style="font-size:11px; padding:2px 8px; background:rgba(76,175,80,0.12); color:#4CAF50; border-radius:20px; font-weight:600">${p.badge}</span>
          </div>
          <div style="font-size:11px; color:var(--t3)">${p.role} &middot; ${p.time}</div>
        </div>
        <span style="font-size:11px; padding:3px 10px; border-radius:20px; background:rgba(76,175,80,0.1); color:#4CAF50; font-weight:700; white-space:nowrap">AI Ranked</span>
      </div>
      <p style="font-size:13px; line-height:1.65; color:var(--t1); margin:0 0 14px">${p.content}</p>
      <div style="display:flex; flex-wrap:wrap; gap:6px; margin-bottom:14px">
        ${p.tags.map(t => `<span style="font-size:11px; padding:3px 8px; background:rgba(27,94,32,0.08); color:#2E7D32; border-radius:12px; font-weight:600">#${t}</span>`).join('')}
      </div>
      <div style="display:flex; align-items:center; gap:4px; padding-top:12px; border-top:1px solid var(--border)">
        <button onclick="agriLikePost('${p.id}', this)" style="display:inline-flex; align-items:center; gap:5px; background:none; border:none; cursor:pointer; color:var(--t2); font-size:12px; font-weight:600; padding:6px 10px; border-radius:20px; transition:all 0.2s" onmouseover="this.style.background='rgba(76,175,80,0.1)'" onmouseout="this.style.background='none'">
          <span class="material-symbols-rounded" style="font-size:16px">favorite_border</span> ${p.likes.toLocaleString()}
        </button>
        <button onclick="showToast('Comments loaded. You have 0 new comments.')" style="display:inline-flex; align-items:center; gap:5px; background:none; border:none; cursor:pointer; color:var(--t2); font-size:12px; font-weight:600; padding:6px 10px; border-radius:20px; transition:all 0.2s" onmouseover="this.style.background='rgba(33,150,243,0.1)'" onmouseout="this.style.background='none'">
          <span class="material-symbols-rounded" style="font-size:16px">chat_bubble_outline</span> ${p.comments}
        </button>
        <button onclick="showToast('Reposted! \uD83C\uDF31')" style="display:inline-flex; align-items:center; gap:5px; background:none; border:none; cursor:pointer; color:var(--t2); font-size:12px; font-weight:600; padding:6px 10px; border-radius:20px; transition:all 0.2s" onmouseover="this.style.background='rgba(76,175,80,0.1)'" onmouseout="this.style.background='none'">
          <span class="material-symbols-rounded" style="font-size:16px">repeat</span> ${p.reposts}
        </button>
        <button onclick="showToast('Bookmarked! \uD83C\uDF3F')" style="display:inline-flex; align-items:center; gap:5px; background:none; border:none; cursor:pointer; color:var(--t2); font-size:12px; font-weight:600; padding:6px 10px; border-radius:20px; transition:all 0.2s; margin-left:auto" onmouseover="this.style.background='rgba(255,193,7,0.1)'" onmouseout="this.style.background='none'">
          <span class="material-symbols-rounded" style="font-size:16px">bookmark_border</span>
        </button>
        <button onclick="showToast('Post shared!')" style="display:inline-flex; align-items:center; gap:5px; background:none; border:none; cursor:pointer; color:var(--t2); font-size:12px; font-weight:600; padding:6px 10px; border-radius:20px; transition:all 0.2s" onmouseover="this.style.background='rgba(76,175,80,0.1)'" onmouseout="this.style.background='none'">
          <span class="material-symbols-rounded" style="font-size:16px">share</span>
        </button>
      </div>
    </div>
  `).join('');
}

function agriLikePost(id, btn) {
  const icon = btn.querySelector('.material-symbols-rounded');
  if (icon.textContent === 'favorite_border') {
    icon.textContent = 'favorite';
    icon.style.color = '#e53935';
    btn.style.color = '#e53935';
    showToast('Liked! \uD83C\uDF31');
  } else {
    icon.textContent = 'favorite_border';
    icon.style.color = '';
    btn.style.color = '';
  }
}

// ── VIDEOS ──
function _renderAgriVideos() {
  const videos = (typeof DATA !== 'undefined' && DATA.agriVideos) ? DATA.agriVideos : [];
  const container = $id('agri-video-grid');
  if (!container) return;

  const filterVal = agriVideoFilter;
  const filtered = filterVal === 'All' ? videos : videos.filter(v => v.category === filterVal || v.type === filterVal);

  container.innerHTML = filtered.map(v => `
    <div onclick="showToast('Playing: ${v.title.substring(0,40)}... \uD83C\uDF3E')" style="background:var(--card); border-radius:var(--r2); overflow:hidden; border:1px solid var(--border); cursor:pointer; transition:transform 0.2s, box-shadow 0.2s" onmouseover="this.style.transform='translateY(-3px)';this.style.boxShadow='0 8px 24px rgba(0,0,0,0.15)'" onmouseout="this.style.transform='';this.style.boxShadow=''">
      <div style="height:130px; background:${v.thumb_color}; display:grid; place-items:center; position:relative">
        <span style="font-size:40px">${v.icon}</span>
        ${v.live ? '<span style="position:absolute; top:8px; left:8px; background:#e53935; color:#fff; font-size:10px; font-weight:800; padding:3px 8px; border-radius:12px; animation:pulse-dot 1.5s infinite">\uD83D\uDD34 LIVE</span>' : ''}
        ${v.type === 'Short' ? '<span style="position:absolute; top:8px; left:8px; background:#1B5E20; color:#fff; font-size:10px; font-weight:800; padding:3px 8px; border-radius:12px">SHORT</span>' : ''}
        <span style="position:absolute; bottom:8px; right:8px; background:rgba(0,0,0,0.75); color:#fff; font-size:10px; font-weight:700; padding:2px 6px; border-radius:6px">${v.duration}</span>
      </div>
      <div style="padding:12px">
        <div style="font-size:12px; font-weight:700; line-height:1.4; color:var(--t1); margin-bottom:6px; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden">${v.title}</div>
        <div style="font-size:11px; color:var(--t3); margin-bottom:4px">${v.channel}</div>
        <div style="font-size:11px; color:var(--t3)">${v.views} views</div>
      </div>
    </div>
  `).join('');
}

function setAgriVideoFilter(filter) {
  agriVideoFilter = filter;
  document.querySelectorAll('.agri-video-filter-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.filter === filter);
  });
  _renderAgriVideos();
}

// ── MARKET ──
function _renderAgriMarket() {
  const products = (typeof DATA !== 'undefined' && DATA.agriProducts) ? DATA.agriProducts : [];
  const container = $id('agri-market-grid');
  if (!container) return;

  const filtered = agriMarketFilter === 'All' ? products : products.filter(p => p.category === agriMarketFilter);

  container.innerHTML = filtered.map(p => `
    <div style="background:var(--card); border-radius:var(--r2); border:1px solid var(--border); padding:16px; transition:transform 0.2s, box-shadow 0.2s" onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 6px 20px rgba(0,0,0,0.12)'" onmouseout="this.style.transform='';this.style.boxShadow=''">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px">
        <span style="font-size:36px">${p.icon}</span>
        <span style="font-size:10px; padding:3px 8px; background:rgba(76,175,80,0.15); color:#2E7D32; border-radius:12px; font-weight:700">${p.badge}</span>
      </div>
      <div style="font-size:13px; font-weight:800; line-height:1.3; margin-bottom:4px; color:var(--t1)">${p.name}</div>
      <div style="font-size:11px; color:var(--t3); margin-bottom:8px">${p.seller}</div>
      <div style="font-size:11px; color:var(--t2); line-height:1.5; margin-bottom:10px">${p.desc}</div>
      <div style="display:flex; align-items:center; gap:4px; margin-bottom:12px">
        ${'★'.repeat(Math.floor(p.rating))}<span style="font-size:11px; color:var(--t3); margin-left:4px">${p.rating} (${p.reviews.toLocaleString()})</span>
      </div>
      <div style="font-size:16px; font-weight:900; color:#1B5E20; margin-bottom:12px">${p.price}</div>
      <div style="display:flex; gap:8px">
        <button onclick="showToast('Added to cart! \uD83D\uDED2')" style="flex:1; padding:8px; background:linear-gradient(135deg,#1B5E20,#4CAF50); color:#fff; border:none; border-radius:var(--r1); font-size:12px; font-weight:700; cursor:pointer; transition:opacity 0.2s" onmouseover="this.style.opacity='0.9'" onmouseout="this.style.opacity='1'">Add to Cart</button>
        <button onclick="showToast('Contacting ${p.seller}...')" style="padding:8px 10px; background:transparent; color:#4CAF50; border:1.5px solid #4CAF50; border-radius:var(--r1); font-size:12px; font-weight:700; cursor:pointer; transition:all 0.2s" onmouseover="this.style.background='rgba(76,175,80,0.1)'" onmouseout="this.style.background='transparent'">Contact</button>
      </div>
    </div>
  `).join('');
}

function setAgriMarketFilter(filter) {
  agriMarketFilter = filter;
  document.querySelectorAll('.agri-market-filter-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.filter === filter);
  });
  _renderAgriMarket();
}

// ── Buddy AI (AgriHub) ──
function _renderAgriAI() {
  agriChatHistory = [];
  const feed = $id('agri-ai-chat-feed');
  if (feed) feed.innerHTML = `
    <div style="text-align:center; padding:24px 16px">
      <div style="font-size:52px; margin-bottom:12px">🌾</div>
      <div style="font-size:16px; font-weight:800; color:var(--t1); margin-bottom:6px">Hi! I'm your AgriHub Assistant</div>
      <div style="font-size:12px; color:var(--t3); line-height:1.6; max-width:320px; margin:0 auto">Ask me anything about farming, crops, weather, market prices, pest control, or agricultural best practices.</div>
    </div>
    <div style="display:flex; flex-wrap:wrap; gap:8px; padding:0 4px; margin-top:8px">
      ${['Identify crop disease from symptoms','Suggest fertilizer for wheat','Weather impact on paddy today','Best organic pest control methods','How to improve soil health?','Drip vs sprinkler irrigation?'].map(q => `
        <button onclick="sendAgriAIMessage('${q}')" style="font-size:11px; padding:6px 12px; background:rgba(76,175,80,0.1); color:#2E7D32; border:1px solid rgba(76,175,80,0.3); border-radius:20px; cursor:pointer; transition:all 0.2s; font-weight:600" onmouseover="this.style.background='rgba(76,175,80,0.2)'" onmouseout="this.style.background='rgba(76,175,80,0.1)'">${q}</button>
      `).join('')}
    </div>
  `;
}

function sendAgriAIMessage(msg) {
  const input = $id('agri-ai-input');
  const text = msg || (input ? input.value.trim() : '');
  if (!text) return;
  if (input) input.value = '';

  const feed = $id('agri-ai-chat-feed');
  if (!feed) return;

  // Clear suggestion chips if first message
  if (agriChatHistory.length === 0) feed.innerHTML = '';

  // Add user bubble
  feed.insertAdjacentHTML('beforeend', `
    <div style="display:flex; justify-content:flex-end; margin-bottom:12px">
      <div style="max-width:75%; background:linear-gradient(135deg,#1B5E20,#4CAF50); color:#fff; padding:10px 14px; border-radius:18px 18px 4px 18px; font-size:13px; line-height:1.5; font-weight:500">${text}</div>
    </div>
  `);

  // Typing indicator
  const typingId = 'agri-typing-' + Date.now();
  feed.insertAdjacentHTML('beforeend', `
    <div id="${typingId}" style="display:flex; align-items:flex-end; gap:10px; margin-bottom:12px">
      <div style="width:32px; height:32px; border-radius:50%; background:linear-gradient(135deg,#FFC107,#FF9800); display:grid; place-items:center; font-size:16px; flex-shrink:0">🌾</div>
      <div style="background:var(--card2); padding:10px 14px; border-radius:18px 18px 18px 4px; border:1px solid var(--border)">
        <span style="display:inline-flex; gap:4px">
          <span style="width:6px; height:6px; background:#4CAF50; border-radius:50%; animation:pulse-dot 1s infinite"></span>
          <span style="width:6px; height:6px; background:#4CAF50; border-radius:50%; animation:pulse-dot 1s 0.2s infinite"></span>
          <span style="width:6px; height:6px; background:#4CAF50; border-radius:50%; animation:pulse-dot 1s 0.4s infinite"></span>
        </span>
      </div>
    </div>
  `);
  feed.scrollTop = feed.scrollHeight;

  agriChatHistory.push({ role: 'user', text });

  // Simulate AI response
  const responses = _getAgriAIResponse(text);
  setTimeout(() => {
    const typingEl = $id(typingId);
    if (typingEl) typingEl.remove();
    feed.insertAdjacentHTML('beforeend', `
      <div style="display:flex; align-items:flex-start; gap:10px; margin-bottom:16px">
        <div style="width:32px; height:32px; border-radius:50%; background:linear-gradient(135deg,#FFC107,#FF9800); display:grid; place-items:center; font-size:16px; flex-shrink:0">🌾</div>
        <div style="max-width:80%; background:var(--card2); padding:12px 14px; border-radius:18px 18px 18px 4px; border:1px solid var(--border); font-size:13px; line-height:1.65; color:var(--t1)">${responses}</div>
      </div>
    `);
    feed.scrollTop = feed.scrollHeight;
    agriChatHistory.push({ role: 'ai', text: responses });
  }, 1200 + Math.random() * 600);
}

function _getAgriAIResponse(query) {
  const q = query.toLowerCase();
  if (q.includes('disease') || q.includes('pest') || q.includes('blight')) {
    return '🔍 <strong>Crop Disease Analysis:</strong><br>Based on your description, this could be <em>Early Blight (Alternaria solani)</em> or <em>Powdery Mildew</em>. Here\'s my recommendation:<br><br>1. <strong>Immediate action:</strong> Remove and destroy infected plant parts<br>2. <strong>Apply</strong> Mancozeb (0.25%) or Copper Oxychloride (0.3%) fungicide<br>3. <strong>Avoid</strong> overhead irrigation — switch to drip<br>4. <strong>Prevention:</strong> Ensure 40-50cm plant spacing for airflow<br><br>Would you like me to identify disease from a photo? 📷';
  } else if (q.includes('fertilizer') || q.includes('npk') || q.includes('nutrient')) {
    return '🧪 <strong>Fertilizer Recommendation:</strong><br>For wheat at vegetative stage, I recommend:<br><br>• <strong>Base dose:</strong> NPK 12:32:16 @ 50kg/acre<br>• <strong>Top dressing:</strong> Urea @ 25kg/acre at tillering (25 DAS)<br>• <strong>Micro-nutrients:</strong> Zinc sulfate 10kg/acre if soil test shows deficiency<br>• <strong>Nano Urea:</strong> Spray 3ml/L water at booting stage for 12-15% yield boost<br><br>💡 Tip: Always prefer split doses to reduce nitrogen loss through leaching.';
  } else if (q.includes('weather') || q.includes('rain') || q.includes('monsoon')) {
    return '🌦️ <strong>Weather Advisory for Farmers:</strong><br>Current conditions for Punjab region:<br><br>• <strong>Today:</strong> 32°C, Partly Cloudy, Humidity 64%<br>• <strong>Next 48h:</strong> Moderate rainfall (8-12mm) expected<br>• <strong>Advisory:</strong> Complete harvesting operations before Wednesday<br>• <strong>Benefit:</strong> Rainfall will help sown Kharif crops in early vegetative stage<br><br>⚠️ Keep stored grain covered — high humidity may cause fungal issues.';
  } else if (q.includes('soil') || q.includes('organic matter') || q.includes('ph')) {
    return '🌱 <strong>AgriHub Assistant says:</strong><br><br>Great question! Based on my agricultural knowledge base, here\'s what I know:<br><br>' + query + ' involves several key farming principles. For best results, consider consulting your local Krishi Vigyan Kendra (KVK) for region-specific guidance. I can also help with:<br><br>  • Crop disease identification<br>  • Fertilizer recommendations<br>  • Weather-based farm planning<br>  • Market price analysis<br>  • Irrigation planning<br><br>Ask me anything specific and I\'ll give you precise guidance! 🚜';
  } else if (q.includes('drip') || q.includes('sprinkler') || q.includes('irrigation')) {
    return '💧 <strong>Drip vs Sprinkler Irrigation:</strong><br><br><strong>Drip Irrigation:</strong><br>✅ 50-60% water saving<br>✅ Best for vegetables, fruit crops, row crops<br>✅ Fertigation possible — save 30% fertilizer<br>❌ Higher installation cost (₹40-80K/acre)<br><br><strong>Sprinkler Irrigation:</strong><br>✅ Good for cereals, pulses, groundnut<br>✅ Covers large area quickly<br>✅ Lower cost (₹15-30K/acre)<br>❌ Wind affects uniformity<br><br>💡 <strong>Recommendation:</strong> Drip for vegetables + Sprinkler for field crops = optimal water efficiency across your farm.';
  } else if (q.includes('price') || q.includes('market') || q.includes('msp')) {
    return '📊 <strong>Current Market Prices (MSP 2024-25):</strong><br><br>• 🌾 Wheat: ₹2,275/qtl (MSP) | Mandi: ₹2,310-2,380<br>• 🍚 Rice (Paddy): ₹2,183/qtl (MSP) | Mandi: ₹2,150-2,200<br>• 🌿 Cotton: ₹6,620/qtl (MSP) | Mandi: ₹6,800-7,200<br>• 🧅 Onion: ₹2,840/qtl | Rising trend (+8.4%)<br><br>📈 <strong>Trend Alert:</strong> Onion prices surging due to supply gap in Maharashtra. Consider holding stock for 2-3 weeks if possible.';
  } else {
    return '🌾 <strong>AgriHub Assistant says:</strong><br><br>Great question! Based on my agricultural knowledge base, here\'s what I know:<br><br>' + query + ' involves several key farming principles. For best results, consider consulting your local Krishi Vigyan Kendra (KVK) for region-specific guidance. I can also help with:<br><br>  • Crop disease identification<br>  • Fertilizer recommendations<br>  • Weather-based farm planning<br>  • Market price analysis<br>  • Irrigation planning<br><br>Ask me anything specific and I\'ll give you precise guidance! 🚜';
  }
}

// ── KNOWLEDGE HUB ──
function _renderAgriKnowledge() {
  const research = (typeof DATA !== 'undefined' && DATA.agriResearch) ? DATA.agriResearch : [];
  const schemes = (typeof DATA !== 'undefined' && DATA.agriSchemes) ? DATA.agriSchemes : [];
  const rContainer = $id('agri-research-list');
  const sContainer = $id('agri-schemes-list');

  if (rContainer) {
    rContainer.innerHTML = research.map(r => `
      <div style="display:flex; gap:14px; padding:16px; background:var(--card); border-radius:var(--r2); border:1px solid var(--border); margin-bottom:12px; cursor:pointer; transition:all 0.2s" onclick="showToast('Opening paper: ${r.title.substring(0,30)}...')" onmouseover="this.style.borderColor='#4CAF50'" onmouseout="this.style.borderColor='var(--border)'">
        <div style="font-size:28px; flex-shrink:0">${r.icon}</div>
        <div style="min-width:0; flex:1">
          <div style="font-size:13px; font-weight:800; line-height:1.4; color:var(--t1); margin-bottom:4px">${r.title}</div>
          <div style="font-size:11px; color:var(--t3); margin-bottom:6px">${r.authors} &middot; ${r.journal} &middot; ${r.year}</div>
          <div style="display:flex; flex-wrap:wrap; gap:4px; margin-bottom:8px">
            ${r.tags.map(t => `<span style="font-size:10px; padding:2px 6px; background:rgba(76,175,80,0.1); color:#2E7D32; border-radius:10px; font-weight:600">${t}</span>`).join('')}
          </div>
          <div style="font-size:11px; color:var(--t3); display:flex; align-items:center; gap:4px"><span class="material-symbols-rounded" style="font-size:13px">download</span> ${r.downloads} downloads</div>
        </div>
      </div>
    `).join('');
  }

  if (sContainer) {
    sContainer.innerHTML = schemes.map(s => `
      <div style="padding:16px; background:var(--card); border-radius:var(--r2); border:1px solid var(--border); margin-bottom:10px; border-left:4px solid #4CAF50">
        <div style="display:flex; align-items:center; gap:10px; margin-bottom:6px">
          <span style="font-size:22px">${s.icon}</span>
          <div>
            <div style="font-size:13px; font-weight:800; color:var(--t1)">${s.name}</div>
            <span style="font-size:10px; padding:2px 8px; background:rgba(76,175,80,0.15); color:#1B5E20; border-radius:10px; font-weight:700">${s.status} &middot; ${s.applicants} beneficiaries</span>
          </div>
        </div>
        <p style="font-size:12px; color:var(--t2); line-height:1.55; margin:0 0 10px">${s.desc}</p>
        <button onclick="showToast('Redirecting to ${s.name} portal...')" style="font-size:11px; padding:6px 14px; background:linear-gradient(135deg,#1B5E20,#4CAF50); color:#fff; border:none; border-radius:var(--r1); cursor:pointer; font-weight:700">Apply Now</button>
      </div>
    `).join('');
  }
}

// ── DATA CENTER ──
function _renderAgriData() {
  const prices = (typeof DATA !== 'undefined' && DATA.cropPrices) ? DATA.cropPrices : [];
  const weather = (typeof DATA !== 'undefined' && DATA.agriWeather) ? DATA.agriWeather : null;

  const priceContainer = $id('agri-price-list');
  if (priceContainer) {
    priceContainer.innerHTML = prices.map(p => `
      <div style="display:flex; align-items:center; justify-content:space-between; padding:10px 14px; background:var(--card); border-radius:var(--r1); border:1px solid var(--border); margin-bottom:8px">
        <div style="display:flex; align-items:center; gap:10px">
          <span style="font-size:22px">${p.icon}</span>
          <div>
            <div style="font-size:13px; font-weight:700; color:var(--t1)">${p.crop}</div>
            <div style="font-size:11px; color:var(--t3)">per ${p.unit.trim()}</div>
          </div>
        </div>
        <div style="text-align:right">
          <div style="font-size:14px; font-weight:900; color:var(--t1)">${p.price}</div>
          <div style="font-size:11px; font-weight:700; color:${p.up ? '#4CAF50' : '#e53935'}; display:flex; align-items:center; gap:2px; justify-content:flex-end">
            <span class="material-symbols-rounded" style="font-size:13px">${p.up ? 'trending_up' : 'trending_down'}</span> ${p.change}
          </div>
        </div>
      </div>
    `).join('');
  }

  const weatherEl = $id('agri-weather-widget');
  if (weatherEl && weather) {
    weatherEl.innerHTML = `
      <div style="background:linear-gradient(135deg,#1B5E20,#2E7D32); color:#fff; border-radius:var(--r2); padding:20px; margin-bottom:16px">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:16px">
          <div>
            <div style="font-size:11px; opacity:0.8; margin-bottom:4px">${weather.location}</div>
            <div style="font-size:42px; font-weight:900; line-height:1">${weather.temp}&deg;C</div>
            <div style="font-size:13px; opacity:0.9; margin-top:4px">${weather.condition}</div>
          </div>
          <div style="text-align:right; font-size:11px; opacity:0.85">
            <div>Humidity: ${weather.humidity}%</div>
            <div>Wind: ${weather.windSpeed} km/h</div>
            <div style="margin-top:6px; padding:4px 8px; background:rgba(255,193,7,0.3); border-radius:8px; font-weight:700">&#x1F327;&#xFE0F; ${weather.rainfall}</div>
          </div>
        </div>
        <div style="display:flex; gap:10px; overflow-x:auto; padding-bottom:4px">
          ${weather.forecast.map(f => `
            <div style="text-align:center; flex-shrink:0; min-width:52px">
              <div style="font-size:11px; opacity:0.7; margin-bottom:4px">${f.day}</div>
              <div style="font-size:20px; margin-bottom:4px">${f.icon}</div>
              <div style="font-size:11px; font-weight:700">${f.high}&deg;</div>
              <div style="font-size:10px; opacity:0.7">${f.low}&deg;</div>
            </div>
          `).join('')}
        </div>
      </div>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px">
        <div style="background:var(--card); border:1px solid var(--border); border-radius:var(--r2); padding:14px; text-align:center">
          <div style="font-size:28px; margin-bottom:6px">&#x1F9EA;</div>
          <div style="font-size:12px; font-weight:700; color:var(--t1)">Soil Moisture</div>
          <div style="font-size:22px; font-weight:900; color:#4CAF50">68%</div>
          <div style="font-size:10px; color:var(--t3)">Optimal Range</div>
        </div>
        <div style="background:var(--card); border:1px solid var(--border); border-radius:var(--r2); padding:14px; text-align:center">
          <div style="font-size:28px; margin-bottom:6px">&#x26A0;&#xFE0F;</div>
          <div style="font-size:12px; font-weight:700; color:var(--t1)">Pest Alert</div>
          <div style="font-size:14px; font-weight:900; color:#FFC107">Moderate</div>
          <div style="font-size:10px; color:var(--t3)">Aphids in NW zone</div>
        </div>
      </div>
    `;
  }
}

// ── COMMUNITIES ──
function _renderAgriCommunities() {
  const communities = (typeof DATA !== 'undefined' && DATA.agriCommunities) ? DATA.agriCommunities : [];
  const container = $id('agri-communities-grid');
  if (!container) return;

  container.innerHTML = communities.map(c => `
    <div style="background:var(--card); border:1px solid var(--border); border-radius:var(--r2); padding:16px; transition:transform 0.2s, box-shadow 0.2s" onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 6px 20px rgba(0,0,0,0.12)'" onmouseout="this.style.transform='';this.style.boxShadow=''">
      <div style="display:flex; align-items:center; gap:12px; margin-bottom:10px">
        <div style="width:46px; height:46px; border-radius:14px; display:grid; place-items:center; font-size:24px; flex-shrink:0; background:${c.color}22; border:1px solid ${c.color}44">${c.icon}</div>
        <div style="min-width:0; flex:1">
          <div style="font-size:13px; font-weight:800; color:var(--t1); white-space:nowrap; overflow:hidden; text-overflow:ellipsis">${c.name}</div>
          <div style="font-size:11px; color:var(--t3)">${c.members} members &middot; ${c.posts}</div>
        </div>
      </div>
      <p style="font-size:11px; color:var(--t2); line-height:1.5; margin:0 0 12px">${c.desc}</p>
      <button onclick="toggleAgriCommunity('${c.id}', this)" data-joined="${c.joined}" style="width:100%; padding:8px; border-radius:var(--r1); font-size:12px; font-weight:700; cursor:pointer; transition:all 0.2s; border:1.5px solid ${c.joined ? '#4CAF50' : 'var(--border)'}; background:${c.joined ? 'rgba(76,175,80,0.12)' : 'transparent'}; color:${c.joined ? '#4CAF50' : 'var(--t2)'}">
        ${c.joined ? '✓ Joined' : 'Join Community'}
      </button>
    </div>
  `).join('');
}

function toggleAgriCommunity(id, btn) {
  const joined = btn.dataset.joined === 'true';
  if (joined) {
    btn.dataset.joined = 'false';
    btn.textContent = 'Join Community';
    btn.style.color = 'var(--t2)';
    btn.style.background = 'transparent';
    btn.style.borderColor = 'var(--border)';
    showToast('Left community');
  } else {
    btn.dataset.joined = 'true';
    btn.textContent = '✓ Joined';
    btn.style.color = '#4CAF50';
    btn.style.background = 'rgba(76,175,80,0.12)';
    btn.style.borderColor = '#4CAF50';
    showToast('Joined community! 🌱');
    if (typeof IX !== 'undefined' && IX.burstReaction) IX.burstReaction('🌱', window.innerWidth/2, window.innerHeight/2);
  }
}

// ── CROP PRICE TICKER ──
function _startCropPriceTicker() {
  const ticker = $id('agri-price-ticker-inner');
  if (!ticker) return;
  const prices = (typeof DATA !== 'undefined' && DATA.cropPrices) ? DATA.cropPrices : [];
  const html = [...prices, ...prices].map(p =>
    `<span style="display:inline-flex; align-items:center; gap:5px; margin-right:28px; font-size:12px; white-space:nowrap">
      ${p.icon} <strong>${p.crop}</strong> ${p.price}
      <span style="color:${p.up ? '#4CAF50' : '#e53935'}; font-weight:700">${p.change}</span>
    </span>`
  ).join('');
  ticker.innerHTML = html;
}

// ── SEARCH ──
function searchAgriHub(query) {
  const q = (query || '').toLowerCase().trim();
  if (!q) return;
  showToast(`Searching AgriHub for "${query}"... 🔍`);
  // Filter posts
  if (agriActiveTab === 'feed') {
    const posts = (typeof DATA !== 'undefined' && DATA.agriPosts) ? DATA.agriPosts : [];
    const filtered = posts.filter(p => p.content.toLowerCase().includes(q) || p.tags.some(t => t.toLowerCase().includes(q)));
    const container = $id('agri-feed-posts');
    if (container && filtered.length) {
      agriActiveTab = 'feed';
      _renderAgriFeed();
      showToast(`Found ${filtered.length} posts for "${query}" 🌾`);
    }
  }
}

// ── TEMPLATE ──
function getLearnTemplate() {
  return `<section id="pane-learn" class="pane">
    <!-- AgriHub Hero Banner -->
    <div class="agri-hero" style="background:linear-gradient(135deg,#1B5E20 0%,#2E7D32 40%,#388E3C 70%,#4CAF50 100%); border-radius:var(--r2); padding:24px 28px; margin-bottom:20px; position:relative; overflow:hidden; color:#fff">
      <div style="position:absolute; top:-20px; right:-20px; width:180px; height:180px; background:rgba(255,255,255,0.04); border-radius:50%"></div>
      <div style="position:absolute; bottom:-40px; right:60px; width:120px; height:120px; background:rgba(255,193,7,0.08); border-radius:50%"></div>
      <div style="position:relative; z-index:1">
        <div style="display:flex; align-items:center; gap:10px; margin-bottom:8px">
          <span class="material-symbols-rounded" style="font-size:28px; color:#FFC107">grass</span>
          <h1 style="font-size:22px; font-weight:900; margin:0; letter-spacing:-0.02em">Global Agri Hub</h1>
          <span style="font-size:10px; padding:3px 10px; background:rgba(255,193,7,0.25); color:#FFC107; border-radius:20px; font-weight:800; border:1px solid rgba(255,193,7,0.4)">SOCIAL AGRICULTURE</span>
        </div>
        <p style="font-size:12px; opacity:0.85; margin:0 0 16px; line-height:1.55; max-width:480px">Your complete digital agriculture ecosystem — connect with farmers, discover innovations, trade products, and grow together with AI-powered agricultural intelligence.</p>
        <div style="display:flex; gap:10px; flex-wrap:wrap">
          <div style="text-align:center">
            <div style="font-size:18px; font-weight:900; color:#FFC107">2.8M+</div>
            <div style="font-size:10px; opacity:0.75">Farmers</div>
          </div>
          <div style="width:1px; background:rgba(255,255,255,0.2)"></div>
          <div style="text-align:center">
            <div style="font-size:18px; font-weight:900; color:#FFC107">48K+</div>
            <div style="font-size:10px; opacity:0.75">Communities</div>
          </div>
          <div style="width:1px; background:rgba(255,255,255,0.2)"></div>
          <div style="text-align:center">
            <div style="font-size:18px; font-weight:900; color:#FFC107">120+</div>
            <div style="font-size:10px; opacity:0.75">Crop Types</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Crop Price Ticker -->
    <div style="background:var(--card); border:1px solid var(--border); border-radius:var(--r1); padding:8px 16px; margin-bottom:18px; overflow:hidden; position:relative">
      <div style="display:flex; align-items:center; gap:10px">
        <span style="font-size:11px; font-weight:800; color:#4CAF50; white-space:nowrap; padding-right:10px; border-right:1px solid var(--border)">&#x1F4CA; LIVE MANDI</span>
        <div style="overflow:hidden; flex:1">
          <div id="agri-price-ticker-inner" style="display:flex; animation:agri-ticker 30s linear infinite; white-space:nowrap; color:var(--t1)"></div>
        </div>
      </div>
    </div>

    <!-- Tab Navigation -->
    <div class="agri-tab-bar" style="display:flex; gap:6px; overflow-x:auto; padding-bottom:4px; margin-bottom:18px; scrollbar-width:none">
      <button class="agri-tab-btn active" data-tab="feed" onclick="switchAgriTab('feed')" style="display:inline-flex; align-items:center; gap:6px; white-space:nowrap; padding:8px 16px; border-radius:24px; border:1.5px solid var(--border); background:var(--card); font-size:12px; font-weight:700; cursor:pointer; transition:all 0.2s; color:var(--t2)">
        <span class="material-symbols-rounded" style="font-size:15px">home</span> Feed
      </button>
      <button class="agri-tab-btn" data-tab="videos" onclick="switchAgriTab('videos')" style="display:inline-flex; align-items:center; gap:6px; white-space:nowrap; padding:8px 16px; border-radius:24px; border:1.5px solid var(--border); background:var(--card); font-size:12px; font-weight:700; cursor:pointer; transition:all 0.2s; color:var(--t2)">
        <span class="material-symbols-rounded" style="font-size:15px">play_circle</span> AgriTube
      </button>
      <button class="agri-tab-btn" data-tab="market" onclick="switchAgriTab('market')" style="display:inline-flex; align-items:center; gap:6px; white-space:nowrap; padding:8px 16px; border-radius:24px; border:1.5px solid var(--border); background:var(--card); font-size:12px; font-weight:700; cursor:pointer; transition:all 0.2s; color:var(--t2)">
        <span class="material-symbols-rounded" style="font-size:15px">storefront</span> AgriMarket
      </button>
      <button class="agri-tab-btn" data-tab="ai" onclick="switchAgriTab('ai')" style="display:inline-flex; align-items:center; gap:6px; white-space:nowrap; padding:8px 16px; border-radius:24px; border:1.5px solid var(--border); background:var(--card); font-size:12px; font-weight:700; cursor:pointer; transition:all 0.2s; color:var(--t2)">
        <span class="material-symbols-rounded" style="font-size:15px">auto_awesome</span> AgriHub AI
      </button>
      <button class="agri-tab-btn" data-tab="knowledge" onclick="switchAgriTab('knowledge')" style="display:inline-flex; align-items:center; gap:6px; white-space:nowrap; padding:8px 16px; border-radius:24px; border:1.5px solid var(--border); background:var(--card); font-size:12px; font-weight:700; cursor:pointer; transition:all 0.2s; color:var(--t2)">
        <span class="material-symbols-rounded" style="font-size:15px">menu_book</span> Knowledge
      </button>
      <button class="agri-tab-btn" data-tab="data" onclick="switchAgriTab('data')" style="display:inline-flex; align-items:center; gap:6px; white-space:nowrap; padding:8px 16px; border-radius:24px; border:1.5px solid var(--border); background:var(--card); font-size:12px; font-weight:700; cursor:pointer; transition:all 0.2s; color:var(--t2)">
        <span class="material-symbols-rounded" style="font-size:15px">analytics</span> Data Center
      </button>
      <button class="agri-tab-btn" data-tab="communities" onclick="switchAgriTab('communities')" style="display:inline-flex; align-items:center; gap:6px; white-space:nowrap; padding:8px 16px; border-radius:24px; border:1.5px solid var(--border); background:var(--card); font-size:12px; font-weight:700; cursor:pointer; transition:all 0.2s; color:var(--t2)">
        <span class="material-symbols-rounded" style="font-size:15px">groups</span> Communities
      </button>
    </div>

    <!-- ===== FEED PANEL ===== -->
    <div id="agri-panel-feed" class="agri-tab-panel">
      <div style="display:flex; align-items:center; gap:10px; margin-bottom:16px">
        <div style="flex:1; position:relative">
          <span class="material-symbols-rounded" style="position:absolute; left:12px; top:50%; transform:translateY(-50%); font-size:18px; color:var(--t3)">search</span>
          <input type="text" id="agri-feed-search" placeholder="Search AgriHub feed..." onkeydown="if(event.key==='Enter') searchAgriHub(this.value)" style="width:100%; padding:10px 12px 10px 40px; border-radius:var(--r2); border:1.5px solid var(--border); background:var(--card); color:var(--t1); font-size:13px; box-sizing:border-box; outline:none">
        </div>
        <button onclick="openPostComposer()" style="display:inline-flex; align-items:center; gap:6px; padding:10px 16px; background:linear-gradient(135deg,#1B5E20,#4CAF50); color:#fff; border:none; border-radius:var(--r2); font-size:12px; font-weight:700; cursor:pointer; white-space:nowrap">
          <span class="material-symbols-rounded" style="font-size:16px">add</span> Post
        </button>
      </div>
      <div id="agri-feed-posts"></div>
    </div>

    <!-- ===== AGRITUBE PANEL ===== -->
    <div id="agri-panel-videos" class="agri-tab-panel hidden">
      <div style="margin-bottom:16px">
        <h2 style="font-size:18px; font-weight:900; margin:0 0 12px; display:flex; align-items:center; gap:8px">
          <span class="material-symbols-rounded" style="color:#e53935">play_circle</span> AgriTube
          <span style="font-size:11px; font-weight:600; padding:3px 10px; background:rgba(229,57,53,0.12); color:#e53935; border-radius:12px">Live &amp; On-Demand</span>
        </h2>
        <div style="display:flex; gap:8px; overflow-x:auto; scrollbar-width:none; padding-bottom:4px">
          ${['All','Crops','Livestock','Organic','AgriTech','Live','Short'].map(f => `
            <button class="agri-video-filter-btn ${f==='All'?'active':''}" data-filter="${f}" onclick="setAgriVideoFilter('${f}')" style="white-space:nowrap; padding:6px 14px; border-radius:20px; border:1.5px solid var(--border); background:var(--card); font-size:11px; font-weight:700; cursor:pointer; color:var(--t2); transition:all 0.2s">${f}</button>
          `).join('')}
        </div>
      </div>
      <div id="agri-video-grid" style="display:grid; grid-template-columns:repeat(auto-fill, minmax(200px, 1fr)); gap:14px"></div>
    </div>

    <!-- ===== AGRIMARKET PANEL ===== -->
    <div id="agri-panel-market" class="agri-tab-panel hidden">
      <div style="margin-bottom:16px">
        <h2 style="font-size:18px; font-weight:900; margin:0 0 12px; display:flex; align-items:center; gap:8px">
          <span class="material-symbols-rounded" style="color:#4CAF50">storefront</span> AgriMarket
          <span style="font-size:11px; font-weight:600; padding:3px 10px; background:rgba(76,175,80,0.12); color:#2E7D32; border-radius:12px">Secure &middot; Verified</span>
        </h2>
        <div style="display:flex; gap:8px; overflow-x:auto; scrollbar-width:none; padding-bottom:4px">
          ${['All','Seeds','Fertilizers','Irrigation','Equipment','Organic','Poultry','Fisheries','Instruments'].map(f => `
            <button class="agri-market-filter-btn ${f==='All'?'active':''}" data-filter="${f}" onclick="setAgriMarketFilter('${f}')" style="white-space:nowrap; padding:6px 14px; border-radius:20px; border:1.5px solid var(--border); background:var(--card); font-size:11px; font-weight:700; cursor:pointer; color:var(--t2); transition:all 0.2s">${f}</button>
          `).join('')}
        </div>
      </div>
      <div id="agri-market-grid" style="display:grid; grid-template-columns:repeat(auto-fill, minmax(220px, 1fr)); gap:14px"></div>
    </div>

    <!-- ===== AgriHub AI PANEL ===== -->
    <div id="agri-panel-ai" class="agri-tab-panel hidden" style="display:flex; flex-direction:column; height:calc(100vh - 220px); min-height:500px">
      <div style="background:linear-gradient(135deg,#1B5E20,#4CAF50); border-radius:var(--r2); padding:16px 20px; margin-bottom:12px; color:#fff; display:flex; align-items:center; gap:12px">
        <div style="width:44px; height:44px; border-radius:50%; background:rgba(255,255,255,0.15); display:grid; place-items:center; font-size:24px; flex-shrink:0">🌾</div>
        <div>
          <div style="font-size:15px; font-weight:900; margin-bottom:2px">AgriHub AI Assistant</div>
          <div style="font-size:11px; opacity:0.85">Crop advisor &middot; Disease expert &middot; Market analyst &middot; Weather advisor</div>
        </div>
        <div style="margin-left:auto; display:flex; gap:6px">
          <button onclick="showToast('Voice mode coming soon! 🎤')" style="width:34px; height:34px; border-radius:50%; background:rgba(255,255,255,0.15); border:none; color:#fff; cursor:pointer; display:grid; place-items:center">
            <span class="material-symbols-rounded" style="font-size:18px">mic</span>
          </button>
          <select style="padding:4px 8px; border-radius:var(--r1); border:1px solid rgba(255,255,255,0.3); background:rgba(255,255,255,0.15); color:#fff; font-size:11px; font-weight:600; cursor:pointer">
            <option value="en">English</option>
            <option value="hi">हिन्दी</option>
            <option value="pa">ਪੰਜਾਬੀ</option>
            <option value="ta">தமிழ்</option>
          </select>
        </div>
      </div>
      <div id="agri-ai-chat-feed" style="flex:1; overflow-y:auto; padding:8px 4px; scrollbar-width:thin; scrollbar-color:#4CAF5033 transparent"></div>
      <div style="padding-top:12px; display:flex; gap:8px; align-items:center">
        <input type="text" id="agri-ai-input" placeholder="Ask about crops, weather, market prices, farming..." onkeydown="if(event.key==='Enter') sendAgriAIMessage(this.value)" style="flex:1; padding:12px 16px; border-radius:24px; border:1.5px solid var(--border); background:var(--card); color:var(--t1); font-size:13px; outline:none">
        <button onclick="sendAgriAIMessage($id('agri-ai-input').value)" style="width:44px; height:44px; border-radius:50%; background:linear-gradient(135deg,#1B5E20,#4CAF50); border:none; color:#fff; cursor:pointer; display:grid; place-items:center; flex-shrink:0">
          <span class="material-symbols-rounded" style="font-size:20px">send</span>
        </button>
      </div>
    </div>

    <!-- ===== KNOWLEDGE HUB PANEL ===== -->
    <div id="agri-panel-knowledge" class="agri-tab-panel hidden">
      <h2 style="font-size:18px; font-weight:900; margin:0 0 16px; display:flex; align-items:center; gap:8px">
        <span class="material-symbols-rounded" style="color:#1B5E20">menu_book</span> Knowledge Hub
      </h2>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px">
        <div>
          <div style="font-size:13px; font-weight:800; color:var(--t1); margin-bottom:12px; display:flex; align-items:center; gap:6px">
            <span class="material-symbols-rounded" style="font-size:16px; color:#4CAF50">science</span> Research Papers
          </div>
          <div id="agri-research-list"></div>
          <button onclick="showToast('Document upload coming soon! 📄')" style="width:100%; padding:10px; background:transparent; border:1.5px dashed var(--border); border-radius:var(--r2); color:var(--t3); font-size:12px; font-weight:700; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:6px; transition:all 0.2s; margin-top:8px" onmouseover="this.style.borderColor='#4CAF50';this.style.color='#4CAF50'" onmouseout="this.style.borderColor='var(--border)';this.style.color='var(--t3)'">
            <span class="material-symbols-rounded" style="font-size:16px">upload_file</span> Upload Research Paper
          </button>
        </div>
        <div>
          <div style="font-size:13px; font-weight:800; color:var(--t1); margin-bottom:12px; display:flex; align-items:center; gap:6px">
            <span class="material-symbols-rounded" style="font-size:16px; color:#FFC107">account_balance</span> Government Schemes
          </div>
          <div id="agri-schemes-list"></div>
        </div>
      </div>
    </div>

    <!-- ===== DATA CENTER PANEL ===== -->
    <div id="agri-panel-data" class="agri-tab-panel hidden">
      <h2 style="font-size:18px; font-weight:900; margin:0 0 16px; display:flex; align-items:center; gap:8px">
        <span class="material-symbols-rounded" style="color:#1B5E20">analytics</span> Real-Time Data Center
      </h2>
      <div style="display:grid; grid-template-columns:1.2fr 1fr; gap:20px">
        <div>
          <div style="font-size:13px; font-weight:800; color:var(--t1); margin-bottom:12px; display:flex; align-items:center; gap:6px">
            <span class="material-symbols-rounded" style="font-size:16px; color:#4CAF50">trending_up</span> Live Mandi Prices
            <span style="font-size:10px; padding:2px 8px; background:rgba(229,57,53,0.1); color:#e53935; border-radius:10px; font-weight:700; animation:pulse-dot 2s infinite">LIVE</span>
          </div>
          <div id="agri-price-list"></div>
        </div>
        <div>
          <div style="font-size:13px; font-weight:800; color:var(--t1); margin-bottom:12px; display:flex; align-items:center; gap:6px">
            <span class="material-symbols-rounded" style="font-size:16px; color:#2196F3">cloud</span> Weather &amp; Field Data
          </div>
          <div id="agri-weather-widget"></div>
        </div>
      </div>
    </div>

    <!-- ===== COMMUNITIES PANEL ===== -->
    <div id="agri-panel-communities" class="agri-tab-panel hidden">
      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:16px">
        <h2 style="font-size:18px; font-weight:900; margin:0; display:flex; align-items:center; gap:8px">
          <span class="material-symbols-rounded" style="color:#1B5E20">groups</span> Farming Communities
        </h2>
        <button onclick="showToast('Create Community coming soon! 🌾')" style="display:inline-flex; align-items:center; gap:6px; padding:8px 14px; background:linear-gradient(135deg,#1B5E20,#4CAF50); color:#fff; border:none; border-radius:var(--r2); font-size:12px; font-weight:700; cursor:pointer">
          <span class="material-symbols-rounded" style="font-size:15px">add</span> Create
        </button>
      </div>
      <div id="agri-communities-grid" style="display:grid; grid-template-columns:repeat(auto-fill, minmax(240px, 1fr)); gap:14px"></div>
    </div>

  </section>`;
}

// ── CSS INJECTION ──
function _injectAgriHubCSS() {
  if ($id('agrihub-styles')) return;
  const style = document.createElement('style');
  style.id = 'agrihub-styles';
  style.textContent = `
    /* AgriHub CSS Tokens */
    @keyframes agri-ticker {
      0% { transform: translateX(0); }
      100% { transform: translateX(-50%); }
    }
    
    /* Active tab style */
    .agri-tab-btn.active {
      background: linear-gradient(135deg, #1B5E20, #4CAF50) !important;
      color: #fff !important;
      border-color: transparent !important;
    }
    
    /* Active filter button */
    .agri-market-filter-btn.active,
    .agri-video-filter-btn.active {
      background: rgba(76,175,80,0.15) !important;
      color: #2E7D32 !important;
      border-color: #4CAF50 !important;
    }

    /* Star rating color */
    .agri-post-card:hover {
      border-color: rgba(76,175,80,0.4) !important;
    }
  `;
  document.head.appendChild(style);
}
