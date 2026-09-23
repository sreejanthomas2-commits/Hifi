/* ╔══════════════════════════════════════════════════════════════════╗
   ║  PREFERENCE TESTS —  node scripts/test-prefs.js                   ║
   ║                                                                   ║
   ║  features/prefs.js is what every switch in Settings writes to and ║
   ║  what the rest of the app reads. A wrong answer here is not a     ║
   ║  cosmetic bug:                                                    ║
   ║                                                                   ║
   ║  · a setting that does not survive a reload is a setting the      ║
   ║    person has to keep setting                                     ║
   ║  · a merge that takes the older copy silently undoes a change     ║
   ║    someone made on their other device                             ║
   ║  · quiet hours that get the midnight wrap wrong either wake       ║
   ║    people up or silence them all day                              ║
   ║  · a word filter matching inside words hides ordinary sentences   ║
   ║  · a verification that never expires is not a verification        ║
   ║                                                                   ║
   ║  prefs.js is evaluated as the browser runs it.                    ║
   ╚══════════════════════════════════════════════════════════════════╝ */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

let pass = 0, fail = 0;
function check(name, got, want) {
  const ok = String(got) === String(want);
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${name}`);
  if (!ok) console.log(`        got  ${got}\n        want ${want}`);
  ok ? pass++ : fail++;
}

function readModule(rel) {
  const src = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', rel), 'utf8');
  const at = src.indexOf('Global bridge');
  return at === -1 ? src : src.slice(0, src.lastIndexOf('/*', at));
}

/* A browser, reduced to the parts this module touches. */
function makeContext(store) {
  const cls = new Set();
  const ctx = {
    window: {},
    localStorage: {
      getItem: k => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: k => { delete store[k]; },
      key: i => Object.keys(store)[i],
      get length() { return Object.keys(store).length; }
    },
    document: {
      readyState: 'complete',
      hidden: false,
      documentElement: {
        style: { setProperty() {} },
        classList: { toggle: (c, on) => { on ? cls.add(c) : cls.delete(c); }, has: c => cls.has(c) }
      },
      addEventListener() {}, getElementById: () => null
    },
    navigator: { userAgent: 'Mozilla/5.0 (Windows NT 10.0) Chrome/120' },
    setTimeout: () => 0, setInterval: () => 0, clearTimeout: () => {},
    console
  };
  ctx.globalThis = ctx;
  ctx.window.appConfirm = null;
  vm.createContext(ctx);
  vm.runInContext(readModule('features/prefs.js'), ctx);
  return { TP: ctx.window.TP, cls, ctx };
}

let store = {};
let { TP, cls } = makeContext(store);

/* ── Reading and writing ─────────────────────────────────────────── */
console.log('\na setting is read, written and kept');
check('a default is there before anything is set', TP.get('privacy.account'), 'public');
check('a missing path falls back', TP.get('nope.nothing', 'fallback'), 'fallback');
TP.set('privacy.account', 'private');
check('a write is read back', TP.get('privacy.account'), 'private');
check('and it reached storage', JSON.parse(store.ts_prefs_v1).privacy.account, 'private');
TP.toggle('notif.posts');
check('toggle flips a switch', TP.get('notif.posts'), false);
TP.toggle('notif.posts');
check('and flips it back', TP.get('notif.posts'), true);

console.log('\nit survives a reload');
({ TP, cls } = makeContext(store));
check('the change is still there', TP.get('privacy.account'), 'private');
check('untouched settings still have their defaults', TP.get('notif.messages'), true);

console.log('\na newer build adds settings without losing answers');
const trimmed = JSON.parse(store.ts_prefs_v1);
delete trimmed.crypto;                       // as if saved before crypto settings existed
delete trimmed.media.dataSaver;
store.ts_prefs_v1 = JSON.stringify(trimmed);
({ TP } = makeContext(store));
check('the new group appears with its default', TP.get('crypto.confirmSends'), true);
check('the new setting appears with its default', TP.get('media.dataSaver'), false);
check('and the old answer is untouched', TP.get('privacy.account'), 'private');

/* ── Lists ───────────────────────────────────────────────────────── */
console.log('\nlists of people');
store = {};
({ TP } = makeContext(store));
TP.listAdd('blocked', '@Zara');
check('a handle is stored without the @ and in lower case', TP.listAll('blocked').join(), 'zara');
check('and is found either way', [TP.listHas('blocked', 'Zara'), TP.listHas('blocked', '@zara')].join(), 'true,true');
TP.listAdd('blocked', 'zara');
check('adding twice does not duplicate', TP.listCount('blocked'), 1);
TP.listRemove('blocked', 'ZARA');
check('removing is also case-blind', TP.listCount('blocked'), 0);
check('an empty handle is refused', TP.listAdd('blocked', '   '), false);
TP.listAdd('mutedAccounts', 'kai', { posts: true, stories: false });
check('a muted account keeps what is muted', JSON.stringify(TP.all().mutedAccounts.kai.posts), 'true');

/* ── Hidden words ────────────────────────────────────────────────── */
console.log('\nthe word filter matches words, not fragments');
TP.wordAdd('ass');
check('a word is added once', [TP.wordAdd('ass'), TP.words().length].join(), 'false,1');
check('“ass” is caught on its own', !!TP.hidden('what an ass'), true);
check('but “class” is not', TP.hidden('a class act'), null);
check('nor is “passive”', TP.hidden('passive income'), null);
check('the built-in list catches a scam phrase', !!TP.hidden('send your SEED PHRASE to claim'), true);
check('and the match is reported', TP.hidden('this is a scam'), 'scam');
TP.set('interact.hideOffensive', false);
check('turning the built-in list off stops it', TP.hidden('this is a scam'), null);
check('the custom list still works', !!TP.hidden('what an ass'), true);
TP.wordRemove('ass');
check('and a removed word stops matching', TP.hidden('what an ass'), null);
check('plain text is never hidden', TP.hidden('good morning everyone'), null);

/* ── Quiet hours ─────────────────────────────────────────────────── */
console.log('\nquiet hours, including the ones that cross midnight');
const at = (h, m) => { const d = new Date(2026, 0, 1); d.setHours(h, m || 0, 0, 0); return d; };
check('22:00–07:00 covers 23:30', TP.inWindow('22:00', '07:00', at(23, 30)), true);
check('and covers 02:00', TP.inWindow('22:00', '07:00', at(2)), true);
check('but not 12:00', TP.inWindow('22:00', '07:00', at(12)), false);
check('it starts exactly on the hour', TP.inWindow('22:00', '07:00', at(22)), true);
check('and ends exactly on the hour', TP.inWindow('22:00', '07:00', at(7)), false);
check('a daytime window behaves normally', TP.inWindow('09:00', '17:00', at(12)), true);
check('and excludes the evening', TP.inWindow('09:00', '17:00', at(20)), false);
check('nonsense is not a window', TP.inWindow('', 'later', at(12)), false);

console.log('\nwhat may interrupt you');
store = {};
({ TP } = makeContext(store));
check('by default a message may', TP.notifyOk('messages'), true);
TP.set('notif.messages', false);
check('switched off, it may not', TP.notifyOk('messages'), false);
check('but a mention still may', TP.notifyOk('mentions'), true);
TP.set('notif.pause', true);
check('paused, nothing social gets through', TP.notifyOk('mentions'), false);
check('and neither does crypto', TP.notifyOk('crypto'), false);
TP.set('notif.pause', false);

/* ── Verification ────────────────────────────────────────────────── */
console.log('\nmoney asks again, and the answer expires');
check('nothing is verified to begin with', TP.isVerified(), false);
(async () => {
  const ok = await TP.verify('Sending');
  check('with no dialog available it does not block the app', ok, true);
  check('and it is verified afterwards', TP.isVerified(), true);
  TP.dropVerify();
  check('dropping it un-verifies', TP.isVerified(), false);

  /* ── Devices ───────────────────────────────────────────────────── */
  console.log('\ndevices');
  check('this device recorded itself', TP.devices().length, 1);
  check('and named itself from the browser', TP.deviceName(), 'Chrome on Windows');
  check('it knows which one is here', TP.devices()[0].here, true);
  TP.endDevice(TP.devices()[0].id);
  check('ending a session removes it', TP.devices().length, 0);

  /* ── Export ────────────────────────────────────────────────────── */
  console.log('\nthe data export leaves secrets out');
  store.ts_posts = '[{"body":"hello"}]';
  store.ts_gemini_key = 'AIzaSy-not-a-real-one';
  store.ts_nvidia_key = 'nvapi-not-a-real-one';
  store.ts_wallet = '{"address":"0x1"}';
  store.other_app = 'not ours';
  const dump = TP.exportData();
  const keys = Object.keys(dump.data);
  check('posts are included', keys.indexOf('ts_posts') > -1, true);
  check('a wallet address is included', keys.indexOf('ts_wallet') > -1, true);
  check('an API key is not', keys.indexOf('ts_gemini_key'), -1);
  check('nor is another one', keys.indexOf('ts_nvidia_key'), -1);
  check('and another app’s data is not ours to export', keys.indexOf('other_app'), -1);
  check('no key value appears anywhere in the file',
    JSON.stringify(dump).indexOf('AIzaSy-not-a-real-one'), -1);
  check('JSON is parsed back rather than exported as a string',
    Array.isArray(dump.data.ts_posts), true);

  console.log(`\n${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
})();
