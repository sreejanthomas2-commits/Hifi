// ── FITNESS ──────────────────────────────────────────────────────
function renderFitness() {
  const mg = $id('muscle-grid'); if (!mg) return;
  mg.innerHTML = DATA.muscles.map(m => {
    const iconData = get3DIconForEmoji(m.emoji);
    return `
    <button class="muscle-btn${m.id===S.selectedMuscle?' active':''}" onclick="selectMuscle('${m.id}')" style="display:inline-flex; align-items:center; gap:8px">
      <span class="material-symbols-rounded emoji-3d" style="font-size:20px; color:${iconData.color}">${iconData.icon}</span>
      <span>${m.label}</span>
    </button>`;
  }).join('');
  generateWorkout();
}

function selectMuscle(id) {
  S.selectedMuscle = id;
  document.querySelectorAll('.muscle-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.muscle-btn').forEach(b => {
    const label = DATA.muscles.find(m=>m.id===id)?.label;
    if (label && b.textContent.trim().includes(label)) b.classList.add('active');
  });
  generateWorkout();
}

function generateWorkout() {
  const sel = $id('difficulty-select');
  const diff = sel ? sel.value : 'Medium';
  const exercises = DATA.workouts[S.selectedMuscle] || DATA.workouts.full;
  const out = $id('workout-output'); if (!out) return;
  
  const muscleData = DATA.muscles.find(m=>m.id===S.selectedMuscle) || { emoji:'\u2728', label:'Full Body' };
  const iconData = get3DIconForEmoji(muscleData.emoji);
  
  out.innerHTML = `
    <div class="flex-between mb12">
      <div style="display:flex; align-items:center; gap:8px">
        <span class="material-symbols-rounded emoji-3d" style="font-size:24px; color:${iconData.color}">${iconData.icon}</span>
        <div>
          <div style="font-size:15px;font-weight:800">${muscleData.label} Workout</div>
          <div style="font-size:12px;color:var(--t3)">${diff} · ${exercises.length} exercises · ~45 min</div>
        </div>
      </div>
      <span class="badge badge-blue">AI Generated</span>
    </div>
    ${exercises.map((e,i) => `
    <div class="workout-exercise">
      <div class="ex-num">${i+1}</div>
      <div class="ex-info">
        <div class="ex-name">${e.n}</div>
        <div class="ex-sets">${e.s}</div>
      </div>
      <button class="btn btn-ghost btn-sm flex-center gap4" onclick="showToast('${e.n} logged! \uD83D\uDCAA')" style="display:inline-flex; align-items:center; gap:4px">
        <span class="material-symbols-rounded" style="font-size:16px">check</span> Done
      </button>
    </div>`).join('')}
    <button class="btn btn-primary mt16 flex-center gap4" style="width:100%; display:inline-flex; align-items:center; justify-content:center; gap:4px" onclick="completeWorkout()">
      <span class="material-symbols-rounded" style="font-size:18px">emoji_events</span> Complete Workout
    </button>`;
}

function completeWorkout() {
  S.user.xp += 200;
  const xpEl = $id('xp-earned'); if (xpEl) xpEl.textContent = parseInt(xpEl.textContent||0) + 200;
  showToast('Workout Complete! +200 XP earned \uD83C\uDFC6');
}

function logMacro(type) {
  const amounts = { water:8, protein:25, cal:200 };
  S.macros[type] += amounts[type];
  const limits  = { water:96, protein:180, cal:2000 };
  const val = $id(`${type}-val`); if (val) val.textContent = S.macros[type];
  const bar = $id(`${type}-bar`); if (bar) bar.style.width = Math.min(100, (S.macros[type]/limits[type])*100) + '%';
  showToast(`Logged ${amounts[type]}${type==='water'?'oz':type==='protein'?'g':' cal'} \uD83D\uDC9A`);
}

