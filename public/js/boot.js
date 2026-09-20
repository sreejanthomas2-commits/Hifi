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

import './state.js?v=y2';
import './data/mockDb.js?v=11m9';
import './data/languages.js?v=y2';
import './data/i18n.js?v=1m8';
import './utils/api.js?v=y2';
import './utils/firebase-auth.js?v=y2';
import './utils/dom.js?v=y2';
import './utils/engine.js?v=y2';
import './features/uid.js?v=y2';
import './features/money.js?v=y2';
import './components/ui.js?v=y2';
import './components/theme.js?v=y2';
import './router.js?v=y2';
import './components/mobile.js?v=y2';
import './pages/feeds.js?v=y2';
import './features/token-markets.js?v=y2';
import './pages/cryptoverse.js?v=y2';
import './pages/explore.js?v=y2';
import './pages/shop.js?v=y2';
import './features/create.js?v=y2';
import './features/deposit.js?v=y2';
import './features/withdraw.js?v=y2';
import './features/cryptodata.js?v=y2';
import './pages/assets.js?v=y2';
import './pages/trade.js?v=y2';
import './pages/p2p.js?v=3m8';
import './pages/earn.js?v=y2';
import './pages/homecrypto.js?v=y2';
import './pages/homehub.js?v=y2';
import './pages/communityhub.js?v=y2';
import './features/highlights.js?v=y2';
import './pages/profile.js?v=y2';
import './pages/messages.js?v=y2';
import './pages/telegram.js?v=y2';
import './pages/messenger.js?v=y2';
import './pages/modals.js?v=y2';
import './pages/web3hub.js?v=4m8';
import './features/socialfi.js?v=y2';
import './features/cryptotools.js?v=y2';
import './features/assets.js?v=y2';
import './features/feargreed.js?v=y2';
import './features/wallet.js?v=y2';
import './features/chatfi.js?v=y2';
import './features/pay.js?v=y2';
import './features/convert.js?v=y2';
import './features/walletview.js?v=y2';
import './features/walletaddr.js?v=y2';
import './features/search.js?v=y2';
import './features/langs.js?v=y2';
import './features/marketdata.js?v=y2';
import './features/studio.js?v=y2';
import './features/cryptofeed.js?v=y2';
import './features/commune.js?v=y2';
import './pages/communehub.js?v=y2';
import './pages/communestudio.js?v=y2';
import './features/communeplus.js?v=y2';
import './pages/communeplus-hub.js?v=y2';
import './pages/communeplus-community.js?v=y2';
import './pages/communeplus-tools.js?v=y2';
import './pages/communeplus-studio.js?v=y2';
import './features/communemember.js?v=y2';
import './pages/communebrand.js?v=y2';
import './features/profileme.js?v=y2';
import './features/discover.js?v=y2';
import './features/notes.js?v=y2';
import './main.js?v=y2';
import '../interactions.js?v=y2';
import './signin.js?v=y2';
