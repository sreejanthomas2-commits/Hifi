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

import './state.js?v=s3';
import './data/mockDb.js?v=11m9';
import './data/languages.js?v=s3';
import './data/i18n.js?v=ch1';
import './utils/api.js?v=sec0';
import './utils/firebase-auth.js?v=sec3';
import './utils/dom.js?v=sec0';
import './utils/engine.js?v=s3';
import './features/uid.js?v=s3';
import './features/money.js?v=dd1';
import './utils/addrcheck.js?v=sx2';
import './features/sendsafe.js?v=sx1';
import './features/prefs.js?v=sec1';
import './features/payflow.js?v=pf1';
import './components/ui.js?v=s3';
import './components/theme.js?v=s3';
import './router.js?v=c3';
import './components/mobile.js?v=sec1';
import './pages/feeds.js?v=sec3';
import './features/token-markets.js?v=s3';
import './pages/cryptoverse.js?v=s3';
import './pages/explore.js?v=s3';
import './pages/shop.js?v=s3';
import './features/create.js?v=cm1';
import './features/deposit.js?v=sec1';
import './features/withdraw.js?v=sec1';
import './features/sendcrypto.js?v=sx1';
import './features/cryptodata.js?v=s3';
import './pages/assets.js?v=s3';
import './pages/trade.js?v=dd2';
import './pages/p2p.js?v=ha1';
import './pages/earn.js?v=ha1';
import './pages/homecrypto.js?v=dd2';
import './pages/homehub.js?v=dd2';
import './pages/communityhub.js?v=y1';
import './features/highlights.js?v=s3';
import './pages/profile.js?v=c1';
import './pages/messages.js?v=sec0';
import './pages/telegram.js?v=ci1';
import './pages/messenger.js?v=ci1';
import './pages/modals.js?v=sec0';
import './pages/web3hub.js?v=4m8';
import './features/socialfi.js?v=sec0';
import './features/cryptotools.js?v=dd2';
import './features/assets.js?v=s3';
import './features/feargreed.js?v=s3';
import './features/wallet.js?v=s3';
import './features/chatfi.js?v=sx1';
import './features/pay.js?v=tp1';
import './features/trending-pay.js?v=tp4';
import './features/convert.js?v=ha1';
import './features/walletview.js?v=c1';
import './features/walletaddr.js?v=sx1';
import './features/chatinfo.js?v=ci1';
import './features/search.js?v=y1';
import './features/langs.js?v=s3';
import './features/marketdata.js?v=s3';
import './features/hashtags.js?v=cm1';
import './features/studio-stickers.js?v=cm1';
import './features/studio-captions.js?v=cm1';
import './features/studio-music.js?v=cm1';
import './features/studio.js?v=cm1';
import './features/cryptofeed.js?v=s3';
import './features/commune.js?v=s3';
import './pages/communehub.js?v=s3';
import './pages/communestudio.js?v=s3';
import './features/communeplus.js?v=s3';
import './pages/communeplus-hub.js?v=s3';
import './pages/communeplus-community.js?v=s3';
import './pages/communeplus-tools.js?v=s3';
import './pages/communeplus-studio.js?v=s3';
import './features/communemember.js?v=s3';
import './pages/communebrand.js?v=s3';
import './features/profileme.js?v=sec1';
import './features/discover.js?v=s3';
import './features/notes.js?v=y1';
import './main.js?v=s3';
import '../interactions.js?v=s3';
import './signin.js?v=sec1';