// EKG Canvas
let ekgPhase = 0;
function startEKG() {
  const canvas = $id('ekg-canvas'); if (!canvas) return;
  canvas.width = canvas.offsetWidth * (window.devicePixelRatio||1);
  canvas.height = canvas.offsetHeight * (window.devicePixelRatio||1);
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  let x = 0, bpm = 72;
  stopEKG();
  S.ekgInterval = setInterval(() => {
    bpm = 68 + Math.round(Math.sin(Date.now()/3000)*8 + Math.random()*4);
    const el = $id('ekg-bpm'); if (el) el.textContent = bpm;
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'hsl(330,80%,62%)';
    ctx.lineWidth = 2;
    ctx.shadowColor = 'hsl(330,80%,62%)';
    ctx.shadowBlur = 6;
    ekgPhase += 0.1;
    const y = H/2 + Math.sin(ekgPhase)*20 + (Math.sin(ekgPhase*4)>0.95?-40:0) * Math.sin(ekgPhase*4);
    ctx.beginPath();
    if (x === 0) ctx.moveTo(0, H/2);
    ctx.lineTo(x % W, y);
    x = (x+3) % W;
    ctx.stroke();
  }, 30);
}
function stopEKG() {
  if (S.ekgInterval) { clearInterval(S.ekgInterval); S.ekgInterval = null; }
}

