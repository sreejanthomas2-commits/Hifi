// ── DATA ─────────────────────────────────────────────────────────
/* Strict mode, ahead of this file becoming an ES module - modules are
   always strict, and doing it here first means any breakage shows up
   on its own rather than mixed into the module conversion. */
'use strict';

const DATA = {
  users: [
    { name:'Sarah Chen',    handle:'@sarahc',    emoji:'\u2728', online:true,  address:'0x1F2B...A9C4' },
    { name:'Marcus Webb',   handle:'@marcusw',   emoji:'\u2728', online:false, address:'0x9E8D...F321' },
    { name:'Zara Ahmed',    handle:'@zaraa',     emoji:'\u2728', online:true,  address:'0x4B3A...7C82' },
    { name:'Tyler Ross',    handle:'@tylerr',    emoji:'\u2728', online:true,  address:'0x8C1F...E49D' },
    { name:'Mia Thompson',  handle:'@miat',      emoji:'\u2728', online:false, address:'0x2D5A...B16F' },
    { name:'Dev Kumar',     handle:'@devk',      emoji:'\u2728', online:true,  address:'0x7A9B...C35E' },
    { name:'Luna Park',     handle:'@lunap',     emoji:'\u2728', online:false, address:'0x5F8E...D24B' },
    { name:'Kai Brooks',    handle:'@kaib',      emoji:'\u2728', online:true,  address:'0x3E1C...F98A' },
  ],
  stories: [
    { name:'Sarah',   emoji:'\u2728', seen:false },
    { name:'Marcus',  emoji:'\u2728', seen:false },
    { name:'Zara',    emoji:'\u2728', seen:true  },
    { name:'Tyler',   emoji:'\u2728', seen:false },
    { name:'Mia',     emoji:'\u2728', seen:true  },
    { name:'Dev',     emoji:'\u2728', seen:false },
    { name:'Luna',    emoji:'\u2728', seen:true  },
    { name:'Kai',     emoji:'\u2728', seen:false },
  ],
  posts: [
    { id:1, author:'Sarah Chen', handle:'@sarahc', emoji:'\u2728', time:'2m ago', body:'Just shipped a major feature after 3 weeks of grinding. The feeling when everything clicks is unmatched 🚀', tags:['#buildinpublic','#dev','#shipped'], likes:284, comments:42, shares:18, liked:false, type:'text', category:'tech' },
    { id:2, author:'Marcus Webb', handle:'@marcusw', emoji:'\u2728', time:'8m ago', body:'Morning gym session done. 5AM crew where you at? Consistency is everything.', emoji_block:'\u2728\u2728\u2728', tags:['#fitness','#5amclub'], likes:512, comments:67, shares:31, liked:false, type:'emoji', category:'fitness' },
    { id:3, author:'Zara Ahmed', handle:'@zaraa', emoji:'\u2728', time:'23m ago', body:'Hot take: The best time to start creating content was 5 years ago. The second best time is RIGHT NOW. Stop waiting for perfect conditions.', tags:['#creator','#contentcreator','#motivation'], likes:1203, comments:198, shares:445, liked:false, type:'text', category:'motivation' },
    { id:4, author:'Dev Kumar', handle:'@devk', emoji:'\u2728', time:'1h ago', body:'AI tools I actually use daily:\n\n1. ChatGPT for brainstorming\n2. Midjourney for visuals\n3. ALINA for content insights\n4. GitHub Copilot for coding\n\nWhat\'s in your stack?', tags:['#ai','#tools','#productivity'], likes:876, comments:143, shares:267, liked:false, type:'text', category:'tech' },
    { id:5, author:'Luna Park', handle:'@lunap', emoji:'\u2728', time:'2h ago', body:'Design tip: White space is not empty space. It\'s breathing room for your content. Less clutter = more impact.', emoji_block:'\u2728\u2728\u2728', tags:['#design','#ux','#designtips'], likes:2341, comments:89, shares:567, liked:false, type:'emoji', category:'design' },
    { id:6, author:'Kai Brooks', handle:'@kaib', emoji:'\u2728', time:'3h ago', body:'Just broke my personal record on the 100m dash! Training hard every single day is paying off. Never stop pushing your limits.', tags:['#sports','#athletics','#grind'], likes:445, comments:56, shares:23, liked:false, type:'text', category:'sports' },
    { id:7, author:'Mia Thompson', handle:'@miat', emoji:'\u2728', time:'4h ago', body:'Just released my new digital art collection on OpenSea. 3 months of creative grind compressed into 12 pieces. Each one tells a story about the intersection of technology and human emotion.', tags:['#NFT','#digitalart','#creative'], likes:1892, comments:234, shares:178, liked:false, type:'text', category:'design' },
    { id:8, author:'Tyler Ross', handle:'@tylerr', emoji:'\u2728', time:'5h ago', body:'Apex Legends tournament recap: We placed 2nd out of 120 teams! Lost the final fight by 12 HP. The grind continues tomorrow. GGs to all competitors.', emoji_block:'\u2728\u2728\u2728', tags:['#gaming','#esports','#apexlegends'], likes:3456, comments:412, shares:89, liked:false, type:'emoji', category:'tech' },
    { id:9, author:'Priya Sharma', handle:'@priyas', emoji:'\u2728', time:'6h ago', body:'Reminder: Your morning routine sets the tone for your entire day. Wake up 30 minutes earlier. Meditate. Journal. Move your body. Watch how everything changes.', tags:['#wellness','#morningroutine','#mindset'], likes:2108, comments:167, shares:534, liked:false, type:'text', category:'motivation' },
    { id:10, author:'Jordan Lee', handle:'@jordanl', emoji:'\u2728', time:'7h ago', body:'Finally launched my SaaS product after 8 months of building in stealth mode. First 100 users signed up within 3 hours. The power of building an audience first is real.', tags:['#startup','#saas','#buildinpublic'], likes:4521, comments:389, shares:267, liked:false, type:'text', category:'tech' },
    { id:11, author:'Nina Patel', handle:'@ninap', emoji:'\u2728', time:'8h ago', body:'Meal prep Sunday done right! 5 containers of high-protein chicken bowls, 3 smoothie packs, and overnight oats for the week. Nutrition is the foundation of everything.', emoji_block:'\u2728\u2728\u2728', tags:['#mealprep','#nutrition','#fitness'], likes:1567, comments:98, shares:145, liked:false, type:'emoji', category:'fitness' },
    { id:12, author:'Alex Rivera', handle:'@alexr', emoji:'\u2728', time:'9h ago', body:'Hot take: The best frameworks are the ones you actually ship products with. Stop framework-hopping. Pick one, master it, build things that matter.', tags:['#webdev','#coding','#hottake'], likes:5234, comments:567, shares:890, liked:false, type:'text', category:'tech' },
    { id:13, author:'Rajesh Singh', handle:'@rajesh_farms', emoji:'👨‍🌾', time:'10h ago', body:'Just completed harvesting my new hybrid wheat variety. The yield is looking 20% higher than last year despite the erratic rains! The future of farming is data-driven.', tags:['#agriculture','#farming','#wheat'], likes:890, comments:142, shares:56, liked:false, type:'text', category:'agriculture' },
    { id:14, author:'Crypto Whale', handle:'@whale_alert', emoji:'🐋', time:'11h ago', body:'BTC just broke resistance. We are entering a new phase of the bull market. Altcoins will follow soon. Stay vigilant.', tags:['#crypto','#bitcoin','#bullmarket'], likes:4520, comments:890, shares:1200, liked:false, type:'text', category:'crypto' },
  ],

  topics: [
    { emoji:'🌾', name:'Global Agri Hub', count:'5.2M posts', cat:'agriculture' },
    { emoji:'🪙', name:'Bitcoin & Crypto', count:'3.9M posts', cat:'crypto' },
    { emoji:'🤖', name:'Artificial Intelligence', count:'2.4M posts', cat:'tech' },
    { emoji:'💪', name:'Fitness & Wellness', count:'1.8M posts', cat:'fitness' },
    { emoji:'🎨', name:'Design & Art', count:'1.5M posts', cat:'design' },
    { emoji:'💻', name:'Tech & Coding', count:'1.3M posts', cat:'tech' },
    { emoji:'🎮', name:'Gaming', count:'1.1M posts', cat:'gaming' },
    { emoji:'🚀', name:'Startups', count:'540K posts', cat:'startups' },
    { emoji:'🔬', name:'Quantum Computing', count:'520K posts', cat:'science' },
    { emoji:'📰', name:'World News', count:'2.1M posts', cat:'politics' },
    { emoji:'🦌', name:'Wildlife Watch', count:'430K posts', cat:'wildlife' },
    { emoji:'⚽', name:'Sports Highlights', count:'1.7M posts', cat:'sports' },
    { emoji:'🎭', name:'Anime & Movies', count:'1.2M posts', cat:'anime' },
    { emoji:'🏎️', name:'Cars & Motorsport', count:'780K posts', cat:'cars' },
    { emoji:'🔒', name:'Cybersecurity', count:'640K posts', cat:'cyber' },
    { emoji:'🧬', name:'Biotech & DNA', count:'380K posts', cat:'science' },
    { emoji:'🌍', name:'Climate Action', count:'560K posts', cat:'climate' },
    { emoji:'📸', name:'Photography', count:'920K posts', cat:'photo' },
    { emoji:'🧘', name:'Meditation & Yoga', count:'470K posts', cat:'spirit' },
    { emoji:'🧠', name:'Psychology Today', count:'510K posts', cat:'psych' },
    { emoji:'😂', name:'Memes & Humor', count:'3.2M posts', cat:'memes' },
    { emoji:'🔧', name:'DIY & Maker', count:'620K posts', cat:'diy' },
    { emoji:'🎓', name:'Education Hub', count:'880K posts', cat:'edu' },
    { emoji:'📜', name:'History Uncovered', count:'340K posts', cat:'history' },
    { emoji:'🏗️', name:'Architecture', count:'290K posts', cat:'architecture' },
    { emoji:'🌱', name:'Sustainability', count:'410K posts', cat:'env' },
    { emoji:'💼', name:'Career Growth', count:'730K posts', cat:'career' },
    { emoji:'🎧', name:'Podcasts', count:'670K posts', cat:'podcasts' },
    { emoji:'👗', name:'Fashion & Style', count:'1.4M posts', cat:'fashion' },
    { emoji:'💡', name:'Innovation & Ideas', count:'480K posts', cat:'innovation' },
    { emoji:'🏠', name:'Smart Home', count:'350K posts', cat:'home' },
    { emoji:'🤝', name:'Social Impact', count:'390K posts', cat:'social' },
    { emoji:'📱', name:'Mobile Tech', count:'810K posts', cat:'tech' },
    { emoji:'🎯', name:'Productivity Hacks', count:'570K posts', cat:'career' },
    { emoji:'🌦️', name:'Weather & Climate', count:'260K posts', cat:'climate' },
    { emoji:'🛸', name:'UFOs & Mysteries', count:'440K posts', cat:'space' },
    { emoji:'⚡', name:'Electric Vehicles', count:'680K posts', cat:'cars' },
    { emoji:'📊', name:'Data Science', count:'590K posts', cat:'coding' },
    { emoji:'🏆', name:'Esports Tournaments', count:'950K posts', cat:'gaming' },
    { emoji:'🍿', name:'Movie Reviews', count:'1.0M posts', cat:'ent' },
    { emoji:'🌳', name:'Nature Photography', count:'370K posts', cat:'nature' },
    { emoji:'🔗', name:'Blockchain Dev', count:'420K posts', cat:'blockchain' },
    { emoji:'📢', name:'Breaking News', count:'1.6M posts', cat:'news' },
    { emoji:'🚨', name:'Emergency Alerts', count:'180K posts', cat:'emergency' },
    { emoji:'🤖', name:'Robotics & Automation', count:'310K posts', cat:'robotics' },
    { emoji:'📍', name:'Local Community', count:'490K posts', cat:'local' },
    { emoji:'🔥', name:'Trending Now', count:'4.1M posts', cat:'trending' },
    { emoji:'💎', name:'Freelance & Gigs', count:'530K posts', cat:'freelance' },
    { emoji:'🧗', name:'Extreme Sports', count:'280K posts', cat:'sports' },
    { emoji:'📖', name:'Book Club', count:'360K posts', cat:'edu' },
    { emoji:'🌾', name:'Farming & Agriculture', count:'220K posts', cat:'nature' },
    { emoji:'⭐', name:'Motivation & Mindset', count:'1.3M posts', cat:'motivation' },
  ],
  trending: [
    { name:'#Trending', count:'142K posts', icon:'\uD83D\uDD25' },
    { name:'#AIRevolution', count:'98K posts',  icon:'\uD83D\uDD25' },
    { name:'#FitnessFriday', count:'76K posts', icon:'\uD83D\uDD25' },
    { name:'#CreatorEconomy', count:'65K posts',icon:'\uD83D\uDD25' },
    { name:'#Web3Future', count:'54K posts',    icon:'\uD83D\uDD25' },
    { name:'#NightOwls', count:'43K posts',     icon:'\uD83D\uDD25' },
  ],

  products: [
    { emoji:'\u2728', name:'ProSound X1 Wireless Headphones', seller:'AudioTech', price:89.99, oldPrice:149.99, rating:'★★★★★', badge:'SALE', bg:'hsl(213,55%,18%)' },
    { emoji:'\u2728', name:'SmartFit Pro 5 Watch',            seller:'FitGear',   price:199.99, oldPrice:null,   rating:'★★★★☆', badge:'NEW', bg:'hsl(155,45%,16%)' },
    { emoji:'\u2728', name:'MechKeyboard TKL RGB',            seller:'DevGear',   price:129.00, oldPrice:179.00, rating:'★★★★★', badge:'SALE', bg:'hsl(260,45%,18%)' },
    { emoji:'\u2728', name:'UltraCase Pro Max Shield',        seller:'CaseCraft', price:29.99,  oldPrice:49.99,  rating:'★★★★☆', badge:'HOT', bg:'hsl(330,45%,18%)' },
    { emoji:'\u2728', name:'Pro Gaming Controller Elite',    seller:'GameZone',  price:79.99,  oldPrice:null,   rating:'★★★★★', badge:'NEW', bg:'hsl(28,50%,18%)' },
    { emoji:'\u2728', name:'SnapLens Creator Kit',           seller:'VisionPro', price:249.00, oldPrice:299.00, rating:'★★★★☆', badge:'SALE', bg:'hsl(38,50%,16%)' },
    { emoji:'\u2728', name:'TechPack Carbon Backpack',       seller:'UrbanGear', price:119.00, oldPrice:null,   rating:'★★★★★', badge:'HOT', bg:'hsl(213,50%,14%)' },
    { emoji:'\u2728', name:'SmartDesk LED Ring Pro',         seller:'DeskSetup', price:45.99,  oldPrice:69.99,  rating:'★★★★☆', badge:'SALE', bg:'hsl(38,60%,18%)' },
  ],
  shopCategories: ['All','Electronics','Fashion','Gaming','Fitness','Beauty','Home','Books'],
  courses: [
    { id:1, emoji:'\u2728', title:'UI/UX Design Masterclass',     meta:'48 lessons · 12h',  progress:72, cat:'Design',   instructor:'Luna Park',     concepts:'Glassmorphism, HSL Design Tokens, Interactive Micro-interactions', syllabus:['Introduction to Glassmorphism','Designing with HSL Colors','Micro-interaction Principles','Figma High-Fidelity Prototypes'] },
    { id:2, emoji:'\u2728', title:'React & Next.js Complete',     meta:'64 lessons · 18h',  progress:35, cat:'Code',     instructor:'Dev Kumar',     concepts:'React 19 Hooks, Next.js Server Components, Suspense, streaming HTML', syllabus:['Next.js 15 routing structures','React Server Components vs Client Components','Advanced state management with useOptimistic','Deploying edge nodes'] },
    { id:3, emoji:'\u2728', title:'Digital Marketing Pro',        meta:'32 lessons · 8h',   progress:90, cat:'Business', instructor:'Zara Ahmed',     concepts:'SaaS Virality models, K-factor virality calculation, Cohort analysis', syllabus:['Growth Hacking fundamentals','Calculating Viral K-factor','Cohort retention cohorts','A/B conversion split-testing'] },
    { id:4, emoji:'\u2728', title:'AI & Prompt Engineering',      meta:'28 lessons · 6h',   progress:18, cat:'Code',     instructor:'Sarah Chen',    concepts:'Chain of Thought prompting, Zero-shot optimization, Temperature scaling', syllabus:['LLM context windows and attention','Constructing Chain of Thought queries','Negative padding & prompt injection defense','AI agent system integrations'] },
    { id:5, emoji:'\u2728', title:'Music Production 101',          meta:'40 lessons · 10h',  progress:55, cat:'Design',   instructor:'Kai Brooks',    concepts:'Sub-bass frequency tuning, synthesis, audio visualizer mechanics', syllabus:['Understanding frequency ranges','EQ filter automation','Synth ADSR envelopes','Designing game audio soundtracks'] },
    { id:6, emoji:'\u2728', title:'Photography Masterclass',      meta:'36 lessons · 9h',   progress:0,  cat:'Design',   instructor:'Mia Thompson',  concepts:'Aperture depth of field, Rule of Thirds, High-contrast lighting', syllabus:['Mastering manual exposure settings','Depth of Field & Bokeh effects','Composition rules and storyboards','Post-processing RAW assets'] },
    { id:7, emoji:'\u2728', title:'Bio-informatics & DNA Coding',  meta:'42 lessons · 14h',  progress:25, cat:'Science',  instructor:'Marcus Webb',   concepts:'FASTA sequences processing, Evolutionary conservation scoring, bio-DB APIs', syllabus:['Introduction to genomic computing','Parsing FASTA sequence files','Calculating phyloP evolutionary weights','Querying UniProt biological registers'] },
    { id:8, emoji:'\u2728', title:'Aerodynamics & Flight Physics', meta:'30 lessons · 10h',  progress:12, cat:'Science',  instructor:'Tyler Ross',    concepts:'Aero Lift coefficients, drag profiles, fluid velocity boundary layers', syllabus:['Fluid dynamics & Bernoulli principles','Lift vs Drag physics calculations','Wing shape angle optimization','Supersonic wind tunnel simulations'] },
    { id:9, emoji:'\u2728', title:'Behavior Design & Psychology',  meta:'24 lessons · 6h',   progress:85, cat:'Business', instructor:'Sarah Chen',    concepts:'B.J. Fogg behavior model, triggers, user motivation architecture', syllabus:['Principles of behavioral modification','Designing effective Prompt mechanisms','Structuring ability friction reductions','Gamification reward schedules'] }
  ],
  badges: [
    { e:'🏆', n:'Champion'   }, { e:'🚀', n:'Launcher'  }, { e:'💎', n:'Diamond'   },
    { e:'🔥', n:'On Fire'    }, { e:'⭐', n:'Star'       }, { e:'🎯', n:'Focused'   },
    { e:'💡', n:'Innovator'  }, { e:'🌟', n:'Rising Star'}, { e:'👑', n:'Creator'   },
    { e:'💪', n:'Athlete'    }, { e:'🧠', n:'Thinker'    }, { e:'🎨', n:'Artist'    },
  ],
  conversations: [
    { id:1, name:'Sarah Chen',   emoji:'\u2728', preview:'Are you coming to the meetup?', time:'2m',  unread:2, online:true, type:'chats'  },
    { id:2, name:'Marcus Webb',  emoji:'\u2728', preview:'Bro that workout was insane!',  time:'14m', unread:0, online:false, type:'chats' },
    { id:3, name:'Zara Ahmed',   emoji:'\u2728', preview:'Check my latest post 🔥',      time:'1h',  unread:1, online:true, type:'chats'  },
    { id:4, name:'Dev Kumar',    emoji:'\u2728', preview:'What stack are you using?',    time:'3h',  unread:0, online:true, type:'chats'  },
    { id:5, name:'Design Squad', emoji:'\u2728', preview:'Sarah added 3 files to layout.', time:'1d', unread:0, online:false, type:'groups' },
    { id:6, name:'Trending Universe', emoji:'\u2728', preview:'Web3 summit updates released!',  time:'2d', unread:0, online:false, type:'channels' },
    { id:7, name:'ALINA', emoji:'\u2728', preview:'Intelligence that grows with you...', time:'just now', unread:0, online:true, type:'bots' }
  ],
  chatHistory: {
    1: [
      { me:false, text:'Hey! Are you coming to the Trending meetup this Friday?',      time:'2:10 PM' },
      { me:true,  text:'Absolutely! I\'ve been looking forward to it all week 🙌',        time:'2:11 PM' },
      { me:false, text:'Amazing! I\'ll save you a seat. It\'s going to be packed.',        time:'2:12 PM' },
      { me:true,  text:'Perfect. Should I bring anything?',                               time:'2:13 PM' },
      { me:false, text:'Just bring good vibes! See you there 🚀',                         time:'2:14 PM' },
    ],
    2: [
      { me:false, text:'Dude that leg day was BRUTAL 😵',                                 time:'9:45 AM' },
      { me:true,  text:'I know! I can barely walk up the stairs 😂',                      time:'9:46 AM' },
      { me:false, text:'Progress! Same time next week?',                                  time:'9:47 AM' },
      { me:true,  text:'100%. I\'m already dreading it haha',                             time:'9:48 AM' },
    ],
    3: [
      { me:false, text:'Check my latest post 🔥 It\'s already at 2K likes!',              time:'11:02 AM' },
      { me:true,  text:'Just saw it — the color grading is unreal 😍',                    time:'11:05 AM' },
      { me:false, text:'Thanks! Shot everything on my phone believe it or not.',          time:'11:06 AM' },
    ],
    4: [
      { me:false, text:'What stack are you using for the new project?',                   time:'8:20 AM' },
      { me:true,  text:'Node + Express on the backend, vanilla JS front. Keeping it simple.', time:'8:24 AM' },
      { me:false, text:'Respect. No-framework gang 💪',                                   time:'8:25 AM' },
    ],
    5: [
      { me:false, text:'Sarah added 3 files to the layout folder.',                       time:'Mon' },
      { me:false, text:'Can everyone review the new grid spec before Friday?',            time:'Mon' },
      { me:true,  text:'On it — I\'ll leave comments tonight.',                           time:'Mon' },
    ],
    6: [
      { me:false, text:'📢 Web3 summit updates released! Full schedule now live on the portal.', time:'2d' },
      { me:false, text:'📢 Speaker lineup drops tomorrow. Stay tuned!',                   time:'2d' },
    ],
    7: [
      { me:false, text:'Hi! I\'m ALINA 🤖 — ask me anything: writing, code, ideas, translations…', time:'Now' },
    ],
  },
  aiResponses: [
    'Great question! Based on current trends, I\'d recommend focusing on short-form video content — it drives 3x more engagement right now.',
    'I\'ve analyzed your profile data. Your peak posting time is 7-9 PM on weekdays. That\'s when your audience is most active.',
    'Here\'s a quick tip: Use 3-5 relevant hashtags rather than 30. Targeted hashtags outperform spray-and-pray by 40%.',
    'Your fitness journey is inspiring! Based on your logs, you\'re ahead of 78% of users with similar goals. Keep crushing it! 💪',
    'I detect high engagement potential in tech & AI topics for your audience. Want me to draft a post outline?',
    'Fun fact: Posts with personal stories get 22% more shares. Try adding "Here\'s what I learned..." to your next post.',
    'Your analytics show a 34% growth in followers this month. You\'re on an excellent trajectory! 🚀',
    'I can help you schedule content, analyze competitors, or generate post ideas. What would you like to focus on?',
  ],
  gigs: [
    { id:1, title:'Figma Landing Page Design', company:'StartupHub', pay:'$450 (0.0065 BTC)', tags:['Design','Figma'], applied:false, desc:'Design a high-converting, responsive glassmorphic landing page in Figma for a green-energy SaaS platform.', client:'Zara Ahmed', milestones:['Prototype wireframe layouts','High-fidelity HSL visual style design','Escrow release review'] },
    { id:2, title:'React Component Library Refactor', company:'TechCorp', pay:'$800 (0.0116 BTC)', tags:['Code','React'], applied:false, desc:'Refactor legacy web app buttons, inputs, and modals to use modern React 19 server components and custom CSS variables.', client:'Marcus Webb', milestones:['State refactor and optimization','Modernizing inputs & select fields','React 19 testing and package assembly'] },
    { id:3, title:'Science Explainer Copywriting', company:'EduMedia', pay:'$300 (0.0043 BTC)', tags:['Writing','Science'], applied:false, desc:'Write concise, educational scripts explaining quantum entanglement and fluid boundary velocity for a suite of 60-second learning reels.', client:'Luna Park', milestones:['Draft core quantum physics syllabus','Verify factual accuracy thresholds','Write final presentation script outlines'] },
    { id:4, title:'Solidity Token Smart Contract', company:'DeFi Labs', pay:'$1,200 (0.0175 BTC)', tags:['Web3','Solidity'], applied:false, desc:'Develop and audit an ERC-20 token smart contract with custom minting rules and gas-optimized validation checks.', client:'Dev Kumar', milestones:['Write token minting rule algorithms','Run gas utilization tests','Complete local sandbox security audit'] },
    { id:5, title:'AI Chatbot Integration (Next.js)', company:'GeminiBuild', pay:'$950 (0.0138 BTC)', tags:['Code','AI'], applied:false, desc:'Integrate a streaming AI assistant conversational panel into a Next.js 15 enterprise SaaS portal.', client:'Kai Brooks', milestones:['Establish serverless context pipes','UI styling with clean glass effects','Verify streaming response speeds'] },
    { id:6, title:'Spatial UI Glassmorphic Styling', company:'VisionTech', pay:'$700 (0.0102 BTC)', tags:['Design','CSS'], applied:false, desc:'Style a glassmorphic dashboard with vibrant HSL colors, micro-animations, and dynamic mobile-first media queries.', client:'Mia Thompson', milestones:['Configure CSS HSL color tokens','Develop active scale animations','Validate cross-browser media rendering'] },
    { id:7, title:'Rust Engine WebAssembly Porting', company:'WasmSoft', pay:'$1,500 (0.0219 BTC)', tags:['Code','Rust'], applied:false, desc:'Compile a high-performance graphic rendering library written in Rust to WebAssembly to run inside standard web browsers.', client:'Sarah Chen', milestones:['Refactor Rust calculations loops','Compile target WebAssembly package','Benchmark browser frame latency rates'] },
    { id:8, title:'Bio-informatics Data Synthesizer', company:'BioGrid', pay:'$1,100 (0.0160 BTC)', tags:['Science','Python'], applied:false, desc:'Write a Python script to parse FASTA biological files, extract protein sequences, and compute evolutionary conservation scores.', client:'Tyler Ross', milestones:['Program genomic parsing regex patterns','Synthesize relative conservation weights','Format output JSON for UI visualizers'] }
  ],
  // All 50+ categories listed cleanly
  allCategories: [
    { id:'science', emoji:'🔬', name:'Science' },
    { id:'politics', emoji:'📰', name:'Politics & News' },
    { id:'crypto', emoji:'🪙', name:'Crypto & DeFi' },
    { id:'gaming', emoji:'🎮', name:'Gaming' },
    { id:'music', emoji:'🎵', name:'Music & Audio' },
    { id:'tech', emoji:'💻', name:'Tech & AI' },
    { id:'wildlife', emoji:'🦌', name:'Wildlife & Nature' },
    { id:'local', emoji:'📍', name:'Local Civic' },
    { id:'home', emoji:'🏠', name:'Home Dashboard' },
    { id:'trending', emoji:'🔥', name:'Trending Now' },
    { id:'news', emoji:'📢', name:'Breaking News' },
    { id:'ent', emoji:'🍿', name:'Entertainment' },
    { id:'space', emoji:'🚀', name:'Space Exploration' },
    { id:'nature', emoji:'🌳', name:'Nature Conservation' },
    { id:'env', emoji:'🌱', name:'Environment' },
    { id:'climate', emoji:'🌦️', name:'Climate Action' },
    { id:'world', emoji:'🌍', name:'World Affairs' },
    { id:'blockchain', emoji:'🔗', name:'Blockchain Tech' },
    { id:'finance', emoji:'📈', name:'Finance Markets' },
    { id:'stocks', emoji:'📊', name:'Stock Market' },
    { id:'business', emoji:'💼', name:'Business Strategy' },
    { id:'startups', emoji:'⚡', name:'Startups' },
    { id:'edu', emoji:'🎓', name:'Education Hub' },
    { id:'history', emoji:'📜', name:'History Lab' },
    { id:'sports', emoji:'⚽', name:'Sports Arena' },
    { id:'anime', emoji:'🎭', name:'Anime & Movies' },
    { id:'podcasts', emoji:'🎧', name:'Podcasts' },
    { id:'fashion', emoji:'👗', name:'Fashion & Style' },
    { id:'health', emoji:'💪', name:'Health & Wellness' },
    { id:'food', emoji:'🍕', name:'Food & Cooking' },
    { id:'travel', emoji:'✈️', name:'Travel & Vlog' },
    { id:'photo', emoji:'📸', name:'Photography' },
    { id:'cars', emoji:'🏎️', name:'Cars & Motor' },
    { id:'innovation', emoji:'💡', name:'Innovation Core' },
    { id:'coding', emoji:'🖥️', name:'Coding Space' },
    { id:'cyber', emoji:'🔒', name:'Cybersecurity' },
    { id:'robotics', emoji:'🤖', name:'Robotics' },
    { id:'psych', emoji:'🧠', name:'Psychology' },
    { id:'philosophy', emoji:'📖', name:'Philosophy' },
    { id:'culture', emoji:'🎪', name:'Culture Hub' },
    { id:'memes', emoji:'😂', name:'Memes' },
    { id:'social', emoji:'🤝', name:'Social Issues' },
    { id:'diy', emoji:'🔧', name:'DIY Crafts' },
    { id:'art', emoji:'🖼️', name:'Fine Art' },
    { id:'design', emoji:'🎨', name:'Design Studio' },
    { id:'architecture', emoji:'🏗️', name:'Architecture' },
    { id:'spirit', emoji:'🧘', name:'Spirituality' },
    { id:'motivation', emoji:'⭐', name:'Motivation' },
    { id:'career', emoji:'🎯', name:'Career Builder' },
    { id:'freelance', emoji:'💎', name:'Freelance Hub' },
    { id:'emergency', emoji:'🚨', name:'Emergency Alerts' }
  ],

  // ── Web3 Crypto Hub Data ──
  wallet: {
    address: '0x8A9F...2C11',
    balances: {
      USDT: 50000.00,
      BTC: 1.25,
      ETH: 14.50,
      SOL: 250.00,
      NEON: 14500.50,
      DOGE: 42000.00,
      TREND: 10000.00
    }
  },
  cryptoPosts: [
    { id: 'cp1', author: 'Crypto Whale', handle: '@whaletrades', avatar: '🐳', time: '10m ago', content: 'Just moved 1500 ETH to cold storage. Not trusting these centralized exchanges after the latest news. Not your keys, not your coins.', likes: 3200, comments: 450, tags: ['ETH', 'ColdStorage', 'Security'] },
    { id: 'cp2', author: 'DeFi Degen', handle: '@yieldfarmer', avatar: '🚜', time: '1h ago', content: 'The APY on the new SOL liquidity pools is insane right now. I just farmed 45% APY over the weekend. Don\'t sleep on this!', likes: 1850, comments: 210, tags: ['SOL', 'DeFi', 'YieldFarming'] },
    { id: 'cp3', author: 'Blockchain Builder', handle: '@dev_block', avatar: '💻', time: '3h ago', content: 'Building smart contracts on Ethereum is getting so much easier with the new Solidity updates. Just deployed a testnet oracle in 5 minutes.', likes: 890, comments: 120, tags: ['Ethereum', 'Web3', 'Solidity'] },
    { id: 'cp4', author: 'Satoshi Fan', handle: '@btc_maxi', avatar: '⚡', time: '5h ago', content: 'Bitcoin dominance is climbing again. The halving supply shock is real. Stack sats and stay humble.', likes: 5400, comments: 890, tags: ['Bitcoin', 'BTC', 'Halving'] }
  ]
};

