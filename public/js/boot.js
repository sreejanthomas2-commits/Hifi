/* ╔══════════════════════════════════════════════════════════════════╗
   ║  BOOT — the load order, and the only script tag in index.html     ║
   ║                                                                   ║
   ║  These were 71 <script defer> tags. They are ES modules now, for  ║
   ║  one reason: classic scripts share a single lexical scope, so a   ║
   ║  duplicate top-level `const X` anywhere was a SyntaxError that    ║
   ║  silently killed the whole later file. It happened three times    ║
   ║  in this project — CMD, then CM against web3communities, then CV  ║
   ║  against cryptoverse — and each time the symptom was a feature    ║
   ║  that simply did not exist, with nothing in the console about     ║
   ║  the file that actually broke.                                    ║
   ║                                                                   ║
   ║  Module scope ends that. Each file still publishes its own names  ║
   ║  to the global object at the end (see globals.js), because the    ║
   ║  app's inline onclick= handlers resolve there — but a clash is    ║
   ║  now a console warning naming both files, not a dead file.        ║
   ║                                                                   ║
   ║  The order below is the order the tags were in, and the ?v= on    ║
   ║  each import is the cache-buster that used to live on the tag.    ║
   ║  This file is now the one place versions are bumped — and bump    ║
   ║  boot.js's OWN ?v= in index.html at the same time, or the browser ║
   ║  serves a cached copy of this list and the change never ships.    ║
   ║                                                                   ║
   ║  One bad import here stops all 71 modules, because a graph is     ║
   ║  linked in full before any of it evaluates. That is louder than   ║
   ║  the old failure, not quieter: a 404 names the file.              ║
   ║                                                                   ║
   ║  Imports are side-effect only: nothing here imports a binding,    ║
   ║  so the conversion did not have to untangle which file needs      ║
   ║  which. That can happen a file at a time, from now on.            ║
   ╚══════════════════════════════════════════════════════════════════╝ */

'use strict';

/* Five panes are NOT here: they load when you first open them. The list
   is in lazy.js, which the router imports, along with why each of the
   others had to stay — deferring the wrong one is silent, not loud. */

import './state.js?v=5m8';
import './data/mockDb.js?v=11m9';
import './data/languages.js?v=1m8';
import './data/i18n.js?v=1m8';
import './utils/api.js?v=20260919am8';
import './utils/firebase-auth.js?v=7m9';
import './utils/dom.js?v=5m8';
import './utils/engine.js?v=20260919bm9';
import './features/uid.js?v=1m9';
import './features/money.js?v=1m8';
import './components/ui.js?v=7m9';
import './components/theme.js?v=20260919bm9';
import './router.js?v=1790000000';
import './components/mobile.js?v=5m9';
import './pages/feeds.js?v=20260920cm9';
import './features/token-markets.js?v=20260916cm8';
import './pages/cryptoverse.js?v=20260916bm8';
import './pages/explore.js?v=21m9';
import './pages/shop.js?v=2m9';
import './features/create.js?v=4m8';
import './features/deposit.js?v=3m8';
import './features/withdraw.js?v=3m8';
import './features/cryptodata.js?v=3m8';
import './pages/assets.js?v=9m8';
import './pages/trade.js?v=20260919am8';
import './pages/p2p.js?v=3m8';
import './pages/earn.js?v=4m8';
import './pages/homecrypto.js?v=20260917cm8';
import './pages/homehub.js?v=14m8';
import './pages/communityhub.js?v=6m9';
import './features/highlights.js?v=1m8';
import './pages/profile.js?v=20m8';
import './pages/messages.js?v=18m9';
import './pages/telegram.js?v=4m8';
import './pages/messenger.js?v=6m8';
import './pages/modals.js?v=3m8';
import './pages/web3hub.js?v=4m8';
import './features/socialfi.js?v=3m8';
import './features/cryptotools.js?v=20260912m8';
import './features/assets.js?v=2m8';
import './features/feargreed.js?v=8m8';
import './features/wallet.js?v=4m8';
import './features/chatfi.js?v=6m8';
import './features/pay.js?v=4m9';
import './features/convert.js?v=2m8';
import './features/walletview.js?v=3m9';
import './features/walletaddr.js?v=6m8';
import './features/search.js?v=20260920bm9';
import './features/langs.js?v=1m8';
import './features/marketdata.js?v=3m8';
import './features/studio.js?v=5m8';
import './features/cryptofeed.js?v=1m8';
import './features/commune.js?v=5m8';
import './pages/communehub.js?v=8m8';
import './pages/communestudio.js?v=5m8';
import './features/communeplus.js?v=2m8';
import './pages/communeplus-hub.js?v=5m8';
import './pages/communeplus-community.js?v=2m8';
import './pages/communeplus-tools.js?v=4m8';
import './pages/communeplus-studio.js?v=3m8';
import './features/communemember.js?v=3m8';
import './pages/communebrand.js?v=7m8';
import './features/profileme.js?v=6m9';
import './features/discover.js?v=10m8';
import './features/notes.js?v=6m9';
import './main.js?v=8m9';
import '../interactions.js?v=5m8';
import './signin.js?v=7m9';