// ── AGRIHUB DATA ENRICHMENT ──
if (typeof DATA !== 'undefined') {

  DATA.agriPosts = [
    { id: 'ap1', author: 'Ramesh Patel', handle: '@ramesh_farmer', avatar: '🧑‍🌾', role: 'Wheat Farmer · Punjab', time: '2h ago', category: 'Crops', content: 'Just finished my wheat harvest! Yield was up 18% this season after switching to the SRI method. Soil health is visibly better too 🌾 #WheatFarming #SRI', image: null, likes: 1482, comments: 94, reposts: 203, tags: ['WheatFarming', 'SRI', 'Punjab'], verified: true, badge: '🌾 Expert Farmer' },
    { id: 'ap2', author: 'Dr. Priya Sharma', handle: '@drpriya_agri', avatar: '👩‍🔬', role: 'Agricultural Researcher · IARI', time: '4h ago', category: 'Research', content: 'New study shows that mycorrhizal inoculants can increase phosphorus uptake by up to 40% in degraded soils. Massive implications for low-input farming! Full paper linked. 🔬🌱', image: null, likes: 3201, comments: 287, reposts: 890, tags: ['SoilScience', 'Research', 'Mycorrhizal'], verified: true, badge: '🔬 Verified Researcher' },
    { id: 'ap3', author: 'GreenField Dairy', handle: '@greenfield_dairy', avatar: '🐄', role: 'Dairy Cooperative · Gujarat', time: '6h ago', category: 'Dairy', content: 'Our herd of 340 Holstein cows achieved an average daily yield of 22L per animal after optimizing the TMR diet with silage. Sharing our formula sheet below! 🐄🥛', image: null, likes: 892, comments: 145, reposts: 312, tags: ['DairyFarming', 'Holstein', 'TMR'], verified: true, badge: '🐄 Verified Dairy' },
    { id: 'ap4', author: 'AquaFarm Innovations', handle: '@aquafarm_in', avatar: '🐟', role: 'Aquaculture Startup · Kerala', time: '8h ago', category: 'Fisheries', content: 'Our smart RAS (Recirculating Aquaculture System) just hit 98% water efficiency. Monitoring 14 parameters in real-time via our IoT dashboard 🐟💧 #SmartFarming', image: null, likes: 2140, comments: 201, reposts: 540, tags: ['Aquaculture', 'SmartFarming', 'RAS'], verified: false, badge: '🐟 Aqua Innovator' },
    { id: 'ap5', author: 'Kisan Weather Desk', handle: '@kisanweather', avatar: '🌦️', role: 'Agri-Weather Analytics · National', time: '10m ago', category: 'Weather', content: '⚠️ WEATHER ALERT: Southwest monsoon to arrive Punjab, Haryana and UP belt 3 days early this year. Farmers advised to complete pre-sowing operations immediately. Stay updated! 🌧️', image: null, likes: 8920, comments: 1204, reposts: 4302, tags: ['MonsoonAlert', 'WeatherUpdate'], verified: true, badge: '🌦️ Weather Expert' },
    { id: 'ap6', author: 'Organic Valley Co-op', handle: '@organicvalley', avatar: '🥦', role: 'Organic Farming Network · Maharashtra', time: '1d ago', category: 'Organic', content: 'Certified organic broccoli fetching ₹85/kg at our direct farm-to-restaurant network this week! No middlemen. Farmers keeping 92% of revenue. This is the future. 🥦✅', image: null, likes: 5820, comments: 430, reposts: 1820, tags: ['OrganicFarming', 'FarmToFork'], verified: true, badge: '🥦 Certified Organic' },
    { id: 'ap7', author: 'AgriTech India', handle: '@agritech_india', avatar: '🤖', role: 'AgriTech News · Bangalore', time: '3h ago', category: 'AgriTech', content: '🚀 Breaking: India\'s first AI-powered autonomous crop spraying drone completes 1,000 hours of fieldwork with 96% accuracy and 60% less chemical use. Game changer! 🚁🌿', image: null, likes: 12400, comments: 2140, reposts: 6800, tags: ['AgriTech', 'DroneAgriculture', 'Precision'], verified: true, badge: '🤖 Tech Media' }
  ];

  DATA.agriProducts = [
    { id: 'pr1', name: 'Hybrid Tomato Seeds (F1)', category: 'Seeds', seller: 'SeedMaster Pro', price: '₹320 / 50g', rating: 4.8, reviews: 2840, badge: 'Best Seller', icon: '🍅', desc: 'High-yield disease-resistant F1 hybrid. Avg yield: 80-100 ton/hectare. Suitable for protected cultivation.' },
    { id: 'pr2', name: 'Nano Urea Fertilizer (500ml)', category: 'Fertilizers', seller: 'IFFCO Official', price: '₹240 / bottle', rating: 4.6, reviews: 14200, badge: 'Govt. Approved', icon: '🧪', desc: 'IFFCO Nano Urea — reduces need for conventional urea by 50%. Proven in 94 crops across India.' },
    { id: 'pr3', name: 'Solar Drip Irrigation Kit (1 Acre)', category: 'Irrigation', seller: 'JainIrrigation', price: '₹18,500', rating: 4.9, reviews: 890, badge: 'Premium', icon: '💧', desc: 'Complete solar-powered drip system. 60% water savings. 5-year warranty. Free installation support.' },
    { id: 'pr4', name: 'Mini Power Tiller (7HP)', category: 'Equipment', seller: 'VST Tillers', price: '₹72,000', rating: 4.7, reviews: 3240, badge: 'Top Rated', icon: '🚜', desc: 'Compact 7HP diesel tiller ideal for small farms. Handles all soil types. Easy maintenance.' },
    { id: 'pr5', name: 'Organic Neem Cake (50kg)', category: 'Organic', seller: 'GreenFarm Organics', price: '₹1,200 / bag', rating: 4.5, reviews: 6120, badge: 'Organic Certified', icon: '🌿', desc: 'Cold-pressed neem cake. Excellent soil amendment — repels pests, improves nitrogen, promotes earthworms.' },
    { id: 'pr6', name: 'Broiler Day-Old Chicks (100 pcs)', category: 'Poultry', seller: 'Suguna Poultry', price: '₹4,800 / batch', rating: 4.6, reviews: 1820, badge: 'Verified Breeder', icon: '🐤', desc: 'Vaccinated, healthy day-old Vencobb broiler chicks. Fast growth rate — 2.5kg in 42 days.' },
    { id: 'pr7', name: 'Soil Test Kit (Pro)', category: 'Instruments', seller: 'Krishi Yantra', price: '₹2,400', rating: 4.8, reviews: 4890, badge: 'Lab Accurate', icon: '🔬', desc: 'Tests NPK, pH, moisture, organic carbon. Digital display. Results in 10 minutes. 500 tests per kit.' },
    { id: 'pr8', name: 'Rohu Fish Fingerlings (1000 pcs)', category: 'Fisheries', seller: 'AquaSeed India', price: '₹2,000 / 1000', rating: 4.4, reviews: 920, badge: 'Disease-Free', icon: '🐟', desc: 'Certified disease-free Rohu fingerlings. Excellent survival rate in pond conditions.' }
  ];

  DATA.agriCommunities = [
    { id: 'c1', name: 'Organic Farming Network', icon: '🌿', members: '142K', posts: '3.2K/week', joined: true, desc: 'Share organic techniques, certifications, and market connections', color: '#4CAF50' },
    { id: 'c2', name: 'Hydroponics & Vertical Farms', icon: '💧', members: '89K', posts: '1.8K/week', joined: false, desc: 'Grow without soil — nutrient solutions, NFT, DWC systems', color: '#2196F3' },
    { id: 'c3', name: 'Dairy Farmers Hub', icon: '🐄', members: '210K', posts: '4.1K/week', joined: false, desc: 'Herd management, milk quality, TMR, breed selection', color: '#FF9800' },
    { id: 'c4', name: 'Smart Farming & AgriTech', icon: '🤖', members: '320K', posts: '6.4K/week', joined: true, desc: 'Drones, IoT sensors, AI, precision agriculture innovations', color: '#9C27B0' },
    { id: 'c5', name: 'Poultry Professionals', icon: '🐤', members: '175K', posts: '2.9K/week', joined: false, desc: 'Broiler, layer, desi breeds — management and disease control', color: '#FFC107' },
    { id: 'c6', name: 'Fisheries & Aquaculture', icon: '🐟', members: '94K', posts: '1.4K/week', joined: false, desc: 'Pond management, RAS, shrimp farming, fish health', color: '#00BCD4' },
    { id: 'c7', name: 'Agroforestry Circle', icon: '🌳', members: '58K', posts: '890/week', joined: true, desc: 'Trees + crops integrated systems, carbon credits, biodiversity', color: '#1B5E20' },
    { id: 'c8', name: 'Women in Agriculture', icon: '👩‍🌾', members: '112K', posts: '2.1K/week', joined: false, desc: 'Empowering rural women farmers with knowledge and markets', color: '#E91E63' },
    { id: 'c9', name: 'Agricultural Startups', icon: '🚀', members: '64K', posts: '1.2K/week', joined: false, desc: 'Agri-entrepreneurs, investors, incubators, funding news', color: '#FF5722' },
    { id: 'c10', name: 'Sustainable Agriculture', icon: '♻️', members: '287K', posts: '5.3K/week', joined: false, desc: 'Climate-smart farming, carbon footprint, regenerative ag', color: '#8BC34A' }
  ];

  DATA.agriVideos = [
    { id: 'v1', title: 'SRI Method Explained: 180% More Yield with Less Water', channel: 'Krishi Vigyan', duration: '18:42', views: '2.4M', category: 'Crops', icon: '🌾', thumb_color: '#1B5E20', type: 'Tutorial', live: false },
    { id: 'v2', title: 'Complete Hydroponic Setup for Beginners (₹15K Budget)', channel: 'AgroTech India', duration: '32:10', views: '1.8M', category: 'Hydroponics', icon: '💧', thumb_color: '#1565C0', type: 'Tutorial', live: false },
    { id: 'v3', title: '🔴 LIVE: Organic Farming Masterclass — Season 4 Ep 1', channel: 'Organic India Live', duration: 'LIVE', views: '48.2K watching', category: 'Organic', icon: '🌿', thumb_color: '#2E7D32', type: 'Live', live: true },
    { id: 'v4', title: 'Drone Spraying Demo — 1 Acre in 8 Minutes (Real Footage)', channel: 'AgriTech Vision', duration: '14:23', views: '4.1M', category: 'AgriTech', icon: '🚁', thumb_color: '#4A148C', type: 'Demo', live: false },
    { id: 'v5', title: 'Goat Farming: How I Earn ₹8L/Year from 60 Goats', channel: 'Rural Success Stories', duration: '28:05', views: '3.2M', category: 'Livestock', icon: '🐐', thumb_color: '#BF360C', type: 'Story', live: false },
    { id: 'v6', title: 'Soil Health Revolution — Fix Any Soil in 90 Days', channel: 'Dr. Soil Labs', duration: '45:18', views: '890K', category: 'Soil', icon: '🌱', thumb_color: '#795548', type: 'Education', live: false },
    { id: 'v7', title: '🌾 Short: How to Check Seed Germination Rate in 5 Min', channel: 'Quick Agri Tips', duration: '0:58', views: '12.4M', category: 'Seeds', icon: '🌱', thumb_color: '#388E3C', type: 'Short', live: false },
    { id: 'v8', title: '🌾 Short: Drip vs Sprinkler — Which Saves More?', channel: 'Kisan Shorts', duration: '1:12', views: '8.9M', category: 'Irrigation', icon: '💧', thumb_color: '#0277BD', type: 'Short', live: false }
  ];

  DATA.agriResearch = [
    { id: 'r1', title: 'Mycorrhizal Inoculants and Phosphorus Uptake in Degraded Indian Soils', authors: 'Sharma P., Kumar R., Nair K.', journal: 'Journal of Soil Biology', year: 2024, tags: ['Soil Science', 'Organic'], downloads: '12K', icon: '🔬' },
    { id: 'r2', title: 'AI-Powered Crop Disease Detection: A Meta-Analysis of 48 Studies', authors: 'Singh A., Patel M., Zhang L.', journal: 'Nature Food', year: 2025, tags: ['AgriTech', 'AI', 'Disease'], downloads: '38K', icon: '🤖' },
    { id: 'r3', title: 'Climate-Smart Wheat Varieties for South Asian Drought Conditions', authors: 'CIMMYT Research Team', journal: 'Field Crops Research', year: 2024, tags: ['Climate', 'Wheat', 'Breeding'], downloads: '9.4K', icon: '🌾' },
    { id: 'r4', title: 'Economic Impact of Direct Farmer-to-Consumer Digital Markets in India', authors: 'Mehta R., Das S.', journal: 'Agricultural Economics', year: 2025, tags: ['Markets', 'Digital', 'Income'], downloads: '6.1K', icon: '📊' },
    { id: 'r5', title: 'Nano-Urea Efficacy Across 94 Crop Types — National Trial Report', authors: 'IFFCO Research Division', journal: 'IFFCO Technical Bulletin', year: 2024, tags: ['Fertilizers', 'Nano', 'Yield'], downloads: '24K', icon: '🧪' }
  ];

  DATA.cropPrices = [
    { crop: 'Wheat', price: '₹2,275', unit: '/qtl', change: '+1.2%', up: true, icon: '🌾' },
    { crop: 'Rice (Paddy)', price: '₹2,183', unit: '/qtl', change: '-0.4%', up: false, icon: '🍚' },
    { crop: 'Cotton', price: '₹6,620', unit: '/qtl', change: '+3.1%', up: true, icon: '🌿' },
    { crop: 'Soybean', price: '₹4,892', unit: '/qtl', change: '+0.8%', up: true, icon: '🫘' },
    { crop: 'Mustard', price: '₹5,450', unit: '/qtl', change: '-1.1%', up: false, icon: '🌼' },
    { crop: 'Onion', price: '₹2,840', unit: '/qtl', change: '+8.4%', up: true, icon: '🧅' },
    { crop: 'Potato', price: '₹1,240', unit: '/qtl', change: '-2.3%', up: false, icon: '🥔' },
    { crop: 'Sugarcane', price: '₹370', unit: '/qtl', change: '+0.3%', up: true, icon: '🌱' }
  ];

  DATA.agriWeather = {
    location: 'Punjab, India',
    temp: 32,
    condition: 'Partly Cloudy',
    humidity: 64,
    windSpeed: 14,
    rainfall: '8mm expected in 48h',
    forecast: [
      { day: 'Today', icon: '⛅', high: 32, low: 24 },
      { day: 'Tue', icon: '🌧️', high: 28, low: 21 },
      { day: 'Wed', icon: '🌩️', high: 26, low: 20 },
      { day: 'Thu', icon: '🌦️', high: 30, low: 22 },
      { day: 'Fri', icon: '☀️', high: 34, low: 24 }
    ]
  };

  DATA.agriSchemes = [
    { name: 'PM-KISAN Samman Nidhi', desc: 'Direct income support of ₹6,000/year to eligible farmer families in 3 installments', status: 'Active', applicants: '11.4 Crore', icon: '🏛️' },
    { name: 'Pradhan Mantri Fasal Bima Yojana', desc: 'Crop insurance scheme protecting against natural calamities, pests and disease losses', status: 'Active', applicants: '5.6 Crore', icon: '🛡️' },
    { name: 'Kisan Credit Card (KCC)', desc: 'Short-term agricultural credit at 7% interest rate with flexible repayment options', status: 'Active', applicants: '7.2 Crore', icon: '💳' },
    { name: 'PM Krishi Sinchai Yojana', desc: 'Water efficiency mission — subsidizing drip and sprinkler irrigation for all farm sizes', status: 'Active', applicants: '2.1 Crore', icon: '💧' }
  ];
}





