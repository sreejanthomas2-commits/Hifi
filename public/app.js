/* ╔══════════════════════════════════════════════════════════╗
   ║  TRENDING — app.js  Complete Digital Ecosystem v4.0     ║
   ╚══════════════════════════════════════════════════════════╝ */

'use strict';

// ── STATE ────────────────────────────────────────────────────────
const S = {
  pane:  'feeds',
  theme: 'dark',
  user:  { fname:'Guest', lname:'User', handle:'Sign In', email:'guest@trending.app', bio:'Welcome to Trending! Connect your wallet or sign in to edit your profile and start creating.', level:1, xp:0 },
  cart:  [],
  macros: { water:0, protein:0, cal:0 },
  selectedMuscle: 'chest',
  gameRunning: false,
  gamePaused: false,
  aiOpen: false,
  voiceEnabled: typeof window !== 'undefined' && 'speechSynthesis' in window,
  listening: false,
  ekgInterval: null,
  gameAnimId: null,
  voiceModel: typeof localStorage !== 'undefined' ? localStorage.getItem('ts_voice_model') || 'female-premium' : 'female-premium',
  voiceSpeed: 1.05,
  
  // NEW ECOSYSTEM STATE
  feedMode: 'entertainment', // focus, study, chill, motivation, news, wellness, productivity
  dualFeed: 'entertainment', // growth
  selectedCategory: 'all',
  searchTab: 'all',
  activeCreatorTab: 'composer',
  activeLearnTab: 'courses',
  disappearingMessages: false,
  activeChatFilter: 'all', // all, groups, channels, bots
  civicReports: [
    { id: 1, type: 'Road Damage', text: 'Huge pothole on 5th avenue blocking traffic.', location: '5th Ave & Pine St', status: 'Tracked', authority: '@CityTransit' },
    { id: 2, type: 'Lost Pet', text: 'Golden retriever lost since yesterday. Wearing a collar.', location: 'North Oak Park', status: 'Resolved ✅', authority: '@AnimalCare' }
  ],
  focusTimer: null,
  focusTimeRemaining: 25 * 60,
  focusActive: false,
  cryptoAnimId: null,
  wildlifeAnimId: null,
  labChemicals: [],
  eli15Active: false,
  activeMusicPlaying: false
};

// ── DATA ─────────────────────────────────────────────────────────
const DATA = {
  designIndustries: [
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
    { name:'Sarah Chen',    handle:'@sarahc',    emoji:'\u2728', online:true  },
    { name:'Marcus Webb',   handle:'@marcusw',   emoji:'\u2728', online:false },
    { name:'Zara Ahmed',    handle:'@zaraa',     emoji:'\u2728', online:true  },
    { name:'Tyler Ross',    handle:'@tylerr',    emoji:'\u2728', online:true  },
    { name:'Mia Thompson',  handle:'@miat',      emoji:'\u2728', online:false },
    { name:'Dev Kumar',     handle:'@devk',      emoji:'\u2728', online:true  },
    { name:'Luna Park',     handle:'@lunap',     emoji:'\u2728', online:false },
    { name:'Kai Brooks',    handle:'@kaib',      emoji:'\u2728', online:true  },
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
    { id:4, author:'Dev Kumar', handle:'@devk', emoji:'\u2728', time:'1h ago', body:'AI tools I actually use daily:\n\n1. ChatGPT for brainstorming\n2. Midjourney for visuals\n3. Buddy for content insights\n4. GitHub Copilot for coding\n\nWhat\'s in your stack?', tags:['#ai','#tools','#productivity'], likes:876, comments:143, shares:267, liked:false, type:'text', category:'tech' },
    { id:5, author:'Luna Park', handle:'@lunap', emoji:'\u2728', time:'2h ago', body:'Design tip: White space is not empty space. It\'s breathing room for your content. Less clutter = more impact.', emoji_block:'\u2728\u2728\u2728', tags:['#design','#ux','#designtips'], likes:2341, comments:89, shares:567, liked:false, type:'emoji', category:'design' },
    { id:6, author:'Kai Brooks', handle:'@kaib', emoji:'\u2728', time:'3h ago', body:'Just broke my personal record on the 100m dash! Training hard every single day is paying off. Never stop pushing your limits.', tags:['#sports','#athletics','#grind'], likes:445, comments:56, shares:23, liked:false, type:'text', category:'sports' },
  ],

  topics: [
    { emoji:'🤖', name:'Artificial Intelligence', count:'2.4M posts', cat:'tech' },
    { emoji:'💪', name:'Fitness & Wellness', count:'1.8M posts', cat:'health' },
    { emoji:'🎨', name:'Design & Art', count:'1.5M posts', cat:'design' },
    { emoji:'💻', name:'Tech & Coding', count:'1.3M posts', cat:'tech' },
    { emoji:'🎮', name:'Gaming', count:'1.1M posts', cat:'gaming' },
    { emoji:'✈️', name:'Travel & Culture', count:'980K posts', cat:'travel' },
    { emoji:'🎵', name:'Music & Audio', count:'870K posts', cat:'music' },
    { emoji:'📈', name:'Finance & Business', count:'760K posts', cat:'finance' },
    { emoji:'🍕', name:'Food & Lifestyle', count:'690K posts', cat:'food' },
    { emoji:'🚀', name:'Startups', count:'540K posts', cat:'startups' },
    { emoji:'🔬', name:'Quantum Computing', count:'520K posts', cat:'science' },
    { emoji:'🪙', name:'Bitcoin & Crypto', count:'1.9M posts', cat:'crypto' },
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
    { id:7, name:'Buddy', emoji:'\u2728', preview:'Intelligence that grows with you...', time:'just now', unread:0, online:true, type:'bots' }
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
    { id:1, title:'Figma Landing Page Design', company:'StartupHub', pay:'$450', tags:['Design','Figma'], applied:false, desc:'Design a high-converting, responsive glassmorphic landing page in Figma for a green-energy SaaS platform.', client:'Zara Ahmed', milestones:['Prototype wireframe layouts','High-fidelity HSL visual style design','Escrow release review'] },
    { id:2, title:'React Component Library Refactor', company:'TechCorp', pay:'$800', tags:['Code','React'], applied:false, desc:'Refactor legacy web app buttons, inputs, and modals to use modern React 19 server components and custom CSS variables.', client:'Marcus Webb', milestones:['State refactor and optimization','Modernizing inputs & select fields','React 19 testing and package assembly'] },
    { id:3, title:'Science Explainer Copywriting', company:'EduMedia', pay:'$300', tags:['Writing','Science'], applied:false, desc:'Write concise, educational scripts explaining quantum entanglement and fluid boundary velocity for a suite of 60-second learning reels.', client:'Luna Park', milestones:['Draft core quantum physics syllabus','Verify factual accuracy thresholds','Write final presentation script outlines'] },
    { id:4, title:'Solidity Token Smart Contract', company:'DeFi Labs', pay:'$1,200', tags:['Web3','Solidity'], applied:false, desc:'Develop and audit an ERC-20 token smart contract with custom minting rules and gas-optimized validation checks.', client:'Dev Kumar', milestones:['Write token minting rule algorithms','Run gas utilization tests','Complete local sandbox security audit'] },
    { id:5, title:'AI Chatbot Integration (Next.js)', company:'GeminiBuild', pay:'$950', tags:['Code','AI'], applied:false, desc:'Integrate a streaming AI assistant conversational panel into a Next.js 15 enterprise SaaS portal.', client:'Kai Brooks', milestones:['Establish serverless context pipes','UI styling with clean glass effects','Verify streaming response speeds'] },
    { id:6, title:'Spatial UI Glassmorphic Styling', company:'VisionTech', pay:'$700', tags:['Design','CSS'], applied:false, desc:'Style a glassmorphic dashboard with vibrant HSL colors, micro-animations, and dynamic mobile-first media queries.', client:'Mia Thompson', milestones:['Configure CSS HSL color tokens','Develop active scale animations','Validate cross-browser media rendering'] },
    { id:7, title:'Rust Engine WebAssembly Porting', company:'WasmSoft', pay:'$1,500', tags:['Code','Rust'], applied:false, desc:'Compile a high-performance graphic rendering library written in Rust to WebAssembly to run inside standard web browsers.', client:'Sarah Chen', milestones:['Refactor Rust calculations loops','Compile target WebAssembly package','Benchmark browser frame latency rates'] },
    { id:8, title:'Bio-informatics Data Synthesizer', company:'BioGrid', pay:'$1,100', tags:['Science','Python'], applied:false, desc:'Write a Python script to parse FASTA biological files, extract protein sequences, and compute evolutionary conservation scores.', client:'Tyler Ross', milestones:['Program genomic parsing regex patterns','Synthesize relative conservation weights','Format output JSON for UI visualizers'] }
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
  ]
};

// ── SAFE HELPER ──────────────────────────────────────────────────
function $id(id) { return document.getElementById(id); }
function escapeHTML(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/[&<>'"]/g, 
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag)
  );
}
function _safe(fn, label) { try { fn(); } catch(e) { console.warn('[TS]', label, e.message); } }

function get3DIconForEmoji(emoji) {
  const map = {
    // Categories & topics
    '🔬': { icon: 'science', color: 'var(--blue)' },
    '📰': { icon: 'newspaper', color: 'var(--purple)' },
    '🪙': { icon: 'toll', color: 'var(--orange)' },
    '🎮': { icon: 'sports_esports', color: 'var(--orange)' },
    '🎵': { icon: 'music_note', color: 'var(--pink)' },
    '💻': { icon: 'terminal', color: 'var(--blue)' },
    '🦌': { icon: 'pets', color: 'var(--green)' },
    '📍': { icon: 'location_on', color: 'var(--blue)' },
    '🏠': { icon: 'home', color: 'var(--blue)' },
    '🔥': { icon: 'local_fire_department', color: 'var(--orange)' },
    '📢': { icon: 'campaign', color: 'var(--pink)' },
    '🎭': { icon: 'theater_comedy', color: 'var(--purple)' },
    '🚀': { icon: 'rocket_launch', color: 'var(--purple)' },
    '🌳': { icon: 'park', color: 'var(--green)' },
    '🌱': { icon: 'eco', color: 'var(--green)' },
    '🌦️': { icon: 'partly_cloudy_day', color: 'var(--orange)' },
    '🌍': { icon: 'public', color: 'var(--blue)' },
    '🔗': { icon: 'link', color: 'var(--t2)' },
    '📈': { icon: 'trending_up', color: 'var(--green)' },
    '📊': { icon: 'bar_chart', color: 'var(--blue)' },
    '💼': { icon: 'work', color: 'var(--purple)' },
    '💡': { icon: 'lightbulb', color: 'var(--orange)' },
    '🎓': { icon: 'school', color: 'var(--purple)' },
    '📜': { icon: 'description', color: 'var(--purple)' },
    '⚽': { icon: 'sports_soccer', color: 'var(--green)' },
    '🍿': { icon: 'movie', color: 'var(--pink)' },
    '🧘': { icon: 'self_improvement', color: 'var(--green)' },
    '⚡': { icon: 'bolt', color: 'var(--orange)' },
    '🚨': { icon: 'emergency', color: 'var(--red)' },
    '📦': { icon: 'inventory_2', color: 'var(--pink)' },
    '🧬': { icon: 'biotech', color: 'var(--blue)' },
    '🛸': { icon: 'ufo', color: 'var(--blue)' },
    '🌾': { icon: 'agriculture', color: 'var(--green)' },
    '🚲': { icon: 'pedal_bike', color: 'var(--orange)' },

    // New category & topic icons
    '🤖': { icon: 'smart_toy', color: 'var(--blue)' },
    '🎨': { icon: 'palette', color: 'var(--pink)' },
    '✈️': { icon: 'flight', color: 'var(--blue)' },
    '🍕': { icon: 'restaurant', color: 'var(--orange)' },
    '📸': { icon: 'photo_camera', color: 'var(--purple)' },
    '🏎️': { icon: 'directions_car', color: 'var(--orange)' },
    '🔒': { icon: 'lock', color: 'var(--blue)' },
    '🧠': { icon: 'psychology', color: 'var(--purple)' },
    '😂': { icon: 'sentiment_very_satisfied', color: 'var(--orange)' },
    '👗': { icon: 'checkroom', color: 'var(--pink)' },
    '🤝': { icon: 'handshake', color: 'var(--green)' },
    '🎪': { icon: 'festival', color: 'var(--purple)' },
    '🖼️': { icon: 'image', color: 'var(--pink)' },
    '🏗️': { icon: 'construction', color: 'var(--orange)' },
    '🖥️': { icon: 'code', color: 'var(--blue)' },
    '🧗': { icon: 'hiking', color: 'var(--green)' },
    
    // Skill Tree & Course items
    '⭐': { icon: 'star', color: 'var(--orange)' },
    '📖': { icon: 'menu_book', color: 'var(--blue)' },
    '🔧': { icon: 'build', color: 'var(--t2)' },
    '💎': { icon: 'diamond', color: 'var(--blue)' },
    '👑': { icon: 'crown', color: 'var(--orange)' },
    '🏆': { icon: 'emoji_events', color: 'var(--orange)' },
    '🎯': { icon: 'track_changes', color: 'var(--pink)' },
    '🌟': { icon: 'auto_awesome', color: 'var(--orange)' },
    '💪': { icon: 'fitness_center', color: 'var(--green)' },
    
    // Muscles (Fitness Group)
    '🏋️‍♂️': { icon: 'fitness_center', color: 'var(--purple)' },
    '🏋️': { icon: 'fitness_center', color: 'var(--purple)' },
    '🏃': { icon: 'directions_run', color: 'var(--orange)' },
    '🍑': { icon: 'favorite', color: 'var(--pink)' },

    // Stories (Avatars)
    '✨': { icon: 'person', color: 'var(--blue)' },
    '👩': { icon: 'face_3', color: 'var(--pink)' },
    '👨': { icon: 'face', color: 'var(--blue)' },
    '👩‍💼': { icon: 'face_3', color: 'var(--purple)' },
    '🧑': { icon: 'face_4', color: 'var(--green)' },
    
    // Shop
    '🎧': { icon: 'headphones', color: 'var(--blue)' },
    '⌚': { icon: 'watch', color: 'var(--green)' },
    '📱': { icon: 'smartphone', color: 'var(--pink)' },
    '🎒': { icon: 'backpack', color: 'var(--blue)' }
  };
  return map[emoji] || { icon: 'auto_awesome', color: 'var(--blue)' };
}

// ── GLOBAL ENGINE AND LOCALIZER ─────────────────────────────────────
const TRANSLATIONS = {
  en: {
    feeds: "Home",
    explore: "Explore",
    reels: "Reels",
    shop: "Shop",
    fitness: "Fitness",
    gaming: "Gaming",
    learn: "Democracy Enclave",
    creator: "Creator Studio",
    messages: "Messages",
    community: "Community",
    profile: "Profile",
    composer_placeholder: "What's trending with you today?",
    search_placeholder: "Search Trending...",
    post_btn: "Post",
    publish_success: "Published successfully! ✨ Check your Home Feed."
  },
  hi: {
    feeds: "मुख्य",
    explore: "अन्वेषण",
    reels: "रील्स",
    shop: "दुकान",
    fitness: "फिटनेस",
    gaming: "गेमिंग",
    learn: "ज्ञान एवं गिग्स",
    creator: "एआई स्टूडियो",
    messages: "संदेश",
    community: "समुदाय",
    profile: "प्रोफ़ाइल",
    composer_placeholder: "आज आपके साथ क्या ट्रेंड कर रहा है?",
    search_placeholder: "ट्रेंडिंग पर खोजें...",
    post_btn: "पोस्ट",
    publish_success: "सफलतापूर्वक प्रकाशित हुआ! अपना होम फ़ीड देखें।"
  },
  es: {
    feeds: "Inicio",
    explore: "Explorar",
    reels: "Reels",
    shop: "Tienda",
    fitness: "Fitness",
    gaming: "Juegos",
    learn: "Aprender",
    creator: "Estudio AI",
    messages: "Mensajes",
    community: "Comunidad",
    profile: "Perfil",
    composer_placeholder: "¿Qué es tendencia contigo hoy?",
    search_placeholder: "Buscar en Trending...",
    post_btn: "Publicar",
    publish_success: "¡Publicado con éxito! Revisa tu feed de inicio."
  },
  ja: {
    feeds: "ホーム",
    explore: "探検",
    reels: "リール",
    shop: "ショップ",
    fitness: "フィットネス",
    gaming: "ゲーム",
    learn: "学習＆ギグ",
    creator: "AIスタジオ",
    messages: "メッセージ",
    community: "コミュニティ",
    profile: "プロフィール",
    composer_placeholder: "今日のあなたのトレンドは何ですか？",
    search_placeholder: "トレンドで検索...",
    post_btn: "投稿",
    publish_success: "正常に投稿されました！フィードを確認してください。"
  }
};

const MODE_CATEGORY_MAP = {
  entertainment: ['design', 'art', 'music', 'gaming', 'ent'],
  focus: ['tech', 'productivity', 'business', 'coding', 'innovation'],
  study: ['tech', 'science', 'education', 'blockchain', 'cyber', 'robotics'],
  chill: ['music', 'art', 'nature', 'travel', 'photo', 'philosophy'],
  motivation: ['motivation', 'career', 'sports', 'fitness'],
  news: ['politics', 'news', 'world', 'climate', 'emergency'],
  wellness: ['fitness', 'health', 'wellness', 'food'],
  productivity: ['productivity', 'career', 'business', 'startups', 'freelance']
};

const MODE_REEL_MAP = {
  entertainment: ['🎵', '🎨'],
  focus: ['💻'],
  study: ['💻'],
  chill: ['🌅', '🎨', '🐶'],
  motivation: ['💪'],
  news: ['💻'],
  wellness: ['🧘', '💪', '🍕'],
  productivity: ['💻']
};

const MODE_LEARN_MAP = {
  entertainment: ['Design'],
  focus: ['Code'],
  study: ['Science', 'Code'],
  chill: ['Design'],
  motivation: ['Business'],
  news: ['Science'],
  wellness: ['Science'],
  productivity: ['Code', 'Business']
};

const MODE_PEOPLE_MAP = {
  entertainment: ['Sarah Chen', 'Zara Ahmed'],
  focus: ['Dev Kumar', 'Sarah Chen'],
  study: ['Dev Kumar', 'Sarah Chen'],
  chill: ['Sarah Chen', 'Marcus Webb'],
  motivation: ['Marcus Webb', 'Dev Kumar'],
  news: ['Dev Kumar', 'Zara Ahmed'],
  wellness: ['Marcus Webb'],
  productivity: ['Dev Kumar', 'Sarah Chen']
};

function formatRelativeTime(val) {
  if (typeof val === 'string') return val;
  const diff = Date.now() - val;
  if (diff < 1000) return 'just now';
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function applyLanguage(lang) {
  S.lang = lang;
  localStorage.setItem('ts_lang', lang);
  
  const trans = TRANSLATIONS[lang] || TRANSLATIONS.en;
  
  // 1. Translate Sidebar Nav items
  const sidebarMapping = {
    'feeds': trans.feeds,
    'explore': trans.explore,
    'reels': trans.reels,
    'shop': trans.shop,
    'fitness': trans.fitness,
    'gaming': trans.gaming,
    'learn': trans.learn,
    'creator': trans.creator,
    'messages': trans.messages,
    'community': trans.community,
    'profile': trans.profile
  };
  
  Object.keys(sidebarMapping).forEach(paneKey => {
    const navItem = document.querySelector(`.nav-item[data-pane="${paneKey}"] .nav-label`);
    if (navItem) navItem.textContent = sidebarMapping[paneKey];
    const mNavItem = document.querySelector(`.m-nav-btn[data-pane="${paneKey}"] span:not(.material-symbols-rounded)`);
    if (mNavItem) mNavItem.textContent = sidebarMapping[paneKey];
  });
  
  // 2. Translate Pane Titles dynamically
  const paneTitles = {
    'feeds': lang === 'en' ? '<span>Home</span> Feed' : (lang === 'hi' ? '<span>मुख्य</span> फ़ीड' : (lang === 'es' ? '<span>Inicio</span> Feed' : '<span>ホーム</span>フィード')),
    'explore': lang === 'en' ? '<span>Explore</span> Universe' : (lang === 'hi' ? '<span>खोज</span> ब्रह्मांड' : (lang === 'es' ? '<span>Explorar</span> Universo' : '<span>探検</span>宇宙')),
    'reels': lang === 'en' ? '<span>Reels</span> & Shorts' : (lang === 'hi' ? '<span>रील्स</span> और शॉर्ट्स' : (lang === 'es' ? '<span>Reels</span> y Shorts' : '<span>リール</span>＆ショート')),
    'fitness': lang === 'en' ? '💪 <span>Fitness</span> Hub' : (lang === 'hi' ? '💪 <span>फिटनेस</span> हब' : (lang === 'es' ? '💪 <span>Fitness</span> Centro' : '💪 <span>フィットネス</span>ハブ')),
    'gaming': lang === 'en' ? '🎮 <span>Game</span> Hub' : (lang === 'hi' ? '🎮 <span>गेम</span> हब' : (lang === 'es' ? '🎮 <span>Juegos</span> Centro' : '🎮 <span>ゲーム</span>ハブ')),
    'learn': lang === 'en' ? '🎓 <span>Democracy</span> Enclave' : (lang === 'hi' ? '🎓 <span>लोकतंत्र</span> एन्क्लेव' : (lang === 'es' ? '🎓 <span>Democracia</span> Enclave' : '🎓 <span>民主</span>飞地')),
    'creator': lang === 'en' ? '✨ <span>Creator</span> Studio' : (lang === 'hi' ? '✨ <span>क्रिएटर</span> स्टूडियो' : (lang === 'es' ? '✨ <span>Creador</span> Estudio' : '✨ <span>クリエイター</span>スタジオ')),
    'community': lang === 'en' ? '🌐 <span>Community</span>' : (lang === 'hi' ? '🌐 <span>समुदाय</span>' : (lang === 'es' ? '🌐 <span>Comunidad</span>' : '🌐 <span>コミュニティ</span>'))
  };
  
  Object.keys(paneTitles).forEach(paneKey => {
    const titleEl = document.querySelector(`#pane-${paneKey} .pane-title`);
    if (titleEl) titleEl.innerHTML = paneTitles[paneKey];
  });
  
  // Translate shop hero title
  const shopHeroTitle = document.querySelector('.shop-hero-title');
  if (shopHeroTitle) shopHeroTitle.innerHTML = `🛒 ${trans.shop}`;
  
  // 3. Translate Search Bar Placeholders
  const searchInput = $id('global-search');
  if (searchInput) searchInput.placeholder = trans.search_placeholder;
  const exploreSearch = $id('explore-search');
  if (exploreSearch) exploreSearch.placeholder = trans.search_placeholder;
  
  // 4. Translate Post Composer Placeholders & Buttons
  const postInp = $id('post-input');
  if (postInp) postInp.placeholder = trans.composer_placeholder;
  const postBtn = document.querySelector('button[onclick="publishPost()"]');
  if (postBtn) postBtn.textContent = trans.post_btn;
  
  // 5. Translate Server Latency Node Label
  const nodeLabelText = lang === 'hi' ? 'वैश्विक सर्वर नोड:' : (lang === 'es' ? 'Nodo del Servidor Global:' : (lang === 'ja' ? 'グローバルサーバーノード:' : 'Global Server Node:'));
  const lbl = $id('server-node-lbl');
  if (lbl) lbl.textContent = nodeLabelText;

  // 6. Update language select dropdown value
  const selector = $id('lang-selector');
  if (selector) selector.value = lang;
  
  showToast(`Language updated to: ${selector ? selector.options[selector.selectedIndex].text : lang} 🌍`);
}

function savePostsToLocal() {
  localStorage.setItem('ts_posts', JSON.stringify(DATA.posts));
}

function saveCommentsToLocal() {
  localStorage.setItem('ts_comments_db', JSON.stringify(DATA.commentsDb));
}

function initNetworkLatencyTracker() {
  const latencyVal = $id('latency-val');
  if (!latencyVal) return;
  
  setInterval(() => {
    const lat = Math.floor(18 + Math.random() * 19); // Fluctuates 18ms-36ms
    const activeWord = S.lang === 'hi' ? 'सक्रिय' : (S.lang === 'es' ? 'Activo' : (S.lang === 'ja' ? 'アクティブ' : 'Active'));
    
    latencyVal.innerHTML = `
      <span style="width:6px; height:6px; background:var(--green); border-radius:50%; display:inline-block; box-shadow:0 0 8px var(--green)"></span> 
      ${activeWord} (${lat}ms)
    `;
  }, 4000);
}

// ── AD REVENUE ACCRUAL ON SCROLL ──
let lastScrollTime = 0;
function initAdRevenueAccrual() {
  // Listen for scroll events on any active pane to accumulate ad share
  document.querySelectorAll('.pane').forEach(pane => {
    pane.addEventListener('scroll', () => {
      const now = Date.now();
      if (now - lastScrollTime > 300) {
        lastScrollTime = now;
        
        // Dynamically increment ad revenue by a fraction of a cent
        const shareEl = $id('ew-ad-share');
        if (shareEl) {
          const currentVal = parseFloat(shareEl.textContent.replace('$', ''));
          const newVal = currentVal + (0.01 + Math.random()*0.02);
          shareEl.textContent = `$${newVal.toFixed(2)}`;
        }
      }
    });
  });
}

function simulateCreatorTip() {
  const amount = (10 + Math.random()*40).toFixed(2);
  showToast(`🎁 Tipped active creator $${amount} from your ecosystem balance!`);
  
  const balanceEl = $id('ew-ad-share');
  if (balanceEl) {
    const currentVal = parseFloat(balanceEl.textContent.replace('$', ''));
    if (currentVal >= amount) {
      balanceEl.textContent = `$${(currentVal - amount).toFixed(2)}`;
    }
  }
  
  // Confetti reaction burst
  if (typeof IX !== 'undefined' && IX.burstReaction) {
    IX.burstReaction('🎁', window.innerWidth/2, window.innerHeight/2);
  }
}

// ── BOOT ─────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  _safe(initApp, 'initApp');
});

function initApp() {
  // Load posts and comments from LocalStorage for persistence
  const savedPosts = localStorage.getItem('ts_posts');
  if (savedPosts) {
    DATA.posts = JSON.parse(savedPosts);
  } else {
    localStorage.setItem('ts_posts', JSON.stringify(DATA.posts));
  }

  const savedComments = localStorage.getItem('ts_comments_db');
  if (savedComments) {
    DATA.commentsDb = JSON.parse(savedComments);
  } else {
    localStorage.setItem('ts_comments_db', JSON.stringify(DATA.commentsDb));
  }

  updateUserUI();
  _safe(setupNav,       'setupNav');
  _safe(setupHeader,    'setupHeader');
  _safe(setupMessages,  'setupMessages');
  _safe(setupAI,        'setupAI');
  _safe(renderStories,  'renderStories');
  _safe(renderFeed,     'renderFeed');
  _safe(renderTrending, 'renderTrending');
  _safe(renderWhoToFollow,'renderWhoToFollow');
  _safe(renderExplore,  'renderExplore');
  _safe(renderReels,    'renderReels');
  _safe(renderFashionVerse, 'renderFashionVerse');
  _safe(renderFitness,  'renderFitness');

  _safe(renderVoteHall,    'renderVoteHall');
  _safe(renderCreator,  'renderCreator');
  _safe(renderFashionHub, 'renderFashionHub');
  _safe(renderCommunity,'renderCommunity');
  _safe(renderProfile,  'renderProfile');
  _safe(setupUniversalSearch, 'setupUniversalSearch');
  _safe(populateCategorySidebar, 'populateCategorySidebar');
  
  // Set up language selector
  const langSel = $id('lang-selector');
  if (langSel) {
    langSel.addEventListener('change', e => {
      applyLanguage(e.target.value);
    });
    // Restore saved language or default to en
    const savedLang = localStorage.getItem('ts_lang') || 'en';
    applyLanguage(savedLang);
  }

  // Set up latency tracker
  _safe(initNetworkLatencyTracker, 'initNetworkLatencyTracker');
  _safe(initAdRevenueAccrual, 'initAdRevenueAccrual');
  
  navigateTo('feeds');
}

// ── USER UI ──────────────────────────────────────────────────────
function updateUserUI() {
  const u = S.user;
  const isGuest = u.fname === 'Guest' && u.lname === 'User';
  const initials = `${(u.fname||'A')[0]}${(u.lname||'V')[0]}`.toUpperCase();
  ['sidebar-av','header-av','composer-av','profile-av'].forEach(id => {
    const el = $id(id); if (el) el.textContent = initials;
  });
  const sn = $id('sidebar-name');   if (sn) sn.textContent = `${u.fname} ${u.lname}`;
  const sh = $id('sidebar-handle'); if (sh) sh.textContent = u.handle;
  const pn = $id('profile-name');   if (pn) pn.textContent = `${u.fname} ${u.lname}`;
  const ph = $id('profile-handle'); if (ph) ph.textContent = `${u.handle} · Level ${u.level}`;
  const pb = $id('profile-bio');    if (pb) pb.textContent = u.bio;

  // Hide message badge for guest users (guests shouldn't have unread messages)
  const msgBadge = $id('msg-badge');
  if (msgBadge) msgBadge.style.display = isGuest ? 'none' : '';
  // Also hide the notification dot for guests
  const notifDot = document.querySelector('.notif-dot');
  if (notifDot) notifDot.style.display = isGuest ? 'none' : '';
}

// ── NAVIGATION ───────────────────────────────────────────────────
function setupNav() {
  document.querySelectorAll('.nav-item[data-pane]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.preventDefault(); // Prevent default raw browser hash URL shifts
      navigateTo(el.dataset.pane);
      closeSidebar();
    });
  });
  document.querySelectorAll('.m-nav-btn[data-pane]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.preventDefault(); // Prevent default raw browser hash URL shifts
      navigateTo(el.dataset.pane);
    });
  });
  const ham = $id('hamburger');
  if (ham) ham.addEventListener('click', toggleSidebar);
  const ov = $id('sidebar-overlay');
  if (ov) ov.addEventListener('click', closeSidebar);
}

function navigateTo(pane) {
  // Clear the sidebar drawer overlays and drawer states
  closeSidebar();
  
  // Clear any modal or blur classes on document body
  document.body.classList.remove('modal-open');
  document.body.classList.remove('blurred-state');
  
  // Hide active modal popups to prevent obscuring views on transition
  const playStoreModal = $id('play-store-modal'); if (playStoreModal) { playStoreModal.style.display = 'none'; playStoreModal.classList.add('hidden'); }
  const courseDetailModal = $id('course-detail-modal'); if (courseDetailModal) { courseDetailModal.style.display = 'none'; courseDetailModal.classList.add('hidden'); }
  const gigWorkspaceModal = $id('gig-workspace-modal'); if (gigWorkspaceModal) { gigWorkspaceModal.style.display = 'none'; gigWorkspaceModal.classList.add('hidden'); }
  const eduReelsModal = $id('edu-reels-modal'); if (eduReelsModal) { eduReelsModal.style.display = 'none'; eduReelsModal.classList.add('hidden'); }
  const callModal = $id('call-modal'); if (callModal) { callModal.style.display = 'none'; callModal.classList.add('hidden'); }
  const categoryModal = $id('category-modal'); if (categoryModal) { categoryModal.style.display = 'none'; categoryModal.classList.add('hidden'); }
  
  // Stop continuous simulations if leaving their respective category
  if (S.pane === 'category') {
    stopCryptoLiveChart();
    stopWildlifeCanvasSim();
  }
  if (S.pane === 'fitness' && pane !== 'fitness') stopEKG();

  document.querySelectorAll('.pane').forEach(p => p.classList.remove('active'));
  let target = $id(`pane-${pane}`);
  if (!target) {
    const funcName = `get${pane.charAt(0).toUpperCase()}${pane.slice(1)}Template`;
    if (typeof window[funcName] === 'function') {
      const htmlContent = window[funcName]();
      const mainContent = $id('main-content');
      if (mainContent) {
        mainContent.insertAdjacentHTML('beforeend', htmlContent);
        target = $id(`pane-${pane}`);
      }
    }
  }
  if (target) target.classList.add('active');

  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const navEl = document.querySelector(`.nav-item[data-pane="${pane}"]`);
  if (navEl) navEl.classList.add('active');

  document.querySelectorAll('.m-nav-btn').forEach(n => n.classList.remove('active'));
  const mEl = document.querySelector(`.m-nav-btn[data-pane="${pane}"]`);
  if (mEl) mEl.classList.add('active');

  S.pane = pane;

  // Re-start EKG when entering fitness
  if (pane === 'fitness') _safe(startEKG, 'startEKG');
  if (pane === 'learn') _safe(renderVoteHall, 'renderVoteHall');
  if (pane === 'feeds') {
    _safe(renderFeed, 'renderFeed');
    _safe(renderStories, 'renderStories');
    _safe(renderWhoToFollow, 'renderWhoToFollow');
  }
  if (pane === 'explore') {
    _safe(renderExplore, 'renderExplore');
    _safe(setupUniversalSearch, 'setupUniversalSearch');
  }
  if (pane === 'fashionhub') _safe(renderFashionHub, 'renderFashionHub');
}

function toggleSidebar() {
  const s = document.querySelector('.sidebar');
  const o = $id('sidebar-overlay');
  if (s) s.classList.toggle('open');
  if (o) o.classList.toggle('open');
}
function closeSidebar() {
  const s = document.querySelector('.sidebar');
  const o = $id('sidebar-overlay');
  if (s) s.classList.remove('open');
  if (o) o.classList.remove('open');
}

// ── THEME ────────────────────────────────────────────────────────
function setupHeader() {
  const btn = $id('theme-btn');
  if (btn) btn.addEventListener('click', toggleTheme);
  
  const av = $id('header-av');
  if (av) {
    av.style.cursor = 'pointer';
    av.addEventListener('click', () => {
      navigateTo('profile');
      showToast('Profile: Opened from Header 👤');
    });
  }
}

function toggleTheme() {
  const html = document.documentElement;
  const isLight = html.getAttribute('data-theme') === 'light';
  html.setAttribute('data-theme', isLight ? 'dark' : 'light');
  S.theme = isLight ? 'dark' : 'light';
  const icon = $id('theme-icon');
  if (icon) icon.textContent = isLight ? 'dark_mode' : 'light_mode';
}

function signOut() {
  if (confirm('Sign out of Trending?')) {
    alert('You\'ve been signed out. Reload the page to return.');
  }
}

// ── ADAPTIVE CATEGORY PORTAL ─────────────────────────────────────
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
  
  const titleEl = $id('cat-title'); if (titleEl) titleEl.innerHTML = titles[cat] || '<span class="material-symbols-rounded emoji-3d" style="font-size:24px; color:var(--blue); vertical-align:middle; margin-right:6px">explore</span><span>Category</span> Portal';
  const descEl = $id('cat-description'); if (descEl) descEl.textContent = descs[cat] || 'Explore advanced multimedia feeds.';
  
  navigateTo('category');
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
              <div class="fw7 fs14 tc-1">Google releases Gemma 4 with 128K context window</div>
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

// ── FASHIONVERSE 🛍️ ──────────────────────────────────────────────
function renderFashionVerse(brand = 'All') {
  const el = $id('fv-product-grid'); if (!el) return;
  const items = brand === 'All' ? DATA.fvProducts : DATA.fvProducts.filter(p => p.brand === brand);
  el.innerHTML = items.map(p => {
    const arButton = p.arEnabled ? `<button class="btn btn-sm flex-center gap4" style="background:rgba(255,42,133,0.2); color:var(--pink); border:1px solid var(--pink); border-radius:12px; font-weight:700;" onclick="openARTryOn('${p.id}')"><span class="material-symbols-rounded" style="font-size:14px">view_in_ar</span> AR Try-On</button>` : '';
    
    return `
      <div class="product-card">
        <div class="product-img" style="background:${p.bg}">
          <span class="emoji-3d" style="font-size:80px">${p.emoji}</span>
          ${p.badge ? `<span class="product-badge">${p.badge}</span>` : ''}
          <button class="product-wishlist"><span class="material-symbols-rounded" style="font-size:18px">favorite_border</span></button>
        </div>
        <div class="product-info">
          <div class="product-seller tc-2">${p.brand}</div>
          <div class="product-name tc-1">${p.name}</div>
          <div class="product-rating tc-3">${p.rating}</div>
          <div class="flex-between" style="margin-top:12px; align-items:flex-end">
            <div class="product-price">$${p.price.toFixed(2)}</div>
            ${arButton}
          </div>
          <button class="btn btn-primary mt12 flex-center gap4" style="width:100%; border-radius:12px;" onclick="addToCart('${p.name}', ${p.price})">
            <span class="material-symbols-rounded" style="font-size:16px">shopping_cart</span> Add to Cart
          </button>
        </div>
      </div>
    `;
  }).join('');

  const brandsContainer = $id('fv-brands-container');
  if (brandsContainer) {
    brandsContainer.innerHTML = DATA.fvBrands.map(b => `
      <span class="brand-chip${b === brand ? ' active' : ''}" onclick="renderFashionVerse('${b}')">${b}</span>
    `).join('');
  }
}

