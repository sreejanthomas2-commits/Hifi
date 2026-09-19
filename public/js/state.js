// ── STATE ────────────────────────────────────────────────────────
/* Strict mode, ahead of this file becoming an ES module - modules are
   always strict, and doing it here first means any breakage shows up
   on its own rather than mixed into the module conversion. */
'use strict';

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
  chatSearch: '',
  peerTyping: null, // chat id whose peer is currently "typing"
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

/* ── Global bridge ───────────────────────────────────────────────────
   This file is an ES module now, so its top-level names are private
   to it. Inline onclick= handlers and every other module still look
   them up on the global object, so they are republished here.

   Each one is a thunk because the list is produced by scanning, and
   scanning over-collects — a line inside a template literal can look
   like a declaration. publish() calls each thunk and skips the ones
   that do not resolve, so a phantom costs one caught error and not a
   dead module graph. */
import { publish } from './globals.js?v=3';
publish('state.js', {
  S: () => S
});