function getFitnessTemplate() {
  return `<section id="pane-fitness" class="pane">
        <h1 class="pane-title" style="display:flex; align-items:center; gap:10px">
          <span class="material-symbols-rounded emoji-3d" style="font-size:32px; color:var(--green)">fitness_center</span>
          <span>Fitness</span> Hub
        </h1>

        <div class="fitness-layout">
          <!-- Left Column -->
          <div>
            <div class="card mb16" style="padding:20px">
              <div class="section-hdr">
                <span class="section-title">Select Muscle Group</span>
                <span class="badge badge-blue">AI Powered</span>
              </div>
              <div class="muscle-group-grid" id="muscle-grid"></div>
              <div class="flex mt12" style="gap:8px">
                <select class="input btn-sm" id="difficulty-select">
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                  <option value="beast">Beast</option>
                </select>
                <select class="input btn-sm" id="equipment-select">
                  <option value="gym">Gym</option>
                  <option value="dumbbells">Dumbbells</option>
                  <option value="bodyweight">Bodyweight</option>
                  <option value="none">No Equipment</option>
                </select>
                <button class="btn btn-primary flex-center gap4" id="gen-workout-btn" onclick="generateWorkout()" style="display:inline-flex; align-items:center; gap:4px">
                  <span class="material-symbols-rounded" style="font-size:16px">bolt</span> Generate Plan
                </button>
              </div>
            </div>

            <div id="workout-output" class="workout-output"></div>

            <div class="ekg-card">
              <div class="ekg-header">
                <div>
                  <span class="ekg-bpm" id="ekg-bpm">72</span>
                  <div class="ekg-label">BPM</div>
                </div>
                <span class="badge badge-pink" style="display:inline-flex; align-items:center; gap:4px">
                  <span class="material-symbols-rounded" style="font-size:14px">favorite</span> Heart Rate
                </span>
              </div>
              <canvas id="ekg-canvas"></canvas>
            </div>
          </div>

          <!-- Right Column -->
          <div>
            <div class="card" style="padding:18px;margin-bottom:16px">
              <div class="section-hdr">
                <span class="section-title" style="display:flex; align-items:center; gap:6px"><span class="material-symbols-rounded" style="color:var(--blue)">insights</span> Daily Macros</span>
              </div>
              <div class="macro-grid">
                <div class="macro-card">
                  <div class="macro-val tc-blue" id="water-val">0</div>
                  <div class="macro-lbl">Water (oz)</div>
                  <div class="progress-bar mt8">
                    <div class="progress-fill" id="water-bar" style="width:0%;background:var(--blue)"></div>
                  </div>
                  <button class="macro-log-btn" onclick="logMacro('water')">Log 8oz</button>
                </div>
                <div class="macro-card">
                  <div class="macro-val tc-green" id="protein-val">0</div>
                  <div class="macro-lbl">Protein (g)</div>
                  <div class="progress-bar mt8">
                    <div class="progress-fill" id="protein-bar" style="width:0%;background:var(--green)"></div>
                  </div>
                  <button class="macro-log-btn" onclick="logMacro('protein')">Log 25g</button>
                </div>
                <div class="macro-card">
                  <div class="macro-val tc-pink" id="cal-val">0</div>
                  <div class="macro-lbl">Calories</div>
                  <div class="progress-bar mt8">
                    <div class="progress-fill" id="cal-bar" style="width:0%;background:var(--pink)"></div>
                  </div>
                  <button class="macro-log-btn" onclick="logMacro('cal')">Log 200</button>
                </div>
              </div>
            </div>

            <div class="card" style="padding:18px">
              <div class="section-hdr">
                <span class="section-title" style="display:flex; align-items:center; gap:6px"><span class="material-symbols-rounded" style="color:var(--orange)">emoji_events</span> Today's Stats</span>
              </div>
              <div class="grid-2 mt12">
                <div class="stat-card">
                  <div class="stat-val" id="steps-val">0</div>
                  <div class="stat-lbl">Steps</div>
                </div>
                <div class="stat-card">
                  <div class="stat-val" id="cal-burned">0</div>
                  <div class="stat-lbl">Calories</div>
                </div>
                <div class="stat-card">
                  <div class="stat-val" id="workout-time">0m</div>
                  <div class="stat-lbl">Active</div>
                </div>
                <div class="stat-card">
                  <div class="stat-val" id="xp-earned">0</div>
                  <div class="stat-lbl">XP Earned</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>`;
}