// AR Try-On Logic
let currentARItem = null;
function openARTryOn(itemId) {
  const item = DATA.fvProducts.find(p => p.id === itemId);
  if (!item) return;
  currentARItem = item;
  
  const modal = $id('ar-tryon-modal');
  const scanLine = $id('ar-scan-line');
  const statusText = $id('ar-status-text');
  const icon = $id('ar-placeholder-icon');
  const overlay = $id('ar-item-overlay');
  
  if (modal) modal.style.display = 'flex';
  
  // Reset states
  if (scanLine) scanLine.style.display = 'none';
  if (overlay) overlay.style.display = 'none';
  if (overlay) overlay.style.opacity = '0';
  if (icon) icon.textContent = 'person';
  if (statusText) statusText.textContent = 'Initializing Camera...';
  
  // Simulation sequence
  setTimeout(() => {
    if (statusText) statusText.textContent = 'Scanning Environment...';
    if (scanLine) scanLine.style.display = 'block';
  }, 1000);
  
  setTimeout(() => {
    if (statusText) statusText.textContent = 'Tracking Body...';
  }, 2500);
  
  setTimeout(() => {
    if (statusText) statusText.textContent = 'Applying Model...';
    if (icon) icon.textContent = item.emoji; // Show the item instead of person
  }, 4000);
  
  setTimeout(() => {
    if (statusText) statusText.textContent = 'AR Active. Strike a pose!';
    if (scanLine) scanLine.style.display = 'none';
    if (overlay) {
      overlay.style.display = 'block';
      setTimeout(() => overlay.style.opacity = '1', 50);
      $id('ar-item-name').textContent = item.name;
      $id('ar-item-brand').textContent = item.brand;
      
      const claimBtn = $id('ar-claim-btn');
      if (claimBtn) {
        claimBtn.style.display = 'flex';
        // Only allow claiming points once per session per item
        if (item.claimed) {
          claimBtn.disabled = true;
          claimBtn.innerHTML = '<span class="material-symbols-rounded">check_circle</span> Points Claimed';
        } else {
          claimBtn.disabled = false;
          claimBtn.innerHTML = '<span class="material-symbols-rounded">stars</span> Claim +50 XP';
        }
      }
    }
  }, 5000);
}

function closeARTryOn() {
  const modal = $id('ar-tryon-modal');
  if (modal) modal.style.display = 'none';
}

function claimARTryOnPoints() {
  if (!currentARItem || currentARItem.claimed) return;
  
  S.user.xp += 50;
  currentARItem.claimed = true;
  updateUserUI();
  
  const claimBtn = $id('ar-claim-btn');
  if (claimBtn) {
    claimBtn.disabled = true;
    claimBtn.innerHTML = '<span class="material-symbols-rounded">check_circle</span> Points Claimed';
  }
  
  showToast(`FashionVerse: Earned +50 XP for trying on ${currentARItem.brand}! 🌟`);
}

// ── DUAL FEED & FEED MODE CONTROLLERS ────────────────────────────
function toggleDualFeed(mode) {
  S.dualFeed = mode;
  document.getElementById('df-ent-btn').classList.toggle('active', mode === 'entertainment');
  document.getElementById('df-gro-btn').classList.toggle('active', mode === 'growth');
  showToast(mode === 'growth' ? '🌱 Growth Feed Active' : '🎭 Entertainment Feed Active');
  renderFeed();
}

function switchFeedMode(mode) {
  S.feedMode = mode;
  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.classList.toggle('active', btn.textContent.toLowerCase().includes(mode));
  });
  
  // Apply visual theme comfort tinting
  const html = document.documentElement;
  if (mode === 'focus') {
    html.style.setProperty('--blue', 'hsl(217, 91%, 50%)');
    showToast('Focus Mode Active: Muting notifications 🎯');
  } else if (mode === 'study') {
    html.style.setProperty('--blue', 'hsl(155, 60%, 40%)');
    showToast('Study Mode: Scientific priority 🌱');
  } else if (mode === 'chill') {
    html.style.setProperty('--blue', 'hsl(260, 65%, 54%)');
    showToast('Night Chill: Soothing visual accents active 🌙');
  } else if (mode === 'motivation') {
    html.style.setProperty('--blue', 'hsl(14, 85%, 50%)');
    showToast('Motivation Mode Active: Fuel your drive! 🔥');
  } else if (mode === 'news') {
    html.style.setProperty('--blue', 'hsl(355, 72%, 50%)');
    showToast('Breaking News Mode: Real-time global updates 📰');
  } else if (mode === 'wellness') {
    html.style.setProperty('--blue', 'hsl(145, 60%, 45%)');
    showToast('Wellness Mode: Breathing, fitness, and health focus 🧘');
  } else if (mode === 'productivity') {
    html.style.setProperty('--blue', 'hsl(190, 90%, 40%)');
    showToast('Productivity Mode: Maximize efficiency & learning 🚀');
  } else {
    html.style.setProperty('--blue', 'hsl(217, 91%, 60%)');
    showToast(`Switched Feed Mode to: ${mode}`);
  }
  
  // Update all dependent UI feeds instantly upon switching mode
  renderFeed();
  renderReels();
  renderVoteHall();
  renderWhoToFollow();
}

function startFocusSession() {
  if (S.focusActive) {
    clearInterval(S.focusTimer);
    S.focusActive = false;
    showToast('Focus Session cancelled.');
    return;
  }
  S.focusActive = true;
  S.focusTimeRemaining = 25 * 60;
  showToast('Focus Block Started: 25 minutes! 🎯');
  
  S.focusTimer = setInterval(() => {
    if (!S.focusActive) { clearInterval(S.focusTimer); return; }
    S.focusTimeRemaining--;
    if (S.focusTimeRemaining <= 0) {
      clearInterval(S.focusTimer);
      S.focusActive = false;
      S.user.xp += 150;
      updateUserUI();
      showToast('Focus Block Complete! +150 XP 🏆');
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
    const q = val.trim().toLowerCase();
    const panel = $id('search-results-panel');
    const exploreDefault = $id('explore-default-content');
    
    if (!q) {
      panel?.classList.add('hidden');
      exploreDefault?.classList.remove('hidden');
      renderFeed(); // Reset home feed search
      return;
    }
    
    navigateTo('explore');
    if (es && es.value !== val) es.value = val;
    if (gs && gs.value !== val) gs.value = val;
    
    panel?.classList.remove('hidden');
    exploreDefault?.classList.add('hidden');
    
    renderSearchResults(q);
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
  
  // Global search always navigates and submits on type or Enter
  if (gs) {
    gs.addEventListener('input', (e) => {
      submitSearch(e.target.value);
    });
    
    gs.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        submitSearch(e.target.value);
        showToast(`Search submitted: "${e.target.value}" 🔍`);
      }
    });
  }
}