/* ── Social wallet persistence ─────────────────────────────────────────
   DATA.wallet.balances is the social wallet: tips come out of it, creator
   rewards and subscriptions settle through it, and Trade's Deposit /
   Withdraw move USDT between it and the trading account.

   It used to be rebuilt from the seed above on every load and never
   written back. So a tip was quietly refunded on reload — and because the
   trading account IS saved, a Deposit left the money in both places
   (and a Withdraw lost it from both).

   Several modules write to it directly, so rather than touching each one
   the balances object is wrapped: restored from storage here, and saved
   on every write, whoever makes it. */
(function persistSocialWallet() {
  const KEY = 'ts_social_wallet';
  if (!DATA.wallet || !DATA.wallet.balances) return;
  const raw = DATA.wallet.balances;

  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (saved && typeof saved === 'object') {
      Object.keys(saved).forEach(k => {
        const v = Number(saved[k]);
        if (isFinite(v) && v >= 0) raw[k] = v;
      });
    }
  } catch (e) { /* corrupt entry — fall back to the seed */ }

  const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(raw)); } catch (e) {} };

  DATA.wallet.balances = new Proxy(raw, {
    set(target, key, value) { target[key] = value; persist(); return true; },
    deleteProperty(target, key) { delete target[key]; persist(); return true; }
  });
})();

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
publish('data/mockDb.js', {
  DATA: () => DATA
});