/* --- Mindfulness Interactive Scroll-Limiter Intervention --- */
function triggerMindfulnessIntervention() {
  if (S.mindfulnessActive) return;
  S.mindfulnessActive = true;
  
  let overlay = $id('mindfulness-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'mindfulness-overlay';
    overlay.className = 'mental-health-breakover';
    document.body.appendChild(overlay);
  }
  
  overlay.innerHTML = `
    <div class="flex-center flex-col" style="max-width:480px; gap:16px">
      <span class="material-symbols-rounded emoji-3d" style="font-size:64px; color:var(--blue)">spa</span>
      <h1 class="fw9 tc-1" style="font-size:32px; letter-spacing:-0.03em">Breathe with Me 🌿</h1>
      <p class="tc-2 fs14" style="line-height:1.6">Your mental energy is highly valuable. Let's take a quick 10-second mindfulness break to restore your focus.</p>
      
      <div class="breathing-orb" id="mental-breathing-orb">
        <span class="breathing-status-text" id="mental-breathing-text">Inhale...</span>
      </div>
      
      <p class="tc-3 fs11">Rewards: <strong>+30 Mindfulness XP</strong> upon completion</p>
      <div id="breathing-progress-countdown" class="fs18 fw8 tc-blue">10s remaining</div>
    </div>
  `;
  
  overlay.classList.add('active');
  
  let count = 10;
  const textElement = $id('mental-breathing-text');
  const orbElement = $id('mental-breathing-orb');
  const timerElement = $id('breathing-progress-countdown');
  
  const breathInterval = setInterval(() => {
    count--;
    if (timerElement) timerElement.textContent = `${count}s remaining`;
    
    if (count > 7) {
      if (textElement) textElement.textContent = 'Inhale...';
      if (orbElement) orbElement.style.background = 'radial-gradient(circle, var(--blue) 0%, rgba(59, 130, 246, 0.4) 70%)';
    } else if (count > 4) {
      if (textElement) textElement.textContent = 'Hold...';
      if (orbElement) orbElement.style.background = 'radial-gradient(circle, var(--purple) 0%, rgba(139, 92, 246, 0.4) 70%)';
    } else {
      if (textElement) textElement.textContent = 'Exhale...';
      if (orbElement) orbElement.style.background = 'radial-gradient(circle, var(--pink) 0%, rgba(236, 72, 153, 0.4) 70%)';
    }
    
    if (count <= 0) {
      clearInterval(breathInterval);
      completeMindfulness();
    }
  }, 1000);
  
  function completeMindfulness() {
    overlay.classList.remove('active');
    S.mindfulnessActive = false;
    
    S.user = S.user || { xp: 0 };
    S.user.xp += 30;
    updateUserUI();
    
    showToast('Mindfulness Complete! Restored neuro-balance +30 XP 🌿');
    
    if (typeof IX !== 'undefined' && IX.burstReaction) {
      IX.burstReaction('🌿', window.innerWidth/2, window.innerHeight/2, 12);
    }
  }
}