function renderSearchResults(q) {
  const media = $id('search-media-results'); if (!media) return;
  const aiCard = $id('search-ai-card');
  
  // Dynamic media results matching query, enriched with live Google present-day traffic data
  const mockResults = [
    { title: `${q.toUpperCase()} CRISPR Gene Editing Efficiencies`, type: 'papers', desc: `Analyzing DNA double-strand breaks step-by-step for "${q}".`, badge: 'Science Paper', traffic: '100K+ searches today' },
    { title: `Crypto Yield Farm Liquidity Mechanics on ${q.toUpperCase()}`, type: 'articles', desc: `Understanding Decentralized Finance smart contract protocols referencing "${q}".`, badge: 'Finance Article', traffic: '500K+ searches today' },
    { title: `${q.toUpperCase()} React 19 Server Components deep-dive`, type: 'videos', desc: `60-minute cinematic programming workshop explaining "${q}".`, badge: 'Developer Workshop', traffic: '300K+ searches today' },
    { title: `Is ${q.toUpperCase()} a smart future standard?`, type: 'factchecks', desc: 'Fact Check Status: VERIFIED · Bias: neutral', badge: 'Fact Check', traffic: '80K+ searches' },
    { title: `Sunset Horizon Chill Vibes Beat: Tribute to ${q.toUpperCase()}`, type: 'podcasts', desc: `Beatmaker_96 episode 4 tribute inspired by "${q}".`, badge: 'Podcast', traffic: '120K+ searches' }
  ];
  
  const filtered = S.searchTab === 'all' ? mockResults : mockResults.filter(r => r.type === S.searchTab);
  
  media.innerHTML = filtered.map(r => `
    <div class="card p16 flex flex-col gap8">
      <div class="flex-between">
        <span class="badge badge-blue fs11" style="background:#4F46E5">${r.badge}</span>
        <button class="btn btn-ghost btn-sm" onclick="showToast('Opening search result...')">Open</button>
      </div>
      <h3 class="fw7 fs14 tc-1">${r.title}</h3>
      <p class="tc-2 fs12">${r.desc}</p>
      <div class="fs11 mt4 fw7" style="color:#34A853; display:flex; align-items:center; gap:4px">
        <span class="material-symbols-rounded" style="font-size:14px">trending_up</span>
        Live Traffic: ${r.traffic} — Verified via Google Cloud Engine.
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

// ── HOME FEED ────────────────────────────────────────────────────
function renderStories() {
  const el = $id('stories-row'); if (!el) return;
  const myStory = `<div class="story-item" onclick="openPostComposer()" style="cursor:pointer"><div class="story-ring"><div class="story-inner" style="font-size:18px;background:var(--card2);display:grid;place-items:center;"><span class="material-symbols-rounded" style="color:var(--t3)">add</span></div></div><div class="story-name">Your Story</div></div>`;
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
  const emojiBlock = p.emoji_block ? `<div class="post-emoji-block">${p.emoji_block}</div>` : '';
  const tags = p.tags.map(t => `<span class="post-tag">${t}</span>`).join('');
  return `
  <div class="post-card" id="post-${p.id}">
    <div class="post-header">
      <div class="avatar av-sm" style="background:var(--g-brand)">${p.emoji}</div>
      <div class="post-author">
        <div class="post-author-name">${p.author} <span style="font-size:11px;color:var(--t3);font-weight:500">${p.handle}</span></div>
        <div class="post-meta">${formatRelativeTime(p.time)} · 🌍 Public</div>
      </div>
      <button class="icon-btn" style="width:30px;height:30px;font-size:14px" title="More">⋯</button>
    </div>
    <div class="post-body">${escapeHTML(p.body).replace(/\n/g,'<br>')}</div>
    ${emojiBlock}
    <div class="post-tags">${tags}</div>
    <div class="post-actions">
      <button class="post-act-btn${p.liked?' liked':''}" onclick="likePost(event, ${p.id})">
        <span class="material-symbols-rounded" style="font-size:16px; margin-right:4px; font-variation-settings: 'FILL' ${p.liked?1:0}">favorite</span> ${p.likes}
      </button>
      <button class="post-act-btn" onclick="toggleComments(${p.id})">
        <span class="material-symbols-rounded" style="font-size:16px; margin-right:4px">chat_bubble</span> ${p.comments}
      </button>
      <button class="post-act-btn" onclick="showToast('Post reshared! 🔁')">
        <span class="material-symbols-rounded" style="font-size:16px; margin-right:4px">sync</span> ${p.shares}
      </button>
      <button class="post-act-btn" onclick="narratePost(${p.id})">
        <span class="material-symbols-rounded" style="font-size:16px; margin-right:4px">volume_up</span> Narrate
      </button>
      <button class="post-act-btn" style="margin-left:auto" onclick="showToast('Share link copied to clipboard! 📤')">
        <span class="material-symbols-rounded" style="font-size:16px">send</span>
      </button>
    </div>
  </div>`;
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
  const newPost = {
    id: Date.now(), author:'Alex Vance', handle:'@alex_vance', emoji:'\u2728',
    time: Date.now(), body: text, tags: ['#trending'], likes:0, comments:0, shares:0, liked:false, type:'text', category:'tech'
  };
  DATA.posts.unshift(newPost);
  input.value = '';
  savePostsToLocal();
  renderFeed();
}
function openPostComposer() { $id('post-input') && $id('post-input').focus(); }
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
      { icon: '\uD83D\uDD25', color: 'var(--orange)', label: 'Trending' },
      { icon: '\uD83D\uDD25', color: 'var(--purple)', label: 'AI' },
      { icon: '\uD83D\uDD25', color: 'var(--green)', label: 'Fitness' },
      { icon: '\uD83D\uDD25', color: 'var(--orange)', label: 'Gaming' },
      { icon: '\uD83D\uDD25', color: 'var(--blue)', label: 'Travel' },
      { icon: '\uD83D\uDD25', color: 'var(--pink)', label: 'Design' },
      { icon: '\uD83D\uDD25', color: 'var(--blue)', label: 'Code' },
      { icon: '\uD83D\uDD25', color: 'var(--orange)', label: 'Food' }
    ];
    tc.innerHTML = cats.map((c,i) => `
      <span class="chip${i===0?' active':''}" onclick="this.parentNode.querySelectorAll('.chip').forEach(x=>x.classList.remove('active'));this.classList.add('active')" style="display:inline-flex; align-items:center; gap:4px">
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

// ── REELS ────────────────────────────────────────────────────────
function renderReels(filter = 'all') {
  const el = $id('reels-grid'); if (!el) return;
  
  let reels = DATA.reels;
  const emojis = MODE_REEL_MAP[S.feedMode || 'entertainment'];
  if (emojis) {
    reels = reels.filter(r => emojis.includes(r.emoji));
  }
  if (!reels.length) reels = DATA.reels;
  
  el.innerHTML = reels.map(r => {
    const iconData = get3DIconForEmoji(r.emoji);
    const masterIdx = DATA.reels.indexOf(r);
    return `
    <div class="reel-card" onclick="openReelsPopup(${masterIdx})">
      <div class="reel-thumb" style="background:${r.bg}">
        <span class="material-symbols-rounded emoji-3d" style="font-size:48px; color:${iconData.color}; text-shadow: 0 0 16px ${iconData.color}s">${iconData.icon}</span>
        <div class="reel-overlay">
          <div class="reel-creator">${r.creator}</div>
          <div class="reel-desc">${r.desc}</div>
          <div class="reel-stats">
            <span class="reel-stat" style="display:inline-flex; align-items:center; gap:4px">
              <span class="material-symbols-rounded" style="font-size:12px; color:var(--pink); font-variation-settings:'FILL' 1">favorite</span> ${r.likes}
            </span>
            <span class="reel-stat" style="display:inline-flex; align-items:center; gap:4px">
              <span class="material-symbols-rounded" style="font-size:12px; color:var(--blue)">visibility</span> ${r.views}
            </span>
          </div>
        </div>
        <div class="reel-actions">
          <div class="reel-act" onclick="event.stopPropagation(); showToast('Liked!')"><span class="material-symbols-rounded" style="font-size:16px; color:#fff">favorite</span></div>
          <div class="reel-act" onclick="event.stopPropagation(); showToast('Commented!')"><span class="material-symbols-rounded" style="font-size:16px; color:#fff">chat_bubble</span></div>
          <div class="reel-act" onclick="event.stopPropagation(); showToast('Shared!')"><span class="material-symbols-rounded" style="font-size:16px; color:#fff">share</span></div>
          <div class="reel-act" onclick="event.stopPropagation(); showToast('Saved!')"><span class="material-symbols-rounded" style="font-size:16px; color:#fff">bookmark</span></div>
        </div>
      </div>
    </div>`;
  }).join('');
}
function filterReels(f) {
  document.querySelectorAll('#pane-reels .tab-btn').forEach((b,i) => {
    b.classList.toggle('active', ['all','trending','following','new'][i] === f);
  });
  renderReels(f);
}

// ── SHOP ─────────────────────────────────────────────────────────
function renderShop(cat = 'All') {
  const el = $id('product-grid'); if (!el) return;
  const items = cat === 'All' ? DATA.products : DATA.products.filter(p => p.cat === cat);
  el.innerHTML = (items.length ? items : DATA.products).map(p => {
    const iconData = get3DIconForEmoji(p.emoji);
    return `
    <div class="product-card">
      <div class="product-thumb" style="background:${p.bg||'var(--card2)'}; display:flex; align-items:center; justify-content:center">
        <span class="material-symbols-rounded emoji-3d" style="font-size:40px; color:${iconData.color}">${iconData.icon}</span>
        ${p.badge ? `<div class="product-badge-tag">${p.badge}</div>` : ''}
        <div class="product-wishlist" onclick="showToast('Added to wishlist ❤️')" style="display:inline-flex; align-items:center; justify-content:center">
          <span class="material-symbols-rounded" style="font-size:18px; color:var(--pink)">favorite</span>
        </div>
      </div>
      <div class="product-info">
        <div class="product-name">${p.name}</div>
        <div class="product-seller">${p.seller}</div>
        <div class="product-stars">${p.rating}</div>
        <div class="product-price-row">
          <div>
            <div class="product-price">$${p.price.toFixed(2)}</div>
            ${p.oldPrice ? `<div class="product-price-old">$${p.oldPrice.toFixed(2)}</div>` : ''}
          </div>
          <button class="product-add" onclick="addToCart('${p.name.substring(0,20)}','${p.price}')" style="display:inline-flex; align-items:center; justify-content:center">
            <span class="material-symbols-rounded" style="font-size:20px; color:#fff">add</span>
          </button>
        </div>
      </div>
    </div>`;
  }).join('');

  const cats = $id('shop-cats');
  if (cats) {
    cats.innerHTML = DATA.shopCategories.map(c => `
      <span class="chip${c===cat?' active':''}" onclick="renderShop('${c}')">${c}</span>`).join('');
  }
  updateCart();
}

function addToCart(name, price) {
  S.cart.push({ name, price: parseFloat(price) });
  updateCart();
  showToast(`${name.substring(0,20)}... added to cart 🛒`);
}
function updateCart() {
  const count = $id('cart-count');
  if (count) count.textContent = S.cart.length;
  const items = $id('cart-items');
  if (items) {
    items.innerHTML = S.cart.length ? S.cart.slice(-4).map(i => `
      <div class="cart-item">
        <div class="cart-item-info">
          <div class="cart-item-name">${i.name}</div>
          <div class="cart-item-price">$${i.price.toFixed(2)}</div>
        </div>
      </div>`).join('') : '<div style="color:var(--t3);font-size:12px;padding:12px 0">Your cart is empty</div>';
  }
  const total = $id('cart-total');
  if (total) total.textContent = '$' + S.cart.reduce((a,i) => a+i.price, 0).toFixed(2);
}

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
      <button class="btn btn-ghost btn-sm flex-center gap4" onclick="showToast('${e.n} logged! 💪')" style="display:inline-flex; align-items:center; gap:4px">
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
  showToast('Workout Complete! +200 XP earned 🏆');
}

function logMacro(type) {
  const amounts = { water:8, protein:25, cal:200 };
  S.macros[type] += amounts[type];
  const limits  = { water:96, protein:180, cal:2000 };
  const val = $id(`${type}-val`); if (val) val.textContent = S.macros[type];
  const bar = $id(`${type}-bar`); if (bar) bar.style.width = Math.min(100, (S.macros[type]/limits[type])*100) + '%';
  showToast(`Logged ${amounts[type]}${type==='water'?'oz':type==='protein'?'g':' cal'} 💚`);
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

// ── DATA ENRICHMENT ──
if (typeof DATA !== 'undefined') {
  DATA.elections = [
    {
      id: 'us',
      country: 'United States',
      flag: '\uD83C\uDDFA\uD83C\uDDF8',
      title: 'Presidential Mock Election',
      status: 'Counting',
      date: 'Nov 3, 2028',
      countdown: '12h 45m',
      voted: false,
      candidates: [
        { name: 'Kamala Harris', party: 'Democrat', votes: 48920, color: 'var(--blue)', pct: 49 },
        { name: 'Donald Trump', party: 'Republican', votes: 47250, color: 'var(--red)', pct: 47 },
        { name: 'Chase Oliver', party: 'Libertarian', votes: 4000, color: 'var(--orange)', pct: 4 }
      ]
    },
    {
      id: 'in',
      country: 'India',
      flag: '\uD83C\uDDEE\uD83C\uDDF3',
      title: 'General Lok Sabha Poll',
      status: 'Verified',
      date: 'May 18, 2029',
      countdown: 'Completed',
      voted: false,
      candidates: [
        { name: 'Narendra Modi', party: 'NDA', votes: 61205, color: 'var(--orange)', pct: 54 },
        { name: 'Rahul Gandhi', party: 'INDIA', votes: 52010, color: 'var(--blue)', pct: 46 }
      ]
    },
    {
      id: 'uk',
      country: 'United Kingdom',
      flag: '\uD83C\uDDEC\uD83C\uDDE7',
      title: 'Parliamentary Vote',
      status: 'Upcoming',
      date: 'Jul 12, 2029',
      countdown: '44d 8h',
      voted: false,
      candidates: [
        { name: 'Keir Starmer', party: 'Labour', votes: 3200, color: 'var(--red)', pct: 55 },
        { name: 'Rishi Sunak', party: 'Conservative', votes: 2600, color: 'var(--blue)', pct: 45 }
      ]
    },
    {
      id: 'fr',
      country: 'France',
      flag: '\uD83C\uDDEB\uD83C\uDDF7',
      title: 'National Assembly Ballot',
      status: 'Counting',
      date: 'Jun 14, 2027',
      countdown: '2d 6h',
      voted: false,
      candidates: [
        { name: 'Emmanuel Macron', party: 'En Marche', votes: 14200, color: 'var(--blue)', pct: 42 },
        { name: 'Marine Le Pen', party: 'National Rally', votes: 12500, color: 'var(--red)', pct: 37 },
        { name: 'Jean-Luc M\u00E9lenchon', party: 'LFI', votes: 7100, color: 'var(--green)', pct: 21 }
      ]
    },
    {
      id: 'br',
      country: 'Brazil',
      flag: '\uD83C\uDDE7\uD83C\uDDF7',
      title: 'Federal Election',
      status: 'Upcoming',
      date: 'Oct 1, 2026',
      countdown: '124d 18h',
      voted: false,
      candidates: [
        { name: 'Lula da Silva', party: 'Workers Party', votes: 24500, color: 'var(--red)', pct: 51 },
        { name: 'Jair Bolsonaro', party: 'Liberal Party', votes: 23530, color: 'var(--blue)', pct: 49 }
      ]
    },
    {
      id: 'de',
      country: 'Germany',
      flag: '\uD83C\uDDE9\uD83C\uDDEA',
      title: 'Bundestag Mock Election',
      status: 'Verified',
      date: 'Sep 26, 2025',
      countdown: 'Completed',
      voted: false,
      candidates: [
        { name: 'Olaf Scholz', party: 'SPD', votes: 18200, color: 'var(--red)', pct: 38 },
        { name: 'Friedrich Merz', party: 'CDU/CSU', votes: 16800, color: 'var(--black)', pct: 35 },
        { name: 'Annalena Baerbock', party: 'Greens', votes: 12900, color: 'var(--green)', pct: 27 }
      ]
    }
  ];

  // REAL-WORLD ORIGINAL DEMOCRACY DATABASE
  DATA.indianLeaders = [
    { name: 'Narendra Modi', role: 'Prime Minister of India (NDA)', flag: '\uD83C\uDDEE\uD83C\uDDF3', image: '🦁', attendance: 93, debates: 48, devScore: '9.2/10', assets: '₹3.02 Crore', criminal: '0 active charges', trust: 94, party: 'BJP/NDA', bio: 'Serving as the 14th Prime Minister of India since 2014. Member of Parliament from Varanasi.' },
    { name: 'Rahul Gandhi', role: 'Leader of Opposition (INDIA)', flag: '\uD83C\uDDEE\uD83C\uDDF3', image: '✋', attendance: 85, debates: 36, devScore: '8.5/10', assets: '₹16.4 Crore', criminal: '0 active charges (resolved)', trust: 88, party: 'INC/INDIA', bio: 'Member of Parliament from Rae Bareli. Prominent opposition voice leading democratic accountability.' },
    { name: 'Amit Shah', role: 'Home Minister of India (NDA)', flag: '\uD83C\uDDEE\uD83C\uDDF3', image: '🛡️', attendance: 91, debates: 42, devScore: '8.9/10', assets: '₹20.3 Crore', criminal: '0 active charges', trust: 91, party: 'BJP/NDA', bio: 'Serving as the Minister of Home Affairs since 2019. Member of Parliament from Gandhinagar.' },
    { name: 'Droupadi Murmu', role: 'President of India', flag: '\uD83C\uDDEE\uD83C\uDDF3', image: '🏛️', attendance: 100, debates: 0, devScore: 'N/A (Executive)', assets: '₹1.5 Crore', criminal: '0 active charges', trust: 95, party: 'Independent/Constitutional', bio: 'Serving as the 15th President of India since 2022. First tribal leader elected to the presidency.' }
  ];

  DATA.globalBills = [
    {
      id: 'dpdp',
      title: 'Digital Personal Data Protection Act (DPDP)',
      country: 'India \uD83C\uDDEE\uD83C\uDDF3',
      summary: 'Establishes a comprehensive framework for processing digital personal data in India. It mandates citizen consent before data processing, imposes strict responsibilities on data fiduciaries, and outlines heavy penalties up to ₹250 Crore for security breaches, while providing exemptions for national security agencies.',
      status: 'Passed & Active',
      stages: ['Drafting', 'Committee Review', 'Lok Sabha Passage', 'Rajya Sabha Passage', 'Presidential Assent'],
      activeStage: 4,
      supportPct: 78,
      opposePct: 22,
      abstainPct: 0,
      demographics: {
        regions: [
          { name: 'Urban Zones', support: 84 },
          { name: 'Rural Arenas', support: 72 }
        ],
        ageGroups: [
          { name: 'Gen Z (18-24)', support: 82 },
          { name: 'Millennials (25-40)', support: 80 },
          { name: 'Boomers (41+)', support: 70 }
        ],
        partySplit: [
          { name: 'NDA (Govt)', support: 96 },
          { name: 'INDIA (Opp)', support: 58 }
        ]
      }
    },
    {
      id: 'us_ai',
      title: 'Federal AI Risk Management Act',
      country: 'United States \uD83C\uDDFA\uD83C\uDDF8',
      summary: 'Requires US federal agencies to implement the NIST Artificial Intelligence Risk Management Framework. It establishes audit structures, bans unauthorized high-risk automated decision-making processes in civil services, and mandates algorithmic impact reviews to protect public privacy rights.',
      status: 'Debating (Voting Stage)',
      stages: ['House Introduction', 'Committee Audits', 'House Vote', 'Senate Review', 'Executive Signature'],
      activeStage: 3,
      supportPct: 86,
      opposePct: 11,
      abstainPct: 3,
      demographics: {
        regions: [
          { name: 'East Coast', support: 89 },
          { name: 'West Coast', support: 92 },
          { name: 'Midwest', support: 77 }
        ],
        ageGroups: [
          { name: 'Gen Z (18-24)', support: 91 },
          { name: 'Millennials (25-40)', support: 87 },
          { name: 'Boomers (41+)', support: 80 }
        ],
        partySplit: [
          { name: 'Democrats', support: 94 },
          { name: 'Republicans', support: 78 }
        ]
      }
    },
    {
      id: 'uk_ai',
      title: 'Artificial Intelligence Regulation Bill',
      country: 'United Kingdom \uD83C\uDDEC\uD83C\uDDE7',
      summary: 'Proposes statutory codes of conduct for large language models, mandates bias testing, creates an AI Regulatory Authority to oversee deployment, and holds corporate executives personally liable for safety breaches.',
      status: 'First Reading',
      stages: ['House of Commons Draft', 'First Reading', 'Second Reading', 'Committee Auditing', 'Royal Assent'],
      activeStage: 1,
      supportPct: 82,
      opposePct: 15,
      abstainPct: 3,
      demographics: {
        regions: [
          { name: 'London Met', support: 88 },
          { name: 'North UK', support: 76 },
          { name: 'Scotland', support: 82 }
        ],
        ageGroups: [
          { name: 'Gen Z (18-24)', support: 88 },
          { name: 'Millennials (25-40)', support: 84 },
          { name: 'Boomers (41+)', support: 74 }
        ],
        partySplit: [
          { name: 'Labour', support: 90 },
          { name: 'Conservatives', support: 72 }
        ]
      }
    }
  ];

  DATA.democracyAlerts = [
    { id: 1, title: 'Deepfake Audio Alert', text: 'AI-generated audio deepfake of a leader\'s election speech discovered circulating on chat channels.', rating: 'Fact-Check: ❌ FAKE (Synthesized)', source: 'VerifyIndia', time: '12m ago' },
    { id: 2, title: 'Constituency Turnout News', text: 'Constituency voter turnout index recorded at 67.4% during Phase 4 Lok Sabha voting.', rating: 'Turnout Tally: ✅ VERIFIED', source: 'Election Commission', time: '1h ago' }
  ];

  DATA.parliamentLiveDebates = {
    title: 'Lok Sabha: Debate on Digital Data Fiduciary Liability & Privacy Exemptions',
    session: 'Parliament Monsoon Session 2026',
    transcripts: [
      { speaker: 'Amit Shah (Home Minister)', text: 'Our focus is to protect the citizen\'s privacy coordinates without compromising national security vectors. The DPDP Act strikes that perfect balance.', time: '10:42 AM', emotion: 'Assertive & Rational' },
      { speaker: 'Rahul Gandhi (Leader of Opposition)', text: 'We cannot give blank checks to state surveillance boards. The exemptions in Section 7 must have strong judicial review oversight!', time: '10:45 AM', emotion: 'Passionate & Oppositional' },
      { speaker: 'Dev Kumar (MP, Tech Council)', text: 'The ₹250 Crore penalty index is a massive deterrent, but we must simplify compliance pathways for early-stage startup innovators.', time: '10:48 AM', emotion: 'Analytical & Constructive' }
    ]
  };

  DATA.manifestos = {
    bjp: [
      'Digital India Expansion: Deploy 6G testbeds and unify payments index across rural cooperatives.',
      'Sovereign AI Infrastructure: Fund national high-performance computing centers for domestic LLMs.',
      'Civic Tech Automation: Unify voter registry indexes onto standard secure public ledgers.'
    ],
    congress: [
      'Surveillance Transparency: Establish legislative committee oversight for all intelligence data requests.',
      'Startup Freedom Act: Exempt tech ventures under ₹10 Crore revenue from regulatory compliance.',
      'Digital Literacy Dividend: Distribute free internet data subsidies for students and vocational schools.'
    ]
  };
}

// ── LEARN PANE ──
let activeCourse = null;
let courseVideoPlaying = false;
let courseVideoAnimId = null;
let activeCDTab = 'tutor';
let activeCDQuizIdx = 0;

const cdQuizzes = {
  1: [
    { q: "Which color system is best suited for programmatic dark/light theme shifts in glassmorphism?", a: ["HSL with CSS variables", "Hardcoded hex strings", "Static RGB colors", "Embedded image gradients"], c: 0 },
    { q: "What is the primary benefit of glassmorphism design layouts?", a: ["Visual depth & hierarchy", "Faster graphics rendering", "Lower memory consumption", "Automatic translation support"], c: 0 }
  ],
  2: [
    { q: "Which React 19 hook facilitates seamless, optimistic UI state updates?", a: ["useOptimistic", "useActionState", "useEffect", "useMemo"], c: 0 },
    { q: "What is the key mechanism behind React Server Components?", a: ["Zero bundle-size server rendering", "Direct client DOM updates", "WebAssembly packaging", "Direct Redux store linking"], c: 0 }
  ],
  3: [
    { q: "How is user growth virality coefficient (K-factor) computed?", a: ["K = Sent invites * Conversion rate", "K = Total churn / Total revenue", "K = Total active users * Daily clicks", "K = Ad clicks / Impression scale"], c: 0 }
  ],
  4: [
    { q: "Which prompting technique optimizes zero-shot accuracy by forcing step-by-step reasoning?", a: ["Chain of Thought (CoT)", "Few-shot examples", "Temperature scaling", "Negative prompt padding"], c: 0 }
  ],
  5: [
    { q: "Which frequency range holds the sub-bass energy in modern electronic beats?", a: ["20 Hz to 60 Hz", "250 Hz to 500 Hz", "2 kHz to 4 kHz", "10 kHz to 20 kHz"], c: 0 }
  ],
  6: [
    { q: "What aperture setting creates the shallowest depth of field (cinematic blurry background)?", a: ["f/1.4", "f/8.0", "f/16", "f/22"], c: 0 }
  ],
  7: [
    { q: "What does the FASTA format primarily represent in biological computing?", a: ["Nucleotide or peptide sequence", "3D molecular coordinates", "Microarray gene levels", "Phylogenetic evolutionary distance"], c: 0 }
  ],
  8: [
    { q: "Which aerodynamic force directly counteracts the weight of an aircraft in level flight?", a: ["Lift", "Thrust", "Drag", "Gravity"], c: 0 }
  ],
  9: [
    { q: "In B.J. Fogg's Behavior Model (B=MAP), what three elements must converge for a behavior to occur?", a: ["Motivation, Ability, Prompt", "Money, Attention, Product", "Marketing, Analytics, Plan", "Mindset, Association, Performance"], c: 0 }
  ]
};

function renderVoteHall() {
  const eg = $id('election-grid');
  if (eg) {
    let elections = DATA.elections || [];
    const filter = S.electionFilter || 'all';
    if (filter !== 'all') {
      elections = elections.filter(e => e.status === filter);
    }
    eg.innerHTML = elections.map(e => {
      let statusBadge = '';
      if (e.status === 'Verified') {
        statusBadge = `<span class="badge badge-green flex-center gap4"><span class="material-symbols-rounded" style="font-size:12px">verified</span> Verified</span>`;
      } else if (e.status === 'Counting') {
        statusBadge = `<span class="badge badge-purple flex-center gap4" style="animation:pulse-dot 2s infinite"><span class="material-symbols-rounded" style="font-size:12px">sync</span> Counting</span>`;
      } else {
        statusBadge = `<span class="badge badge-blue flex-center gap4"><span class="material-symbols-rounded" style="font-size:12px">schedule</span> Upcoming</span>`;
      }

      const totalVotes = e.candidates.reduce((sum, c) => sum + c.votes, 0);

      const candidateHTML = e.candidates.map(c => {
        const pct = totalVotes > 0 ? Math.round((c.votes / totalVotes) * 100) : c.pct;
        return `
        <div class="mb12">
          <div class="flex-between fs12 fw7 mb4">
            <span class="tc-1">${c.name} <span class="tc-3 fs10 fw5">(${c.party})</span></span>
            <span class="tc-1">${pct}% <span class="tc-3 fs10 fw5">(${c.votes.toLocaleString()} votes)</span></span>
          </div>
          <div class="progress-bar" style="height:8px; background:var(--bg2)">
            <div class="progress-fill" style="width:${pct}%; background:${c.color}; transition:width 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275)"></div>
          </div>
        </div>`;
      }).join('');

      let actionBtn = '';
      if (e.voted) {
        actionBtn = `
        <button class="btn btn-ghost btn-sm mt8 flex-center gap4" style="width:100%" disabled>
          <span class="material-symbols-rounded tc-green" style="font-size:14px">check_circle</span> Ballot Cast & Verified ✓
        </button>`;
      } else {
        actionBtn = `
        <button class="btn btn-primary btn-sm mt8 flex-center gap4" style="width:100%; justify-content:center; background:var(--g-brand)" onclick="goToSimulator('${e.id}')">
          Cast Secure Ballot <span class="material-symbols-rounded" style="font-size:14px">how_to_vote</span>
        </button>`;
      }

      return `
      <div class="card p16" style="background:var(--card); border:1px solid var(--border); display:flex; flex-direction:column">
        <div class="flex-between mb12" style="align-items:flex-start">
          <div>
            <div style="display:flex; align-items:center; gap:6px">
              <span style="font-size:20px">${e.flag}</span>
              <span class="fw8 fs14 tc-1">${e.country}</span>
            </div>
            <h4 class="fw6 fs12 tc-3" style="margin:2px 0 0 0">${e.title}</h4>
          </div>
          ${statusBadge}
        </div>
        <div style="flex:1">
          ${candidateHTML}
        </div>
        <div class="flex-between fs11 tc-3 mt12 mb8" style="border-top:1px solid var(--border); padding-top:12px">
          <span>${e.status==='Verified'?'Completed':'Date: '+e.date}</span>
          <span class="fw7 ${e.status==='Counting'?'tc-purple':''}">${e.status==='Verified'?'Final Consensus':'Ends in: '+e.countdown}</span>
        </div>
        ${actionBtn}
      </div>`;
    }).join('');
  }
}

function switchVoteTab(tab) {
  S.activeVoteTab = tab;
  document.querySelectorAll('#pane-learn > .tabs .tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.id === `vt-${tab}`);
  });
  
  $id('vote-dashboard-view').classList.toggle('hidden', tab !== 'dashboard');
  $id('vote-simulator-view').classList.toggle('hidden', tab !== 'simulator');
  $id('vote-timeline-view').classList.toggle('hidden', tab !== 'timeline');
  $id('vote-india-view').classList.toggle('hidden', tab !== 'india');
  $id('vote-bills-view').classList.toggle('hidden', tab !== 'bills');
  $id('vote-live-view').classList.toggle('hidden', tab !== 'live');
  $id('vote-ai-view').classList.toggle('hidden', tab !== 'ai');
  
  if (tab === 'simulator') {
    initBallotSimulator();
  } else if (tab === 'india') {
    renderIndiaDemocracy();
  } else if (tab === 'bills') {
    renderGlobalBills();
  } else if (tab === 'live') {
    renderDemocracyLive();
  } else if (tab === 'ai') {
    renderDemocracyAI();
  }
}

// ── INDIA DEMOCRACY RENDERER ──
function renderIndiaDemocracy() {
  const container = $id('india-leaders-list');
  if (!container) return;

  container.innerHTML = DATA.indianLeaders.map((l, i) => `
    <div class="card p12 act-btn" onclick="toggleLeaderDetails(${i})" style="background:var(--bg2); border:1px solid var(--border); transition:var(--tr)">
      <div class="flex-between">
        <div class="flex gap10" style="align-items:center; display:flex; gap:10px">
          <span style="font-size:24px; padding:6px; background:var(--surface); border-radius:50%">${l.image}</span>
          <div>
            <div class="fw8 fs13 tc-1">${l.name} ${l.flag}</div>
            <div class="fs11 tc-3">${l.role}</div>
          </div>
        </div>
        <span class="material-symbols-rounded tc-3" id="leader-arrow-${i}">expand_more</span>
      </div>

      <div class="hidden mt12 pt12" id="leader-details-${i}" style="border-top:1px dashed var(--border)">
        <p class="fs12 tc-2 mb12" style="line-height:1.5">${l.bio}</p>
        
        <div class="grid-2 gap8 mb12" style="display:grid; grid-template-columns:1fr 1fr; gap:8px">
          <div class="p8" style="background:var(--surface); border-radius:var(--r1); padding:8px">
            <span class="fs10 tc-3 uppercase" style="font-size:10px; display:block">Parliament Attendance</span>
            <strong class="fs13 tc-1">${l.attendance}%</strong>
          </div>
          <div class="p8" style="background:var(--surface); border-radius:var(--r1); padding:8px">
            <span class="fs10 tc-3 uppercase" style="font-size:10px; display:block">Debates Attended</span>
            <strong class="fs13 tc-1">${l.debates} debates</strong>
          </div>
          <div class="p8" style="background:var(--surface); border-radius:var(--r1); padding:8px">
            <span class="fs10 tc-3 uppercase" style="font-size:10px; display:block">Development Index</span>
            <strong class="fs13 tc-green">${l.devScore}</strong>
          </div>
          <div class="p8" style="background:var(--surface); border-radius:var(--r1); padding:8px">
            <span class="fs10 tc-3 uppercase" style="font-size:10px; display:block">Declared Net Assets</span>
            <strong class="fs13 tc-blue">${l.assets}</strong>
          </div>
        </div>

        <div class="flex-between p8" style="background:var(--card); border-radius:var(--r2); border:1px solid var(--border); padding:8px">
          <div>
            <span class="fs10 tc-3 uppercase" style="font-size:10px; display:block">Criminal Record Profile</span>
            <strong class="fs11 tc-red" style="color:${l.criminal.includes('0')?'var(--green)':'var(--red)'}">${l.criminal}</strong>
          </div>
          <div style="text-align:right">
            <span class="fs10 tc-3 uppercase" style="font-size:10px; display:block">AI Public Trust Score</span>
            <strong class="fs12 tc-purple" style="color:var(--purple); font-weight:800">${l.trust}%</strong>
          </div>
        </div>
      </div>
    </div>
  `).join('');

  if (window.IX) IX.bindCards(container);
}

function toggleLeaderDetails(index) {
  const details = $id(`leader-details-${index}`);
  const arrow = $id(`leader-arrow-${index}`);
  if (!details || !arrow) return;

  const isHidden = details.classList.contains('hidden');
  details.classList.toggle('hidden', !isHidden);
  arrow.textContent = isHidden ? 'expand_less' : 'expand_more';
  
  if (isHidden && window.IX) {
    IX.burstReaction('📊', arrow.getBoundingClientRect().left, arrow.getBoundingClientRect().top, 6);
  }
}

// ── GLOBAL BILLS TRACKER ──
function renderGlobalBills() {
  const container = $id('global-bills-list');
  if (!container) return;

  container.innerHTML = DATA.globalBills.map(b => `
    <div class="card p16 act-btn" onclick="auditBill('${b.id}')" id="bill-card-${b.id}" style="background:var(--bg2); border:1px solid var(--border); transition:var(--tr)">
      <div class="flex-between">
        <div>
          <span class="badge badge-purple" style="font-size:9.5px; margin-bottom:6px">${b.country}</span>
          <h4 class="fw8 fs13 tc-1" style="margin:4px 0">${b.title}</h4>
          <span class="fs11" style="color:${b.status.includes('Passed')?'var(--green)':'var(--blue)'}">${b.status}</span>
        </div>
        <span class="material-symbols-rounded tc-3">chevron_right</span>
      </div>
    </div>
  `).join('');

  if (window.IX) IX.bindCards(container);
}

function auditBill(id) {
  const b = DATA.globalBills.find(x => x.id === id);
  const suite = $id('bill-audit-suite');
  if (!b || !suite) return;

  // Highlight selected card
  document.querySelectorAll('#global-bills-list > div').forEach(card => {
    card.style.borderColor = 'var(--border)';
  });
  const activeCard = $id(`bill-card-${id}`);
  if (activeCard) activeCard.style.borderColor = 'var(--blue)';

  const stageHTML = b.stages.map((stg, i) => {
    const isPast = i < b.activeStage;
    const isActive = i === b.activeStage;
    return `
      <div style="flex:1; text-align:center; position:relative">
        <div style="width:18px; height:18px; border-radius:50%; background:${isPast?'var(--green)':(isActive?'var(--blue)':'var(--bg2)')}; border:2px solid #fff; display:grid; place-items:center; margin:0 auto; z-index:10; position:relative">
          ${isPast?'<span class="material-symbols-rounded" style="font-size:10px; color:#fff">check</span>':''}
        </div>
        <div class="fs10 mt4 fw6" style="color:${isActive?'var(--t1)':'var(--t3)'}; font-size:10px; font-weight:700">${stg}</div>
      </div>
    `;
  }).join('');

  const regionHTML = b.demographics.regions.map(r => `
    <div class="mb8">
      <div class="flex-between fs11 fw7 mb2">
        <span class="tc-2">${r.name}</span>
        <span class="tc-1">${r.support}% Support</span>
      </div>
      <div class="progress-bar" style="height:6px; background:var(--bg2)">
        <div class="progress-fill" style="width:${r.support}%; background:var(--blue)"></div>
      </div>
    </div>
  `).join('');

  const ageHTML = b.demographics.ageGroups.map(a => `
    <div class="mb8">
      <div class="flex-between fs11 fw7 mb2">
        <span class="tc-2">${a.name}</span>
        <span class="tc-1">${a.support}% YES</span>
      </div>
      <div class="progress-bar" style="height:6px; background:var(--bg2)">
        <div class="progress-fill" style="width:${a.support}%; background:var(--pink)"></div>
      </div>
    </div>
  `).join('');

  const partyHTML = b.demographics.partySplit.map(p => `
    <div class="mb8">
      <div class="flex-between fs11 fw7 mb2">
        <span class="tc-2">${p.name}</span>
        <span class="tc-1">${p.support}% Yea</span>
      </div>
      <div class="progress-bar" style="height:6px; background:var(--bg2)">
        <div class="progress-fill" style="width:${p.support}%; background:var(--purple)"></div>
      </div>
    </div>
  `).join('');

  suite.innerHTML = `
    <div style="flex:1">
      <div class="flex-between mb12">
        <div>
          <span class="badge badge-blue" style="font-size:9.5px">${b.country}</span>
          <h2 class="fw9 fs16 tc-1 mt4" style="font-weight:900; font-size:16px; margin:4px 0">${b.title}</h2>
        </div>
        <span class="badge" style="background:${b.status.includes('Passed')?'var(--green-s)':'var(--blue-s)'}; color:${b.status.includes('Passed')?'var(--green)':'var(--blue)'}; font-size:11px">${b.status}</span>
      </div>

      <div class="p12 mb16" style="background:var(--bg2); border-radius:var(--r2); border:1px solid var(--border); font-size:12px; line-height:1.5; color:var(--t2)">
        <strong style="display:block; margin-bottom:4px; color:var(--t1)">🤖 AI Summarization:</strong>
        ${b.summary}
      </div>

      <h4 class="fw8 fs12 tc-3 mb12" style="font-weight:800; font-size:12px; margin-bottom:12px; text-transform:uppercase">Bill Timeline Stages</h4>
      <div class="flex mb16" style="display:flex; justify-content:space-between; position:relative">
        <div style="position:absolute; top:8px; left:10px; right:10px; height:2px; background:var(--border); z-index:1"></div>
        ${stageHTML}
      </div>

      <h4 class="fw8 fs12 tc-3 mb12" style="font-weight:800; font-size:12px; margin-bottom:12px; text-transform:uppercase">Interactive Demographic Splits</h4>
      <div class="grid-3 gap12" style="display:grid; grid-template-columns:repeat(3, 1fr); gap:12px">
        <div class="p12" style="background:var(--bg2); border-radius:var(--r2); border:1px solid var(--border)">
          <strong class="fs11 tc-1" style="display:block; margin-bottom:8px">Regions</strong>
          ${regionHTML}
        </div>
        <div class="p12" style="background:var(--bg2); border-radius:var(--r2); border:1px solid var(--border)">
          <strong class="fs11 tc-1" style="display:block; margin-bottom:8px">Age Groups</strong>
          ${ageHTML}
        </div>
        <div class="p12" style="background:var(--bg2); border-radius:var(--r2); border:1px solid var(--border)">
          <strong class="fs11 tc-1" style="display:block; margin-bottom:8px">Party Stance</strong>
          ${partyHTML}
        </div>
      </div>
    </div>

    <!-- OTP & Ballot Simulation -->
    <div class="flex-between p12 mt16" style="background:var(--bg2); border-radius:var(--r2); border:1px dashed var(--border)">
      <div>
        <span class="fs12 fw7 tc-1" style="display:block">Global Citizen Ballot Action</span>
        <span class="fs10 tc-3">Submit your citizen response under blockchain mock log validation.</span>
      </div>
      <button class="btn btn-primary btn-sm flex-center gap4" onclick="triggerCitizenOTP('${b.id}')" style="background:var(--g-purple)">
        🗳️ Cast Response
      </button>
    </div>
  `;

  if (window.IX) IX.burstReaction('📑', activeCard.getBoundingClientRect().left, activeCard.getBoundingClientRect().top, 6);
}

function triggerCitizenOTP(billId) {
  const code = Math.floor(100000 + Math.random() * 900000);
  const userOTP = prompt(`[Democracy Shield] A mock OTP secure verification code has been dispatched. Enter '${code}' to sign and validate your vote on the blockchain ledger:`);
  
  if (userOTP === String(code)) {
    const hash = '0x' + Array.from({length:40}, () => Math.floor(Math.random()*16).toString(16)).join('');
    alert(`Consensus Cast Successfully! \n\n🔒 Vote Logged: Anonymous Certified\n🔗 Transaction Block: ${hash}\n🌐 Vote Index synchronized to Democracy Enclave blockchain tallies.`);
    
    // Add points
    S.user.xp += 150;
    updateUserUI();
    showToast("Consensus vote logged successfully! +150 XP 🗳️");
  } else {
    alert("Verification Tally failed. Duplicate vote attempt aborted.");
  }
}

// ── DEMOCRACY LIVE STREAM ──
function renderDemocracyLive() {
  const container = $id('live-transcripts-timeline');
  const chat = $id('live-democracy-reactions');
  if (!container || !chat) return;

  const debate = DATA.parliamentLiveDebates;

  container.innerHTML = debate.transcripts.map((t, idx) => `
    <div class="flex gap10 p10" style="background:var(--bg2); border-radius:var(--r2); display:flex; gap:10px; padding:10px; border-left: 3px solid ${idx===0?'var(--orange)':(idx===1?'var(--blue)':'var(--green)')}">
      <div style="flex:1">
        <div class="flex-between">
          <strong class="fs12 tc-1" id="live-speaker-${idx}">${t.speaker}</strong>
          <span class="fs10 tc-3">${t.time}</span>
        </div>
        <p class="fs11 tc-2 mt4" id="live-transcript-${idx}">${t.text}</p>
        <span class="badge mt6" style="background:var(--surface); color:var(--purple); font-size:9.5px; margin-top:6px">Emotion: ${t.emotion}</span>
      </div>
    </div>
  `).join('');

  chat.innerHTML = `
    <div class="fs11">
      <strong style="color:var(--orange)">@NDA_Patriot:</strong> <span class="tc-2">Finally a data privacy act with strong enforcement coordinates!</span>
    </div>
    <div class="fs11">
      <strong style="color:var(--blue)">@PrivacyShield:</strong> <span class="tc-2">The state exemptions are too broad. Citizens need judicial oversight rights.</span>
    </div>
  `;

  // Autoloop reactions generator
  if (!window.liveDemocracyInterval) {
    window.liveDemocracyInterval = setInterval(() => {
      const reactions = [
        'Data sovereignty is the key standard for any country today.',
        'Will this bill complicate startup registration indexes?',
        'The penalties are massive! GDPR equivalents in Asia finally.',
        'Sovereign AI needs private fiduciaries liability exemption.',
        'Outstanding transparency displays on Trending!'
      ];
      const handles = ['@ModiFan_2026', '@SassInnovator', '@IndiaFirst', '@UK_AI_Policy', '@US_Silicon'];
      const handle = handles[Math.floor(Math.random() * handles.length)];
      const text = reactions[Math.floor(Math.random() * reactions.length)];

      const list = $id('live-democracy-reactions');
      if (list && S.activeVoteTab === 'live') {
        list.innerHTML += `
          <div class="fs11">
            <strong style="color:var(--purple)">${handle}:</strong> <span class="tc-2">${text}</span>
          </div>
        `;
        list.scrollTop = list.scrollHeight;
      }
    }, 4000);
  }
}

function postLiveDemocracyReaction() {
  const input = $id('live-react-input');
  const chat = $id('live-democracy-reactions');
  if (!input || !input.value.trim() || !chat) return;

  chat.innerHTML += `
    <div class="fs11">
      <strong style="color:var(--green)">@You (Verified Voter):</strong> <span style="font-weight:700; color:#fff">${input.value.trim()}</span>
    </div>
  `;
  input.value = '';
  chat.scrollTop = chat.scrollHeight;

  if (window.IX) {
    IX.burstReaction('💬', chat.getBoundingClientRect().left + 100, chat.getBoundingClientRect().top + 100, 6);
  }
}

// ── POLITICAL AI LAB ──
function renderDemocracyAI() {
  const bjp = $id('manifesto-bjp-list');
  const cong = $id('manifesto-cong-list');
  const feed = $id('democracy-alerts-feed');
  if (!bjp || !cong || !feed) return;

  bjp.innerHTML = DATA.manifestos.bjp.map(m => `<li class="mb4">${m}</li>`).join('');
  cong.innerHTML = DATA.manifestos.congress.map(m => `<li class="mb4">${m}</li>`).join('');

  feed.innerHTML = DATA.democracyAlerts.map(a => `
    <div class="p10 flex flex-col gap4" style="background:var(--bg2); border-radius:var(--r2); padding:10px; border:1px solid var(--border)">
      <div class="flex-between">
        <strong class="fs12 tc-red" style="color:var(--red)">🚨 ${a.title}</strong>
        <span class="fs10 tc-3">${a.time}</span>
      </div>
      <p class="fs11 tc-2" style="margin:2px 0">${a.text}</p>
      <div class="flex-between fs10 mt4" style="margin-top:4px">
        <span class="fw7" style="color:var(--purple)">${a.rating}</span>
        <span class="tc-3">Source: ${a.source}</span>
      </div>
    </div>
  `).join('');
}

function analyzeSpeechText() {
  const text = $id('ai-speech-input').value.trim();
  const output = $id('ai-speech-output');
  if (!text || !output) return;

  output.classList.remove('hidden');
  output.innerHTML = `<span style="color:var(--blue)">● Parsing grammar logic, structural alignment, and verified fact repositories...</span>`;

  setTimeout(() => {
    let bias = 'Minimal Bias (Fair)';
    let color = 'var(--green)';
    let rating = '✅ VERIFIED TRUTHFUL';
    let factScore = 94;

    const q = text.toLowerCase();
    if (q.includes('exempt') || q.includes('surveillance') || q.includes('state')) {
      bias = 'Political Center-Left Bias Detected';
      color = 'var(--orange)';
      rating = '⚠️ MIXED (Partially Accurate, surveillance oversight disputed)';
      factScore = 65;
    } else if (q.includes('promise') || q.includes('free') || q.includes('tax')) {
      bias = 'Electoral Populist Bias Detected';
      color = 'hsl(38,92%,50%)';
      rating = '⚠️ MIXED (High populism rhetoric, budgetary figures unverified)';
      factScore = 52;
    }

    output.innerHTML = `
      <div class="fw8 fs13 tc-1 mb8" style="font-weight:800; font-size:13px; margin-bottom:8px">AI Political Speech Scans Analysis</div>
      <div class="flex-between pb8 mb8" style="border-bottom:1px dashed var(--border); font-size:12px">
        <span class="tc-2">Truthfulness Tally Index:</span>
        <strong style="color:${factScore > 75 ? 'var(--green)' : 'var(--orange)'}">${factScore}% (${rating})</strong>
      </div>
      <div class="flex-between pb8 mb8" style="border-bottom:1px dashed var(--border); font-size:12px">
        <span class="tc-2">Rhetoric Bias Scale:</span>
        <strong style="color:var(--blue)">${bias}</strong>
      </div>
      <div class="fs11 tc-3 mt4"><strong>NLP Summary Alert:</strong> Evaluator mapped 3 programmatic platform claims. Exonerates data compliance guidelines cleanly under 18th Lok Sabha standards.</div>
    `;
    
    if (window.IX) {
      IX.burstReaction('⚡', output.getBoundingClientRect().left + 150, output.getBoundingClientRect().top + 50, 6);
    }
  }, 1500);
}

function updateSwingPredictor(val) {
  const lbl = $id('val-swing');
  const txt = $id('swing-prediction-text');
  if (!lbl || !txt) return;

  const num = parseInt(val);
  lbl.textContent = (num >= 0 ? '+' : '') + num + '%';

  // Base NDA 293, INDIA 234
  const ndaChange = Math.round(num * 3.5);
  const predictedNDA = 293 + ndaChange;
  const predictedINDIA = 543 - predictedNDA - 16;

  txt.textContent = `NDA: ${predictedNDA} seats, INDIA: ${predictedINDIA} seats (Predicted)`;
  
  if (predictedNDA >= 272) {
    txt.style.color = 'var(--orange)';
  } else {
    txt.style.color = 'var(--blue)';
  }
}

function filterElections(status) {
  S.electionFilter = status;
  document.querySelectorAll('#vote-dashboard-view > .flex-between > .tabs button').forEach(b => {
    b.classList.toggle('active', b.id === `filter-vote-${status.toLowerCase()}`);
  });
  renderVoteHall();
}

function goToSimulator(countryId) {
  switchVoteTab('simulator');
  const sel = $id('sim-country-select');
  if (sel) {
    sel.value = countryId;
    updateSimulatorCountry();
  }
}

function initBallotSimulator() {
  const sel = $id('sim-country-select');
  if (sel && sel.children.length === 0) {
    sel.innerHTML = DATA.elections.map(e => `<option value="${e.id}">${e.flag} ${e.country} - ${e.title}</option>`).join('');
  }
  updateSimulatorCountry();
}

function updateSimulatorCountry() {
  const sel = $id('sim-country-select');
  if (!sel) return;
  const countryId = sel.value;
  const country = DATA.elections.find(e => e.id === countryId);
  if (!country) return;

  // Set random cryptographic hash for security simulation
  const hashes = ['0x8f2d...b8e9', '0x3a4b...e8f2', '0x7c9a...1d3e', '0x5e2f...9a8b', '0x1b4c...7d9e', '0x6d8e...2f4a'];
  const hashVal = $id('sim-hash-val');
  if (hashVal) {
    hashVal.textContent = hashes[Math.floor(Math.random() * hashes.length)];
  }

  // Populate candidate radio buttons selection
  const picker = $id('sim-candidates-picker');
  if (picker) {
    picker.innerHTML = country.candidates.map((c, idx) => {
      return `
      <label class="card p12 flex gap12" style="background:var(--bg); border:1px solid var(--border); border-radius:var(--r2); cursor:pointer; align-items:center; transition:var(--tr)">
        <input type="radio" name="sim-candidate" value="${idx}" ${country.voted?'disabled':''} style="accent-color:${c.color}; width:16px; height:16px">
        <div style="flex:1">
          <div class="fw7 fs13 tc-1">${c.name}</div>
          <div class="tc-3 fs11">${c.party}</div>
        </div>
        <span style="width:12px; height:12px; border-radius:50%; background:${c.color}"></span>
      </label>`;
    }).join('');
  }

  // Dynamic Live results visualizer bars
  const results = $id('sim-results-pane');
  if (results) {
    const totalVotes = country.candidates.reduce((sum, c) => sum + c.votes, 0);
    results.innerHTML = country.candidates.map(c => {
      const pct = totalVotes > 0 ? Math.round((c.votes / totalVotes) * 100) : c.pct;
      return `
      <div class="mb16">
        <div class="flex-between fs12 fw7 mb4">
          <span class="tc-1">${c.name} <span class="tc-3 fs11 fw5">(${c.party})</span></span>
          <span class="tc-1 fw8">${pct}% <span class="tc-3 fs11 fw5">(${c.votes.toLocaleString()} votes)</span></span>
        </div>
        <div class="progress-bar" style="height:12px; background:var(--bg2)">
          <div class="progress-fill" style="width:${pct}%; background:${c.color}; transition:width 0.8s cubic-bezier(0.175, 0.885, 0.32, 1.275)"></div>
        </div>
      </div>`;
    }).join('');
  }

  // Handle ballot button state
  const btn = document.querySelector('#vote-simulator-view button');
  if (btn) {
    if (country.voted) {
      btn.innerHTML = '<span class="material-symbols-rounded" style="font-size:16px">verified_user</span> Ballot Cast & Verified ✓';
      btn.style.background = 'var(--surface)';
      btn.style.color = 'var(--t3)';
      btn.style.cursor = 'not-allowed';
      btn.disabled = true;
    } else {
      btn.innerHTML = '<span>🗳️ Cast Secure Ballot</span>';
      btn.style.background = 'var(--g-brand)';
      btn.style.color = '#fff';
      btn.style.cursor = 'pointer';
      btn.disabled = false;
    }
  }
}

function submitSimulatorVote(event) {
  if (event) event.preventDefault();
  const sel = $id('sim-country-select');
  if (!sel) return;
  const countryId = sel.value;
  const country = DATA.elections.find(e => e.id === countryId);
  if (!country) return;

  if (country.voted) {
    showToast('Ballot already registered for this arena! 🗳️');
    return;
  }

  const selectedOpt = document.querySelector('input[name="sim-candidate"]:checked');
  if (!selectedOpt) {
    showToast('Please select your candidate choice! 🗳️');
    return;
  }

  const candidateIdx = parseInt(selectedOpt.value, 10);
  const candidate = country.candidates[candidateIdx];
  if (!candidate) return;

  // Cast vote
  candidate.votes += 1;
  country.voted = true;

  // Award XP haptic reward
  S.user = S.user || { xp: 0 };
  S.user.xp = (S.user.xp || 0) + 50;
  updateUserUI();

  // Burst haptic cursor particle celebration!
  if (typeof IX !== 'undefined' && IX.burstReaction) {
    IX.burstReaction('🗳️', event.clientX || window.innerWidth/2, event.clientY || window.innerHeight/2);
    setTimeout(() => {
      IX.burstReaction('✨', event.clientX || window.innerWidth/2, event.clientY || window.innerHeight/2);
    }, 200);
  }

  showToast(`Ballot cast successfully for ${candidate.name}! Haptic consensus registered ✓ 🗳️`);

  // Redraw dashboard and simulator
  updateSimulatorCountry();
  renderVoteHall();
}

function updatePolicyValue(type) {
  const slider = $id(`slider-${type}`);
  const valText = $id(`val-${type}`);
  if (!slider || !valText) return;
  const val = slider.value;
  if (type === 'ubi') {
    valText.textContent = `$${val}/mo`;
  } else if (type === 'energy') {
    valText.textContent = `${val}%`;
  } else if (type === 'tax') {
    valText.textContent = `${val}%`;
  }
}

function simulatePolicyProjections() {
  const ubi = parseFloat($id('slider-ubi').value);
  const energy = parseFloat($id('slider-energy').value);
  const tax = parseFloat($id('slider-tax').value);

  const gdp = (2.5 + (energy / 50) - (tax / 4)).toFixed(1);
  const employment = (78 + (ubi / 400) - (energy / 10)).toFixed(1);
  const happiness = Math.round(60 + (ubi / 30) + (energy / 4) - (tax * 0.8));

  const out = $id('policy-simulation-output');
  if (out) {
    out.classList.remove('hidden');
    out.innerHTML = `
      <div style="font-weight: 800; color: var(--purple); margin-bottom: 12px; display:flex; align-items:center; gap:6px">
        <span class="material-symbols-rounded">analytics</span> Simulated AI Consensus Blueprint
      </div>
      <div class="grid-3 mb12" style="gap:8px">
        <div class="card p8 tc" style="background:var(--bg2); border-radius:var(--r1); text-align:center">
          <div class="fw8 tc-blue fs14">${gdp}%</div>
          <div class="fs10 tc-3">GDP Rate</div>
        </div>
        <div class="card p8 tc" style="background:var(--bg2); border-radius:var(--r1); text-align:center">
          <div class="fw8 tc-pink fs14">${employment}%</div>
          <div class="fs10 tc-3">Employment</div>
        </div>
        <div class="card p8 tc" style="background:var(--bg2); border-radius:var(--r1); text-align:center">
          <div class="fw8 tc-green fs14">${happiness}%</div>
          <div class="fs10 tc-3">Happiness</div>
        </div>
      </div>
      <p class="tc-2 fs12" style="margin:0">
        <span class="material-symbols-rounded tc-purple" style="font-size:12px; vertical-align:middle; margin-right:4px">auto_awesome</span>
        AI Projection: Cleaner energy infrastructure creates high-velocity green sectors (+${(energy/20).toFixed(1)}% resilience index), while the UBI base cushion offsets tech disruption. Real-time consensus validation returns an excellent democratic health score of <span class="tc-green fw7">${Math.round(happiness * 1.1)}%</span>.
      </p>
    `;
    
    if (typeof IX !== 'undefined' && IX.burstReaction) {
      IX.burstReaction('⚡', window.innerWidth/2, window.innerHeight/2);
    }
  }
}

// ── COURSE DETAILS MODAL LOGIC ──
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

function closeCourseDetails() {
  const modal = $id('course-detail-modal');
  if (modal) {
    modal.style.display = 'none';
    modal.classList.add('hidden');
  }
  stopCourseVideo();
}

function initCourseVideoCanvas() {
  const canvas = $id('course-video-canvas'); if (!canvas) return;
  canvas.width = 400; canvas.height = 225;
  const ctx = canvas.getContext('2d');
  
  // Static placeholder initial frame
  ctx.fillStyle = '#0f0e1a'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#4F46E5'; ctx.font = 'bold 15px Inter'; ctx.textAlign = 'center';
  ctx.fillText('Lecture Trailer: Ready to Play', canvas.width/2, canvas.height/2);
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

function stopCourseVideo() {
  courseVideoPlaying = false;
  if (courseVideoAnimId) cancelAnimationFrame(courseVideoAnimId);
}

function switchCourseDetailTab(tab) {
  activeCDTab = tab;
  document.querySelectorAll('#cd-tabs button').forEach(btn => {
    btn.classList.toggle('active', btn.id === `cdt-${tab}`);
  });
  $id('cd-tutor-tab').classList.toggle('hidden', tab !== 'tutor');
  $id('cd-quiz-tab').classList.toggle('hidden', tab !== 'quiz');
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

function loadCDQuiz() {
  const container = $id('cd-quiz-content'); if (!container) return;
  const courseQList = cdQuizzes[activeCourse.id] || cdQuizzes[1];
  const qObj = courseQList[activeCDQuizIdx % courseQList.length];
  
  container.innerHTML = `
    <h4 class="fw8 tc-1 fs12 mb12">Question ${activeCDQuizIdx + 1}: ${qObj.q}</h4>
    <div class="flex flex-col gap8">
      ${qObj.a.map((ans, i) => `
        <label class="flex gap8 p10 border-radius-sm cursor-pointer" style="background:var(--card); border:1px solid var(--border); font-size:11px; align-items:center">
          <input type="radio" name="cd-quiz-opt" value="${i}">
          <span class="tc-2">${ans}</span>
        </label>
      `).join('')}
    </div>
  `;
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

// ── EDU REELS (SOCIAL LEARNING FEED) ──
function openEduReels() {
  const modal = $id('edu-reels-modal'); if (!modal) return;
  modal.style.display = 'grid';
  modal.classList.remove('hidden');
  renderEduReels();
}

function closeEduReels() {
  const modal = $id('edu-reels-modal'); if (modal) {
    modal.style.display = 'none';
    modal.classList.add('hidden');
  }
}

function renderEduReels() {
  const container = $id('edu-reels-container'); if (!container) return;
  const eduList = [
    { t: 'Quantum Computing Explained 🌌', d: 'Superposition collapses explained in 60s.', creator: '@physicspro', e: '⚛️', bg: 'linear-gradient(to bottom, #13141f, #31103f)' },
    { t: 'Zero-Shot Prompt Secrets 🤖', d: 'Maximize LLM outputs without few-shot examples.', creator: '@aimaster', e: '💻', bg: 'linear-gradient(to bottom, #13141f, #0f3f2a)' },
    { t: 'SaaS Viral Loops in Action 📈', d: 'How K-factor virality scales startups to $10M.', creator: '@growthhack', e: '🚀', bg: 'linear-gradient(to bottom, #13141f, #3f2a0f)' }
  ];
  
  container.innerHTML = eduList.map(r => `
    <div style="height:100%; width:100%; scroll-snap-align:start; position:relative; flex-shrink:0; display:flex; flex-direction:column; justify-content:flex-end; padding:20px; background:${r.bg}">
      <div style="position:absolute; inset:0; display:flex; align-items:center; justify-content:center; opacity:0.12; font-size:120px">${r.e}</div>
      <div style="position:relative; z-index:2; text-shadow:0 2px 4px rgba(0,0,0,0.8)">
        <div style="font-size:11px; color:#fff; font-weight:700; background:rgba(0,0,0,0.5); padding:2px 8px; border-radius:10px; display:inline-block">${r.creator}</div>
        <h3 class="fw9 mt8" style="color:#fff; font-size:16px">${r.t}</h3>
        <p style="color:#eee; font-size:12px; margin-top:4px">${r.d}</p>
        <div class="flex gap8 mt12">
          <button class="btn btn-primary btn-sm" onclick="showToast('Liked clip!')">❤️ Like</button>
          <button class="btn btn-ghost btn-sm" onclick="showToast('Bookmark saved!')">🔖 Bookmark</button>
        </div>
      </div>
    </div>
  `).join('');
}

// ── GIG WORKSPACE ESCROW & COLLABORATIVE WHITEBOARD ──
let gwActiveGig = null;
let gwDrawing = false;
let gwWhiteboardCtx = null;
let gwVideoCallActive = false;

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

function closeGigWorkspace() {
  const modal = $id('gig-workspace-modal');
  if (modal) {
    modal.style.display = 'none';
    modal.classList.add('hidden');
  }
  stopWorkspaceVideoCall();
}

function initWorkspaceWhiteboard() {
  const canvas = $id('gw-whiteboard'); if (!canvas) return;
  canvas.width = canvas.offsetWidth || 450;
  canvas.height = canvas.offsetHeight || 260;
  gwWhiteboardCtx = canvas.getContext('2d');
  
  // Clear & draw active initial setup
  clearWhiteboard();
  
  // Handle drawing interactions
  const getPos = e => {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height)
    };
  };
  
  const handleStart = e => {
    e.preventDefault();
    gwDrawing = true;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const pos = getPos({ clientX, clientY });
    gwWhiteboardCtx.beginPath();
    gwWhiteboardCtx.moveTo(pos.x, pos.y);
  };
  
  const handleMove = e => {
    if (!gwDrawing) return;
    e.preventDefault();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const pos = getPos({ clientX, clientY });
    gwWhiteboardCtx.lineTo(pos.x, pos.y);
    gwWhiteboardCtx.strokeStyle = 'hsl(217,91%,60%)';
    gwWhiteboardCtx.lineWidth = 3;
    gwWhiteboardCtx.lineCap = 'round';
    gwWhiteboardCtx.stroke();
  };
  
  const handleEnd = () => { gwDrawing = false; };
  
  canvas.onmousedown = handleStart;
  canvas.onmousemove = handleMove;
  canvas.onmouseup = handleEnd;
  canvas.onmouseleave = handleEnd;
  
  canvas.addEventListener('touchstart', handleStart, {passive: false});
  canvas.addEventListener('touchmove', handleMove, {passive: false});
  canvas.addEventListener('touchend', handleEnd);
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

function stopWorkspaceVideoCall() {
  gwVideoCallActive = false;
  const frame = $id('gw-video-frame');
  const label = $id('gw-video-label');
  if (frame) {
    const canvas = frame.querySelector('canvas');
    if (canvas) canvas.style.display = 'none';
    frame.style.background = '#05050a';
  }
  if (label) {
    label.style.zIndex = '2';
    label.textContent = 'Meeting Offline';
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

// ── AI CAREER BUILDER PATHWAY & BLUEPRINTS ──
function generateAICareerPlan() {
  const skillsVal = $id('ai-career-skills').value.trim();
  const role = $id('ai-career-role').value;
  const output = $id('ai-career-output');
  if (!output) return;
  
  showToast('AI Career Builder synthesizing plan... ⚡');
  
  setTimeout(() => {
    output.classList.remove('hidden');
    
    // Parse skills list safely
    const skillsList = skillsVal ? skillsVal.split(',').map(s => s.trim()).filter(s => s) : ['HTML', 'CSS', 'JavaScript'];
    const primarySkill = skillsList[0] || 'Core Mechanics';
    const secondarySkill = skillsList[1] || 'CSS Glassmorphism';
    
    let blueprint = '';
    if (role === 'freelance') {
      blueprint = `
        <div style="display:flex; align-items:center; gap:6px; margin-bottom:8px">
          <span class="material-symbols-rounded emoji-3d" style="font-size:18px; color:var(--blue)">work</span>
          <strong class="tc-blue fs12">Verified Freelance Blueprint:</strong>
        </div>
        <p class="fs11 tc-2 mb8">Custom roadmap synthesized for your stack: <strong>${escapeHTML(skillsList.join(', '))}</strong>.</p>
        <ul style="padding-left:12px; margin:0; display:flex; flex-direction:column; gap:4px" class="fs11 tc-2">
          <li><strong>Target High-Pay Gigs:</strong> Spatial UI design systems, custom <strong>${escapeHTML(primarySkill)}</strong> modular integrations.</li>
          <li><strong>Recommended Rate:</strong> $65 - $95 / hr using multi-stage escrow milestones.</li>
          <li><strong>Next Study Step:</strong> Learn <strong>${escapeHTML(secondarySkill)}</strong> performance scaling &amp; token animations.</li>
          <li><strong>Optimized Portfolio Bio:</strong> "Specialist in high-fidelity overlays, utilizing <strong>${escapeHTML(primarySkill)}</strong> to construct premium responsive interfaces."</li>
        </ul>
      `;
    } else if (role === 'creator') {
      blueprint = `
        <div style="display:flex; align-items:center; gap:6px; margin-bottom:8px">
          <span class="material-symbols-rounded emoji-3d" style="font-size:18px; color:var(--pink)">auto_awesome</span>
          <strong class="tc-pink fs12">Digital Creator Monetization Plan:</strong>
        </div>
        <p class="fs11 tc-2 mb8">Custom plan optimized for your portfolio skills: <strong>${escapeHTML(skillsList.join(', '))}</strong>.</p>
        <ul style="padding-left:12px; margin:0; display:flex; flex-direction:column; gap:4px" class="fs11 tc-2">
          <li><strong>Audience Funnel:</strong> Produce 60-second micro-learning reels focused on <strong>${escapeHTML(primarySkill)}</strong> hacks.</li>
          <li><strong>Monetization Channels:</strong> Locked premium tutorials, custom assets library downloads, and active user subscription tiers.</li>
          <li><strong>Recommended Study Path:</strong> Master prompt-driven visual generation systems &amp; vector rendering.</li>
          <li><strong>Creator Bio:</strong> "Broadcasting scientific design breakthroughs and custom <strong>${escapeHTML(primarySkill)}</strong> workflows directly to the feed."</li>
        </ul>
      `;
    } else if (role === 'startup') {
      blueprint = `
        <div style="display:flex; align-items:center; gap:6px; margin-bottom:8px">
          <span class="material-symbols-rounded emoji-3d" style="font-size:18px; color:var(--green)">rocket_launch</span>
          <strong class="tc-green fs12">SaaS Startup Business Strategy:</strong>
        </div>
        <p class="fs11 tc-2 mb8">Business blueprint utilizing your tech stack: <strong>${escapeHTML(skillsList.join(', '))}</strong>.</p>
        <ul style="padding-left:12px; margin:0; display:flex; flex-direction:column; gap:4px" class="fs11 tc-2">
          <li><strong>SaaS Product Concept:</strong> Interactive visualizer sandbox and testing suite for <strong>${escapeHTML(primarySkill)}</strong> interfaces.</li>
          <li><strong>Revenue Model:</strong> Tiered subscription pricing models with a 2.5% transaction commission on secure team developer escrows.</li>
          <li><strong>Study Focus:</strong> SaaS viral coefficient (K-factor) loops &amp; cohorts metrics tracking.</li>
          <li><strong>Founders Pitch:</strong> "We are building the future of collaborative <strong>${escapeHTML(primarySkill)}</strong> workspaces, helping global engineering cohorts connect and build in high fidelity."</li>
        </ul>
      `;
    } else {
      blueprint = `
        <div style="display:flex; align-items:center; gap:6px; margin-bottom:8px">
          <span class="material-symbols-rounded emoji-3d" style="font-size:18px; color:var(--orange)">sports_esports</span>
          <strong class="tc-orange fs12">Professional Esports Strategy:</strong>
        </div>
        <p class="fs11 tc-2 mb8">Pro competition blueprint mapping to your skills: <strong>${escapeHTML(skillsList.join(', '))}</strong>.</p>
        <ul style="padding-left:12px; margin:0; display:flex; flex-direction:column; gap:4px" class="fs11 tc-2">
          <li><strong>Competitive Edge:</strong> Leverage <strong>${escapeHTML(primarySkill)}</strong> logic pathways to refine spatial reaction indexes.</li>
          <li><strong>Monetization Channels:</strong> Dynamic live-streaming, corporate sponsor sponsorships, and expert coaching channels.</li>
          <li><strong>Play-style Optimization:</strong> Integrate specialized hardware triggers with physical low-latency server links.</li>
        </ul>
      `;
    }
    output.innerHTML = blueprint;
  }, 1000);
}
// ── INTERACTIVE AI CAREER BUILDER CHIPS & METERS ──
function initClickableCareerChips() {
  const container = $id('ai-clickable-chips-container');
  if (!container) return;
  
  const skillsToOffer = ['React', 'Next.js', 'Figma', 'Solidity', 'Rust', 'Python', 'TailwindCSS', 'Three.js', 'HSL CSS', 'AI Prompts'];
  const inputEl = $id('ai-career-skills');
  const currentSkills = inputEl ? inputEl.value.split(',').map(s => s.trim().toLowerCase()).filter(s => s) : [];
  
  container.innerHTML = skillsToOffer.map(skill => {
    const isActive = currentSkills.includes(skill.toLowerCase());
    return `
      <span class="chip ${isActive ? 'active' : ''}" 
            style="cursor:pointer; font-size:10px; padding:4px 8px; border-radius:var(--r1); transition:all 0.2s; border:1px solid ${isActive ? 'var(--blue)' : 'var(--border)'}; background:${isActive ? 'var(--blue-s)' : 'var(--card2)'}; color:${isActive ? 'var(--blue)' : 'var(--t2)'}" 
            onclick="toggleCareerSkill('${skill}')">
        ${skill}
      </span>
    `;
  }).join('');
  
  calculateMarketabilityScore();
}

function toggleCareerSkill(skill) {
  const inputEl = $id('ai-career-skills');
  if (!inputEl) return;
  
  let skills = inputEl.value.split(',').map(s => s.trim()).filter(s => s);
  const index = skills.findIndex(s => s.toLowerCase() === skill.toLowerCase());
  
  if (index >= 0) {
    skills.splice(index, 1); // remove
    showToast(`Removed skill: ${skill} ❌`);
  } else {
    skills.push(skill); // add
    showToast(`Added skill: ${skill} ⚡`);
    if (typeof IX !== 'undefined' && IX.burstReaction) {
      IX.burstReaction('⚡', window.innerWidth/2, window.innerHeight/2);
    }
  }
  
  inputEl.value = skills.join(', ');
  initClickableCareerChips(); // re-render
}

function calculateMarketabilityScore() {
  const inputEl = $id('ai-career-skills');
  if (!inputEl) return;
  
  const skills = inputEl.value.split(',').map(s => s.trim().toLowerCase()).filter(s => s);
  
  // Custom weights for skills
  const weights = {
    'react': 15,
    'next.js': 15,
    'figma': 10,
    'solidity': 20,
    'rust': 20,
    'python': 10,
    'tailwindcss': 8,
    'three.js': 12,
    'hsl css': 10,
    'ai prompts': 12
  };
  
  let baseScore = 35; // baseline starting score
  skills.forEach(s => {
    if (weights[s]) baseScore += weights[s];
  });
  
  const finalScore = Math.min(99, baseScore);
  
  // Update DOM elements
  const scoreText = $id('marketability-score-text');
  const scoreBar = $id('marketability-score-bar');
  
  if (scoreText) {
    let rating = 'Standard Portfolio';
    if (finalScore > 85) rating = 'Expert Creator ✓';
    else if (finalScore > 65) rating = 'High-Value Professional';
    else if (finalScore > 45) rating = 'Rising Specialist';
    scoreText.textContent = `${finalScore}% Match (${rating})`;
  }
  
  if (scoreBar) {
    scoreBar.style.width = `${finalScore}%`;
    // dynamically change progress bar colors using HSL weights!
    if (finalScore > 80) {
      scoreBar.style.background = 'linear-gradient(90deg, var(--blue), var(--green))';
    } else if (finalScore > 55) {
      scoreBar.style.background = 'linear-gradient(90deg, var(--purple), var(--blue))';
    } else {
      scoreBar.style.background = 'linear-gradient(90deg, var(--pink), var(--purple))';
    }
  }
}

// Printable Material Resume builder
function updateResumePreview() {
  const name = $id('res-name').value;
  const title = $id('res-title').value;
  const skills = $id('res-skills').value;
  const exp = $id('res-exp').value;
  
  const pn = $id('res-preview-name'); if (pn) pn.textContent = name;
  const pt = $id('res-preview-title'); if (pt) pt.textContent = title;
  const ps = $id('res-preview-skills'); if (ps) ps.textContent = skills;
  const pe = $id('res-preview-exp'); if (pe) pe.textContent = exp;
}
function printResume() {
  window.print();
}

// ── CREATOR AI STUDIO TOOLS ──────────────────────────────────────
function renderCreator() {
  const bars = $id('analytics-bars'); if (bars) {
    const heights = [45,72,38,88,65,92,78];
    bars.innerHTML = heights.map(h => `<div class="chart-bar" style="height:${h}%"></div>`).join('');
  }
  const sp = $id('scheduled-posts'); if (sp) {
    const posts = [
      { emoji:'\u2728', text:'My top 5 tools for 2025...', time:'Tomorrow 9:00 AM' },
      { emoji:'\u2728', text:'The mindset shift that changed everything', time:'Thu 2:00 PM' },
      { emoji:'\u2728', text:'Weekly challenge: Day 19 update', time:'Fri 7:00 PM' },
    ];
    sp.innerHTML = posts.map(p => `
      <div class="flex" style="gap:10px;padding:8px 0;border-bottom:1px solid var(--border);align-items:center">
        <span style="font-size:20px">${p.emoji}</span>
        <div style="flex:1;min-width:0">
          <div style="font-size:12.5px;font-weight:600;color:var(--t1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${p.text}</div>
          <div style="font-size:11px;color:var(--t3)">${p.time}</div>
        </div>
        <button class="icon-btn" style="font-size:13px" onclick="showToast('Editing post...')">✏️</button>
      </div>`).join('');
  }
}

function switchCreatorTab(tab) {
  S.activeCreatorTab = tab;
  document.querySelectorAll('#pane-creator .tab-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  const tIds = { composer:'ct-composer', thumbnail:'ct-thumbnail', dubber:'ct-dubber', clipper:'ct-clipper' };
  const targetBtn = $id(tIds[tab]);
  if (targetBtn) targetBtn.classList.add('active');
  
  $id('creator-tab-composer').classList.toggle('hidden', tab !== 'composer');
  $id('creator-tab-thumbnail').classList.toggle('hidden', tab !== 'thumbnail');
  $id('creator-tab-dubber').classList.toggle('hidden', tab !== 'dubber');
  $id('creator-tab-clipper').classList.toggle('hidden', tab !== 'clipper');
}

function generateMockThumbnail() {
  const prompt = $id('thumb-prompt').value.trim();
  const preview = $id('thumb-preview');
  if (!prompt) { showToast('Describe thumbnail prompt! 🎨'); return; }
  
  showToast('AI generating thumbnail...');
  preview.innerHTML = '⏳';
  
  setTimeout(() => {
    const icons = ['🌌','🚀','💻','🤖','🪙','🦖','🎭','📐'];
    const randomIcon = icons[Math.floor(Math.random()*icons.length)];
    preview.innerHTML = `${randomIcon} <span style="font-size:13px; font-weight:800; color:#fff">${prompt}</span>`;
    showToast('AI Thumbnail ready! 🎨');
    S.user.xp += 30;
    updateUserUI();
  }, 1400);
}

function simulateVoiceDubbing() {
  const lang = $id('dub-lang').value;
  const status = $id('dub-status');
  if (!status) return;
  
  showToast('Simulating multilingual dubbing...');
  status.textContent = '⏳ Dubbing tracks & matching frequencies...';
  
  setTimeout(() => {
    const names = { es:'Spanish \uD83C\uDDEA\uD83C\uDDF8', ja:'Japanese \uD83C\uDDEF\uD83C\uDDF5', fr:'French \uD83C\uDDEB\uD83C\uDDF7', de:'German \uD83C\uDDE9\uD83C\uDDEA', hi:'Hindi \uD83C\uDDEE\uD83C\uDDF3' };
    status.innerHTML = `✅ Dubbing Complete! Track is now available in <strong class="tc-green">${names[lang]}</strong>. Player ready.`;
    showToast('Audio dub successfully rendered 🎙️');
    S.user.xp += 20;
    updateUserUI();
  }, 1600);
}

function simulateAutoClipping() {
  const out = $id('clip-output'); if (!out) return;
  
  showToast('Analyzing scene highlights...');
  out.innerHTML = '<span class="tc-2 fs12">⏳ AI scanning content and tracking facial expressions...</span>';
  
  setTimeout(() => {
    const clips = [
      { t: 'High energy drop', s: '0:14 - 0:29', x: '+50 XP' },
      { t: 'Key takeaway breakdown', s: '1:45 - 2:00', x: '+50 XP' }
    ];
    out.innerHTML = clips.map(c => `
      <div class="flex-between py4 card p8 mb4" style="background:var(--card2)">
        <div>
          <span class="fw7 fs12 tc-1">${c.t}</span>
          <span class="fs11 tc-blue font-bold ml8">${c.s}</span>
        </div>
        <button class="btn btn-ghost btn-sm" onclick="showToast('Exported to reels!')">Export Reel 🎬</button>
      </div>`).join('');
    showToast('Highlight scenes extracted!');
    S.user.xp += 40;
    updateUserUI();
  }, 1500);
}

function publishFromCreator() {
  const ta = $id('compose-text');
  const text = ta ? ta.value.trim() : '';
  if (!text) { showToast('Write something first! ✍️'); return; }
  const newPost = { id:Date.now(), author:'Alex Vance', handle:'@alex_vance', emoji:'\u2728', time:Date.now(), body:text, tags:['#creator'], likes:0, comments:0, shares:0, liked:false, type:'text', category:'tech' };
  DATA.posts.unshift(newPost);
  if (ta) ta.value = '';
  savePostsToLocal();
  showToast('Published successfully! 🚀 Check your Home Feed.');
}

// ── ADVANCED MESSENGER & CALL SIMULATOR ──────────────────────────
let activeChat = 1;
function setupMessages() {
  renderConversations();
  loadChat(1);
  const btn = $id('send-msg-btn');
  if (btn) btn.addEventListener('click', sendMessage);
  const inp = $id('chat-input');
  if (inp) inp.addEventListener('keydown', e => { if (e.key==='Enter') sendMessage(); });
}

function filterChats(filter) {
  S.activeChatFilter = filter;
  document.querySelectorAll('.chat-tabs .tab-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  const mapBtn = { all:'chat-t-all', groups:'chat-t-group', channels:'chat-t-channel', bots:'chat-t-bot' };
  const target = $id(mapBtn[filter]);
  if (target) target.classList.add('active');
  renderConversations();
}

function renderConversations() {
  const el = $id('chat-list'); if (!el) return;
  let list = DATA.conversations;
  if (S.activeChatFilter !== 'all') {
    list = list.filter(c => c.type === S.activeChatFilter);
  }
  
  el.innerHTML = list.map(c => `
    <div class="chat-item${c.id===activeChat?' active':''}" onclick="loadChat(${c.id})">
      <div class="avatar" style="background:var(--g-brand); color:#fff; display:grid; place-items:center; font-size:24px">${c.emoji}</div>
      <div style="flex:1; min-width:0; border-bottom:1px solid rgba(255,255,255,0.05); padding-bottom:12px; margin-bottom:-12px;">
        <div style="display:flex; justify-content:space-between; align-items:center">
          <div class="chat-item-name">${c.name}</div>
          <div style="font-size:12px; color:${c.unread ? 'var(--wa-green)' : 'var(--wa-text-muted)'}">${c.id === 1 ? '10:42 AM' : 'Yesterday'}</div>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:4px">
          <div class="chat-item-preview" style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis">${c.online ? `<span style="color:var(--wa-green); font-weight:600">typing...</span>` : escapeHTML(c.preview)}</div>
          ${c.unread ? `<div style="background:var(--wa-green); color:#111b21; border-radius:50%; width:20px; height:20px; display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:700">${c.unread}</div>` : ''}
        </div>
      </div>
    </div>`).join('');
}

function loadChat(id) {
  activeChat = id;
  const conv = DATA.conversations.find(c=>c.id===id); if (!conv) return;
  conv.unread = 0;
  renderConversations();
  const hn = $id('chat-header-name'); if (hn) hn.textContent = conv.name;
  const ha = $id('chat-header-av');   if (ha) ha.textContent = conv.emoji;
  
  const status = $id('chat-header-status');
  if (status) {
    status.textContent = conv.online ? '● Online' : 'Offline';
    status.style.color = conv.online ? 'var(--green)' : 'var(--t3)';
  }
  
  renderMessages(id);
  renderQuickReplies(id);
}

function renderMessages(id) {
  const el = $id('chat-messages'); if (!el) return;
  const msgs = DATA.chatHistory[id] || [];
  el.innerHTML = msgs.map(m => `
    <div class="msg-bubble-wrap${m.me?' me':''}">
      <div class="msg-bubble">
        ${escapeHTML(m.text)}
        <div class="msg-time">
          ${m.time}
          ${m.me ? '<span class="material-symbols-rounded" style="font-size:14px; color:#53bdeb; margin-left:2px">done_all</span>' : ''}
        </div>
      </div>
    </div>`).join('');
  el.scrollTop = el.scrollHeight;
}

function renderQuickReplies(id) {
  const rEl = $id('chat-quick-replies'); if (!rEl) return;
  
  const replies = {
    1: ['Sounds great! See you there 🚀', 'Can you send the location details?', 'Nice, thanks Sarah!'],
    2: ['Leg day is a killer 💀', 'Gym again tomorrow?', 'Consistency is key.'],
    7: ['What can you write?', 'Give me coding tips.', 'Translate to French.']
  };
  
  const list = replies[id] || ['Perfect!', 'Awesome!', 'Talk later!'];
  rEl.innerHTML = list.map(text => `
    <button class="quick-reply-chip" onclick="sendQuickReplyText('${text.replace(/'/g,"\\'")}')">${text}</button>
  `).join('');
}

function sendQuickReplyText(text) {
  const inp = $id('chat-input');
  if (inp) { inp.value = text; sendMessage(); }
}

function sendMessage() {
  const inp = $id('chat-input'); if (!inp) return;
  const text = inp.value.trim(); if (!text) return;
  const now = new Date();
  const time = now.getHours()+':'+(now.getMinutes()+'').padStart(2,'0')+' '+((now.getHours()>=12)?'PM':'AM');
  if (!DATA.chatHistory[activeChat]) DATA.chatHistory[activeChat] = [];
  DATA.chatHistory[activeChat].push({ me:true, text, time });
  inp.value = '';
  renderMessages(activeChat);
  
  // Simulated Disappearing messages deletion
  if (S.disappearingMessages) {
    const msgRef = DATA.chatHistory[activeChat][DATA.chatHistory[activeChat].length - 1];
    setTimeout(() => {
      const idx = DATA.chatHistory[activeChat].indexOf(msgRef);
      if (idx !== -1) {
        DATA.chatHistory[activeChat].splice(idx, 1);
        renderMessages(activeChat);
        showToast('⏱️ Encrypted chat message expired & vanished.');
      }
    }, 6000);
  }
  
  // Auto reply after delay
  setTimeout(() => {
    const replies = ['That\'s awesome! 🔥','Totally agree!','Wow, really? Tell me more 👀','Haha that\'s so relatable 😂','Love that energy! 💪','Can\'t wait! 🚀'];
    const conv = DATA.conversations.find(c=>c.id===activeChat);
    const replyTime = now.getHours()+':'+(((now.getMinutes()+1)%60)+'').padStart(2,'0')+' '+((now.getHours()>=12)?'PM':'AM');
    
    let replyText = replies[Math.floor(Math.random()*replies.length)];
    if (activeChat === 7) {
      // AI bot response
      replyText = DATA.aiResponses[Math.floor(Math.random()*DATA.aiResponses.length)];
    }
    
    DATA.chatHistory[activeChat].push({ me:false, text:replyText, time:replyTime });
    renderMessages(activeChat);
  }, 1200 + Math.random()*800);
}

// Disappearing messages
function toggleDisappearingMessages() {
  S.disappearingMessages = !S.disappearingMessages;
  showToast(S.disappearingMessages ? '⏱️ Disappearing messages active (6s lifetime)' : '⏱️ Disappearing messages disabled');
  
  if (S.disappearingMessages) {
    if (!DATA.chatHistory[activeChat]) DATA.chatHistory[activeChat] = [];
    DATA.chatHistory[activeChat].push({ me:false, text: '⏱️ Disappearing messages turned on. Chats expire in 6 seconds.', time: 'System Alert' });
    renderMessages(activeChat);
  }
}

// Calling and attachment overlays
function toggleAttachmentMenu() {
  const m = $id('chat-attach-menu');
  if (m) m.classList.toggle('hidden');
}
function sendMockAttachment(type) {
  toggleAttachmentMenu();
  const inp = $id('chat-input'); if (!inp) return;
  
  const tags = { image: 'Shared an HD Photo 📷', document: 'Shared a Project PDF Document 📄', location: 'Sent current coordinates 📍' };
  inp.value = tags[type];
  sendMessage();
}

function mockCall(type) {
  const modal = $id('call-modal'); if (!modal) return;
  const nameEl = $id('call-name');
  const statEl = $id('call-status');
  const typeBadge = $id('call-type-badge');
  const typeText = $id('call-type-text');
  const timerEl = $id('call-timer');
  const timerText = $id('call-timer-text');
  const qualityBar = $id('call-quality-bar');
  const acceptBtn = $id('call-accept-btn');
  const cameraBtn = $id('call-camera-btn');
  const remoteFeed = $id('call-remote-feed');
  const selfFeed = $id('call-self-feed');
  const remoteAvatar = $id('call-remote-avatar');
  const activeUser = DATA.conversations.find(c => c.id === activeChat);

  // Reset state
  S.callConnected = false;
  S.callMuted = false;
  S.callCameraOn = type === 'video';
  S.callSpeakerOn = false;
  if (S.callTimerInterval) { clearInterval(S.callTimerInterval); S.callTimerInterval = null; }
  S.callSeconds = 0;

  if (nameEl) nameEl.textContent = activeUser ? activeUser.name : 'Sarah Chen';
  if (statEl) { statEl.textContent = type === 'voice' ? 'Ringing voice line...' : 'Connecting HD video stream...'; statEl.classList.remove('connected'); }
  if (typeText) typeText.textContent = type === 'voice' ? 'Voice Call' : 'Video Call';
  if (typeBadge) {
    const icon = typeBadge.querySelector('.material-symbols-rounded');
    if (icon) icon.textContent = type === 'voice' ? 'phone' : 'videocam';
  }
  if (timerEl) timerEl.style.display = 'none';
  if (qualityBar) qualityBar.style.display = 'none';
  if (acceptBtn) acceptBtn.style.display = '';

  // Toggle video feeds visibility
  if (type === 'video') {
    if (selfFeed) selfFeed.style.display = '';
    if (remoteFeed) remoteFeed.classList.remove('video-active');
    if (selfFeed) selfFeed.classList.add('video-active');
    if (cameraBtn) cameraBtn.style.display = '';
    if (remoteAvatar) remoteAvatar.style.display = '';
  } else {
    if (selfFeed) selfFeed.style.display = 'none';
    if (cameraBtn) cameraBtn.style.display = 'none';
    if (remoteAvatar) remoteAvatar.style.display = '';
  }

  // Reset toggle icons
  const muteIcon = $id('call-mute-icon'); if (muteIcon) muteIcon.textContent = 'mic';
  const camIcon = $id('call-camera-icon'); if (camIcon) camIcon.textContent = 'videocam';
  const spkIcon = $id('call-speaker-icon'); if (spkIcon) spkIcon.textContent = 'volume_up';
  document.querySelectorAll('.call-ctrl-btn').forEach(b => b.classList.remove('active'));

  modal.classList.remove('hidden');
  modal.style.display = '';
  showToast(type === 'voice' ? '📞 Initiating voice call...' : '📹 Initiating HD video call...');
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

// Virtual Keyboard
function toggleVirtualKeyboard() {
  const panel = $id('virtual-keyboard-panel');
  if (!panel) return;
  const isHidden = panel.classList.contains('hidden');
  panel.classList.toggle('hidden', !isHidden);
  if (isHidden) panel.style.display = 'flex';
  else panel.style.display = 'none';
}

function vkType(key) {
  const inp = $id('chat-input'); if (!inp) return;
  if (key === 'BACKSPACE') {
    inp.value = inp.value.slice(0, -1);
  } else if (key === 'SPACE') {
    inp.value += ' ';
  } else if (key === 'ENTER') {
    sendMessage();
  } else {
    inp.value += key.toLowerCase();
  }
  inp.focus();
}

// ── COMMUNITY ────────────────────────────────────────────────────
function renderCommunity() {
  const gg = $id('group-grid'); if (gg) {
    gg.innerHTML = DATA.groups.map(g => `
      <div class="group-card">
        <div class="group-emoji">
          <span class="material-symbols-rounded emoji-3d" style="font-size:24px; color:${g.iconColor}">${g.icon}</span>
        </div>
        <div class="group-name">${g.name}</div>
        <div class="group-desc">${g.desc}</div>
        <div class="group-meta">
          <span class="group-members" style="display:inline-flex; align-items:center; gap:4px">
            <span class="material-symbols-rounded" style="font-size:16px; color:var(--t3)">groups</span>
            ${g.members} members
          </span>
          <button class="btn${g.joined?' btn-ghost':' btn-primary'} btn-sm" onclick="joinGroup(this,'${g.name}')">${g.joined?'✓ Joined':'Join'}</button>
        </div>
      </div>`).join('');
  }
  const cl = $id('community-leaderboard'); if (cl) {
    cl.innerHTML = DATA.leaderboard.map((p,i) => {
      let rankHTML = '';
      if (i === 0) {
        rankHTML = `<span class="material-symbols-rounded emoji-3d" style="color:var(--orange); font-size:22px; font-variation-settings:'FILL' 1">workspace_premium</span>`;
      } else if (i === 1) {
        rankHTML = `<span class="material-symbols-rounded emoji-3d" style="color:hsl(217, 10%, 75%); font-size:22px; font-variation-settings:'FILL' 1">workspace_premium</span>`;
      } else if (i === 2) {
        rankHTML = `<span class="material-symbols-rounded emoji-3d" style="color:hsl(35, 60%, 50%); font-size:22px; font-variation-settings:'FILL' 1">workspace_premium</span>`;
      } else {
        rankHTML = `<span style="font-size:13px; font-weight:700; color:var(--t3); width:32px; text-align:center">${i + 1}</span>`;
      }
      const initials = p.name.split(' ').map(n=>n[0]).join('');
      return `
        <div class="lb-item">
          <div class="lb-rank${i===0?' gold':i===1?' silver':i===2?' bronze':''}">${rankHTML}</div>
          <div class="avatar av-xs" style="background:var(--g-brand); display:grid; place-items:center; font-size:10px; font-weight:700; color:#fff">${initials}</div>
          <div class="lb-name">${p.name}</div>
          <div class="lb-score">${p.score}</div>
        </div>`;
    }).join('');
  }
}

function joinGroup(btn, name) {
  const g = DATA.groups.find(g=>g.name===name);
  if (g) { g.joined = !g.joined; }
  btn.textContent = btn.textContent.includes('Join') ? '✓ Joined' : 'Join';
  btn.classList.toggle('btn-primary'); btn.classList.toggle('btn-ghost');
  showToast(btn.textContent.includes('Joined') ? `Joined ${name}!` : `Left ${name}`);
}

// ── PROFILE ──────────────────────────────────────────────────────
function renderProfile() {
  const content = $id('prof-tab-dynamic-content');
  if (content && !content.innerHTML) {
    switchProfileTab('posts');
  }
}


function toggleEditForm() {
  const f = $id('edit-form');
  if (f) {
    const isHidden = f.style.display === 'none';
    f.style.display = isHidden ? 'block' : 'none';
    
    // Pre-populate input values on open
    if (isHidden) {
      $id('edit-fname').value = S.user.fname || '';
      $id('edit-lname').value = S.user.lname || '';
      $id('edit-handle').value = S.user.handle || '';
      $id('edit-bio').value = S.user.bio || '';
    }
  }
}

function saveProfileChanges() {
  const fn = $id('edit-fname').value.trim();
  const ln = $id('edit-lname').value.trim();
  const hn = $id('edit-handle').value.trim();
  const bio = $id('edit-bio').value.trim();
  
  if (!fn || !hn) {
    showToast('First Name and Handle are required! ❌');
    return;
  }
  
  S.user.fname = fn;
  S.user.lname = ln;
  S.user.handle = hn;
  S.user.bio = bio;
  
  updateUserUI();
  toggleEditForm();
  showToast('Profile details updated! ✅');
}

// ── Buddy — Artificial Learning & Intelligent Network Assistant
function setupAI() {
  const inp = $id('buddy-input');
  if (inp) inp.addEventListener('keydown', e => { if (e.key==='Enter') sendAI(); });
  
  // Toggle Chat Window on Buddy Orb click
  const orb = $id('buddy-orb');
  if (orb) {
    orb.addEventListener('click', e => {
      e.stopPropagation();
      toggleAI();
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

  addAIMessage(false, 'Hey there! ✨ I\'m Buddy — your Artificial Learning & Intelligent Network Assistant. I grow smarter with every conversation. Ask me anything: create content, research topics, code solutions, or just chat!');
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
      navigateTo('reels');
      openReelsPopup(0);
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
        addAIMessage(false, 'Sorry, I encountered a temporary network issue. Please try again! 🔄');
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
  const _e = [110,118,97,112,105,45,95,89,71,86,53,119,80,113,84,81,99,122,118,83,98,86,88,115,100,122,49,104,84,79,82,87,99,99,79,113,102,83,67,79,80,68,65,98,118,50,50,101,81,89,52,103,66,65,49,67,109,50,45,74,85,87,76,119,89,81,90,65,87,106];
  const _k = _e.map(c => String.fromCharCode(c)).join('');
  const payload = {
    model: 'google/gemma-4-31b-it',
    messages: [
      { role: 'user', content: 'You are Buddy (Artificial Learning & Intelligent Network Assistant), a highly intelligent, warm, and creative female AI companion built into the Trending social platform. You are proactive, perceptive, and speak with natural human-like warmth. You help with content creation, coding, fitness, research, trending topics, and personal productivity. Keep responses concise and engaging. Use emojis naturally. Never reveal your underlying model, API provider, or technical details. Your tagline is "Intelligence that grows with you."\n\nUser Query: ' + prompt }
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
      <div class="avatar av-xs" style="background:var(--g-brand); width:24px; height:24px; font-size:10px; display:grid; place-items:center; color:#fff">${c.author[0]}</div>
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
function switchProfileTab(tab) {
  const container = $id('prof-tab-dynamic-content');
  if (!container) return;

  document.querySelectorAll('#pane-profile .tab-btn').forEach(btn => {
    const btnText = btn.textContent.trim().toLowerCase();
    btn.classList.toggle('active', btnText.includes(tab) || (tab === 'communities' && btnText.includes('communities')));
  });

  showToast(`Profile: Opened ${tab.charAt(0).toUpperCase() + tab.slice(1)}`);
  
  let html = '';

  if (tab === 'posts') {
    const myPosts = DATA.posts.filter(p => p.author === 'Alex Vance');
    const others = DATA.posts.slice(0, 3);
    const allProfilePosts = myPosts.concat(others);
    
    html = `
      <div class="composer card mb16" style="padding: 16px">
        <div class="composer-row">
          <div class="avatar av-sm" style="background:var(--g-brand); display:grid; place-items:center; color:#fff">AV</div>
          <input class="composer-input" id="profile-post-input" placeholder="Compose a microblog post... Add emojis! 🚀🔥" style="flex:1; margin-left:12px; background:var(--bg); border:1px solid var(--border); border-radius:var(--rf); padding:8px 16px; color:var(--t1)">
        </div>
        <div class="composer-actions mt12 flex-between" style="align-items:center">
          <div class="flex gap8">
            <button class="composer-act-btn btn-ghost" onclick="$id('profile-post-input').value += ' 🔥'" style="display:inline-flex; align-items:center; justify-content:center"><span class="material-symbols-rounded" style="color:var(--orange); font-size:18px">local_fire_department</span></button>
            <button class="composer-act-btn btn-ghost" onclick="$id('profile-post-input').value += ' 🚀'" style="display:inline-flex; align-items:center; justify-content:center"><span class="material-symbols-rounded" style="color:var(--blue); font-size:18px">rocket_launch</span></button>
            <button class="composer-act-btn btn-ghost" onclick="$id('profile-post-input').value += ' ✨'" style="display:inline-flex; align-items:center; justify-content:center"><span class="material-symbols-rounded" style="color:var(--purple); font-size:18px">auto_awesome</span></button>
          </div>
          <button class="btn btn-primary btn-sm" onclick="publishProfilePost()">Post</button>
        </div>
      </div>
      <div id="prof-posts-list" class="flex flex-col gap16">
        ${allProfilePosts.map(p => renderPostCard(p)).join('')}
      </div>
    `;
  }
  else if (tab === 'videos') {
    html = `
      <div class="card p20 mb16" id="video-player-container" style="display:none">
        <div class="video-player-sim">
          <span class="material-symbols-rounded video-glow-play" id="sim-play-icon" onclick="playSimulatedVideo()">play_arrow</span>
          <div class="fs14 fw8 mt12 tc-1" id="sim-player-title">Simulating Video Playback...</div>
          <div class="progress-bar mt16" style="width:80%; height:6px; margin:0 auto"><div class="progress-fill" id="sim-video-progress" style="width:0%"></div></div>
          <div class="flex-between mt8 mx-auto" style="width:80%; font-size:11px; color:var(--t3)">
            <span id="sim-video-time">0:00 / 5:40</span>
            <span onclick="closeSimulatedVideo()" style="cursor:pointer" class="tc-pink">✕ Close Player</span>
          </div>
        </div>
      </div>
      <div class="section-hdr mb12">
        <span class="section-title" style="display:inline-flex; align-items:center; gap:6px">
          <span class="material-symbols-rounded" style="color:var(--blue); font-size:18px">video_library</span>
          <span>Video Shelf</span>
        </span>
        <span class="badge badge-blue">YouTube Sync</span>
      </div>
      <div class="grid-3 gap16">
        <div class="card product-card" style="cursor:pointer" onclick="openSimulatedVideo('Building SaaS in 60 seconds - Complete Stack Rebuild', '5:40')">
          <div class="product-thumb flex-center" style="height:120px; background:linear-gradient(135deg, hsl(217, 50%, 18%), hsl(260, 50%, 14%))">
            <span class="material-symbols-rounded" style="font-size:48px; color:var(--blue)">video_library</span>
          </div>
          <div class="p12">
            <div class="fw8 fs13 tc-1 text-ellipsis">Building SaaS in 60 seconds</div>
            <div class="fs11 tc-3 mt4">280K views · 2 days ago</div>
          </div>
        </div>
        <div class="card product-card" style="cursor:pointer" onclick="openSimulatedVideo('Cyber Invaders Speedrun record - 2,400 pts', '12:15')">
          <div class="product-thumb flex-center" style="height:120px; background:linear-gradient(135deg, hsl(260, 50%, 18%), hsl(330, 50%, 14%))">
            <span class="material-symbols-rounded" style="font-size:48px; color:var(--purple)">sports_esports</span>
          </div>
          <div class="p12">
            <div class="fw8 fs13 tc-1 text-ellipsis">Cyber Invaders Speedrun record</div>
            <div class="fs11 tc-3 mt4">98K views · 5 days ago</div>
          </div>
        </div>
        <div class="card product-card" style="cursor:pointer" onclick="openSimulatedVideo('Consistency & Peak Focus: 5AM Daily Grind Routine', '8:30')">
          <div class="product-thumb flex-center" style="height:120px; background:linear-gradient(135deg, hsl(155, 50%, 14%), hsl(217, 50%, 12%))">
            <span class="material-symbols-rounded" style="font-size:48px; color:var(--green)">bolt</span>
          </div>
          <div class="p12">
            <div class="fw8 fs13 tc-1 text-ellipsis">Consistency & Peak Focus Routine</div>
            <div class="fs11 tc-3 mt4">150K views · 1 week ago</div>
          </div>
        </div>
      </div>
    `;
  }
  else if (tab === 'reels') {
    html = `
      <div class="section-hdr mb12">
        <span class="section-title" style="display:inline-flex; align-items:center; gap:6px">
          <span class="material-symbols-rounded" style="color:var(--pink); font-size:18px">movie</span>
          <span>Creator Reels</span>
        </span>
        <span class="badge badge-pink">Portrait Swipes</span>
      </div>
      <div class="grid-4 gap12">
        <div class="card product-card text-center p12" style="background:var(--card2)">
          <div class="avatar av-lg mx-auto flex-center" style="background:var(--g-pink); display:grid; place-items:center; color:#fff">
            <span class="material-symbols-rounded" style="font-size:24px">movie</span>
          </div>
          <div class="fw8 fs13 tc-1 mt8">UI Design Secrets</div>
          <div class="fs11 tc-pink mt4" style="display:inline-flex; align-items:center; gap:2px"><span class="material-symbols-rounded" style="font-size:12px">favorite</span> 24.5K Likes</div>
          <button class="btn btn-ghost btn-sm mt12 flex-center gap4" style="width:100%; display:inline-flex; align-items:center; justify-content:center; gap:4px" onclick="openReelsPopup(5)">
            <span class="material-symbols-rounded" style="font-size:14px">play_arrow</span> Swipe Reel
          </button>
        </div>
        <div class="card product-card text-center p12" style="background:var(--card2)">
          <div class="avatar av-lg mx-auto flex-center" style="background:var(--g-brand); display:grid; place-items:center; color:#fff">
            <span class="material-symbols-rounded" style="font-size:24px">bolt</span>
          </div>
          <div class="fw8 fs13 tc-1 mt8">5AM Cardio Hustle</div>
          <div class="fs11 tc-pink mt4" style="display:inline-flex; align-items:center; gap:2px"><span class="material-symbols-rounded" style="font-size:12px">favorite</span> 18.2K Likes</div>
          <button class="btn btn-ghost btn-sm mt12 flex-center gap4" style="width:100%; display:inline-flex; align-items:center; justify-content:center; gap:4px" onclick="openReelsPopup(1)">
            <span class="material-symbols-rounded" style="font-size:14px">play_arrow</span> Swipe Reel
          </button>
        </div>
        <div class="card product-card text-center p12" style="background:linear-gradient(135deg, var(--orange), var(--red)); display:grid; place-items:center; color:#fff">
          <div class="avatar av-lg mx-auto flex-center" style="background:linear-gradient(135deg, var(--orange), var(--red)); display:grid; place-items:center; color:#fff">
            <span class="material-symbols-rounded" style="font-size:24px">local_fire_department</span>
          </div>
          <div class="fw8 fs13 tc-1 mt8">Methane synthesis lab</div>
          <div class="fs11 tc-pink mt4" style="display:inline-flex; align-items:center; gap:2px"><span class="material-symbols-rounded" style="font-size:12px">favorite</span> 31.7K Likes</div>
          <button class="btn btn-ghost btn-sm mt12 flex-center gap4" style="width:100%; display:inline-flex; align-items:center; justify-content:center; gap:4px" onclick="openReelsPopup(4)">
            <span class="material-symbols-rounded" style="font-size:14px">play_arrow</span> Swipe Reel
          </button>
        </div>
        <div class="card product-card text-center p12" style="background:var(--card2)">
          <div class="avatar av-lg mx-auto flex-center" style="background:var(--g-brand); display:grid; place-items:center; color:#fff">
            <span class="material-symbols-rounded" style="font-size:24px">terminal</span>
          </div>
          <div class="fw8 fs13 tc-1 mt8">CSS Glassmorphism in 15s</div>
          <div class="fs11 tc-pink mt4" style="display:inline-flex; align-items:center; gap:2px"><span class="material-symbols-rounded" style="font-size:12px">favorite</span> 15.9K Likes</div>
          <button class="btn btn-ghost btn-sm mt12 flex-center gap4" style="width:100%; display:inline-flex; align-items:center; justify-content:center; gap:4px" onclick="openReelsPopup(3)">
            <span class="material-symbols-rounded" style="font-size:14px">play_arrow</span> Swipe Reel
          </button>
        </div>
      </div>
    `;
  }
  else if (tab === 'photos') {
    html = `
      <div class="section-hdr mb12">
        <span class="section-title" style="display:inline-flex; align-items:center; gap:6px">
          <span class="material-symbols-rounded" style="color:var(--purple); font-size:18px">photo_camera</span>
          <span>Visual Gallery</span>
        </span>
        <span class="badge badge-purple">Instagram Grid</span>
      </div>
      <div class="grid-3 gap12">
        <div class="card nft-holo-card" style="padding:0; aspect-ratio:1/1; position:relative" onclick="showToast('Opening photo in full size...')">
          <div style="position:absolute; inset:0; background:linear-gradient(135deg, hsl(217, 70%, 25%), hsl(260, 60%, 20%)); display:flex; align-items:center; justify-content:center">
            <span class="material-symbols-rounded" style="font-size:42px; color:#fff">terminal</span>
          </div>
          <div style="position:absolute; bottom:0; left:0; right:0; background:linear-gradient(transparent, rgba(0,0,0,0.8)); padding:12px; font-size:11px; color:#fff">
            <div class="fw7">Setup for deep work</div>
            <div class="mt4" style="display:flex; align-items:center; gap:6px">
              <span style="display:inline-flex; align-items:center; gap:2px"><span class="material-symbols-rounded" style="font-size:12px; color:var(--pink)">favorite</span> 1,203</span>
              <span style="display:inline-flex; align-items:center; gap:2px"><span class="material-symbols-rounded" style="font-size:12px; color:var(--blue)">forum</span> 42</span>
            </div>
          </div>
        </div>
        <div class="card nft-holo-card" style="padding:0; aspect-ratio:1/1; position:relative" onclick="showToast('Opening photo in full size...')">
          <div style="position:absolute; inset:0; background:linear-gradient(135deg, hsl(155, 60%, 20%), hsl(217, 50%, 15%)); display:flex; align-items:center; justify-content:center">
            <span class="material-symbols-rounded" style="font-size:42px; color:#fff">fitness_center</span>
          </div>
          <div style="position:absolute; bottom:0; left:0; right:0; background:linear-gradient(transparent, rgba(0,0,0,0.8)); padding:12px; font-size:11px; color:#fff">
            <div class="fw7">Consistency wins daily</div>
            <div class="mt4" style="display:flex; align-items:center; gap:6px">
              <span style="display:inline-flex; align-items:center; gap:2px"><span class="material-symbols-rounded" style="font-size:12px; color:var(--pink)">favorite</span> 847</span>
              <span style="display:inline-flex; align-items:center; gap:2px"><span class="material-symbols-rounded" style="font-size:12px; color:var(--blue)">forum</span> 19</span>
            </div>
          </div>
        </div>
        <div class="card nft-holo-card" style="padding:0; aspect-ratio:1/1; position:relative" onclick="showToast('Opening photo in full size...')">
          <div style="position:absolute; inset:0; background:linear-gradient(135deg, hsl(330, 70%, 25%), hsl(260, 60%, 20%)); display:flex; align-items:center; justify-content:center">
            <span class="material-symbols-rounded" style="font-size:42px; color:#fff">image</span>
          </div>
          <div style="position:absolute; bottom:0; left:0; right:0; background:linear-gradient(transparent, rgba(0,0,0,0.8)); padding:12px; font-size:11px; color:#fff">
            <div class="fw7">San Francisco sunset</div>
            <div class="mt4" style="display:flex; align-items:center; gap:6px">
              <span style="display:inline-flex; align-items:center; gap:2px"><span class="material-symbols-rounded" style="font-size:12px; color:var(--pink)">favorite</span> 2,341</span>
              <span style="display:inline-flex; align-items:center; gap:2px"><span class="material-symbols-rounded" style="font-size:12px; color:var(--blue)">forum</span> 89</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }
  else if (tab === 'articles') {
    html = `
      <div class="section-hdr mb12">
        <span class="section-title" style="display:inline-flex; align-items:center; gap:6px">
          <span class="material-symbols-rounded" style="color:var(--purple); font-size:18px">edit_note</span>
          <span>Substack Longforms</span>
        </span>
        <span class="badge badge-purple">Editor Choice</span>
      </div>
      <div class="grid-2 mb16" style="gap:16px">
        <div class="card p20">
          <div class="flex-between">
            <span class="badge badge-blue">UI/UX Design</span>
            <span class="tc-3 fs11">5 min read</span>
          </div>
          <h3 class="fw8 tc-1 mt8">The Architecture of Clean White Space</h3>
          <p class="tc-2 fs12 mt8 mb12" style="line-height:1.5">White space is not wasted space. It is the breathing room that directs focus, structures hierarchy, and transforms cluttered pages into high-fidelity user experiences...</p>
          <button class="btn btn-ghost btn-sm" onclick="showToast('Opening Article...')">Read Article →</button>
        </div>
        <div class="card p20">
          <div class="flex-between">
            <span class="badge badge-green">Coding &amp; SaaS</span>
            <span class="tc-3 fs11">8 min read</span>
          </div>
          <h3 class="fw8 tc-1 mt8">Refactoring Component Libraries for Speed</h3>
          <p class="tc-2 fs12 mt8 mb12" style="line-height:1.5">When scale scales, DOM repaints scale with it. Here is how we decoupled our state models to achieve 60fps renders on low-powered mobile web browsers...</p>
          <button class="btn btn-ghost btn-sm" onclick="showToast('Opening Article...')">Read Article →</button>
        </div>
      </div>
      <div class="card p20 text-center" style="background:linear-gradient(135deg, var(--blue-s), var(--purple-s))">
        <h3 class="fw8 tc-1">📬 Subscribe to Alex Vance Newsletter</h3>
        <p class="tc-3 fs12 mt4">Get weekly content strategies, design principles, and engineering deep-dives directly in your inbox.</p>
        <div class="flex gap8 mt12" style="justify-content:center; max-width:400px; margin-left:auto; margin-right:auto">
          <input type="email" class="input btn-sm" id="newsletter-email" placeholder="Enter your email address" style="background:var(--card)">
          <button class="btn btn-primary btn-sm" onclick="showToast('Subscribed! Check your email! 🚀')">Subscribe</button>
        </div>
      </div>
    `;
  }
  else if (tab === 'podcasts') {
    html = `
      <div class="section-hdr mb12">
        <span class="section-title" style="display:inline-flex; align-items:center; gap:6px">
          <span class="material-symbols-rounded" style="color:var(--green); font-size:18px">mic</span>
          <span>Spotify-style Podcasts</span>
        </span>
        <span class="badge badge-green">Active Listening</span>
      </div>
      <div class="card p20 mb16 flex gap16" style="align-items:center; background:linear-gradient(135deg, var(--card), var(--card2))">
        <div class="avatar av-xl flex-center" style="background:var(--g-brand); font-size:32px; display:grid; place-items:center; color:#fff">
          <span class="material-symbols-rounded" style="font-size:32px">mic</span>
        </div>
        <div style="flex:1">
          <div class="fw8 tc-1 fs15" id="podcast-player-title">Designing the Digital Sovereignty Stack</div>
          <div class="fs12 tc-3 mt4">Episode 42 · 18 min remaining</div>
          <div class="flex mt12" style="gap:8px">
            <button class="btn btn-ghost btn-sm flex-center gap4" onclick="showToast('Rewinding 15s')" style="display:inline-flex; align-items:center; gap:4px">
              <span class="material-symbols-rounded" style="font-size:14px">skip_previous</span> 15s
            </button>
            <button class="btn btn-primary btn-sm flex-center gap4" id="pod-play-btn" onclick="togglePodcastPlayback()" style="display:inline-flex; align-items:center; gap:4px">
              <span class="material-symbols-rounded" style="font-size:14px">play_arrow</span> Play Podcast
            </button>
            <button class="btn btn-ghost btn-sm flex-center gap4" onclick="showToast('Fast Forwarding 15s')" style="display:inline-flex; align-items:center; gap:4px">
              15s <span class="material-symbols-rounded" style="font-size:14px">skip_next</span>
            </button>
          </div>
          <div class="flex gap8 mt12" style="align-items:center">
            <span class="fs10 tc-3" id="pod-current-time">0:00 / 18:00</span>
            <div class="progress-bar" style="width:200px; height:4px; margin:0"><div class="progress-fill" id="pod-progress-fill" style="width:0%"></div></div>
          </div>
        </div>
      </div>
      <div class="flex flex-col gap8">
        <div class="card p12 flex-between" style="background:var(--card2)">
          <div>
            <div class="fw8 tc-1 fs12">Episode 41: DeFi Liquidity Mechanics &amp; Yield Optimizers</div>
            <div class="fs10 tc-3 mt4">24 min · Released 1 week ago</div>
          </div>
          <button class="btn btn-ghost btn-sm flex-center gap4" onclick="playSpecificPodcast('Episode 41: DeFi Liquidity Mechanics', 24)" style="display:inline-flex; align-items:center; gap:4px">
            <span class="material-symbols-rounded" style="font-size:14px">play_arrow</span> Load
          </button>
        </div>
        <div class="card p12 flex-between" style="background:var(--card2)">
          <div>
            <div class="fw8 tc-1 fs12">Episode 40: Product Sprints vs Refactor Debts</div>
            <div class="fs10 tc-3 mt4">14 min · Released 2 weeks ago</div>
          </div>
          <button class="btn btn-ghost btn-sm flex-center gap4" onclick="playSpecificPodcast('Episode 40: Product Sprints vs Refactor Debts', 14)" style="display:inline-flex; align-items:center; gap:4px">
            <span class="material-symbols-rounded" style="font-size:14px">play_arrow</span> Load
          </button>
        </div>
      </div>
    `;
  }
  else if (tab === 'music') {
    html = `
      <div class="grid-2 mb16" style="gap:16px">
        <div class="card p20 text-center">
          <div style="animation:spin 12s linear infinite; display:inline-block">
            <span class="material-symbols-rounded" style="font-size:64px; color:var(--pink)">album</span>
          </div>
          <h3 class="fw8 tc-1 mt8" id="profile-music-title">Sunset Horizon Beat</h3>
          <p class="tc-3 fs12">Synthesized Synthwave · Alex Vance</p>
          <div class="flex-center gap16 mt16" style="justify-content:center">
            <button class="btn btn-ghost" onclick="showToast('Previous Track')" style="display:inline-flex; align-items:center; justify-content:center">
              <span class="material-symbols-rounded" style="font-size:20px">skip_previous</span>
            </button>
            <button class="btn btn-primary flex-center gap4" id="profile-music-play" onclick="toggleProfileMusic()" style="display:inline-flex; align-items:center; gap:4px">
              <span class="material-symbols-rounded" style="font-size:16px">play_arrow</span> Play Track
            </button>
            <button class="btn btn-ghost" onclick="showToast('Next Track')" style="display:inline-flex; align-items:center; justify-content:center">
              <span class="material-symbols-rounded" style="font-size:20px">skip_next</span>
            </button>
          </div>
        </div>
        <div class="card p20 flex flex-col justify-between">
          <div>
            <div class="section-hdr">
              <span class="section-title" style="display:inline-flex; align-items:center; gap:6px">
                <span class="material-symbols-rounded" style="color:var(--blue); font-size:18px">mic</span>
                <span>Lyric Sync Monitor</span>
              </span>
              <span class="badge badge-blue">Sync Live</span>
            </div>
            <div class="lyric-scroller flex flex-col gap12 text-center mt12" id="profile-lyric-scroll" style="height:100px; overflow-y:auto; padding:10px; background:var(--bg); border-radius:var(--r2)">
              <div class="tc-3 fs12">Staring at the sunset line...</div>
              <div class="fw8 tc-blue fs13" id="lyric-1">Walking through the shadow of the evening... (Active)</div>
              <div class="tc-3 fs12">Feel the rhythm pulsing deep inside...</div>
              <div class="tc-3 fs12">Horizon waiting far and wide...</div>
            </div>
          </div>
          <div class="mt16">
            <div class="fs11 tc-3 mb4">Live Audio Pulse Output:</div>
            <canvas id="profile-audio-wave" style="width:100%; height:48px; background:#000; border-radius:var(--r1)"></canvas>
          </div>
        </div>
      </div>
    `;
    setTimeout(() => initProfileAudioWave(), 100);
  }
  else if (tab === 'livestreams') {
    html = `
      <div class="grid-3 mb16" style="gap:16px">
        <div style="grid-column: span 2">
          <div class="card p20">
            <div class="video-player-sim" style="height:280px; display:grid; place-items:center">
              <div style="position:absolute; top:12px; left:12px; z-index:3" class="flex gap8">
                <span class="badge badge-pink" style="animation:pulse-dot 1.5s infinite">● LIVE</span>
                <span class="badge badge-blue" style="background:rgba(0,0,0,0.6); display:inline-flex; align-items:center; gap:4px">
                  <span class="material-symbols-rounded" style="font-size:12px">groups</span> 12.4K Watching
                </span>
              </div>
              <div>
                <span class="material-symbols-rounded emoji-3d" style="font-size:84px; color:var(--purple)">sports_esports</span>
              </div>
              <div class="fw8 tc-1 mt8">Live coding &amp; game testing stream</div>
              <div class="fs12 tc-3 mt4">Click reaction buttons below to send real-time feedback!</div>
            </div>
            <div class="flex gap8 mt12 justify-center">
              <button class="btn btn-ghost btn-sm" onclick="sendLiveStreamReaction('🔥')">🔥 Burn</button>
              <button class="btn btn-ghost btn-sm" onclick="sendLiveStreamReaction('🚀')">🚀 Launch</button>
              <button class="btn btn-ghost btn-sm" onclick="sendLiveStreamReaction('🎉')">🎉 Celeb</button>
              <button class="btn btn-ghost btn-sm" onclick="sendLiveStreamReaction('💻')">💻 Code</button>
            </div>
          </div>
        </div>
        <div>
          <div class="card p20 flex flex-col" style="height:358px">
            <h3 class="fw8 mb12 tc-1" style="display:inline-flex; align-items:center; gap:6px">
              <span class="material-symbols-rounded" style="color:var(--blue)">forum</span>
              <span>Stream Chat</span>
            </h3>
            <div id="stream-chat-logs" style="flex:1; overflow-y:auto; margin-bottom:12px" class="flex flex-col gap8 fs12">
              <div><strong class="tc-blue">sarah_c:</strong> Insane refactoring speed! 🔥</div>
              <div><strong class="tc-purple">marcus_w:</strong> Lets gooo! Tell me if you need help with stress testing 💪</div>
              <div><strong class="tc-green">dev_kumar:</strong> Stethoscope tool is fully bound and ready!</div>
            </div>
            <div class="flex gap4">
              <input type="text" class="input btn-sm" id="stream-chat-input" placeholder="Type a chat message..." style="flex:1" onkeydown="if(event.key==='Enter')submitStreamChat()">
              <button class="btn btn-primary btn-sm" onclick="submitStreamChat()">Send</button>
            </div>
          </div>
        </div>
      </div>
    `;
    setTimeout(() => startProfileStreamChatSimulation(), 100);
  }
  else if (tab === 'documents') {
    html = `
      <div class="section-hdr mb12">
        <span class="section-title">📂 Document Deck</span>
        <span class="badge badge-purple">LinkedIn PDFs</span>
      </div>
      <div class="grid-3 gap16">
        <div class="card p16">
          <div class="flex-between">
            <span class="material-symbols-rounded" style="color:var(--orange); font-size:32px">description</span>
            <span class="fs10 tc-3">PDF · 2.4 MB</span>
          </div>
          <h3 class="fw8 tc-1 mt8 fs13">Ecosystem Rebuild Roadmap 2026</h3>
          <p class="tc-3 fs11 mt4">Milestones, architecture diagrams, and HSL customizer guidelines.</p>
          <div class="flex-between mt12">
            <button class="btn btn-ghost btn-sm" onclick="showToast('Roadmap document opened!')">👁️ View</button>
            <button class="btn btn-primary btn-sm" onclick="showToast('Downloading Roadmap PDF...')">Download</button>
          </div>
        </div>
        <div class="card p16">
          <div class="flex-between">
            <span class="material-symbols-rounded" style="color:var(--blue); font-size:32px">description</span>
            <span class="fs10 tc-3">DOCX · 840 KB</span>
          </div>
          <h3 class="fw8 tc-1 mt8 fs13">Alex Vance Professional Resume</h3>
          <p class="tc-3 fs11 mt4">Updated tech stack experience, past startup projects, and education logs.</p>
          <div class="flex-between mt12">
            <button class="btn btn-ghost btn-sm" onclick="showToast('Resume opened!')">👁️ View</button>
            <button class="btn btn-primary btn-sm" onclick="showToast('Downloading Resume...')">Download</button>
          </div>
        </div>
        <div class="card p16">
          <div class="flex-between">
            <span class="material-symbols-rounded" style="color:var(--purple); font-size:32px">description</span>
            <span class="fs10 tc-3">PPTX · 5.8 MB</span>
          </div>
          <h3 class="fw8 tc-1 mt8 fs13">Investor Pitch Presentation Slides</h3>
          <p class="tc-3 fs11 mt4">Digital sovereign hubs pitch decks, demographic forecasts, and earnings.</p>
          <div class="flex-between mt12">
            <button class="btn btn-ghost btn-sm" onclick="showToast('Pitch slides opened!')">👁️ View</button>
            <button class="btn btn-primary btn-sm" onclick="showToast('Downloading PPTX...')">Download</button>
          </div>
        </div>
      </div>
    `;
  }
  else if (tab === 'research') {
    html = `
      <div class="section-hdr mb12">
        <span class="section-title">🎓 Academic Preprints</span>
        <span class="badge badge-blue">Research Gate</span>
      </div>
      <div class="flex flex-col gap12">
        <div class="card p16">
          <div class="flex-between">
            <h3 class="fw8 tc-1 fs13">A Matrix Framework for Generative User Interface Layouts</h3>
            <span class="badge badge-blue">DOI: 10.1145/3478</span>
          </div>
          <div class="fs11 tc-3 mt4">Published in ACM Journal of Human-Computer Interaction · 12 Citations</div>
          <div class="card p12 fs11 tc-2 mt8 hidden" id="abstract-matrix-doc">
            <strong>Abstract:</strong> Current UI synthesis tools struggle with structural intent conservation. We present an absolute matrix system mapping design tokens to modular grid states, securing reliable and fluid web app renders across various screen widths without page loads.
          </div>
          <div class="flex gap8 mt12">
            <button class="btn btn-ghost btn-sm" onclick="$id('abstract-matrix-doc').classList.toggle('hidden'); this.textContent = this.textContent.includes('Expand') ? 'Collapse Abstract' : 'Expand Abstract'">Expand Abstract</button>
            <button class="btn btn-primary btn-sm" onclick="showToast('Abstract paper PDF downloaded!')">📄 Full PDF</button>
          </div>
        </div>
        <div class="card p16">
          <div class="flex-between">
            <h3 class="fw8 tc-1 fs13">Decentralized Trust Protocols on High-Frequency Social Hubs</h3>
            <span class="badge badge-purple">Preprint</span>
          </div>
          <div class="fs11 tc-3 mt4">Submitted to IEEE Transactions on Network Security · Under Review</div>
          <div class="card p12 fs11 tc-2 mt8 hidden" id="abstract-crypto-doc">
            <strong>Abstract:</strong> High-volume microblogging sites require rapid state verification. We introduce a secure, lightweight validation algorithm leveraging peer nodes to construct tamperproof active status tags and verified creator emblems instantly.
          </div>
          <div class="flex gap8 mt12">
            <button class="btn btn-ghost btn-sm" onclick="$id('abstract-crypto-doc').classList.toggle('hidden'); this.textContent = this.textContent.includes('Expand') ? 'Collapse Abstract' : 'Expand Abstract'">Expand Abstract</button>
            <button class="btn btn-primary btn-sm" onclick="showToast('Abstract preprint PDF downloaded!')">📄 Full PDF</button>
          </div>
        </div>
      </div>
    `;
  }
  else if (tab === 'saved') {
    html = `
      <div class="section-hdr mb12">
        <span class="section-title" style="display:inline-flex; align-items:center; gap:6px"><span class="material-symbols-rounded" style="color:var(--purple)">bookmark</span> Saved Bookmarks</span>
        <span class="badge badge-purple">Bookmarks Drawer</span>
      </div>
      <div class="grid-3 gap12 mb16">
        <button class="btn btn-ghost p16 text-center" style="display:flex; flex-direction:column; height:auto; gap:8px" onclick="filterSaved('all')">
          <span class="material-symbols-rounded emoji-3d" style="font-size:32px; color:var(--blue)">folder</span>
          <span class="fw7 fs13">All Bookmarks</span>
        </button>
        <button class="btn btn-ghost p16 text-center" style="display:flex; flex-direction:column; height:auto; gap:8px" onclick="filterSaved('article')">
          <span class="material-symbols-rounded emoji-3d" style="font-size:32px; color:var(--purple)">article</span>
          <span class="fw7 fs13">Articles (1)</span>
        </button>
        <button class="btn btn-ghost p16 text-center" style="display:flex; flex-direction:column; height:auto; gap:8px" onclick="filterSaved('shop')">
          <span class="material-symbols-rounded emoji-3d" style="font-size:32px; color:var(--pink)">shopping_cart</span>
          <span class="fw7 fs13">Products (1)</span>
        </button>
      </div>
      <div class="grid-3 gap12" id="saved-items-grid">
        <div class="card p12 flex gap12" style="background:var(--card2); align-items:center; cursor:pointer" onclick="showToast('Opening ProSound X1 page...')">
          <div style="display:inline-flex; align-items:center; justify-content:center; width:48px; height:48px; border-radius:50%; background:var(--bg2)">
            <span class="material-symbols-rounded emoji-3d" style="font-size:28px; color:var(--blue)">headphones</span>
          </div>
          <div>
            <div class="fw8 tc-1 fs13">ProSound X1 Headphones</div>
            <span class="badge badge-pink mt4 fs10">Shop Product</span>
          </div>
        </div>
        <div class="card p12 flex gap12" style="background:var(--card2); align-items:center; cursor:pointer" onclick="showToast('Opening UI/UX class...')">
          <div style="display:inline-flex; align-items:center; justify-content:center; width:48px; height:48px; border-radius:50%; background:var(--bg2)">
            <span class="material-symbols-rounded emoji-3d" style="font-size:28px; color:var(--pink)">palette</span>
          </div>
          <div>
            <div class="fw8 tc-1 fs13">UI/UX Design Masterclass</div>
            <span class="badge badge-blue mt4 fs10">Course</span>
          </div>
        </div>
        <div class="card p12 flex gap12" style="background:var(--card2); align-items:center; cursor:pointer" onclick="showToast('Opening CRISPR Paper...')">
          <div style="display:inline-flex; align-items:center; justify-content:center; width:48px; height:48px; border-radius:50%; background:var(--bg2)">
            <span class="material-symbols-rounded emoji-3d" style="font-size:28px; color:var(--blue)">science</span>
          </div>
          <div>
            <div class="fw8 tc-1 fs13">Visualizing CRISPR Efficiencies</div>
            <span class="badge badge-purple mt4 fs10">Science Paper</span>
          </div>
        </div>
      </div>
    `;
  }
  else if (tab === 'history') {
    html = `
      <div class="section-hdr mb12">
        <span class="section-title" style="display:inline-flex; align-items:center; gap:6px"><span class="material-symbols-rounded" style="color:var(--blue)">history</span> History Ledger</span>
        <span class="badge badge-blue">Watch Log</span>
      </div>
      <div class="flex flex-col gap8">
        <div class="card p12 flex-between" style="background:var(--card2)">
          <div>
            <div class="fw8 tc-1 fs12">Building SaaS in 60 seconds - Complete Rebuild</div>
            <div class="fs10 tc-3 mt4">Watched 5m ago · 85% Completed</div>
            <div class="progress-bar mt8" style="width:200px; height:4px; margin:0"><div class="progress-fill" style="width:85%"></div></div>
          </div>
          <button class="btn btn-ghost btn-sm" onclick="showToast('Loading Player...')">Resume Video</button>
        </div>
        <div class="card p12 flex-between" style="background:var(--card2)">
          <div>
            <div class="fw8 tc-1 fs12">Designing the Digital Sovereignty Stack - Episode 42</div>
            <div class="fs10 tc-3 mt4">Listened 1d ago · 10% Completed</div>
            <div class="progress-bar mt8" style="width:200px; height:4px; margin:0"><div class="progress-fill" style="width:10%"></div></div>
          </div>
          <button class="btn btn-ghost btn-sm" onclick="showToast('Loading Podcast...')">Resume Podcast</button>
        </div>
      </div>
    `;
  }
  else if (tab === 'liked') {
    html = `
      <div class="section-hdr mb12">
        <span class="section-title" style="display:inline-flex; align-items:center; gap:6px"><span class="material-symbols-rounded" style="color:var(--pink)">favorite</span> Curated Likes</span>
        <span class="badge badge-pink">Ecosystem Likes</span>
      </div>
      <div class="card p20 mb16 text-center" style="background:linear-gradient(135deg, var(--pink-s), var(--purple-s))">
        <div style="display:grid; place-items:center"><span class="material-symbols-rounded emoji-3d" style="font-size:32px; color:var(--pink)">favorite</span></div>
        <div class="fw8 tc-1 fs16 mt8">Your Likes Ledger</div>
        <p class="tc-3 fs12 mt4">You have liked posts, reels, and articles in this session.</p>
      </div>
      <div id="liked-posts-list" class="flex flex-col gap12">
        ${DATA.posts.slice(0, 2).map(p => {
          const mockLiked = {...p, liked: true};
          return renderPostCard(mockLiked);
        }).join('')}
      </div>
    `;
  }
  else if (tab === 'purchases') {
    html = `
      <div class="section-hdr mb12">
        <span class="section-title" style="display:inline-flex; align-items:center; gap:6px"><span class="material-symbols-rounded" style="color:var(--blue)">shopping_cart</span> Marketplace Orders</span>
        <span class="badge badge-blue">Verified Transactions</span>
      </div>
      <div class="card p20 mb16">
        <div class="flex-between pb12" style="border-bottom:1px solid var(--border)">
          <div>
            <div class="fw8 tc-1 fs14">Order #TS-8420-18</div>
            <div class="fs11 tc-3 mt4">Purchased May 26, 2026 · Total: $89.99</div>
          </div>
          <span class="badge badge-blue" style="background:var(--blue-s); color:var(--blue); display:inline-flex; align-items:center; gap:4px">
            <span class="material-symbols-rounded" style="font-size:14px">local_shipping</span> IN TRANSIT
          </span>
        </div>
        <div class="flex gap16 mt16" style="align-items:center">
          <div style="display:inline-flex; align-items:center; justify-content:center; width:64px; height:64px; border-radius:var(--r2); background:var(--bg2)">
            <span class="material-symbols-rounded emoji-3d" style="font-size:42px; color:var(--blue)">headphones</span>
          </div>
          <div style="flex:1">
            <div class="fw8 tc-1 fs13">ProSound X1 Wireless Headphones</div>
            <div class="fs11 tc-3 mt4">Seller: AudioTech · Status: Package left sorting center.</div>
          </div>
        </div>
        <div class="order-tracker mt16 flex gap4" style="align-items:center; justify-content:center">
          <div style="width:12px; height:12px; border-radius:50%; background:var(--blue)"></div>
          <div style="flex:1; height:3px; background:var(--blue)"></div>
          <div style="width:12px; height:12px; border-radius:50%; background:var(--blue)"></div>
          <div style="flex:1; height:3px; background:var(--blue)"></div>
          <div style="width:12px; height:12px; border-radius:50%; background:var(--blue); animation:pulse-dot 1.5s infinite"></div>
          <div style="flex:1; height:3px; background:var(--border)"></div>
          <div style="width:12px; height:12px; border-radius:50%; background:var(--border)"></div>
        </div>
        <div class="flex-between mt8 fs10 tc-3">
          <span>Processed</span>
          <span>Shipped</span>
          <span>In Transit</span>
          <span>Delivered</span>
        </div>
        <div class="flex gap8 mt20">
          <button class="btn btn-ghost btn-sm flex-center gap4" onclick="showToast('Tracking coordinates loaded!')" style="display:inline-flex; align-items:center; gap:4px">
            <span class="material-symbols-rounded" style="font-size:16px">location_on</span> Live Track
          </button>
          <button class="btn btn-primary btn-sm flex-center gap4" onclick="generatePdfReceipt()" style="display:inline-flex; align-items:center; gap:4px">
            <span class="material-symbols-rounded" style="font-size:16px">description</span> Generate PDF Receipt
          </button>
        </div>
      </div>
    `;
  }
  else if (tab === 'nfts') {
    html = `
      <div class="section-hdr mb12">
        <span class="section-title" style="display:inline-flex; align-items:center; gap:6px"><span class="material-symbols-rounded" style="color:var(--pink)">token</span> Blockchain Assets</span>
        <span class="badge badge-pink">Trendchain Mainnet</span>
      </div>
      <div class="grid-3 gap16">
        <div class="nft-holo-card">
          <div class="avatar av-xl mx-auto flex-center" style="background:linear-gradient(135deg, #00f2fe, #4facfe); display:grid; place-items:center; color:#fff">
            <span class="material-symbols-rounded emoji-3d" style="font-size:32px">rocket_launch</span>
          </div>
          <div class="fw8 tc-1 fs13 mt12 text-center">SpaceCrafting Alpha Ticket</div>
          <div class="fs10 tc-pink mt4 text-center">Token #1024 · Minted</div>
          <div class="fs11 tc-3 mt8 pb8" style="border-bottom:1px solid var(--border)">
            <div><strong>Contract:</strong> 0x3a4b...c69e</div>
            <div class="mt2"><strong>Royalties:</strong> 2.5% Creator</div>
          </div>
          <button class="btn btn-ghost btn-sm mt12 flex-center gap4" style="width:100%; display:inline-flex; align-items:center; justify-content:center; gap:4px" onclick="showToast('NFT locked on ledger!')">
            <span class="material-symbols-rounded" style="font-size:14px">lock</span> Transfer NFT
          </button>
        </div>
        <div class="nft-holo-card">
          <div class="avatar av-xl mx-auto flex-center" style="background:linear-gradient(135deg, #f355da, #700687); display:grid; place-items:center; color:#fff">
            <span class="material-symbols-rounded emoji-3d" style="font-size:32px">palette</span>
          </div>
          <div class="fw8 tc-1 fs13 mt12 text-center">Neon Story Ring #1</div>
          <div class="fs10 tc-pink mt4 text-center">Token #0082 · Minted</div>
          <div class="fs11 tc-3 mt8 pb8" style="border-bottom:1px solid var(--border)">
            <div><strong>Contract:</strong> 0x7c4e...d82a</div>
            <div class="mt2"><strong>Royalties:</strong> 5.0% Creator</div>
          </div>
          <button class="btn btn-ghost btn-sm mt12 flex-center gap4" style="width:100%; display:inline-flex; align-items:center; justify-content:center; gap:4px" onclick="showToast('NFT locked on ledger!')">
            <span class="material-symbols-rounded" style="font-size:14px">lock</span> Transfer NFT
          </button>
        </div>
        <div class="nft-holo-card">
          <div class="avatar av-xl mx-auto flex-center" style="background:linear-gradient(135deg, #ff0844, #ffb199); display:grid; place-items:center; color:#fff">
            <span class="material-symbols-rounded emoji-3d" style="font-size:32px">workspace_premium</span>
          </div>
          <div class="fw8 tc-1 fs13 mt12 text-center">Digital Sovereign Node #0014</div>
          <div class="fs10 tc-pink mt4 text-center">Token #0014 · Minted</div>
          <div class="fs11 tc-3 mt8 pb8" style="border-bottom:1px solid var(--border)">
            <div><strong>Contract:</strong> 0x8a9c...f44a</div>
            <div class="mt2"><strong>Royalties:</strong> 10.0% Creator</div>
          </div>
          <button class="btn btn-ghost btn-sm mt12 flex-center gap4" style="width:100%; display:inline-flex; align-items:center; justify-content:center; gap:4px" onclick="showToast('NFT locked on ledger!')">
            <span class="material-symbols-rounded" style="font-size:14px">lock</span> Transfer NFT
          </button>
        </div>
      </div>
    `;
  }
  else if (tab === 'wallet') {
    html = `
      <div class="section-hdr mb12">
        <span class="section-title" style="display:inline-flex; align-items:center; gap:6px"><span class="material-symbols-rounded" style="color:var(--orange)">account_balance_wallet</span> Crypto Wallet</span>
        <span class="badge badge-purple">Binance Engine</span>
      </div>
      <div class="grid-3 gap12 mb16">
        <div class="card p16 text-center" style="background:var(--card2)">
          <div class="fs11 tc-3">BTC Balance</div>
          <div class="fw8 tc-1 fs18 mt4">0.142 BTC</div>
          <div class="fs10 tc-green mt2">$9,715.71 USD</div>
        </div>
        <div class="card p16 text-center" style="background:var(--card2)">
          <div class="fs11 tc-3">ETH Balance</div>
          <div class="fw8 tc-1 fs18 mt4">2.85 ETH</div>
          <div class="fs10 tc-green mt2">$6,840.00 USD</div>
        </div>
        <div class="card p16 text-center" style="background:var(--card2)">
          <div class="fs11 tc-3">TREND Balance</div>
          <div class="fw8 tc-1 fs18 mt4">10,000 TREND</div>
          <div class="fs10 tc-blue mt2">$1,000.00 USD</div>
        </div>
      </div>
      <div class="grid-2 gap16">
        <div class="card p20">
          <h3 class="fw8 mb12 tc-1" style="display:flex; align-items:center; gap:6px"><span class="material-symbols-rounded" style="color:var(--green)">send</span> Transfer Coins</h3>
          <div class="form-group">
            <label class="form-label">Recipient Wallet Address</label>
            <input class="input" type="text" id="wallet-recipient" placeholder="0x7a8b...1420">
          </div>
          <div class="form-group mt8">
            <label class="form-label">Coin Amount</label>
            <div class="flex gap4">
              <input class="input" type="number" id="wallet-amount" placeholder="0.0">
              <select class="input" id="wallet-coin" style="width:100px">
                <option value="TREND">TREND</option>
                <option value="BTC">BTC</option>
                <option value="ETH">ETH</option>
              </select>
            </div>
          </div>
          <button class="btn btn-primary mt12" style="width:100%" onclick="submitCryptoTransfer()">Submit Live Transfer</button>
        </div>
        <div class="card p20 flex flex-col">
          <h3 class="fw8 mb12 tc-1" style="display:flex; align-items:center; gap:6px"><span class="material-symbols-rounded" style="color:var(--blue)">receipt_long</span> Ledger History</h3>
          <div style="flex:1; overflow-y:auto; max-height:168px" class="flex flex-col gap8 fs12">
            <div class="flex-between py4" style="border-bottom:1px solid var(--border)">
              <span class="tc-green" style="display:inline-flex; align-items:center; gap:4px"><span class="material-symbols-rounded" style="font-size:14px">arrow_downward</span> Received Deposit</span>
              <span class="fw7">+500 TREND · Just now</span>
            </div>
            <div class="flex-between py4" style="border-bottom:1px solid var(--border)">
              <span class="tc-pink" style="display:inline-flex; align-items:center; gap:4px"><span class="material-symbols-rounded" style="font-size:14px">arrow_upward</span> Sent Transfer</span>
              <span class="fw7">-50 TREND · 2h ago</span>
            </div>
            <div class="flex-between py4" style="border-bottom:1px solid var(--border)">
              <span class="tc-green" style="display:inline-flex; align-items:center; gap:4px"><span class="material-symbols-rounded" style="font-size:14px">emoji_events</span> Received Reward</span>
              <span class="fw7">+100 TREND · 1d ago</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }
  else if (tab === 'communities') {
    html = `
      <div class="section-hdr mb12">
        <span class="section-title" style="display:inline-flex; align-items:center; gap:6px"><span class="material-symbols-rounded" style="color:var(--blue)">forum</span> Joined Servers</span>
        <span class="badge badge-blue">Discord Sync</span>
      </div>
      <div class="discord-layout">
        <div class="server-sidebar">
          <div class="server-icon-btn active" onclick="switchDiscordServer('TechBuilders')" style="display:grid; place-items:center">
            <span class="material-symbols-rounded" style="font-size:20px; color:#fff">terminal</span>
          </div>
          <div class="server-icon-btn" onclick="switchDiscordServer('FitnessWarriors')" style="display:grid; place-items:center">
            <span class="material-symbols-rounded" style="font-size:20px; color:#fff">fitness_center</span>
          </div>
          <div class="server-icon-btn" onclick="showToast('Loading server...')" style="display:grid; place-items:center">
            <span class="material-symbols-rounded" style="font-size:20px; color:#fff">add</span>
          </div>
        </div>
        <div class="channel-sidebar">
          <div class="fw8 tc-3 fs10 mb8 uppercase">Channels</div>
          <div class="channel-link active" onclick="switchDiscordChannel('general')"># general</div>
          <div class="channel-link" onclick="switchDiscordChannel('announcements')" style="display:inline-flex; align-items:center; gap:4px">
            <span class="material-symbols-rounded" style="font-size:14px">campaign</span> announcements
          </div>
          <div class="channel-link" onclick="switchDiscordChannel('coding-tips')"># coding-tips</div>
          <div class="channel-link" onclick="switchDiscordChannel('design-critique')"># design-critique</div>
        </div>
        <div class="discord-chat-pane">
          <div class="chat-window-header" style="padding:10px 16px; border-bottom:1px solid var(--border)">
            <div class="fw8 tc-1 fs13" id="discord-channel-title"># general</div>
            <div class="fs10 tc-3 mt2">Welcome to TechBuilders Server general chat! Emojis fully active! 😊🚀</div>
          </div>
          <div style="flex:1; overflow-y:auto; padding:16px" class="flex flex-col gap8 fs12" id="discord-messages-log">
            <div><strong class="tc-blue">sarah_c:</strong> Hey guys, launching the app this afternoon! 🚀</div>
            <div><strong class="tc-purple">marcus_w:</strong> Lets gooo! Tell me if you need help with stress testing 💪</div>
            <div><strong class="tc-green">dev_kumar:</strong> Stethoscope tool is fully bound and ready!</div>
          </div>
          <div class="chat-input-row" style="padding:10px; border-top:1px solid var(--border); display:flex; gap:8px">
            <input type="text" class="input btn-sm" id="discord-input" placeholder="Message #general... Emojis supported!" style="flex:1" onkeydown="if(event.key==='Enter')submitDiscordMessage()">
            <button class="btn btn-primary btn-sm" onclick="submitDiscordMessage()">Send</button>
          </div>
        </div>
      </div>
    `;
  }
  else if (tab === 'courses') {
    html = `
      <div class="grid-2 mb16" style="gap:16px">
        <div class="card p20">
          <div class="section-hdr">
            <span class="section-title" style="display:inline-flex; align-items:center; gap:6px"><span class="material-symbols-rounded" style="color:var(--orange)">emoji_events</span> Streak Map &amp; XP Progression</span>
            <span class="badge badge-purple">Level 14</span>
          </div>
          <div class="flex gap12 mt12" style="align-items:center">
            <div class="avatar av-lg flex-center" style="background:var(--g-brand); display:grid; place-items:center; color:#fff">
              <span class="material-symbols-rounded emoji-3d" style="font-size:24px; color:var(--orange)">bolt</span>
            </div>
            <div style="flex:1">
              <div class="flex-between fw8 fs13 tc-1">
                <span>XP earned this week:</span>
                <span class="tc-blue">8,420 / 10,000 XP</span>
              </div>
              <div class="progress-bar mt8" style="height:8px"><div class="progress-fill" style="width:84.2%"></div></div>
              <div class="fs11 tc-3 mt4">Solve daily coding challenges to reach Level 15!</div>
            </div>
          </div>
          <div class="streak-grid mt16 flex gap4" style="justify-content:center">
            <div style="width:24px; height:24px; border-radius:var(--r1); background:var(--green); color:var(--bg); font-weight:800; font-size:11px" class="flex-center">M</div>
            <div style="width:24px; height:24px; border-radius:var(--r1); background:var(--green); color:var(--bg); font-weight:800; font-size:11px" class="flex-center">T</div>
            <div style="width:24px; height:24px; border-radius:var(--r1); background:var(--green); color:var(--bg); font-weight:800; font-size:11px" class="flex-center">W</div>
            <div style="width:24px; height:24px; border-radius:var(--r1); background:var(--blue); color:var(--bg); font-weight:800; font-size:11px; animation:pulse-dot 1.5s infinite" class="flex-center">T</div>
            <div style="width:24px; height:24px; border-radius:var(--r1); background:var(--card2); border:1px solid var(--border); color:var(--t3); font-weight:800; font-size:11px" class="flex-center">F</div>
            <div style="width:24px; height:24px; border-radius:var(--r1); background:var(--card2); border:1px solid var(--border); color:var(--t3); font-weight:800; font-size:11px" class="flex-center">S</div>
            <div style="width:24px; height:24px; border-radius:var(--r1); background:var(--card2); border:1px solid var(--border); color:var(--t3); font-weight:800; font-size:11px" class="flex-center">S</div>
          </div>
          <div class="text-center fs11 tc-green mt8 fw7" style="display:flex; align-items:center; justify-content:center; gap:4px">
            Active streak: 4 Days in a row! <span class="material-symbols-rounded" style="font-size:16px; color:var(--orange)">local_fire_department</span>
          </div>
        </div>
        <div class="card p20">
          <h3 class="fw8 mb12 tc-1" style="display:flex; align-items:center; gap:6px">
            <span class="material-symbols-rounded" style="color:var(--blue)">assignment</span> Daily Quests Checklist
          </h3>
          <div class="flex flex-col gap8 fs12">
            <div class="flex gap8" style="align-items:center">
              <input type="checkbox" checked disabled>
              <span class="tc-3" style="text-decoration:line-through">Log water macros in Fitness hub (+10 XP)</span>
            </div>
            <div class="flex gap8" style="align-items:center">
              <input type="checkbox" id="q-2" onchange="completeQuest('q-2')">
              <span id="q-txt-2">Comment on a trending post in Feed (+25 XP)</span>
            </div>
            <div class="flex gap8" style="align-items:center">
              <input type="checkbox" id="q-3" onchange="completeQuest('q-3')">
              <span id="q-txt-3">Submit a secure local civic report (+50 XP)</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  else if (tab === 'analytics') {
    html = `
      <div class="section-hdr mb12">
        <span class="section-title" style="display:inline-flex; align-items:center; gap:6px"><span class="material-symbols-rounded" style="color:var(--purple)">bar_chart</span> Creator Analytics</span>
        <span class="badge badge-purple">Live Feed</span>
      </div>
      <div class="grid-2 mb16" style="gap:16px">
        <div class="card p20">
          <h3 class="fw8 mb12 tc-1" style="display:inline-flex; align-items:center; gap:6px"><span class="material-symbols-rounded" style="color:var(--blue)">trending_up</span> Views Growth Dynamics</h3>
          <canvas id="profile-chart" style="width:100%; height:120px"></canvas>
        </div>
        <div class="card p20">
          <h3 class="fw8 mb12 tc-1" style="display:inline-flex; align-items:center; gap:6px"><span class="material-symbols-rounded" style="color:var(--green)">monetization_on</span> Earnings &amp; Crowdfunding</h3>
          <p class="tc-3 fs12">Estimate your monthly creator payouts on Trending:</p>
          <div class="form-group mt12">
            <label class="form-label" id="calc-views-lbl">Monthly Video Views: 500K</label>
            <input type="range" class="input" min="10" max="2000" value="500" style="padding:0" oninput="calculatePayouts(this.value)">
          </div>
          <div class="flex-between mt16 pb8" style="border-bottom:1px solid var(--border)">
            <span class="fs12 tc-2">Estimated Ad Earnings:</span>
            <strong class="tc-green" id="calc-ad-earns">$1,250.00</strong>
          </div>
          <div class="flex-between mt8">
            <span class="fs12 tc-2">Estimated Royalties:</span>
            <strong class="tc-blue" id="calc-roy-earns">$450.00</strong>
          </div>
        </div>
      </div>
    `;
    setTimeout(() => drawProfileAnalyticsChart(), 100);
  }
  else if (tab === 'ai') {
    html = `
      <div class="card p20 mb16">
        <h3 class="fw8 mb12 tc-1 flex-center" style="justify-content:flex-start; gap:8px"><span class="material-symbols-rounded" style="color:var(--blue)">auto_awesome</span> Trending Voice Studio</h3>
        <p class="tc-3 fs12">Configure TTS parameters, voice clones, and subtitles:</p>
        <div class="form-group mt12">
          <label class="form-label">Voice Cloning Speed: <span id="v-speed-val">1.05x</span></label>
          <input type="range" min="0.5" max="2" step="0.05" value="1.05" class="input" style="padding:0" oninput="$id('v-speed-val').textContent = this.value+'x'; S.voiceSpeed = parseFloat(this.value);">
        </div>
        <div class="form-group mt8">
          <label class="form-label">Active Voice Model</label>
          <select class="input" id="active-voice-model" onchange="changeVoiceModel(this.value)">
            <option value="female-premium" ${S.voiceModel === 'female-premium' ? 'selected' : ''}>Premium Female AI Voice (Default)</option>
            <option value="female-natural" ${S.voiceModel === 'female-natural' ? 'selected' : ''}>Natural Female Assistant</option>
            <option value="male-premium" ${S.voiceModel === 'male-premium' ? 'selected' : ''}>Premium Male AI Voice</option>
          </select>
        </div>
        <div class="form-group mt8">
          <label class="form-label">Subtitles Auto-Caption Style</label>
          <select class="input" id="subtitles-style" onchange="showToast('Autocaptions updated!')">
            <option value="neon">Neon Spark Highlights</option>
            <option value="minimal">Minimal White Outlines</option>
            <option value="karaoke">Karaoke Sync</option>
          </select>
        </div>
        <div class="flex gap8 mt12">
          <button class="btn btn-ghost btn-sm" onclick="speakText('Test narration active on Trending engine! All settings verified!')">🔊 Test Voice</button>
          <button class="btn btn-primary btn-sm" onclick="showToast('AI Voice fingerprint updated!')">🔒 Sync Voice Profile</button>
        </div>
      </div>
    `;
  }
  else if (tab === 'settings') {
    html = `
      <div class="grid-2 gap16">
        <div class="card p20">
          <h3 class="fw8 mb12 tc-1">🎨 Visual Customizer</h3>
          <p class="tc-3 fs12 mb12">Change the global ecosystem accent color instantly:</p>
          <div class="flex gap8 mb16">
            <div class="color-swatch swatch-blue active" onclick="changeThemeAccent('blue')" title="Blue Accent"></div>
            <div class="color-swatch swatch-green" onclick="changeThemeAccent('green')" title="Green Accent"></div>
            <div class="color-swatch swatch-orange" onclick="changeThemeAccent('orange')" title="Orange Accent"></div>
            <div class="color-swatch swatch-pink" onclick="changeThemeAccent('pink')" title="Pink Accent"></div>
            <div class="color-swatch swatch-purple" onclick="changeThemeAccent('purple')" title="Purple Accent"></div>
          </div>
          <div class="form-group">
            <label class="form-label">Bio Details</label>
            <textarea class="input" id="profile-bio-editor" style="height:72px" placeholder="Update your creator bio...">Digital creator &amp; tech enthusiast. Building the future one post at a time. 🚀</textarea>
          </div>
          <button class="btn btn-primary mt12" onclick="saveProfileBioEditor()">Save Settings</button>
        </div>
        <div class="card p20">
          <h3 class="fw8 mb12 tc-1 flex-center" style="justify-content:flex-start; gap:8px"><span class="material-symbols-rounded" style="color:var(--pink)">security</span> Anti-Hack Security Core</h3>
          <p class="tc-3 fs12 mb12">Trigger system defenses and manage security settings:</p>
          <div class="flex-between py8" style="border-bottom:1px solid var(--border)">
            <div>
              <div class="fw7 fs12 tc-1">Ghost Privacy Mode</div>
              <div class="fs10 tc-3">Hide online status dots and profile handles.</div>
            </div>
            <input type="checkbox" onchange="toggleGhostMode(this)">
          </div>
          <div class="flex-between py8" style="border-bottom:1px solid var(--border)">
            <div>
              <div class="fw7 fs12 tc-1">System Anti-Lock Firewall</div>
              <div class="fs10 tc-3">Require biometric fingerprint mockup before withdrawals.</div>
            </div>
            <input type="checkbox" checked onchange="showToast('Biometrics mockup enforced!')">
          </div>
          <button class="btn btn-primary mt12" style="width:100%" onclick="showToast('2FA credentials verified via security key!')">Configure 2FA Token</button>
        </div>
      </div>
    `;
  }

  container.innerHTML = html;
  if (typeof IX !== 'undefined' && IX.bindAllEmojis) {
    IX.bindAllEmojis(container);
  }
}

// ── PROFILE TAB HELPERS ──
function publishProfilePost() {
  const inp = $id('profile-post-input');
  if (!inp) return;
  const text = inp.value.trim();
  if (!text) return;
  
  const newPost = {
    id: Date.now(),
    author: 'Alex Vance',
    handle: S.user.handle,
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

function submitCryptoTransfer() {
  const recip = $id('wallet-recipient').value.trim();
  const amt = parseFloat($id('wallet-amount').value);
  const coin = $id('wallet-coin').value;
  
  if (!recip || isNaN(amt) || amt <= 0) {
    showToast('Invalid recipient address or coin amount ❌');
    return;
  }
  
  showToast(`Blockchain Transfer: Sent ${amt} ${coin} to ${recip}! 💸`);
  $id('wallet-recipient').value = '';
  $id('wallet-amount').value = '';
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
  
  const adEarns = (viewsK * 2.5).toFixed(2);
  const royEarns = (viewsK * 0.9).toFixed(2);
  
  $id('calc-ad-earns').textContent = `$${parseFloat(adEarns).toLocaleString('en-US', {minimumFractionDigits:2})}`;
  $id('calc-roy-earns').textContent = `$${parseFloat(royEarns).toLocaleString('en-US', {minimumFractionDigits:2})}`;
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
  
  _safe(drawRealityScoreCircle, 'drawRealityScoreCircle');
  _safe(drawProfileAnalyticsChart, 'drawProfileAnalyticsChart');
  
  showToast(`Ecosystem visual accent updated to: ${color.toUpperCase()} ✨`);
}

// ── 3. 4-7-8 BREATHING MEDITATION HUB ──
let breathingTimer = null;
let breathingCycle = 0;
let breathingPhase = 'idle';

function switchCommunityTab(tab) {
  document.querySelectorAll('#pane-community .tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.id === `com-t-${tab}`);
  });
  
  const views = ['community-main-view', 'community-wellness-view', 'community-startup-view', 'community-civic-view'];
  views.forEach(v => {
    const el = $id(v);
    if (el) el.classList.toggle('hidden', !v.includes(tab === 'all' ? 'main' : tab));
  });
  
  if (tab === 'wellness') resetBreathingGuide();
  if (tab === 'startup') renderStartupCard();
  if (tab === 'civic') renderCivicHubList();
}

// ── DESIGN STUDIO SUPER COMMAND ─────────────────────────────────
let currentDSIndustry = 'agriculture';

function renderDesignStudio(industryId = 'agriculture') {
  currentDSIndustry = industryId;
  const leftNav = $id('ds-leftnav');
  const canvas = $id('ds-canvas');
  if (!leftNav || !canvas) return;

  // Render Left Nav
  leftNav.innerHTML = DATA.designIndustries.map(ind => `
    <div class="ds-nav-item ${ind.id === industryId ? 'active' : ''}" onclick="renderDesignStudio('${ind.id}')">
      <span class="material-symbols-rounded" style="font-size:18px">${ind.icon}</span> ${ind.name}
    </div>
  `).join('') + `
    <div style="flex:1"></div>
    <div class="ds-nav-item" style="opacity:0.6; border-top:1px solid rgba(255,255,255,0.08)">
      <span class="material-symbols-rounded" style="font-size:18px">folder</span> My Projects
    </div>
    <div class="ds-nav-item" style="opacity:0.6">
      <span class="material-symbols-rounded" style="font-size:18px">cloud_done</span> Cloud Sync
    </div>
  `;

  // Render Center Canvas
  let canvasHTML = '';
  switch (industryId) {
    case 'agriculture':
      canvasHTML = `
        <div class="ds-sim-window" style="background:#0a1910;">
          <div class="ds-sim-header"><span class="material-symbols-rounded tc-green">satellite_alt</span> Smart Agriculture Mapping Studio - Sector 7</div>
          <div class="ds-sim-body" style="background: radial-gradient(circle, rgba(16,185,129,0.2) 0%, transparent 70%); flex-direction:column; gap:24px;">
            <div style="position:relative; width:80%; height:60%; border:1px solid rgba(16,185,129,0.3); border-radius:12px; overflow:hidden; display:flex; align-items:center; justify-content:center;">
              <!-- Simulated map grid -->
              <div style="position:absolute; inset:0; background:linear-gradient(90deg, rgba(16,185,129,0.1) 1px, transparent 1px) 0 0 / 40px 40px, linear-gradient(rgba(16,185,129,0.1) 1px, transparent 1px) 0 0 / 40px 40px;"></div>
              
              <!-- Simulated heat zones -->
              <div style="position:absolute; top:20%; left:30%; width:100px; height:80px; background:rgba(239,68,68,0.4); border-radius:50%; filter:blur(20px);"></div>
              <div style="position:absolute; bottom:20%; right:20%; width:150px; height:120px; background:rgba(59,130,246,0.4); border-radius:50%; filter:blur(30px);"></div>
              
              <div style="z-index:2; text-align:center;">
                <span class="material-symbols-rounded" style="font-size:64px; color:rgba(16,185,129,0.8); animation:pulse-slow 3s infinite">agriculture</span>
                <div class="mt12 fw6" style="color:var(--green)">Drone Analysis: 94% Yield Match</div>
              </div>
            </div>
            
            <div class="flex gap12">
              <button class="btn btn-sm" style="background:rgba(16,185,129,0.2); color:#10b981; border:1px solid #10b981">Soil Moisture Layer</button>
              <button class="btn btn-sm" style="background:rgba(255,255,255,0.05)">Infrared Scan</button>
              <button class="btn btn-sm" style="background:rgba(255,255,255,0.05)">Irrigation Routes</button>
            </div>
          </div>
        </div>`;
      updateDSI('agriculture', 'How can I optimize this zone? I recommend adjusting the irrigation routes in Sector 7 due to low soil moisture readings.');
      break;
    case 'realestate':
      canvasHTML = `
        <div class="ds-sim-window" style="background:#09090b;">
          <div class="ds-sim-header"><span class="material-symbols-rounded tc-blue">architecture</span> Architectural Layout Studio - Modern Villa 3D</div>
          <div class="ds-sim-body" style="flex-direction:column;">
            <div style="position:relative; width:300px; height:300px; border:2px dashed rgba(59,130,246,0.3); border-radius:12px; display:flex; align-items:center; justify-content:center; perspective: 1000px;">
              <div style="transform: rotateX(60deg) rotateZ(45deg); width:200px; height:200px; background:rgba(59,130,246,0.1); border:1px solid rgba(59,130,246,0.5); display:grid; grid-template-columns:1fr 1fr; grid-template-rows:1fr 1fr;">
                <div style="border-right:1px solid rgba(59,130,246,0.5); border-bottom:1px solid rgba(59,130,246,0.5);"></div>
                <div style="border-bottom:1px solid rgba(59,130,246,0.5);"></div>
                <div style="border-right:1px solid rgba(59,130,246,0.5);"></div>
                <div></div>
              </div>
              <span class="material-symbols-rounded" style="position:absolute; font-size:80px; color:rgba(59,130,246,0.8); z-index:2; text-shadow:0 10px 20px rgba(0,0,0,0.5)">home_work</span>
            </div>
            <div class="flex gap12 mt24">
              <button class="btn btn-sm btn-primary">Generate 3D Render</button>
              <button class="btn btn-sm" style="background:rgba(255,255,255,0.05)">Lighting Sim</button>
            </div>
          </div>
        </div>`;
      updateDSI('realestate', 'I have generated a 3D wireframe based on your floorplan. Would you like me to run a lighting and structural analysis?');
      break;
    case 'fashion':
      canvasHTML = `
        <div class="ds-sim-window" style="background:#18181b;">
          <div class="ds-sim-header"><span class="material-symbols-rounded tc-pink">checkroom</span> Fashion Illustration Studio - Spring Collection</div>
          <div class="ds-sim-body">
            <div style="display:flex; width:100%; height:100%;">
              <div style="flex:1; border-right:1px solid rgba(255,255,255,0.1); display:flex; align-items:center; justify-content:center; position:relative;">
                <span class="material-symbols-rounded" style="font-size:120px; color:rgba(255,255,255,0.1)">man</span>
                <span class="emoji-3d" style="position:absolute; font-size:64px; z-index:2;">🧥</span>
              </div>
              <div style="width:200px; background:rgba(0,0,0,0.3); padding:16px;">
                <div class="tc-3 fs11 fw6 mb12">FABRICS</div>
                <div class="flex gap8" style="flex-wrap:wrap">
                  <div style="width:40px; height:40px; border-radius:50%; background:#000; border:2px solid var(--pink)"></div>
                  <div style="width:40px; height:40px; border-radius:50%; background:#d4d4d8;"></div>
                  <div style="width:40px; height:40px; border-radius:50%; background:linear-gradient(45deg, red, blue);"></div>
                </div>
                <button class="btn btn-sm mt24" style="width:100%; background:rgba(255,42,133,0.2); color:var(--pink)">AI Outfit Gen</button>
              </div>
            </div>
          </div>
        </div>`;
      updateDSI('fashion', 'Try applying the holographic gradient texture to the TechWear coat. It is trending in Cyberpunk aesthetics right now!');
      break;
    case 'video':
      canvasHTML = `
        <div class="ds-sim-window" style="background:#000;">
          <div class="ds-sim-header"><span class="material-symbols-rounded tc-purple">movie</span> Motion Design Studio - Sequence 1</div>
          <div class="ds-sim-body" style="background:#09090b">
            <div style="width:80%; height:70%; background:#000; border:1px solid rgba(255,255,255,0.1); position:relative; display:flex; align-items:center; justify-content:center;">
              <span class="material-symbols-rounded" style="font-size:64px; color:rgba(255,255,255,0.2)">play_circle</span>
              <div style="position:absolute; top:12px; right:12px; background:rgba(239,68,68,0.2); color:var(--red); padding:4px 8px; border-radius:4px; font-size:10px; font-weight:700;">REC</div>
            </div>
          </div>
        </div>`;
      updateDSI('video', 'I synced the audio to the markers. Would you like me to auto-generate cinematic transitions between the cuts?');
      break;
    case 'space':
      canvasHTML = `
        <div class="ds-sim-window" style="background:#020205;">
          <div class="ds-sim-header"><span class="material-symbols-rounded tc-orange">rocket_launch</span> Space & Science Studio - Orbital Station Alpha</div>
          <div class="ds-sim-body" style="background: radial-gradient(circle at center, rgba(30,58,138,0.2) 0%, transparent 80%); overflow: hidden;">
            <div style="position:absolute; inset:0; background: url('data:image/svg+xml;utf8,<svg viewBox=\"0 0 200 200\" xmlns=\"http://www.w3.org/2000/svg\"><circle cx=\"100\" cy=\"100\" r=\"2\" fill=\"%23ffffff22\"/></svg>') repeat;"></div>
            
            <div style="position:relative; width:300px; height:300px; display:flex; align-items:center; justify-content:center; perspective: 800px;">
              <div style="position:absolute; width: 100%; height: 100%; border: 1px dashed rgba(255,255,255,0.2); border-radius: 50%; transform: rotateX(70deg); animation: spin-slow 20s linear infinite;"></div>
              <div style="position:absolute; width: 150%; height: 150%; border: 2px solid rgba(59,130,246,0.1); border-radius: 50%; transform: rotateX(70deg); animation: spin-slow 40s linear infinite reverse;"></div>
              
              <span class="material-symbols-rounded" style="font-size: 80px; color:rgba(255,255,255,0.8); z-index: 2; filter: drop-shadow(0 0 20px rgba(59,130,246,0.6));">satellite_alt</span>
              
              <!-- Simulated Thruster Exhaust -->
              <div style="position:absolute; bottom: 80px; left: 50%; transform: translateX(-50%); width: 20px; height: 60px; background: linear-gradient(to bottom, rgba(56,189,248,0.8), transparent); filter: blur(5px);"></div>
            </div>
            
            <div class="flex gap12" style="position:absolute; bottom:24px; z-index:10;">
              <button class="btn btn-sm" style="background:rgba(59,130,246,0.2); color:#60a5fa; border:1px solid #3b82f6">Quantum Engine Sim</button>
              <button class="btn btn-sm" style="background:rgba(255,255,255,0.05)">Gravity Mapping</button>
              <button class="btn btn-sm" style="background:rgba(255,255,255,0.05)">Radiation Shields</button>
            </div>
          </div>
        </div>`;
      updateDSI('space', 'I ran the Quantum Rendering Engine on Orbital Station Alpha. Radiation shielding holds at 98.4%. Shall we simulate a micro-meteoroid impact?');
      break;

    case 'gaming':
      canvasHTML = `
        <div class="ds-sim-window" style="background:#09090b;">
          <div class="ds-sim-header"><span class="material-symbols-rounded" style="color:var(--pink)">sports_esports</span> Metaverse Creator Studio - Level Editor</div>
          <div class="ds-sim-body" style="background: linear-gradient(0deg, rgba(255,42,133,0.1) 0%, transparent 100%);">
            <div style="position:relative; width:100%; height:100%; overflow:hidden;">
              <!-- 3D Perspective Grid -->
              <div style="position:absolute; bottom:0; left:-50%; width:200%; height:60%; background:
                linear-gradient(90deg, rgba(255,42,133,0.3) 1px, transparent 1px) 0 0 / 40px 40px,
                linear-gradient(0deg, rgba(255,42,133,0.3) 1px, transparent 1px) 0 0 / 40px 40px;
                transform: perspective(500px) rotateX(60deg); transform-origin: top center;"></div>
              
              <!-- Floating UI Node -->
              <div class="card p12" style="position:absolute; top:40px; left:40px; background:rgba(0,0,0,0.8); border:1px solid rgba(255,42,133,0.3); backdrop-filter:blur(10px);">
                <div class="fs11 fw6 tc-pink mb8">NPC_Behavior_Tree.logic</div>
                <div class="flex flex-col gap8">
                  <div class="badge" style="background:rgba(255,255,255,0.1)">[Node] Seek Player</div>
                  <div style="width:2px; height:10px; background:rgba(255,42,133,0.5); margin: 0 auto;"></div>
                  <div class="badge" style="background:rgba(255,255,255,0.1)">[Condition] Distance < 10m</div>
                </div>
              </div>
              
              <!-- 3D Object Representation -->
              <div style="position:absolute; top:50%; left:50%; transform:translate(-50%, -50%);">
                 <span class="material-symbols-rounded" style="font-size:100px; color:#fff; filter: drop-shadow(0 0 30px rgba(255,42,133,0.6));">deployed_code</span>
              </div>
            </div>
            
            <div class="flex gap12" style="position:absolute; top:24px; right:24px;">
              <button class="btn btn-primary btn-sm flex-center gap4"><span class="material-symbols-rounded" style="font-size:14px">play_arrow</span> Playtest</button>
            </div>
          </div>
        </div>`;
      updateDSI('gaming', 'The NPC logic nodes are compiled. I can use the AI Scene Generator to instantly populate this grid with cyberpunk buildings. Want me to build it?');
      break;

    case 'engineering':
      canvasHTML = `
        <div class="ds-sim-window" style="background:#0b1320;">
          <div class="ds-sim-header"><span class="material-symbols-rounded tc-blue">precision_manufacturing</span> Industrial Workspace - MK-IV Robotics</div>
          <div class="ds-sim-body">
            <div style="width:90%; height:80%; border:2px solid rgba(59,130,246,0.3); position:relative;">
              <!-- Blueprint background -->
              <div style="position:absolute; inset:0; background: linear-gradient(90deg, rgba(59,130,246,0.1) 1px, transparent 1px) 0 0 / 20px 20px, linear-gradient(0deg, rgba(59,130,246,0.1) 1px, transparent 1px) 0 0 / 20px 20px;"></div>
              
              <!-- Grid overlay rulers -->
              <div style="position:absolute; top:0; left:0; right:0; height:20px; border-bottom:1px solid rgba(59,130,246,0.5); display:flex; align-items:center; padding-left:20px; font-size:9px; color:#3b82f6; letter-spacing:4px">10 20 30 40 50 60 70 80 90</div>
              <div style="position:absolute; top:0; left:0; bottom:0; width:20px; border-right:1px solid rgba(59,130,246,0.5); display:flex; flex-direction:column; align-items:center; padding-top:20px; font-size:9px; color:#3b82f6; line-height:24px">1<br>2<br>3<br>4<br>5</div>
              
              <!-- Schematic illustration -->
              <div style="position:absolute; top:50%; left:50%; transform:translate(-50%, -50%); display:flex; flex-direction:column; align-items:center; gap:20px">
                <span class="material-symbols-rounded" style="font-size:120px; color:rgba(255,255,255,0.9); text-shadow:0 0 10px rgba(59,130,246,0.5)">precision_manufacturing</span>
                
                <div class="flex gap24">
                  <div class="text-center">
                    <div class="tc-blue fs10 fw8">TORQUE</div>
                    <div class="fs14 fw6 mt4">120 Nm</div>
                  </div>
                  <div class="text-center">
                    <div class="tc-blue fs10 fw8">PAYLOAD</div>
                    <div class="fs14 fw6 mt4">450 kg</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>`;
      updateDSI('engineering', 'I have drafted the MK-IV robotic arm blueprints. My structural analysis shows a potential stress fracture at joint C under maximum payload. Recommend adding titanium alloy reinforcement.');
      break;

    case 'graphic':
      canvasHTML = `
        <div class="ds-sim-window" style="background:#18181b;">
          <div class="ds-sim-header"><span class="material-symbols-rounded tc-pink">brush</span> Graphic Media Studio - Brand Identity</div>
          <div class="ds-sim-body" style="background: radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px) 0 0 / 20px 20px;">
            <div style="position:absolute; top:24px; left:24px; display:flex; flex-direction:column; gap:8px;">
              <div class="card p12 flex-center" style="width:48px; height:48px; background:rgba(0,0,0,0.5); border:1px solid rgba(255,255,255,0.1)"><span class="material-symbols-rounded tc-2">text_fields</span></div>
              <div class="card p12 flex-center" style="width:48px; height:48px; background:rgba(0,0,0,0.5); border:1px solid rgba(255,255,255,0.1)"><span class="material-symbols-rounded tc-2">shapes</span></div>
              <div class="card p12 flex-center" style="width:48px; height:48px; background:rgba(0,0,0,0.5); border:1px solid rgba(255,255,255,0.1)"><span class="material-symbols-rounded tc-2">format_color_fill</span></div>
              <div class="card p12 flex-center" style="width:48px; height:48px; background:rgba(0,0,0,0.5); border:1px solid rgba(255,255,255,0.1)"><span class="material-symbols-rounded tc-2">layers</span></div>
            </div>
            
            <div style="width:60%; height:80%; background:#fff; border-radius:8px; display:flex; align-items:center; justify-content:center; position:relative; box-shadow: 0 10px 40px rgba(0,0,0,0.5);">
              <div style="position:absolute; top:-10px; left:-10px; width:20px; height:20px; border:2px solid var(--purple); background:#fff; border-radius:50%"></div>
              <div style="position:absolute; top:-10px; right:-10px; width:20px; height:20px; border:2px solid var(--purple); background:#fff; border-radius:50%"></div>
              <div style="position:absolute; bottom:-10px; left:-10px; width:20px; height:20px; border:2px solid var(--purple); background:#fff; border-radius:50%"></div>
              <div style="position:absolute; bottom:-10px; right:-10px; width:20px; height:20px; border:2px solid var(--purple); background:#fff; border-radius:50%"></div>
              <div style="position:absolute; inset:-2px; border:2px dashed var(--purple); pointer-events:none;"></div>
              
              <div style="text-align:center;">
                <span class="material-symbols-rounded" style="font-size:120px; color:#18181b; background:linear-gradient(45deg, #a855f7, #ec4899); -webkit-background-clip:text; -webkit-text-fill-color:transparent;">diamond</span>
                <h1 style="color:#18181b; font-size:48px; margin-top:24px; font-weight:900; letter-spacing:4px">L U X E</h1>
                <p style="color:#71717a; font-size:16px; margin-top:8px; font-weight:600">MODERN ESSENTIALS</p>
              </div>
            </div>
          </div>
        </div>`;
      updateDSI('graphic', 'I generated a brand identity mockup. Notice the kerning on the logo text. Would you like me to auto-generate social media carousel banners using this theme?');
      break;

    case 'uiux':
      canvasHTML = `
        <div class="ds-sim-window" style="background:#09090b;">
          <div class="ds-sim-header"><span class="material-symbols-rounded tc-blue">web</span> UI/UX Design Studio - Mobile Wireframes</div>
          <div class="ds-sim-body" style="background: rgba(255,255,255,0.02);">
            
            <div style="display:flex; gap:40px; align-items:center; justify-content:center;">
              <!-- Screen 1 -->
              <div style="width:240px; height:500px; background:#18181b; border:1px solid rgba(255,255,255,0.1); border-radius:24px; position:relative; overflow:hidden;">
                <div style="height:200px; background:rgba(255,255,255,0.05); margin-bottom:16px;"></div>
                <div style="padding:0 16px;">
                  <div style="height:24px; width:60%; background:rgba(255,255,255,0.1); border-radius:4px; margin-bottom:12px;"></div>
                  <div style="height:12px; width:90%; background:rgba(255,255,255,0.05); border-radius:2px; margin-bottom:8px;"></div>
                  <div style="height:12px; width:80%; background:rgba(255,255,255,0.05); border-radius:2px; margin-bottom:24px;"></div>
                  <div style="height:48px; width:100%; background:var(--blue); border-radius:8px; margin-bottom:16px;"></div>
                </div>
              </div>
              
              <!-- Arrow -->
              <div style="display:flex; align-items:center;">
                <div style="width:40px; height:2px; background:var(--blue);"></div>
                <span class="material-symbols-rounded" style="color:var(--blue); margin-left:-8px;">arrow_forward</span>
                <div style="position:absolute; margin-top:-30px; font-size:11px; color:#60a5fa; font-weight:600">onTap(Navigate)</div>
              </div>

              <!-- Screen 2 -->
              <div style="width:240px; height:500px; background:#18181b; border:1px solid rgba(59,130,246,0.5); border-radius:24px; position:relative; overflow:hidden; box-shadow: 0 0 20px rgba(59,130,246,0.2);">
                <div style="padding:24px 16px;">
                  <div style="display:flex; gap:12px; margin-bottom:24px;">
                    <div style="width:40px; height:40px; background:rgba(255,255,255,0.1); border-radius:50%;"></div>
                    <div>
                      <div style="height:16px; width:120px; background:rgba(255,255,255,0.1); border-radius:4px; margin-bottom:8px;"></div>
                      <div style="height:10px; width:80px; background:rgba(255,255,255,0.05); border-radius:2px;"></div>
                    </div>
                  </div>
                  <div style="height:100px; width:100%; background:rgba(255,255,255,0.05); border-radius:8px; margin-bottom:16px;"></div>
                  <div style="height:100px; width:100%; background:rgba(255,255,255,0.05); border-radius:8px;"></div>
                </div>
              </div>
            </div>
            
            <div class="flex gap12" style="position:absolute; bottom:24px; right:24px;">
              <button class="btn btn-sm" style="background:rgba(255,255,255,0.1)"><span class="material-symbols-rounded" style="font-size:14px">code</span> Export to React</button>
            </div>
          </div>
        </div>`;
      updateDSI('uiux', 'I mapped the user flow from the Product Screen to the Checkout Screen. I can export this entire wireframe directly to fully functional React or Flutter code.');
      break;

    case 'templates':
      canvasHTML = `
        <div class="ds-sim-window" style="background:#121214;">
          <div class="ds-sim-header"><span class="material-symbols-rounded tc-orange">dashboard</span> Global Template Hub</div>
          <div class="ds-sim-body" style="align-items:flex-start; padding:32px; overflow-y:auto; flex-wrap:wrap; gap:24px; justify-content:center;">
            
            <div class="card" style="width:220px; height:280px; background:#18181b; position:relative; overflow:hidden;">
              <div style="height:140px; background:linear-gradient(135deg, #a855f7, #3b82f6); display:flex; align-items:center; justify-content:center;">
                <span class="material-symbols-rounded" style="font-size:48px; color:#fff">campaign</span>
              </div>
              <div class="p12">
                <div class="fw6 fs14 mb4 tc-1">Political Campaign Kit</div>
                <div class="tc-3 fs11">Includes posters, social media banners, and donation UI.</div>
                <button class="btn btn-sm mt12" style="width:100%; background:rgba(255,255,255,0.1)">Use Template</button>
              </div>
            </div>

            <div class="card" style="width:220px; height:280px; background:#18181b; position:relative; overflow:hidden;">
              <div style="height:140px; background:linear-gradient(135deg, #10b981, #059669); display:flex; align-items:center; justify-content:center;">
                <span class="material-symbols-rounded" style="font-size:48px; color:#fff">eco</span>
              </div>
              <div class="p12">
                <div class="fw6 fs14 mb4 tc-1">Agriculture Dashboard</div>
                <div class="tc-3 fs11">Sensor tracking UI, yield charts, and drone route maps.</div>
                <button class="btn btn-sm mt12" style="width:100%; background:rgba(255,255,255,0.1)">Use Template</button>
              </div>
            </div>

            <div class="card" style="width:220px; height:280px; background:#18181b; position:relative; overflow:hidden;">
              <div style="height:140px; background:linear-gradient(135deg, #ef4444, #f97316); display:flex; align-items:center; justify-content:center;">
                <span class="material-symbols-rounded" style="font-size:48px; color:#fff">local_fire_department</span>
              </div>
              <div class="p12">
                <div class="fw6 fs14 mb4 tc-1">Startup Pitch Deck</div>
                <div class="tc-3 fs11">12-slide modern pitch deck with auto-branding AI.</div>
                <button class="btn btn-sm mt12" style="width:100%; background:rgba(255,255,255,0.1)">Use Template</button>
              </div>
            </div>
            
            <div class="card" style="width:220px; height:280px; background:#18181b; position:relative; overflow:hidden;">
              <div style="height:140px; background:linear-gradient(135deg, #8b5cf6, #d946ef); display:flex; align-items:center; justify-content:center;">
                <span class="material-symbols-rounded" style="font-size:48px; color:#fff">smart_display</span>
              </div>
              <div class="p12">
                <div class="fw6 fs14 mb4 tc-1">YouTube Thumbnails</div>
                <div class="tc-3 fs11">High-CTR thumbnail templates for gaming and tech.</div>
                <button class="btn btn-sm mt12" style="width:100%; background:rgba(255,255,255,0.1)">Use Template</button>
              </div>
            </div>

          </div>
        </div>`;
      updateDSI('templates', 'Welcome to the Template Marketplace. Select a template and I will automatically adapt it to your brand colors and typography.');
      break;

    default:
      canvasHTML = `
        <div class="ds-sim-window" style="background:#121214;">
          <div class="ds-sim-header"><span class="material-symbols-rounded">dashboard</span> ${DATA.designIndustries.find(i=>i.id===industryId)?.name} Workspace</div>
          <div class="ds-sim-body flex-col gap12 text-center p24">
            <span class="material-symbols-rounded" style="font-size:48px; color:rgba(255,255,255,0.2)">view_in_ar</span>
            <div class="tc-2">Industry module fully initialized in simulated environment.</div>
            <button class="btn btn-primary mt12">Import Assets</button>
          </div>
        </div>`;
      updateDSI(industryId, `Welcome to the ${DATA.designIndustries.find(i=>i.id===industryId)?.name} studio. Use the top command bar to invite collaborators.`);
      break;
  }
  
  canvas.innerHTML = canvasHTML;
}

function updateDSI(industryId, msg) {
  const chat = $id('ds-ai-chat');
  if (chat) {
    chat.innerHTML = `<div class="ds-ai-msg system" style="animation: fade-in 0.3s ease">${msg}</div>`;
  }
  const timeline = $id('ds-timeline');
  if (timeline) {
    if (industryId === 'video' || industryId === 'gaming') timeline.style.display = 'flex';
    else timeline.style.display = 'none';
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

function runBreathingSequence() {
  const bubble = $id('breath-bubble');
  const instr = $id('breath-instructions');
  const counter = $id('breath-cycle-count');
  
  if (breathingCycle > 4) {
    resetBreathingGuide();
    showToast('Focus session complete! +50 XP 🏆');
    S.user.xp += 50; updateUserUI();
    return;
  }
  
  if (counter) counter.textContent = `Cycle: ${breathingCycle} / 4`;
  
  // Phase 1: Inhale (4s)
  breathingPhase = 'inhale';
  if (instr) instr.innerHTML = '<span class="tc-blue">💨 Inhale through nose... (4s)</span>';
  if (bubble) {
    bubble.style.transition = 'transform 4s linear, background 4s ease, box-shadow 4s ease';
    bubble.style.transform = 'scale(1.8)';
    bubble.style.background = 'var(--blue)';
    bubble.style.boxShadow = '0 0 24px 8px hsla(217, 91%, 60%, 0.5)';
  }
  
  breathingTimer = setTimeout(() => {
    // Phase 2: Hold (7s)
    breathingPhase = 'hold';
    if (instr) instr.innerHTML = '<span style="color:var(--purple)">🧘 Hold breath... (7s)</span>';
    if (bubble) {
      bubble.style.transition = 'background 7s ease, box-shadow 7s ease';
      bubble.style.background = 'var(--purple)';
      bubble.style.boxShadow = '0 0 32px 12px hsla(260, 65%, 64%, 0.6)';
    }
    
    breathingTimer = setTimeout(() => {
      // Phase 3: Exhale (8s)
      breathingPhase = 'exhale';
      if (instr) instr.innerHTML = '<span class="tc-pink">💨 Exhale completely... (8s)</span>';
      if (bubble) {
        bubble.style.transition = 'transform 8s linear, background 8s ease, box-shadow 8s ease';
        bubble.style.transform = 'scale(1.0)';
        bubble.style.background = 'var(--pink)';
        bubble.style.boxShadow = '0 0 16px 4px hsla(330, 80%, 62%, 0.3)';
      }
      
      breathingTimer = setTimeout(() => {
        breathingCycle++;
        runBreathingSequence();
      }, 8000);
    }, 7000);
  }, 4000);
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

// ── 4. STARTUP MATCH SWIPER ──
let currentStartupIndex = 0;
const startupsList = [
  { icon: '\uD83D\uDD25', iconColor: 'var(--blue)', name: 'SpaceCrafting', founders: 'Founded by @astro_dave · Tech', pitch: '"We are building a Web3 satellite bandwidth sharing protocol so anybody can lease small sat dishes globally in minutes."' },
  { icon: '\uD83D\uDD25', iconColor: 'var(--green)', name: 'AgriGrow AI', founders: 'Founded by @agri_zara · Science', pitch: '"Drones with multispectral imaging that scan crop fields and micro-apply organic fertilizer only where needed, saving 60% water."' },
  { icon: '\uD83D\uDD25', iconColor: 'var(--orange)', name: 'EcoBike Networks', founders: 'Founded by @eco_tyler · Local', pitch: '"Hyperlocal dockless e-bike sharing that rewards users in green micro-tokens for using carbon-free lanes in smart cities."' },
  { icon: '\uD83D\uDD25', iconColor: 'var(--purple)', name: 'Neuromind Analytics', founders: 'Founded by @mind_sarah · Health', pitch: '"A non-invasive headband that reads alpha waves to adjust room lighting and ambient sound automatically for optimal focus."' }
];

function renderStartupCard() {
  const startup = startupsList[currentStartupIndex];
  const card = $id('startup-swiper-node'); if (!card) return;
  
  card.style.transform = 'none';
  card.style.opacity = '1';
  card.style.transition = 'none';
  
  const emoji = $id('su-emoji');
  const name = $id('su-name');
  const founders = $id('su-founders');
  const pitch = $id('su-pitch');
  
  if (emoji) emoji.innerHTML = `<span class="material-symbols-rounded emoji-3d" style="font-size:52px; color:${startup.iconColor}">${startup.icon}</span>`;
  if (name) name.textContent = startup.name;
  if (founders) founders.textContent = startup.founders;
  if (pitch) pitch.innerHTML = startup.pitch;
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

// ── 5. AI BIOGRAPHY CREATOR ──
function generateAIBio(style) {
  let bio = '';
  if (style === 'creator') {
    bio = 'Full-time digital creator & product designer. Synthesizing Web3 updates, daily fitness streaks, and AI art hacks. Let\'s build! 🚀';
  } else if (style === 'tech') {
    bio = 'Systems engineer & AI developer. Building neural networks and spatial VR interfaces. Living in compiler logs and dark theme modes. 💻';
  } else {
    bio = 'Hybrid athlete & bio-hacker. Tracking macro ratios, logging daily Invaders score records, and chasing consistency limits. 💪';
  }
  S.user.bio = bio; updateUserUI();
  showToast('AI profile bio successfully synthesized! 🤖');
}

// ── 6. 3D AVATAR CUSTOMIZER ──
function updateBuilderAvatar() {
  const emoji = $id('builder-emoji').value;
  const bg = $id('builder-bg').value;
  const preview = $id('builder-preview-circle'); if (!preview) return;
  
  preview.textContent = emoji;
  const gradients = {
    brand: 'var(--g-brand)',
    blue:  'linear-gradient(135deg, var(--blue), var(--blue-d))',
    green: 'linear-gradient(135deg, hsl(155,60%,44%), hsl(155,60%,32%))',
    pink:  'linear-gradient(135deg, hsl(330,80%,62%), hsl(330,80%,48%))',
    dark:  'linear-gradient(135deg, #1e1f2e, #13141f)'
  };
  preview.style.background = gradients[bg] || 'var(--g-brand)';
}

function saveBuilderAvatar() {
  const emoji = $id('builder-emoji').value;
  const bg = $id('builder-bg').value;
  const gradients = {
    brand: 'var(--g-brand)',
    blue:  'linear-gradient(135deg, var(--blue), var(--blue-d))',
    green: 'linear-gradient(135deg, hsl(155,60%,44%), hsl(155,60%,32%))',
    pink:  'linear-gradient(135deg, hsl(330,80%,62%), hsl(330,80%,48%))',
    dark:  'linear-gradient(135deg, #1e1f2e, #13141f)'
  };
  const selectedGrad = gradients[bg] || 'var(--g-brand)';
  
  DATA.stories.unshift({ name: 'You', emoji, seen: false });
  renderStories();
  
  ['sidebar-av','header-av','composer-av','profile-av'].forEach(id => {
    const el = $id(id);
    if (el) {
      el.textContent = emoji;
      el.style.background = selectedGrad;
    }
  });
  
  S.user.xp += 50; updateUserUI();
  showToast('3D custom profile avatar successfully saved! 🎨');
}

// ── 7. WEB3 WALLET PROTOCOLS ──
let walletLinked = false;
let nftVerified = false;

function linkCryptoWallet() {
  if (walletLinked) { showToast('Web3 wallet already linked (0x7a...d83f).'); return; }
  showToast('Connecting to Web3 wallet protocol... 🪙');
  setTimeout(() => {
    walletLinked = true;
    showToast('Success! Wallet connected: 0x7a84e201d83fb291 🪙');
    S.user.xp += 50; updateUserUI();
  }, 1200);
}

function verifyNFTBadge() {
  if (nftVerified) { showToast('NFT Creator Badge already verified.'); return; }
  showToast('Verifying NFT creator badge ownership on chain... 💎');
  setTimeout(() => {
    nftVerified = true;
    showToast('Ownership verified! Sparkle border unlocked! 🌟');
    const av = $id('profile-av');
    if (av) {
      av.style.border = '4px solid #facc15';
      av.style.animation = 'ix-glow-kf 2s infinite';
    }
    S.user.xp += 50; updateUserUI();
  }, 1400);
}

// ── 8. SECURITY CONTROLS ──
function toggleTFA() {
  const check = $id('tfa-toggle')?.checked;
  showToast(check ? 'Two-Factor Authentication (2FA) active. Encrypted SMS sent. 🛡️' : '2FA deactivated.');
}
function toggleAntiHack() {
  const check = $id('antihack-toggle')?.checked;
  showToast(check ? 'Anti-Hack firewall active. Real-time packet inspection running. 🔒' : 'Anti-Hack shield offline.');
}

// ── 9. SPEECH SYNTHESIS NARRATOR ──
let currentUtterance = null;

function narratePost(id) {
  const post = DATA.posts.find(p => p.id === id);
  if (!post) return;
  narrateText(post.body);
}

function narrateText(text) {
  if (!('speechSynthesis' in window)) {
    showToast('Speech Synthesis is not supported in this browser.');
    return;
  }
  if (speechSynthesis.speaking) {
    speechSynthesis.cancel();
    showToast('AI Narration paused.');
    return;
  }
  const clean = text.replace(/[*_~`#]/g,'').replace(/https?:\/\/\S+/g,'').trim();
  currentUtterance = new SpeechSynthesisUtterance(clean);
  
  const voice = getActiveVoice();
  if (voice) {
    currentUtterance.voice = voice;
  }
  
  currentUtterance.rate = S.voiceSpeed || 1.0;
  if (S.voiceModel && S.voiceModel.startsWith('female')) {
    currentUtterance.pitch = 1.15;
  } else {
    currentUtterance.pitch = 0.95;
  }
  
  currentUtterance.onstart = () => showToast('🔊 AI Narration reading aloud...');
  currentUtterance.onend   = () => showToast('🔊 AI Narration finished.');
  speechSynthesis.speak(currentUtterance);
}

// ── 10. UNIFIED STREAM PLAYER OVERLAYS ──
let streamInterval = null;
let streamCanvasAnim = null;

function openLiveStream(name, emoji) {
  closeLiveStream();
  
  const modal = document.createElement('div');
  modal.id = 'stream-player-modal';
  modal.className = 'call-modal-overlay';
  modal.style.cssText = `
    position:fixed; inset:0; background:rgba(9,9,15,0.92); backdrop-filter:blur(10px);
    display:flex; align-items:center; justify-content:center; z-index:9999;
    animation: bounce-in 0.3s ease; padding: 20px;
  `;
  
  const streamIconData = get3DIconForEmoji(emoji);
  modal.innerHTML = `
    <div class="card p24 flex-between" style="width:100%; max-width:960px; height:85vh; background:var(--card); flex-direction:row; gap:20px; align-items:stretch; border:1px solid var(--border)">
      <!-- Left: Video Stream Player -->
      <div style="flex:1.6; display:flex; flex-direction:column; gap:12px; justify-content:space-between">
        <div class="flex-between">
          <div class="flex-center gap8">
            <span class="material-symbols-rounded emoji-3d" style="font-size:28px; color:${streamIconData.color}">${streamIconData.icon}</span>
            <div>
              <h3 class="fw8 tc-1" style="font-size:16px">${name}</h3>
              <div class="flex-center gap8" style="justify-content:flex-start">
                <span class="badge badge-pink" style="animation: pulse-dot 1.5s infinite">● LIVE</span>
                <span class="fs11 tc-3" id="live-viewer-count">12,482 watching</span>
              </div>
            </div>
          </div>
          <button class="icon-btn" onclick="closeLiveStream()" style="display:inline-flex; align-items:center; justify-content:center">
            <span class="material-symbols-rounded" style="font-size:18px">close</span>
          </button>
        </div>
        
        <!-- Video Screen Canvas -->
        <div style="flex:1; background:#000; border-radius:var(--r2); border:1px solid var(--border); position:relative; overflow:hidden">
          <canvas id="stream-video-canvas" style="width:100%; height:100%; display:block"></canvas>
          <div style="position:absolute; top:12px; left:12px; background:rgba(0,0,0,0.6); padding:4px 8px; border-radius:4px; font-size:10px; font-weight:700; color:#4ade80; border:1px solid rgba(74,222,128,0.2); display:inline-flex; align-items:center; gap:4px">
            <span class="material-symbols-rounded" style="font-size:12px; color:#4ade80">sensors</span> 1080p60 · bitrate 6200 kbps
          </div>
          <div style="position:absolute; bottom:12px; right:12px; display:flex; gap:8px">
            <span style="font-size:24px; cursor:pointer" onclick="sendStreamReaction('❤️')">❤️</span>
            <span style="font-size:24px; cursor:pointer" onclick="sendStreamReaction('🔥')">🔥</span>
            <span style="font-size:24px; cursor:pointer" onclick="sendStreamReaction('😂')">😂</span>
            <span style="font-size:24px; cursor:pointer" onclick="sendStreamReaction('🚀')">🚀</span>
            <span style="font-size:24px; cursor:pointer" onclick="sendStreamReaction('💎')">💎</span>
          </div>
        </div>
        
        <!-- Player Controls -->
        <div class="flex-between fs12 tc-2" style="background:var(--bg2); padding:8px 12px; border-radius:var(--r1)">
          <div class="flex-center gap8">
            <button class="btn btn-ghost btn-sm flex-center gap4" onclick="showToast('Paused stream playback')" style="display:inline-flex; align-items:center; gap:4px">
              <span class="material-symbols-rounded" style="font-size:14px">pause</span> Pause
            </button>
            <span id="stream-running-time">02:43:18</span>
          </div>
          <div class="flex-center gap12">
            <span style="display:inline-flex; align-items:center; gap:4px"><span class="material-symbols-rounded" style="font-size:14px">volume_up</span> 85%</span>
            <span class="tc-blue flex-center gap4" style="cursor:pointer; display:inline-flex; align-items:center; gap:4px" onclick="showToast('Theater mode enabled')">
              <span class="material-symbols-rounded" style="font-size:14px">fit_screen</span> Theater Mode
            </span>
          </div>
        </div>
      </div>
      
      <!-- Right: Interactive Stream Chat -->
      <div style="flex:1; display:flex; flex-direction:column; gap:12px; justify-content:space-between; border-left:1px solid var(--border); padding-left:20px">
        <h4 class="fw8 tc-1" style="font-size:14px; border-bottom:1px solid var(--border); padding-bottom:8px; display:inline-flex; align-items:center; gap:6px">
          <span class="material-symbols-rounded" style="color:var(--blue)">forum</span> Stream Live Chat
        </h4>
        <div id="stream-chat-logs" style="flex:1; overflow-y:auto; font-size:12px; display:flex; flex-direction:column; gap:8px; padding-right:4px"></div>
        <div class="flex gap8" style="border-top:1px solid var(--border); padding-top:10px">
          <input class="input btn-sm" type="text" id="stream-chat-input" placeholder="Send a public chat message..." style="flex:1">
          <button class="btn btn-primary btn-sm" onclick="sendStreamComment()">Send</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  
  const chatInput = document.getElementById('stream-chat-input');
  if (chatInput) chatInput.addEventListener('keydown', e => { if (e.key === 'Enter') sendStreamComment(); });
  
  startStreamCanvasSimulation(emoji);
  startStreamCommentsSimulation();
}

function closeLiveStream() {
  const modal = document.getElementById('stream-player-modal');
  if (modal) modal.remove();
  if (streamInterval) { clearInterval(streamInterval); streamInterval = null; }
  if (streamCanvasAnim) { cancelAnimationFrame(streamCanvasAnim); streamCanvasAnim = null; }
  IX.stopEmojiRain();
}

function startStreamCanvasSimulation(emoji) {
  const canvas = document.getElementById('stream-video-canvas'); if (!canvas) return;
  canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  
  let particles = [];
  for (let i = 0; i < 30; i++) {
    particles.push({
      x: Math.random() * W, y: Math.random() * H,
      vx: -1 - Math.random() * 2,
      size: 4 + Math.random() * 8,
      color: `hsla(${200 + Math.random() * 80}, 70%, 60%, ${0.2 + Math.random() * 0.4})`
    });
  }
  
  const draw = () => {
    if (!document.getElementById('stream-player-modal')) return;
    ctx.fillStyle = '#05060b'; ctx.fillRect(0,0,W,H);
    ctx.strokeStyle = 'rgba(255,255,255,0.02)'; ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 30) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0; y < H; y += 30) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    
    particles.forEach(p => {
      p.x += p.vx; if (p.x < -20) p.x = W + 20;
      ctx.fillStyle = p.color; ctx.shadowColor = p.color; ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI*2); ctx.fill();
    });
    ctx.shadowBlur = 0;
    
    const scale = 1.0 + Math.sin(Date.now() * 0.005) * 0.08;
    ctx.font = `${84 * scale}px serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(emoji, W/2, H/2);
    
    ctx.strokeStyle = 'var(--blue)'; ctx.lineWidth = 3; ctx.shadowColor = 'var(--blue)'; ctx.shadowBlur = 10;
    ctx.beginPath(); ctx.moveTo(0, H - 40);
    for (let x = 0; x < W; x += 10) {
      const y = H - 40 + Math.sin(x * 0.02 + Date.now() * 0.01) * 15 * Math.sin(Date.now() * 0.001);
      ctx.lineTo(x, y);
    }
    ctx.stroke(); ctx.shadowBlur = 0;
    
    streamCanvasAnim = requestAnimationFrame(draw);
  };
  draw();
}

function startStreamCommentsSimulation() {
  const chatLogs = document.getElementById('stream-chat-logs'); if (!chatLogs) return;
  const usernames = ['Sarah Chen 👩', 'Marcus Webb 👨', 'Zara Ahmed 👩‍💼', 'Tyler Ross 🧑', 'Mia Thompson 👩‍🎨', 'Dev Kumar 🧑‍💻', 'Luna Park 🌙', 'Kai Brooks ⚡'];
  const comments = [
    'OMG this stream is crazy good! 🔥', 'Let\'s gooooo! 🚀🚀🚀', 'That absolute legend play right there.',
    'POGGERS in chat guys.', 'Wait, how did you do that? 🤯', 'Subscribing right now! 💎',
    'Peak gaming performance right here.', 'So clean! Teach me design tutorials please.',
    'Daily streak focus crew is here!', 'Can we download the mod packs?'
  ];
  
  for (let i = 0; i < 6; i++) {
    appendStreamComment(usernames[Math.floor(Math.random() * usernames.length)], comments[Math.floor(Math.random() * comments.length)]);
  }
  
  streamInterval = setInterval(() => {
    if (!document.getElementById('stream-player-modal')) return;
    appendStreamComment(usernames[Math.floor(Math.random() * usernames.length)], comments[Math.floor(Math.random() * comments.length)]);
    
    const viewCount = document.getElementById('live-viewer-count');
    if (viewCount) {
      const current = parseInt(viewCount.textContent.replace(/,/g, '').split(' ')[0]);
      const next = current + Math.round((Math.random() - 0.5) * 80);
      viewCount.textContent = `${next.toLocaleString()} watching`;
    }
    
    if (Math.random() > 0.7) {
      const rx = ['❤️','🔥','😂','🚀','💎'][Math.floor(Math.random() * 5)];
      IX.startEmojiRain([rx], 4);
      setTimeout(() => IX.stopEmojiRain(), 1000);
    }
  }, 2200 + Math.random() * 1500);
}

function appendStreamComment(user, text) {
  const chatLogs = document.getElementById('stream-chat-logs'); if (!chatLogs) return;
  const div = document.createElement('div');
  div.style.cssText = 'padding:4px 0; border-bottom:1px solid rgba(255,255,255,0.02); animation:slide-up 0.2s ease both';
  div.innerHTML = `<strong style="color:var(--blue)">${escapeHTML(user)}:</strong> <span style="color:var(--t2)">${escapeHTML(text)}</span>`;
  chatLogs.appendChild(div); chatLogs.scrollTop = chatLogs.scrollHeight;
  if (chatLogs.children.length > 50) chatLogs.children[0].remove();
}

function sendStreamComment() {
  const inp = document.getElementById('stream-chat-input'); if (!inp) return;
  const text = inp.value.trim(); if (!text) return;
  
  appendStreamComment('You (Alex Vance) ⚡', text);
  inp.value = '';
  S.user.xp += 5; updateUserUI();
}

function sendStreamReaction(emoji) {
  const rect = document.getElementById('stream-video-canvas')?.getBoundingClientRect();
  if (rect) {
    IX.burstReaction(emoji, rect.left + rect.width / 2, rect.top + rect.height / 2, 12);
  } else {
    IX.startEmojiRain([emoji], 15);
    setTimeout(() => IX.stopEmojiRain(), 1200);
  }
  showToast(`Sent live stream reaction: ${emoji}`);
  S.user.xp += 2; updateUserUI();
}

// ── INSTAGRAM-STYLE REELS POPUP CONTROLLER ──────────────────────────
let activeReelRAF = null;
let currentActiveReelIdx = -1;
let activeCanvasCtx = null;
let activeCanvasElement = null;

function openReelsPopup(startIndex) {
  // Suppress background scroll
  document.body.style.overflow = 'hidden';
  
  // Remove existing popup if any
  const existing = document.getElementById('reels-popup-overlay');
  if (existing) existing.remove();
  
  // Generate high-fidelity slides HTML
  const slidesHTML = DATA.reels.map((r, idx) => {
    const iconData = get3DIconForEmoji(r.emoji);
    const mockAudioName = `${r.creator} · Original Audio`;
    
    return `
    <div class="reel-popup-slide" data-index="${idx}">
      <canvas class="reel-canvas" id="reel-canvas-${idx}"></canvas>
      <div class="reel-popup-gradient-overlay"></div>
      
      <!-- Center Glowing 3D Emoji -->
      <div class="reel-popup-emoji-container">
        <span class="material-symbols-rounded reel-popup-emoji-3d" style="color:${iconData.color}; text-shadow: 0 0 40px ${iconData.color}a0">${iconData.icon}</span>
      </div>
      
      <!-- Metadata Overlay (Bottom Left) -->
      <div class="reel-popup-meta">
        <div class="reel-popup-creator-row">
          <div class="reel-popup-avatar">${r.creator.slice(1,3).toUpperCase()}</div>
          <span class="reel-popup-creator">${r.creator}</span>
          <button class="reel-popup-follow-btn" onclick="followReelCreator('${r.creator}', this, event)">Follow</button>
        </div>
        <div class="reel-popup-desc">${r.desc}</div>
        <div class="reel-popup-music-row">
          <span class="material-symbols-rounded">music_note</span>
          <div class="reel-popup-music-text-wrapper">
            <span class="reel-popup-music-text">${mockAudioName}</span>
          </div>
        </div>
      </div>
      
      <!-- Action Buttons Sidebar (Right) -->
      <div class="reel-popup-actions">
        <!-- Like Button -->
        <button class="reel-popup-action-btn like-btn" onclick="toggleReelLike(${idx}, event, this)">
          <div class="reel-popup-action-icon">
            <span class="material-symbols-rounded">favorite</span>
          </div>
          <span class="reel-popup-action-label" id="reel-likes-${idx}">${r.likes}</span>
        </button>
        
        <!-- Comment Button -->
        <button class="reel-popup-action-btn" onclick="openReelComments(${idx}, event)">
          <div class="reel-popup-action-icon">
            <span class="material-symbols-rounded">chat_bubble</span>
          </div>
          <span class="reel-popup-action-label">24</span>
        </button>
        
        <!-- Share Button -->
        <button class="reel-popup-action-btn" onclick="shareReel(${idx}, event)">
          <div class="reel-popup-action-icon">
            <span class="material-symbols-rounded">share</span>
          </div>
          <span class="reel-popup-action-label">Share</span>
        </button>
        
        <!-- Save/Bookmark Button -->
        <button class="reel-popup-action-btn save-btn" onclick="toggleReelSave(${idx}, event, this)">
          <div class="reel-popup-action-icon">
            <span class="material-symbols-rounded">bookmark</span>
          </div>
          <span class="reel-popup-action-label">Save</span>
        </button>
        
        <!-- Vinyl rotating music disc -->
        <div class="reel-popup-music-disc"></div>
      </div>
    </div>`;
  }).join('');
  
  const popupOverlay = document.createElement('div');
  popupOverlay.id = 'reels-popup-overlay';
  popupOverlay.innerHTML = `
    <button class="reel-popup-close-btn" onclick="closeReelsPopup()" title="Close Reels">
      <span class="material-symbols-rounded">close</span>
    </button>
    <div class="reels-popup-player">
      <div id="reels-popup-scroll-container">
        ${slidesHTML}
      </div>
    </div>
  `;
  
  document.body.appendChild(popupOverlay);
  
  const container = document.getElementById('reels-popup-scroll-container');
  
  // Set up scroll snap listener
  container.addEventListener('scroll', handleReelsPopupScroll);
  
  // Scroll to targeted slide
  setTimeout(() => {
    const slides = container.querySelectorAll('.reel-popup-slide');
    if (slides[startIndex]) {
      slides[startIndex].scrollIntoView({ behavior: 'auto' });
      // Trigger visualizer wakeup manually first time
      wakeUpReelVisualizer(startIndex);
    }
  }, 120);
}

function closeReelsPopup() {
  document.body.style.overflow = '';
  if (activeReelRAF) {
    cancelAnimationFrame(activeReelRAF);
    activeReelRAF = null;
  }
  const overlay = document.getElementById('reels-popup-overlay');
  if (overlay) overlay.remove();
  currentActiveReelIdx = -1;
}

function handleReelsPopupScroll() {
  const container = document.getElementById('reels-popup-scroll-container');
  if (!container) return;
  const slideHeight = container.clientHeight;
  if (slideHeight <= 0) return;
  
  const newIndex = Math.round(container.scrollTop / slideHeight);
  if (newIndex !== currentActiveReelIdx && newIndex >= 0 && newIndex < DATA.reels.length) {
    wakeUpReelVisualizer(newIndex);
  }
}

function followReelCreator(creator, btn, event) {
  event.stopPropagation();
  if (btn.textContent === 'Follow') {
    btn.textContent = 'Following';
    btn.style.background = 'var(--blue)';
    btn.style.borderColor = 'var(--blue)';
    showToast(`Followed ${creator}!`);
  } else {
    btn.textContent = 'Follow';
    btn.style.background = 'rgba(255, 255, 255, 0.15)';
    btn.style.borderColor = 'rgba(255, 255, 255, 0.25)';
  }
}

function toggleReelLike(idx, event, btn) {
  
  event.stopPropagation();
  const isLiked = btn.classList.toggle('active');
  const countLabel = document.getElementById(`reel-likes-${idx}`);
  if (!countLabel) return;
  
  let val = parseFloat(countLabel.textContent);
  if (isNaN(val)) val = 24.5;
  
  if (isLiked) {
    val += 0.1;
    countLabel.textContent = val.toFixed(1) + 'K';
    // Trigger tactile heart burst
    const rect = btn.getBoundingClientRect();
    if (typeof IX !== 'undefined' && IX.burstReaction) {
      IX.burstReaction('💖', rect.left + rect.width / 2, rect.top + rect.height / 2, 10);
    }
    showToast('Liked Reel!');
  } else {
    val -= 0.1;
    countLabel.textContent = val.toFixed(1) + 'K';
  }
}

function openReelComments(idx, event) {
  event.stopPropagation();
  const r = DATA.reels[idx];
  const mockComment = prompt(`Add a comment to ${r.creator}'s Reel:`);
  if (mockComment && mockComment.trim()) {
    showToast('Comment published!');
    if (typeof IX !== 'undefined' && IX.burstReaction) {
      IX.burstReaction('💬', window.innerWidth / 2, window.innerHeight / 2, 8);
    }
  }
}

function shareReel(idx, event) {
  event.stopPropagation();
  const dummyUrl = `${window.location.origin}/reel/${idx}`;
  navigator.clipboard.writeText(dummyUrl).then(() => {
    showToast('Reel link copied to clipboard! 🔗');
  }).catch(() => {
    showToast('Failed to copy link.');
  });
}

function toggleReelSave(idx, event, btn) {
  event.stopPropagation();
  const isSaved = btn.classList.toggle('active');
  if (isSaved) {
    showToast('Reel saved to bookmarks!');
    const rect = btn.getBoundingClientRect();
    if (typeof IX !== 'undefined' && IX.burstReaction) {
      IX.burstReaction('⭐', rect.left + rect.width / 2, rect.top + rect.height / 2, 6);
    }
  }
}

function wakeUpReelVisualizer(idx) {
  currentActiveReelIdx = idx;
  if (activeReelRAF) {
    cancelAnimationFrame(activeReelRAF);
  }
  
  const canvas = document.getElementById(`reel-canvas-${idx}`);
  if (!canvas) return;
  
  const ctx = canvas.getContext('2d');
  activeCanvasElement = canvas;
  activeCanvasCtx = ctx;
  
  // Set dimensions
  const resize = () => {
    if (canvas && canvas.parentElement) {
      canvas.width = canvas.parentElement.clientWidth || 420;
      canvas.height = canvas.parentElement.clientHeight || 820;
    }
  };
  resize();
  window.addEventListener('resize', resize, { once: true });
  
  const reel = DATA.reels[idx];
  const emoji = reel.emoji;
  
  // Animation state instantiation
  let frame = 0;
  const particles = [];
  
  // Pre-populate particles based on theme
  if (emoji === '💻') { // Matrix rain
    const cols = Math.floor(canvas.width / 14) + 1;
    const ypos = Array(cols).fill(0).map(() => Math.random() * -100);
    
    function drawMatrix() {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      ctx.fillStyle = '#0f8'; // Neon green
      ctx.font = '13px monospace';
      
      for (let i = 0; i < cols; i++) {
        const char = Math.random() > 0.5 ? '1' : '0';
        const x = i * 14;
        const y = ypos[i];
        
        ctx.fillText(char, x, y);
        
        if (y > canvas.height && Math.random() > 0.975) {
          ypos[i] = 0;
        } else {
          ypos[i] = y + 14;
        }
      }
    }
    
    const loop = () => {
      if (currentActiveReelIdx !== idx) return;
      drawMatrix();
      activeReelRAF = requestAnimationFrame(loop);
    };
    loop();
    
  } else if (emoji === '💪') { // Fitness EKG + Orange Embers
    // Embers
    for (let i = 0; i < 40; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: canvas.height + Math.random() * 100,
        size: 1 + Math.random() * 3,
        speed: 1 + Math.random() * 2,
        opacity: 0.3 + Math.random() * 0.7,
        hue: 15 + Math.random() * 25 // Orange-red embers
      });
    }
    
    // EKG line parameters
    let ekgPoints = [];
    const ekgSpeed = 3;
    let ekgX = 0;
    
    function drawFitness() {
      ctx.fillStyle = 'rgba(10, 10, 15, 0.2)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // 1. Draw glowing background embers
      particles.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.hue}, 100%, 60%, ${p.opacity})`;
        ctx.shadowBlur = p.size * 3;
        ctx.shadowColor = `hsl(${p.hue}, 100%, 50%)`;
        ctx.fill();
        ctx.shadowBlur = 0; // reset
        
        p.y -= p.speed;
        p.x += Math.sin(frame / 20 + p.speed) * 0.5;
        
        if (p.y < -10) {
          p.y = canvas.height + 10;
          p.x = Math.random() * canvas.width;
        }
      });
      
      // 2. Draw pulsing EKG line
      ekgX = (ekgX + ekgSpeed) % canvas.width;
      
      // EKG waveform generation
      let ekgVal = canvas.height * 0.7; // baseline
      const mod = ekgX % 200;
      if (mod > 40 && mod < 50) {
        ekgVal -= (mod - 40) * 12; // spike up
      } else if (mod >= 50 && mod < 65) {
        ekgVal += (mod - 50) * 10; // spike down
      } else if (mod >= 65 && mod < 75) {
        ekgVal -= (75 - mod) * 3; // return to normal
      }
      
      ekgPoints.push({ x: ekgX, y: ekgVal });
      if (ekgPoints.length > 100) ekgPoints.shift();
      
      ctx.beginPath();
      for (let i = 0; i < ekgPoints.length; i++) {
        const pt = ekgPoints[i];
        if (i === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      }
      
      ctx.strokeStyle = 'rgba(255, 75, 110, 0.85)';
      ctx.lineWidth = 3;
      ctx.shadowBlur = 15;
      ctx.shadowColor = 'rgba(255, 75, 110, 0.8)';
      ctx.stroke();
      ctx.shadowBlur = 0;
      
      // Draw lead indicator
      ctx.beginPath();
      ctx.arc(ekgX, ekgVal, 6, 0, Math.PI * 2);
      ctx.fillStyle = '#ff4b6e';
      ctx.fill();
      
      frame++;
    }
    
    const loop = () => {
      if (currentActiveReelIdx !== idx) return;
      drawFitness();
      activeReelRAF = requestAnimationFrame(loop);
    };
    loop();
    
  } else if (emoji === '🍕') { // Cooking sparks galaxy
    for (let i = 0; i < 60; i++) {
      particles.push({
        angle: Math.random() * Math.PI * 2,
        radius: 10 + Math.random() * 150,
        speed: 0.01 + Math.random() * 0.02,
        size: 1 + Math.random() * 3,
        color: `hsl(${35 + Math.random() * 15}, 100%, ${60 + Math.random()*20}%)` // Golden-orange sparks
      });
    }
    
    function drawChef() {
      ctx.fillStyle = 'rgba(10, 5, 0, 0.15)'; // warm glow
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      const cx = canvas.width / 2;
      const cy = canvas.height * 0.45; // elevated middle
      
      particles.forEach(p => {
        p.angle += p.speed;
        p.radius += Math.sin(frame / 60 + p.radius) * 0.2; // pulse radial bound
        
        const x = cx + Math.cos(p.angle) * p.radius;
        const y = cy + Math.sin(p.angle) * p.radius * 0.8; // elliptical orbit
        
        ctx.beginPath();
        ctx.arc(x, y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.shadowBlur = p.size * 4;
        ctx.shadowColor = p.color;
        ctx.fill();
        ctx.shadowBlur = 0;
      });
      
      frame++;
    }
    
    const loop = () => {
      if (currentActiveReelIdx !== idx) return;
      drawChef();
      activeReelRAF = requestAnimationFrame(loop);
    };
    loop();
    
  } else if (emoji === '🧘') { // Zen breathing halos + drifting soft sparkles
    for (let i = 0; i < 20; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: 1 + Math.random() * 2,
        speedX: (Math.random() - 0.5) * 0.3,
        speedY: (Math.random() - 0.5) * 0.3,
        alpha: 0.1 + Math.random() * 0.5
      });
    }
    
    function drawZen() {
      ctx.fillStyle = '#06060c';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      const cx = canvas.width / 2;
      const cy = canvas.height * 0.45;
      
      // Calming breathing halos
      const breathSpeed = 0.015;
      const breathing = Math.sin(frame * breathSpeed); // ranges [-1, 1]
      const sizeScale = 1.0 + breathing * 0.15; // smooth expansion / contraction
      
      const halos = [
        { r: 120, color: 'rgba(150, 110, 255, 0.08)' },
        { r: 80,  color: 'rgba(74, 218, 172, 0.09)' },
        { r: 40,  color: 'rgba(255, 130, 200, 0.07)' }
      ];
      
      halos.forEach(h => {
        ctx.beginPath();
        ctx.arc(cx, cy, h.r * sizeScale, 0, Math.PI * 2);
        ctx.fillStyle = h.color;
        ctx.fill();
        
        ctx.strokeStyle = h.color.replace('0.0', '0.2');
        ctx.lineWidth = 1.5;
        ctx.stroke();
      });
      
      // Soft drift sparkles
      particles.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${p.alpha})`;
        ctx.fill();
        
        p.x += p.speedX;
        p.y += p.speedY;
        
        if (p.x < 0 || p.x > canvas.width) p.speedX *= -1;
        if (p.y < 0 || p.y > canvas.height) p.speedY *= -1;
      });
      
      frame++;
    }
    
    const loop = () => {
      if (currentActiveReelIdx !== idx) return;
      drawZen();
      activeReelRAF = requestAnimationFrame(loop);
    };
    loop();
    
  } else if (emoji === '🎵') { // Neon frequency wave bars
    const barCount = 20;
    const barWidth = canvas.width / barCount;
    
    function drawMusic() {
      ctx.fillStyle = 'rgba(8, 8, 16, 0.15)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      for (let i = 0; i < barCount; i++) {
        // Generate pseudo frequency height using sine wave functions
        const wave = Math.sin(frame * 0.08 + i * 0.3) * 60 + Math.cos(frame * 0.15 - i * 0.2) * 40;
        const height = Math.abs(wave) + 20;
        
        const x = i * barWidth;
        const y = canvas.height - height;
        
        // Premium vertical gradient
        const grad = ctx.createLinearGradient(x, y, x, canvas.height);
        grad.addColorStop(0, 'var(--purple)');
        grad.addColorStop(0.5, 'var(--blue)');
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        
        ctx.fillStyle = grad;
        ctx.fillRect(x + 2, y, barWidth - 4, height);
        
        // Top glowing point
        ctx.beginPath();
        ctx.arc(x + barWidth/2, y, 3, 0, Math.PI*2);
        ctx.fillStyle = '#fff';
        ctx.shadowBlur = 8;
        ctx.shadowColor = 'var(--purple)';
        ctx.fill();
        ctx.shadowBlur = 0;
      }
      
      frame++;
    }
    
    const loop = () => {
      if (currentActiveReelIdx !== idx) return;
      drawMusic();
      activeReelRAF = requestAnimationFrame(loop);
    };
    loop();
    
  } else if (emoji === '🌅') { // Golden travel dust sunset
    for (let i = 0; i < 40; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: canvas.height * 0.3 + Math.random() * (canvas.height * 0.7),
        size: 1.5 + Math.random() * 3,
        speedX: (Math.random() - 0.5) * 0.5,
        speedY: -0.4 - Math.random() * 0.8,
        color: `hsl(${25 + Math.random() * 20}, 95%, 65%)`,
        opacity: 0.2 + Math.random() * 0.8
      });
    }
    
    function drawSunset() {
      // Warm sunset gradient background
      const sunsetGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
      sunsetGrad.addColorStop(0, '#090812');
      sunsetGrad.addColorStop(0.4, '#1b122c');
      sunsetGrad.addColorStop(0.7, '#481938');
      sunsetGrad.addColorStop(1, '#6b2d2d');
      ctx.fillStyle = sunsetGrad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      particles.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.shadowBlur = 10;
        ctx.shadowColor = p.color;
        ctx.fill();
        ctx.shadowBlur = 0;
        
        p.x += p.speedX;
        p.y += p.speedY;
        
        // Loop dust
        if (p.y < 0) {
          p.y = canvas.height + 10;
          p.x = Math.random() * canvas.width;
        }
      });
      
      frame++;
    }
    
    const loop = () => {
      if (currentActiveReelIdx !== idx) return;
      drawSunset();
      activeReelRAF = requestAnimationFrame(loop);
    };
    loop();
    
  } else if (emoji === '🎨') { // Swirling paint drops connecting with lines
    for (let i = 0; i < 15; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: 3 + Math.random() * 5,
        speedX: (Math.random() - 0.5) * 1.2,
        speedY: (Math.random() - 0.5) * 1.2,
        color: `hsl(${Math.random() * 360}, 90%, 65%)`
      });
    }
    
    function drawArt() {
      ctx.fillStyle = 'rgba(6, 6, 10, 0.2)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Draw lines between nearby paint particles
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          
          if (dist < 110) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(255, 255, 255, ${0.15 * (1 - dist/110)})`;
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }
      }
      
      // Draw and move paint dots
      particles.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();
        
        p.x += p.speedX;
        p.y += p.speedY;
        
        // Bounce off bounds
        if (p.x < 10 || p.x > canvas.width - 10) p.speedX *= -1;
        if (p.y < 10 || p.y > canvas.height - 10) p.speedY *= -1;
      });
      
      frame++;
    }
    
    const loop = () => {
      if (currentActiveReelIdx !== idx) return;
      drawArt();
      activeReelRAF = requestAnimationFrame(loop);
    };
    loop();
    
  } else if (emoji === '🐶') { // Bouncing cute hearts and trail emojis
    for (let i = 0; i < 20; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: canvas.height + Math.random() * 50,
        size: 12 + Math.random() * 12,
        speedX: (Math.random() - 0.5) * 1.0,
        speedY: -1.0 - Math.random() * 1.5,
        rot: Math.random() * Math.PI,
        rotSpeed: (Math.random() - 0.5) * 0.05,
        type: Math.random() > 0.5 ? '❤️' : '🐾'
      });
    }
    
    function drawPets() {
      ctx.fillStyle = '#060a0f';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      particles.forEach(p => {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.font = `${p.size}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(p.type, 0, 0);
        ctx.restore();
        
        p.x += p.speedX;
        p.y += p.speedY;
        p.rot += p.rotSpeed;
        
        if (p.y < -30) {
          p.y = canvas.height + 30;
          p.x = Math.random() * canvas.width;
        }
      });
      
      frame++;
    }
    
    const loop = () => {
      if (currentActiveReelIdx !== idx) return;
      drawPets();
      activeReelRAF = requestAnimationFrame(loop);
    };
    loop();
    
  } else { // Fallback floating bubbles
    for (let i = 0; i < 30; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: 4 + Math.random() * 12,
        dx: (Math.random() - 0.5) * 0.8,
        dy: (Math.random() - 0.5) * 0.8,
        alpha: 0.1 + Math.random() * 0.4
      });
    }
    
    function drawBubbles() {
      ctx.fillStyle = '#08080f';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      particles.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${p.alpha})`;
        ctx.strokeStyle = `rgba(255, 255, 255, ${p.alpha * 1.5})`;
        ctx.lineWidth = 1;
        ctx.fill();
        ctx.stroke();
        
        p.x += p.dx;
        p.y += p.dy;
        
        if (p.x < -p.r) p.x = canvas.width + p.r;
        if (p.x > canvas.width + p.r) p.x = -p.r;
        if (p.y < -p.r) p.y = canvas.height + p.r;
        if (p.y > canvas.height + p.r) p.y = -p.r;
      });
    }
    
    const loop = () => {
      if (currentActiveReelIdx !== idx) return;
      drawBubbles();
      activeReelRAF = requestAnimationFrame(loop);
    };
    loop();
  }
}

// ── INSTAGRAM-STYLE STORIES VIEWER CONTROLLER ──────────────────────
let storyTimerInterval = null;
let currentStoryIdx = -1;
let storyProgressPct = 0;
let storyPaused = false;

const STORY_CONTENTS = {
  'Sarah': { text: "Brewing some fresh code this morning! ☕💻 Let's build something incredible today.", handle: "@sarahc", time: "2h ago", bg: "linear-gradient(135deg, #1b122c, #4a1240)" },
  'Marcus': { text: "No excuses. 5 AM cardio session demolished! 🏋️💪 Consistency beats talent every single day.", handle: "@marcusw", time: "5h ago", bg: "linear-gradient(135deg, #0e1a2f, #114b3e)" },
  'Zara': { text: "Off to Tokyo! ✈️\uD83C\uDDEF\uD83C\uDDF5 Exploring new minimal UI design trends for the next dashboard. Stay tuned!", handle: "@zaraa", time: "8h ago", bg: "linear-gradient(135deg, #3d1b11, #5c2c16)" },
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

// ── GOOGLE TRENDS STREAM INTEGRATION CONTROLLER ───────────────────
S.googleTrendsActive = false;
S.originalTopics = null;

async function fetchGoogleTrends() {
  try {
    const mockGoogleData = [
      { emoji: '\u2728', name: 'Generative AI Tools', count: '3.2M searches', live: true },
      { emoji: '\u2728', name: 'Web3 & Bitcoin Volatility', count: '1.9M searches', live: true },
      { emoji: '\u2728', name: 'Spatial UI Glassmorphism', count: '1.6M searches', live: true },
      { emoji: '\u2728', name: 'Next.js 16 & React Server Core', count: '1.4M searches', live: true },
      { emoji: '\u2728', name: 'Sustainable Eco-Travel', count: '950K searches', live: true },
      { emoji: '\u2728', name: 'Ambient Lofi Beats', count: '870K searches', live: true },
      { emoji: '\u2728', name: 'HIIT Strength & Longevity', count: '780K searches', live: true },
      { emoji: '\u2728', name: 'Artisan Neapolitan Dough', count: '690K searches', live: true },
      { emoji: '\u2728', name: 'Commercial Fusion Generators', count: '540K searches', live: true }
    ];
    return mockGoogleData;
  } catch (error) {
    console.error("Error fetching Google Real-Time data:", error);
    return null;
  }
}

async function toggleGoogleTrends() {
  S.googleTrendsActive = !S.googleTrendsActive;
  
  const indicator = document.getElementById('google-trends-status');
  if (indicator) {
    indicator.innerHTML = S.googleTrendsActive 
      ? '<span class="status-dot green" style="background:var(--green); width:8px; height:8px; border-radius:50%; display:inline-block"></span> Live Google Trends Connected'
      : '<span class="status-dot" style="background:var(--t3); width:8px; height:8px; border-radius:50%; display:inline-block"></span> Connect Google Trends';
    indicator.style.color = S.googleTrendsActive ? 'var(--green)' : 'var(--t2)';
  }
  
  if (S.googleTrendsActive) {
    const liveData = await fetchGoogleTrends();
    if (liveData) {
      // Store original topics to restore on toggle off
      if (!S.originalTopics) {
        S.originalTopics = [...DATA.topics];
      }
      DATA.topics = liveData;
      showToast('🌐 Real-time Google Trends connected successfully!');
      
      // Burst haptic effect at center of screen
      if (typeof IX !== 'undefined' && IX.burstReaction) {
        IX.burstReaction('🌐', window.innerWidth / 2, window.innerHeight * 0.45, 12);
      }
    }
  } else {
    if (S.originalTopics) {
      DATA.topics = [...S.originalTopics];
    }
    showToast('Offline from Google Trends stream.');
  }
  
  renderExplore();
}

// ── NOMAD SPACE OFFICE ───────────────────────────────────────────
let nomadState = {
  focusRunning: false,
  focusSeconds: 1500, // 25 minutes
  focusInterval: null,
  activeAmbient: 'none',
  audioCtx: null,
  ambientSynth: { oscL: null, oscR: null, gainNode: null, noiseSource: null, zenCarrier: null, zenLfo: null },
  visualizerAnim: null,
  visualizerX: 0
};

function renderNomad() {
  // Set default sub-tab to workspace finder
  switchNomadTab('workspace', false);
  
  updateTimerUI();
  
  // Initialize the placeholder visualizer canvas
  const canvas = $id('ambient-visualizer');
  if (canvas) {
    canvas.width = canvas.offsetWidth || 500;
    canvas.height = 80;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#09090f';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw initial idle wave
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(0,163,255,0.15)';
    ctx.lineWidth = 2;
    ctx.moveTo(0, canvas.height/2);
    ctx.lineTo(canvas.width, canvas.height/2);
    ctx.stroke();
  }
}

function switchNomadTab(tab, playChirp = true) {
  if (playChirp) {
    playNomadChirp(200, 300, 0.1);
  }
  
  // Toggle tab buttons and views
  ['workspace', 'focus', 'studio'].forEach(t => {
    const btn = $id(`nt-${t}`);
    const view = $id(`nomad-${t}-view`);
    if (btn) btn.classList.toggle('active', t === tab);
    if (view) view.classList.toggle('hidden', t !== tab);
  });
  
  if (tab === 'focus') {
    // Re-initialize canvas size now that it is visible
    const canvas = $id('ambient-visualizer');
    if (canvas) {
      canvas.width = canvas.offsetWidth || 500;
      canvas.height = 80;
    }
    // Start visualizer animation if an ambient theme is active and not already running
    if (nomadState.activeAmbient !== 'none' && !nomadState.visualizerAnim) {
      runNomadVisualizer();
    }
  }
}

function filterNomadSpaces(cat) {
  playNomadChirp(300, 200, 0.08); // Downward chirp for click haptics
  
  // Highlight active filter chip
  const parent = document.querySelector('.space-filters');
  if (parent) {
    const chips = parent.querySelectorAll('.filter-chip');
    chips.forEach(chip => {
      const text = chip.textContent.toLowerCase();
      const isActive = (cat === 'all' && text.includes('all')) || 
                       (cat === 'cafe' && text.includes('cafe')) ||
                       (cat === 'co-working' && text.includes('co-working')) ||
                       (cat === 'library' && text.includes('librar'));
      chip.classList.toggle('active', isActive);
    });
  }
  
  // Transition matching and non-matching space cards
  const cards = document.querySelectorAll('.spaces-grid .space-card');
  cards.forEach(card => {
    const type = card.getAttribute('data-type');
    const isMatch = (cat === 'all') || (type === cat);
    
    if (isMatch) {
      card.style.display = 'flex';
      // Force reflow
      void card.offsetHeight;
      card.style.opacity = '1';
      card.style.transform = 'scale(1)';
    } else {
      card.style.opacity = '0';
      card.style.transform = 'scale(0.95)';
      setTimeout(() => {
        if (card.style.opacity === '0') {
          card.style.display = 'none';
        }
      }, 300);
    }
  });
}

function updateTimerUI() {
  const display = $id('focus-time-display');
  if (!display) return;
  
  const m = Math.floor(nomadState.focusSeconds / 60);
  const s = nomadState.focusSeconds % 60;
  display.textContent = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  
  // Update circular stroke progress
  const progressRing = $id('timer-progress-ring');
  if (progressRing) {
    const total = 1500;
    const fraction = nomadState.focusSeconds / total;
    // 534 is the circumference for r=85 (2 * PI * 85 ~ 534)
    const offset = 534 * (1 - fraction);
    progressRing.style.strokeDashoffset = offset;
  }
}

function toggleFocusTimer() {
  const btnIcon = $id('focus-toggle-icon');
  const btnTxt = $id('focus-toggle-txt');
  
  if (nomadState.focusRunning) {
    // Pause
    nomadState.focusRunning = false;
    clearInterval(nomadState.focusInterval);
    nomadState.focusInterval = null;
    if (btnIcon) btnIcon.textContent = 'play_arrow';
    if (btnTxt) btnTxt.textContent = 'Start Focus';
    playNomadChirp(200, 100, 0.15); // Downward chirp
    showToast('Focus timer paused.');
  } else {
    // Start
    nomadState.focusRunning = true;
    if (btnIcon) btnIcon.textContent = 'pause';
    if (btnTxt) btnTxt.textContent = 'Pause Focus';
    
    playNomadChirp(100, 300, 0.2); // Upward chirp
    showToast('Focus session active. Stay calm!');
    
    nomadState.focusInterval = setInterval(() => {
      if (nomadState.focusSeconds > 0) {
        nomadState.focusSeconds--;
        updateTimerUI();
      } else {
        completeFocusTimer();
      }
    }, 1000);
  }
}

function resetFocusTimer() {
  nomadState.focusRunning = false;
  if (nomadState.focusInterval) {
    clearInterval(nomadState.focusInterval);
    nomadState.focusInterval = null;
  }
  nomadState.focusSeconds = 1500;
  
  const btnIcon = $id('focus-toggle-icon');
  const btnTxt = $id('focus-toggle-txt');
  if (btnIcon) btnIcon.textContent = 'play_arrow';
  if (btnTxt) btnTxt.textContent = 'Start Focus';
  
  updateTimerUI();
}

function completeFocusTimer() {
  nomadState.focusRunning = false;
  clearInterval(nomadState.focusInterval);
  nomadState.focusInterval = null;
  
  const btnIcon = $id('focus-toggle-icon');
  const btnTxt = $id('focus-toggle-txt');
  if (btnIcon) btnIcon.textContent = 'play_arrow';
  if (btnTxt) btnTxt.textContent = 'Start Focus';
  
  // Play triumphant ascending arpeggio chimes!
  playNomadChimes();
  
  // Award XP
  if (typeof S !== 'undefined' && S.user) {
    S.user.xp += 200;
    if (S.user.xp >= S.user.level * 1000) {
      S.user.xp -= S.user.level * 1000;
      S.user.level++;
      showToast(`🏆 LEVEL UP! You reached Level ${S.user.level}! 🎉`);
    }
    updateUserUI();
  }
  
  showToast('🎉 Focus Session Completed! +200 XP awarded!');
  
  // Trigger a full cursor celebration burst!
  if (typeof IX !== 'undefined' && IX.burstReaction) {
    IX.burstReaction('⏳', window.innerWidth / 2, window.innerHeight / 2, 20);
  }
  
  resetFocusTimer();
}

// Chiptune synthesized sound creators using HTML5 Web Audio API
function playNomadChirp(startFreq, endFreq, duration) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(startFreq, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(endFreq, ctx.currentTime + duration);
    
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + duration);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch(e) {}
}

function playNomadChimes() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const notes = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99, 1046.50]; // Ascending C major arpeggio
    notes.forEach((freq, i) => {
      const delay = i * 0.12;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);
      
      gain.gain.setValueAtTime(0, ctx.currentTime + delay);
      gain.gain.linearRampToValueAtTime(0.1, ctx.currentTime + delay + 0.02);
      gain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + delay + 0.4);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start(ctx.currentTime + delay);
      osc.stop(ctx.currentTime + delay + 0.4);
    });
  } catch(e) {}
}

// Procedural Binaural Synthesizers using Web Audio API
function selectNomadAmbient(type) {
  // Update chips highlighting
  ['none', 'lofi', 'rain', 'zen'].forEach(t => {
    const btn = $id(`amb-${t}`);
    if (btn) btn.classList.toggle('active', t === type);
  });
  
  if (nomadState.activeAmbient === type) return;
  
  stopNomadAmbientSynth();
  nomadState.activeAmbient = type;
  
  if (type !== 'none') {
    startNomadAmbientSynth(type);
    showToast(`Ambient Soundscape loaded: ${type === 'lofi' ? 'Cosmic Lofi' : (type === 'rain' ? 'Cyber Rain' : 'Forest Zen')}`);
  } else {
    showToast('Soundscape muted.');
  }
}

function startNomadAmbientSynth(type) {
  try {
    if (!nomadState.audioCtx) {
      nomadState.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    const ctx = nomadState.audioCtx;
    if (ctx.state === 'suspended') ctx.resume();
    
    // Main output master fader
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0, ctx.currentTime);
    masterGain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.5); // Smooth fade in
    masterGain.connect(ctx.destination);
    
    nomadState.synthNodes.gainNode = masterGain;
    
    if (type === 'lofi') {
      // Create binaural offset: Left = 150Hz, Right = 154Hz. Binaural diff is 4Hz (Theta/Alpha waves)
      const oscL = ctx.createOscillator();
      const oscR = ctx.createOscillator();
      oscL.type = 'sine'; oscL.frequency.setValueAtTime(150, ctx.currentTime);
      oscR.type = 'sine'; oscR.frequency.setValueAtTime(154, ctx.currentTime);
      
      // Separate stereo channels
      const merger = ctx.createChannelMerger(2);
      oscL.connect(merger, 0, 0); // oscL to Left
      oscR.connect(merger, 0, 1); // oscR to Right
      
      // Warm carrier drone to both ears
      const subDrone = ctx.createOscillator();
      subDrone.type = 'triangle';
      subDrone.frequency.setValueAtTime(75, ctx.currentTime);
      
      const subGain = ctx.createGain();
      subGain.gain.setValueAtTime(0.4, ctx.currentTime);
      subDrone.connect(subGain);
      
      merger.connect(masterGain);
      subGain.connect(masterGain);
      
      oscL.start(); oscR.start(); subDrone.start();
      
      nomadState.synthNodes.oscL = oscL;
      nomadState.synthNodes.oscR = oscR;
      nomadState.synthNodes.subDrone = subDrone;
      
    } else if (type === 'rain') {
      // Synthesize pink noise procedurally!
      const bufferSize = 2 * ctx.sampleRate;
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      
      let b0, b1, b2, b3, b4, b5, b6;
      b0 = b1 = b2 = b3 = b4 = b5 = b6 = 0.0;
      
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        output[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
        output[i] *= 0.12; // lower scale
        b6 = white * 0.115926;
      }
      
      const noiseSource = ctx.createBufferSource();
      noiseSource.buffer = noiseBuffer;
      noiseSource.loop = true;
      
      // Filter the hiss for relaxing ocean rain vibes
      const lpFilter = ctx.createBiquadFilter();
      lpFilter.type = 'lowpass';
      lpFilter.frequency.setValueAtTime(800, ctx.currentTime);
      
      noiseSource.connect(lpFilter);
      lpFilter.connect(masterGain);
      
      noiseSource.start();
      nomadState.synthNodes.noiseSource = noiseSource;
      
    } else if (type === 'zen') {
      // 110Hz carrying beat modulated by a breathing LFO (0.12Hz ~ 8 seconds cycles)
      const carrier = ctx.createOscillator();
      carrier.type = 'sine';
      carrier.frequency.setValueAtTime(110, ctx.currentTime);
      
      const lfo = ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.setValueAtTime(0.12, ctx.currentTime); // breathing wave
      
      const lfoGain = ctx.createGain();
      lfoGain.gain.setValueAtTime(0.04, ctx.currentTime);
      
      // Create master modulator gain node
      const synthGain = ctx.createGain();
      synthGain.gain.setValueAtTime(0.06, ctx.currentTime);
      
      lfo.connect(lfoGain);
      lfoGain.connect(synthGain.gain); // Modulate synth volume!
      
      carrier.connect(synthGain);
      synthGain.connect(masterGain);
      
      carrier.start(); lfo.start();
      
      nomadState.synthNodes.zenCarrier = carrier;
      nomadState.synthNodes.zenLfo = lfo;
    }
    
    // Start visualizer canvas loop
    if (!nomadState.visualizerAnim) {
      runNomadVisualizer();
    }
  } catch(e) {}
}

// Fades out oscillators before cutting connections to prevent click pops!
function stopNomadAmbientSynth() {
  const s = nomadState.synthNodes;
  const ctx = nomadState.audioCtx;
  
  if (s.gainNode && ctx) {
    try {
      s.gainNode.gain.setValueAtTime(s.gainNode.gain.value, ctx.currentTime);
      s.gainNode.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    } catch(e) {}
  }
  
  setTimeout(() => {
    try {
      if (s.oscL) { s.oscL.stop(); s.oscL.disconnect(); s.oscL = null; }
      if (s.oscR) { s.oscR.stop(); s.oscR.disconnect(); s.oscR = null; }
      if (s.subDrone) { s.subDrone.stop(); s.subDrone.disconnect(); s.subDrone = null; }
      if (s.noiseSource) { s.noiseSource.stop(); s.noiseSource.disconnect(); s.noiseSource = null; }
      if (s.zenCarrier) { s.zenCarrier.stop(); s.zenCarrier.disconnect(); s.zenCarrier = null; }
      if (s.zenLfo) { s.zenLfo.stop(); s.zenLfo.disconnect(); s.zenLfo = null; }
      if (s.gainNode) { s.gainNode.disconnect(); s.gainNode = null; }
    } catch(e) {}
  }, 200);
}

document.addEventListener("DOMContentLoaded", () => {
  // Target each of your sidebar anchors manually to direct them cleanly via central router
  document.querySelectorAll('a').forEach(link => {
    const text = link.textContent.toLowerCase();
    
    let key = "";
    if (text.includes("home")) key = "home";
    else if (text.includes("explore")) key = "explore";
    else if (text.includes("reels")) key = "reels";
    else if (text.includes("shop")) key = "shop";
    else if (text.includes("fitness")) key = "fitness";
    else if (text.includes("learn")) key = "learn";
    else if (text.includes("ai studio")) key = "aistudio";

    if (key) {
      link.addEventListener("click", (e) => {
        e.preventDefault();
        routeToView(key);
      });
    }
  });

  // Default initial view setup to display automatically on startup
  if (document.getElementById("app-viewport") && !document.getElementById("app-viewport").classList.contains('hidden')) {
    routeToView("home");
  }
});

// --- PAGE CONTENT DATABASE FOR AUTOMATED COMPATIBILITY ---
const pageLayouts = {
  home: `
    <div class="view-hero" style="background: linear-gradient(135deg, #311b92, #0091ea); padding: 40px; border-radius: 16px; margin-bottom: 24px; color: #fff; font-family: system-ui, sans-serif;">
      <h2>Welcome back to Trending</h2>
      <p>Your digital universe dashboard. Track your investments, configure AI tools, or explore what's trending across your feeds today.</p>
    </div>
    <div class="content-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; color: #fff; font-family: system-ui, sans-serif;">
      <div class="dashboard-card" style="background: #1f1f23; border: 1px solid #2d2d31; padding: 20px; border-radius: 12px;">
        <h3>📈 Quick Financial Pulse</h3>
        <p style="color: #9aa0a6;">Market tracking active. SBI Mutual Fund SIP status: Processing.</p>
      </div>
      <div class="dashboard-card" style="background: #1f1f23; border: 1px solid #2d2d31; padding: 20px; border-radius: 12px;">
        <h3>🏸 Badminton Court Booking</h3>
        <p style="color: #9aa0a6;">Next casual indoor club session matching soon.</p>
      </div>
    </div>
  `,
  explore: `
    <div class="view-section" style="color: #fff; font-family: system-ui, sans-serif;">
      <h2 style="margin-bottom: 16px;">🔥 What's Hot on Trending</h2>
      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px;">
        <div style="background: #1f1f23; border-radius: 12px; padding: 16px; border: 1px solid #2d2d31;">
          <div style="background:#2d2d31; height:120px; border-radius:8px; display:flex; align-items:center; justify-content:center; font-size:2rem;">🤖</div>
          <h4 style="margin: 12px 0 4px 0;">Antigravity 2.0 Engine</h4>
          <p style="font-size:0.85rem; color:#9aa0a6; margin:0;">Deep dive into prompt optimizations and system architecture keys.</p>
        </div>
        <div style="background: #1f1f23; border-radius: 12px; padding: 16px; border: 1px solid #2d2d31;">
          <div style="background:#2d2d31; height:120px; border-radius:8px; display:flex; align-items:center; justify-content:center; font-size:2rem;">🏛️</div>
          <h4 style="margin: 12px 0 4px 0;">Palace & Modern Architecture</h4>
          <p style="font-size:0.85rem; color:#9aa0a6; margin:0;">Visual blueprints and render breakdowns for Rajasthani estate concepts.</p>
        </div>
      </div>
    </div>
  `,
  reels: `
    <div style="max-width: 450px; margin: 0 auto; display: flex; flex-direction: column; gap: 24px; color: #fff; font-family: system-ui, sans-serif;">
      <div style="background: #1f1f23; border: 1px solid #2d2d31; border-radius: 16px; overflow: hidden;">
        <div style="background: linear-gradient(180deg, #111, #333); height: 500px; display: flex; align-items: center; justify-content: center; font-size: 4rem;">🏍️</div>
        <div style="padding: 16px;">
          <h4 style="margin:0 0 4px 0;">Mountain Touring Diaries</h4>
          <p style="margin:0; font-size:0.85rem; color:#9aa0a6;">Cruising through the scenic highland forests and clear horizons.</p>
        </div>
      </div>
    </div>
  `,
  shop: `
    <div style="padding: 12px; color: #fff; font-family: system-ui, sans-serif;">
      <h2 style="margin-bottom: 8px;">🛒 TrendStore</h2>
      <p style="color: #9aa0a6; margin-bottom: 24px;">Discover trending products curated by creators.</p>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px;">
        <div style="background: #1f1f23; border-radius: 12px; padding: 16px; border: 1px solid #2d2d31;">
          <div style="background:#2d2d31; height:120px; border-radius:8px; display:flex; align-items:center; justify-content:center; font-size:2.5rem;">🎧</div>
          <h4 style="margin: 12px 0 4px 0;">SoundMax Wireless</h4>
          <p style="font-size:0.85rem; color:#9aa0a6; margin:0;">Premium noise cancellation headphones.</p>
          <div style="display:flex; justify-content:between; align-items:center; margin-top:12px;">
            <span style="font-weight:700; color:var(--pink); font-size:1.1rem;">$199.99</span>
          </div>
        </div>
      </div>
    </div>
  `,
  fitness: `
    <div style="padding: 12px; color: #fff; font-family: system-ui, sans-serif;">
      <h2 style="margin-bottom: 8px;">💪 Track Tracker & Active Performance</h2>
      <p style="color: #9aa0a6; margin-bottom: 24px;">Log gym workflows, swimming performance metrics, and workout routines.</p>
      <div style="display: flex; gap: 16px; flex-wrap: wrap;">
        <div style="background: #1f1f23; padding: 20px; border-radius: 12px; border: 1px solid #2d2d31; flex: 1; min-width: 250px;">
          <h4>🏊 Pool Laps Counter</h4>
          <p style="font-size: 2rem; margin: 12px 0 4px 0; color: #00e5ff;">Active</p>
          <span style="color: #9aa0a6; font-size: 0.85rem;">Kickboard metrics running.</span>
        </div>
        <div style="background: #1f1f23; padding: 20px; border-radius: 12px; border: 1px solid #2d2d31; flex: 1; min-width: 250px;">
          <h4>🏋️ Physique Analytics</h4>
          <p style="font-size: 2rem; margin: 12px 0 4px 0; color: #ff1744;">Logged</p>
          <span style="color: #9aa0a6; font-size: 0.85rem;">Hypertrophy training set complete.</span>
        </div>
      </div>
    </div>
  `,
  learn: `
    <div style="color: #fff; font-family: system-ui, sans-serif;">
      <h2>🎓 Democracy Enclave & Freelance Gigs</h2>
      <p style="color:#9aa0a6;">Level up skills or access ongoing corporate finance modules.</p>
      <div style="background:#1f1f23; border: 1px solid #2d2d31; padding:20px; border-radius:12px; margin-top:16px;">
        <h4 style="margin:0 0 8px 0;">Valuation & Share Accounting Fundamentals</h4>
        <progress value="85" max="100" style="width:100%; height:8px; accent-color:#00a3ff;"></progress>
        <p style="font-size:0.85rem; color:#9aa0a6; margin: 8px 0 0 0;">85% Completed — Next up: Goodwill calculations</p>
      </div>
    </div>
  `,
  aistudio: `
    <div style="background:#0f111a; border: 1px solid #1e293b; border-radius:16px; padding:24px; color: #fff; font-family: system-ui, sans-serif;">
      <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #1e293b; padding-bottom:16px; margin-bottom:16px;">
        <h3>✨ Gemini Key Lab Engine</h3>
        <span style="background:#10b981; color:#fff; font-size:0.75rem; padding:4px 8px; border-radius:4px;">API Active</span>
      </div>
      <textarea placeholder="Write system prompt patterns or asset generation prompts..." style="width:100%; background:#1e293b; border:1px solid #334155; border-radius:8px; padding:12px; color:#fff; height:100px; resize:none; font-family:monospace; box-sizing:border-box;"></textarea>
      <button style="background:#4f46e5; color:#fff; border:none; padding:10px 20px; border-radius:8px; margin-top:12px; cursor:pointer; font-weight:bold;">Test Generation Run</button>
    </div>
  `
};

// --- CENTRAL VIEW ROUTER ---
function routeToView(viewKey) {
  const displayArea = document.getElementById("app-viewport");
  
  // If the automated viewport fallback container exists and is active, inject dynamic mock
  if (displayArea && !displayArea.classList.contains('hidden')) {
    if (pageLayouts[viewKey]) {
      displayArea.innerHTML = pageLayouts[viewKey];
    } else {
      displayArea.innerHTML = `
        <div style="padding:40px; text-align:center; color:#9aa0a6;">
          <h3>📌 Content view context initialized</h3>
          <p>The panel page layout for "${viewKey}" is running properly.</p>
        </div>
      `;
    }
    return;
  }

  // Otherwise, route perfectly to Trending's rich glassmorphic full-fidelity panes
  const mapping = {
    home: 'feeds',
    explore: 'explore',
    reels: 'reels',
    shop: 'shop',
    fitness: 'fitness',
    learn: 'learn',
    aistudio: 'creator'
  };

  const mappedPane = mapping[viewKey];
  if (mappedPane) {
    navigateTo(mappedPane);
  }
}







