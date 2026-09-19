// ── DATA ─────────────────────────────────────────────────────────
/* Strict mode, ahead of this file becoming an ES module - modules are
   always strict, and doing it here first means any breakage shows up
   on its own rather than mixed into the module conversion. */
'use strict';

const DATA = {
  agriFeeds: [
    { id:1, author:'Rajesh Singh', role:'Progressive Farmer', handle:'@rajesh_farms', body:'Just completed harvesting my new hybrid wheat variety. The yield is looking 20% higher than last year despite the erratic rains!', likes:120, comments:14, category:'Wheat' },
    { id:2, author:'Dr. Sharma', role:'KVK Scientist', handle:'@kvk_sharma', body:'Alert for paddy farmers: High humidity expected next week. Preventive spray for sheath blight is highly recommended.', likes:89, comments:22, category:'Paddy' }
  ],
  agriVideos: [
    { id:1, title:'Advanced Drip Irrigation Setup', channel:'AgriTech India', views:'14K', duration:'12:40', thumb_color:'#FFC107', icon:'💧', category:'Irrigation', type:'Video' },
    { id:2, title:'Organic Pest Control for Tomatoes', channel:'Green Folds', views:'8K', duration:'08:15', thumb_color:'#4CAF50', icon:'🐛', category:'Pests', type:'Video' }
  ],
  agriProducts: [
    { id:1, name:'Premium Neem Oil (Cold Pressed)', seller:'BioSafe Solutions', desc:'100% organic pest repellent for all vegetable crops.', rating:4.8, reviews:120, price:'$12.99', badge:'Top Rated', icon:'🌿', category:'Organic' },
    { id:2, name:'Smart Moisture Sensor IoT', seller:'FarmTech', desc:'Real-time soil moisture monitoring connected to your phone.', rating:4.5, reviews:45, price:'$49.99', badge:'Bestseller', icon:'📱', category:'Tech' }
  ],
  designIndustries: [
    { id: 'canvas', name: 'Free Canvas', icon: 'brush', desc: 'Freeform drawing studio with neon brushes, layers, and export.' },
    { id: 'agriculture', name: 'Agriculture', icon: '\uD83D\uDD25' },
    { id: 'realestate', name: 'Real Estate & Arch', icon: '\uD83D\uDD25' },
    { id: 'fashion', name: 'Fashion Design', icon: '\uD83D\uDD25' },
    { id: 'templates', name: 'Global Templates', icon: '\uD83D\uDD25' },
    { id: 'graphic', name: 'Graphic Media', icon: '\uD83D\uDD25' },
    { id: 'video', name: 'Video & Motion', icon: '\uD83D\uDD25' },
    { id: 'uiux', name: 'UI/UX Design', icon: '\uD83D\uDD25' },
    { id: 'engineering', name: 'Engineering', icon: '\uD83D\uDD25' },
    { id: 'gaming', name: 'Game Creator', icon: '\uD83D\uDD25' },
    { id: 'space', name: 'Space & Science', icon: '\uD83D\uDD25' }
  ],
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

  reels: [
    { emoji:'\u2728', creator:'@beatmaker_96', desc:'This beat dropped different 🔥', likes:'24.5K', views:'890K', bg:'hsl(260,50%,20%)' },
    { emoji:'\u2728', creator:'@fitguru',      desc:'5-min morning routine that changed my life', likes:'18.2K', views:'540K', bg:'hsl(155,45%,16%)' },
    { emoji:'\u2728', creator:'@cheflife',     desc:'Secret ingredient that makes everything better', likes:'31.7K', views:'1.2M', bg:'hsl(38,60%,18%)' },
    { emoji:'\u2728', creator:'@codevibes',    desc:'This one CSS trick blew my mind 🤯', likes:'15.9K', views:'420K', bg:'hsl(213,55%,18%)' },
    { emoji:'\u2728', creator:'@wanderlust',   desc:'Hidden gem in Bali nobody talks about', likes:'44.1K', views:'2.1M', bg:'hsl(28,55%,18%)' },
    { emoji:'\u2728', creator:'@artbymia',     desc:'Speed painting a galaxy in 60 seconds', likes:'29.3K', views:'780K', bg:'hsl(330,45%,18%)' },
    { emoji:'\u2728', creator:'@petparent',    desc:'Teaching my dog to do this took 2 weeks', likes:'87.4K', views:'4.5M', bg:'hsl(38,50%,16%)' },
    { emoji:'\u2728', creator:'@zenmind',      desc:'10-second breathing reset for anxiety', likes:'52.6K', views:'3.2M', bg:'hsl(155,40%,14%)' },
  ],
  fvProducts: [
    { id:'fv1', emoji:'\u2728', name:'CyberPunk Neo Jacket', brand:'CyberPunk', price:189.99, arEnabled:true, rating:'★★★★★', badge:'HOT', bg:'hsl(330,45%,18%)' },
    { id:'fv2', emoji:'\u2728', name:'AirMax 2040 Infinity', brand:'Nike', price:220.00, arEnabled:true, rating:'★★★★☆', badge:'NEW', bg:'hsl(213,55%,18%)' },
    { id:'fv3', emoji:'\u2728', name:'Gucci Glace AR Shades', brand:'Gucci', price:350.00, arEnabled:true, rating:'★★★★★', badge:'SALE', bg:'hsl(155,45%,16%)' },
    { id:'fv4', emoji:'\u2728', name:'Balenciaga Void Tote', brand:'Balenciaga', price:950.00, arEnabled:false, rating:'★★★★☆', badge:'TRENDING', bg:'hsl(260,45%,18%)' },
    { id:'fv5', emoji:'\u2728', name:'Supreme Neural Cap', brand:'Supreme', price:75.00, arEnabled:true, rating:'★★★★★', badge:'HOT', bg:'hsl(38,60%,18%)' },
    { id:'fv6', emoji:'\u2728', name:'TechWear Stealth Coat', brand:'CyberPunk', price:210.00, arEnabled:true, rating:'★★★★☆', badge:'NEW', bg:'hsl(28,50%,18%)' }
  ],
  fvBrands: ['All', 'Nike', 'Gucci', 'Balenciaga', 'Supreme', 'CyberPunk'],
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
  workouts: {
    chest:    [{ n:'Bench Press',         s:'4 sets × 10 reps' }, { n:'Incline DB Press',    s:'3 sets × 12 reps' }, { n:'Cable Fly',           s:'3 sets × 15 reps' }, { n:'Chest Dips',         s:'3 sets × failure' }],
    back:     [{ n:'Pull-Ups',            s:'4 sets × 8 reps'  }, { n:'Barbell Row',         s:'4 sets × 10 reps' }, { n:'Lat Pulldown',        s:'3 sets × 12 reps' }, { n:'Face Pull',          s:'3 sets × 15 reps' }],
    shoulders:[{ n:'Overhead Press',      s:'4 sets × 8 reps'  }, { n:'Lateral Raises',      s:'4 sets × 15 reps' }, { n:'Front Raises',        s:'3 sets × 12 reps' }, { n:'Rear Delt Fly',      s:'3 sets × 15 reps' }],
    arms:     [{ n:'Barbell Curl',        s:'4 sets × 10 reps' }, { n:'Tricep Pushdown',     s:'4 sets × 12 reps' }, { n:'Hammer Curl',         s:'3 sets × 12 reps' }, { n:'Skull Crushers',     s:'3 sets × 10 reps' }],
    legs:     [{ n:'Back Squat',          s:'4 sets × 8 reps'  }, { n:'Romanian Deadlift',   s:'4 sets × 10 reps' }, { n:'Leg Press',           s:'3 sets × 15 reps' }, { n:'Walking Lunges',     s:'3 sets × 12 reps' }],
    core:     [{ n:'Plank',              s:'4 sets × 60 sec'  }, { n:'Cable Crunch',        s:'4 sets × 15 reps' }, { n:'Leg Raises',          s:'3 sets × 15 reps' }, { n:'Russian Twists',     s:'3 sets × 20 reps' }],
    glutes:   [{ n:'Hip Thrust',          s:'4 sets × 12 reps' }, { n:'Sumo Deadlift',       s:'4 sets × 10 reps' }, { n:'Glute Kickback',      s:'3 sets × 15 reps' }, { n:'Step-Ups',           s:'3 sets × 12 reps' }],
    full:     [{ n:'Deadlift',            s:'4 sets × 5 reps'  }, { n:'Push-Ups',            s:'4 sets × 20 reps' }, { n:'Pull-Ups',            s:'3 sets × failure' }, { n:'Goblet Squat',       s:'3 sets × 15 reps' }],
  },
  muscles: [
    { id:'chest',    emoji:'\u2728', label:'Chest'    },
    { id:'back',     emoji:'\u2728', label:'Back'     },
    { id:'shoulders',emoji:'\u2728', label:'Shoulders'},
    { id:'arms',     emoji:'\u2728', label:'Arms'     },
    { id:'legs',     emoji:'\u2728', label:'Legs'     },
    { id:'core',     emoji:'\u2728', label:'Core'     },
    { id:'glutes',   emoji:'\u2728', label:'Glutes'   },
    { id:'full',     emoji:'\u2728', label:'Full Body' },
  ],
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
  skillTree: [
    [{ e:'⭐', l:'Beginner', s:'unlocked'  }, { e:'📖', l:'Learner', s:'unlocked'  }],
    [{ e:'💡', l:'Thinker',  s:'unlocked'  }, { e:'🔧', l:'Builder', s:'unlocked'  }, { e:'🎨', l:'Creator', s:'active'    }],
    [{ e:'🚀', l:'Launcher', s:'locked'    }, { e:'💎', l:'Expert',  s:'locked'    }],
    [{ e:'👑', l:'Master',   s:'locked'    }],
  ],
  groups: [
    { icon:'\uD83D\uDD25', iconColor:'var(--blue)', name:'TechBuilders Hub',    desc:'Developers sharing what they\'re building',  members:'12.4K', joined:true  },
    { icon:'\uD83D\uDD25', iconColor:'var(--pink)', name:'Design Collective',   desc:'UI/UX designers critiquing & inspiring',    members:'8.7K',  joined:false },
    { icon:'\uD83D\uDD25', iconColor:'var(--green)', name:'Fitness Warriors',    desc:'Daily workout challenges & nutrition tips',  members:'23.1K', joined:true  },
    { icon:'\uD83D\uDD25', iconColor:'var(--purple)', name:'Startup Founders',    desc:'Early-stage founders sharing lessons',       members:'5.2K',  joined:false },
    { icon:'\uD83D\uDD25', iconColor:'var(--orange)', name:'Gamers United',       desc:'Gaming, esports, and streaming community',  members:'31.7K', joined:false },
    { icon:'\uD83D\uDD25', iconColor:'var(--green)', name:'Crypto & DeFi',       desc:'Blockchain, Web3 and financial freedom',    members:'18.9K', joined:false },
  ],
  leaderboard: [
    { name:'Zara Ahmed',  score:'98,420 XP', emoji:'\u2728' },
    { name:'Marcus Webb', score:'87,135 XP', emoji:'\u2728'   },
    { name:'Dev Kumar',   score:'76,890 XP', emoji:'\u2728' },
    { name:'Alex Vance',  score:'68,420 XP', emoji:'\u2728'   },
    { name:'Luna Park',   score:'61,205 XP', emoji:'\u2728'   },
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
  streams: [
    { emoji:'\u2728', name:'ProGamer_X — Ranked Matches',  viewers:'12.4K', live:true  },
    { emoji:'\u2728', name:'BeatLab — Live Production',    viewers:'3.8K',  live:true  },
    { emoji:'\u2728', name:'CodeWithMe — Building SaaS',   viewers:'2.1K',  live:true  },
    { emoji:'\u2728', name:'PixelArtistry — Asset Design', viewers:'1.5K',  live:true  },
    { emoji:'\u2728', name:'FinScope — Market Analysis',    viewers:'5.6K',  live:true  }
  ],
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

  // ── FashionVerse Products ──
  fvBrands: ['All', 'RTFKT-X', 'GlitchWear', 'Overworld', 'NeonThread', 'AuraLabs', 'CyberKicks'],
  fvProducts: [
    { id:'fv1', name:'Neo-Tokyo Kickz v2', brand:'RTFKT-X', price:89.99, emoji:'\u2728', rating:'\u2B50 4.9 (2.1K)', bg:'linear-gradient(135deg, #1a1a2e, #16213e)', badge:'HOT', arEnabled:true },
    { id:'fv2', name:'Cyberpunk Exo-Shell', brand:'GlitchWear', price:0, emoji:'\u2728', rating:'\u2B50 4.7 (890)', bg:'linear-gradient(135deg, #0f0c29, #302b63)', badge:'FREE DROP', arEnabled:true },
    { id:'fv3', name:'Aura Halo V1 Headset', brand:'Overworld', price:149.99, emoji:'\u2728', rating:'\u2B50 4.8 (1.4K)', bg:'linear-gradient(135deg, #1f1c2c, #928dab)', badge:'+300 XP', arEnabled:true },
    { id:'fv4', name:'Neon Pulse Jacket', brand:'NeonThread', price:59.99, emoji:'\u2728', rating:'\u2B50 4.6 (670)', bg:'linear-gradient(135deg, #0d0d0d, #1a1a2e)', badge:'LIMITED', arEnabled:false },
    { id:'fv5', name:'Quantum Stride Boots', brand:'CyberKicks', price:119.99, emoji:'\u2728', rating:'\u2B50 4.9 (3.2K)', bg:'linear-gradient(135deg, #16213e, #0f3460)', badge:'TRENDING', arEnabled:true },
    { id:'fv6', name:'Holographic Visor MK3', brand:'AuraLabs', price:79.99, emoji:'\u2728', rating:'\u2B50 4.5 (445)', bg:'linear-gradient(135deg, #1a1a2e, #e94560)', badge:null, arEnabled:true },
    { id:'fv7', name:'Digital Armor Vest', brand:'GlitchWear', price:199.99, emoji:'\u2728', rating:'\u2B50 4.8 (1.8K)', bg:'linear-gradient(135deg, #2d1b69, #1a1a2e)', badge:'EXCLUSIVE', arEnabled:true },
    { id:'fv8', name:'Synthwave Runner 4.0', brand:'RTFKT-X', price:134.99, emoji:'\u2728', rating:'\u2B50 4.7 (920)', bg:'linear-gradient(135deg, #0f0e17, #1e1f3b)', badge:'+150 XP', arEnabled:false },
    { id:'fv9', name:'AuraGlove Pro', brand:'AuraLabs', price:44.99, emoji:'\u2728', rating:'\u2B50 4.4 (310)', bg:'linear-gradient(135deg, #141e30, #243b55)', badge:null, arEnabled:false },
    { id:'fv10', name:'Prism Street Hoodie', brand:'NeonThread', price:69.99, emoji:'\u2728', rating:'\u2B50 4.6 (520)', bg:'linear-gradient(135deg, #0c0c0c, #2e2e3a)', badge:'NEW', arEnabled:true },
    { id:'fv11', name:'Chrome Walker Sneaks', brand:'CyberKicks', price:94.99, emoji:'\u2728', rating:'\u2B50 4.8 (1.1K)', bg:'linear-gradient(135deg, #111, #333)', badge:null, arEnabled:true },
    { id:'fv12', name:'MetaFrame Shades', brand:'Overworld', price:54.99, emoji:'\u2728', rating:'\u2B50 4.3 (290)', bg:'linear-gradient(135deg, #1f1c2c, #2a2a4a)', badge:'REBEL', arEnabled:false }
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
  cryptoMarkets: [
    { pair: 'BTC/USDT', name: 'Bitcoin', price: 68450.20, change: '+2.4%', up: true, vol: '1.2B' },
    { pair: 'ETH/USDT', name: 'Ethereum', price: 3840.15, change: '+4.1%', up: true, vol: '850M' },
    { pair: 'SOL/USDT', name: 'Solana', price: 145.80, change: '-1.2%', up: false, vol: '320M' },
    { pair: 'NEON/USDT', name: 'Neon Protocol', price: 2.45, change: '+12.5%', up: true, vol: '45M' },
    { pair: 'XRP/USDT', name: 'Ripple', price: 0.58, change: '+0.4%', up: true, vol: '120M' },
    { pair: 'ADA/USDT', name: 'Cardano', price: 0.45, change: '-0.8%', up: false, vol: '95M' },
    { pair: 'DOGE/USDT', name: 'Dogecoin', price: 0.14, change: '+5.2%', up: true, vol: '210M' }
  ],
  rwaAssets: [
    { id: 'rwa1', name: 'Manhattan Penthouse Fraction', location: 'New York, USA', apy: '8.5%', price: 500, emoji: '🏢', bg: 'linear-gradient(135deg, #1f1c2c, #928dab)' },
    { id: 'rwa2', name: 'Vintage Rolex Daytona', location: 'Vault A, Geneva', apy: '4.2%', price: 1200, emoji: '⌚', bg: 'linear-gradient(135deg, #0f0c29, #302b63)' },
    { id: 'rwa3', name: 'Solar Farm Yield Share', location: 'Nevada, USA', apy: '12.4%', price: 250, emoji: '☀️', bg: 'linear-gradient(135deg, #1a1a2e, #16213e)' },
    { id: 'rwa4', name: 'Blue-Chip Fine Art', location: 'Louvre Vault', apy: '6.1%', price: 800, emoji: '🎨', bg: 'linear-gradient(135deg, #2d1b69, #1a1a2e)' }
  ],
  communityFeed: [
    { type: 'transfer', from: '0x5F8E...D24B', to: '0x1F2B...A9C4', amount: 250, coin: 'NEON', timestamp: '2 mins ago' },
    { type: 'post', user: 'Marcus Webb', handle: '@marcusw', content: 'Just fractionalized my first piece of digital real estate. Web3 is the future! 🚀', timestamp: '15 mins ago' },
    { type: 'transfer', from: '0x7A9B...C35E', to: '0x2D5A...B16F', amount: 1000, coin: 'USDT', timestamp: '1 hour ago' },
    { type: 'post', user: 'Zara Ahmed', handle: '@zaraa', content: 'Who is buying the dip on BTC right now?', timestamp: '3 hours ago' }
  ],

  // ── Global Fashion Hub Data ──
  fashionEvents: [
    { id: 'ev1', title: 'Milan Digital Fashion Week', status: 'LIVE', viewers: '14.2K', bg: 'linear-gradient(135deg, #FF0055, #20002c)' },
    { id: 'ev2', title: 'RTFKT Sneaker Drop VR', status: 'UPCOMING', time: 'Tomorrow, 8PM', bg: 'linear-gradient(135deg, #00C9FF, #92FE9D)' },
    { id: 'ev3', title: 'Gucci Meta-Gala 2026', status: 'UPCOMING', time: 'Friday, 10PM', bg: 'linear-gradient(135deg, #fceabb, #f8b500)' }
  ],
  fashionFeed: [
    { user: 'Luna Park', handle: '@lunap', type: 'image', content: 'Obsessed with this holographic trench coat I just generated in the AI Lab! 🧥✨', image: 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=500&q=80', timestamp: '5 mins ago', likes: 124 },
    { user: 'Tyler Ross', handle: '@tylerr', type: 'text', content: 'Anyone else attending the digital Milan runway tonight? The AR integrations are supposed to be insane.', timestamp: '12 mins ago', likes: 45 },
    { user: 'Sarah Chen', handle: '@sarahc', type: 'image', content: 'Cyberpunk streetwear concept sketch. Dropping this collection next month!', image: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=500&q=80', timestamp: '1 hour ago', likes: 890 }
  ],
  
  // ── Fitness Hub Data ──
  fitnessPosts: [
    { id: 'fp1', author: 'Marcus Webb', handle: '@marcus_lifts', avatar: '💪', role: 'Powerlifter', time: '1h ago', content: 'Just hit a new PR on the deadlift! 500lbs moving smooth. Consistency and sleep are the real cheat codes.', category: 'PR', likes: 4210, comments: 342, tags: ['Deadlift', 'Powerlifting', 'PR'] },
    { id: 'fp2', author: 'Sarah Chen', handle: '@sarah_runs', avatar: '🏃‍♀️', role: 'Marathoner', time: '3h ago', content: 'Completed my 18-mile long run today. The humidity was brutal but pacing was solid. Fueling strategy: 1 gel every 45 mins worked perfectly!', category: 'Running', likes: 2150, comments: 180, tags: ['Running', 'MarathonTraining', 'Endurance'] },
    { id: 'fp3', author: 'Alex Fitness', handle: '@alex_fit', avatar: '🧘', role: 'Yoga Coach', time: '5h ago', content: 'Mobility is just as important as strength. If you cannot touch your toes, you are missing out on vital functional health. Try this 5-min flow tonight.', category: 'Mobility', likes: 8920, comments: 840, tags: ['Yoga', 'Mobility', 'Recovery'] },
    { id: 'fp4', author: 'Nutrition Lab', handle: '@nutrilab', avatar: '🥑', role: 'Dietitian', time: '8h ago', content: 'Stop overcomplicating protein. 1.6g to 2.2g per kg of bodyweight. Space it out in 3-4 meals. That is 90% of the game.', category: 'Nutrition', likes: 12400, comments: 1200, tags: ['Nutrition', 'Protein', 'Science'] }
  ],
  fitnessVideos: [
    { id: 'fv1', title: '10-Min Core Crusher (No Equipment)', channel: 'Fit Flow', views: '1.2M', duration: '10:05', thumb_color: '#E91E63', icon: '🔥', category: 'Workout', type: 'Video' },
    { id: 'fv2', title: '🔴 LIVE: Morning HIIT Session', channel: 'HIIT Squad', views: '2.4K watching', duration: 'LIVE', thumb_color: '#F44336', icon: '⚡', category: 'Live', type: 'Live' },
    { id: 'fv3', title: 'Fix Your Squat Form in 60s', channel: 'Squat U', views: '3.4M', duration: '0:58', thumb_color: '#3F51B5', icon: '🦵', category: 'Tutorial', type: 'Short' },
    { id: 'fv4', title: 'High Protein Meal Prep (Under $20)', channel: 'Kitchen Gains', views: '890K', duration: '14:20', thumb_color: '#4CAF50', icon: '🥗', category: 'Nutrition', type: 'Video' }
  ],
  
  // ── Crypto Hub Data ──
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
import { publish } from '../globals.js?v=2';
publish('data/mockDb.js', {
  DATA: () => DATA
});
