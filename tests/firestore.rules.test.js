/* ╔══════════════════════════════════════════════════════════════════╗
   ║  FIRESTORE RULES TESTS  —  npm run test:rules                     ║
   ║                                                                   ║
   ║  Runs firestore.rules in the local Firestore emulator and checks  ║
   ║  what each kind of visitor can and cannot do. Nothing touches     ║
   ║  the real database: the project id starts with "demo-", which     ║
   ║  the emulator never connects to anything.                         ║
   ║                                                                   ║
   ║    · users/{uid}     only you; counts you can't raise; your real  ║
   ║                      email; signed-out-everywhere sessions shut   ║
   ║    · sessions/{uid}  only you, and only stamped with now          ║
   ║    · handles, profiles  claimed once, together, by a confirmed    ║
   ║                      account; no reserved or unsafe names         ║
   ║    · posts           anyone reads; you post as yourself only;     ║
   ║                      one like each; only the author deletes       ║
   ║    · chats, messages and anything else unnamed: closed            ║
   ║                                                                   ║
   ║  Needs Java (for the emulator). The npm script starts and stops   ║
   ║  the emulator around this file.                                   ║
   ╚══════════════════════════════════════════════════════════════════╝ */

'use strict';

const fs = require('fs');
const path = require('path');
const { test, before, after, beforeEach, describe } = require('node:test');
const {
  initializeTestEnvironment, assertSucceeds, assertFails,
} = require('@firebase/rules-unit-testing');
const {
  doc, getDoc, setDoc, updateDoc, deleteDoc, addDoc, collection,
  writeBatch, serverTimestamp, increment, Timestamp, setLogLevel,
} = require('firebase/firestore');

// Every refused write is logged as a warning; refusals are the point here.
setLogLevel('silent');

const PROJECT_ID = 'demo-trending-rules';
let env;

before(async () => {
  const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080').split(':');
  env = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      host, port: Number(port),
      rules: fs.readFileSync(path.join(__dirname, '..', 'firestore.rules'), 'utf8'),
    },
  });
});
after(async () => { if (env) await env.cleanup(); });
beforeEach(async () => { await env.clearFirestore(); });

/* ── Who is asking ─────────────────────────────────────────────────── */

const now = () => Math.floor(Date.now() / 1000);

// A confirmed email account that signed in just now.
function as(uid, extra = {}) {
  return env.authenticatedContext(uid, {
    email: `${uid}@example.com`, email_verified: true, auth_time: now(), ...extra,
  }).firestore();
}
const unconfirmed = (uid) => as(uid, { email_verified: false });
const viaPhone = (uid) => as(uid, {
  email: undefined, email_verified: undefined,
  firebase: { sign_in_provider: 'phone', identities: {} },
});
const guest = () => env.unauthenticatedContext().firestore();

// Puts documents in place as setup, without the rules looking.
async function seed(docs) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    for (const [p, data] of Object.entries(docs)) await setDoc(doc(db, p), data);
  });
}

// The profile and handle a confirmed account posts as.
async function seedIdentity(uid, name, displayName) {
  await seed({
    [`handles/${name}`]: { uid, at: Timestamp.now() },
    [`profiles/${uid}`]: { name, displayName, at: Timestamp.now() },
  });
}

const newUser = (uid) => ({
  displayName: 'Alice', email: `${uid}@example.com`,
  xp: 0, level: 1, followers: 0, following: 0, joinedAt: serverTimestamp(),
});

const newPost = (uid, over = {}) => ({
  author: 'Alice', handle: '@alice', uid, time: serverTimestamp(),
  body: 'gm', tags: ['#btc'], likes: 0, comments: 0, shares: 0,
  type: 'text', category: 'crypto', ...over,
});

/* ── users/{uid} ───────────────────────────────────────────────────── */

describe('users', () => {
  test('you can create and read your own profile', async () => {
    const db = as('alice');
    await assertSucceeds(setDoc(doc(db, 'users/alice'), newUser('alice')));
    await assertSucceeds(getDoc(doc(db, 'users/alice')));
  });

  test('you can update your name and settings', async () => {
    await seed({ 'users/alice': { displayName: 'Alice', xp: 0, level: 1 } });
    await assertSucceeds(updateDoc(doc(as('alice'), 'users/alice'),
      { displayName: 'Alice B', prefs: { theme: 'dark' }, prefsAt: serverTimestamp() }));
  });

  test('you can delete your own profile', async () => {
    await seed({ 'users/alice': { displayName: 'Alice' } });
    await assertSucceeds(deleteDoc(doc(as('alice'), 'users/alice')));
  });

  test('nobody else can read, write or delete it', async () => {
    await seed({ 'users/alice': { displayName: 'Alice', email: 'alice@example.com' } });
    await assertFails(getDoc(doc(as('bob'), 'users/alice')));
    await assertFails(getDoc(doc(guest(), 'users/alice')));
    await assertFails(updateDoc(doc(as('bob'), 'users/alice'), { displayName: 'pwned' }));
    await assertFails(deleteDoc(doc(as('bob'), 'users/alice')));
    await assertFails(setDoc(doc(guest(), 'users/mallory'), { displayName: 'x' }));
  });

  test('you cannot start with XP, a level or followers you did not earn', async () => {
    const db = as('alice');
    await assertFails(setDoc(doc(db, 'users/alice'), { ...newUser('alice'), xp: 5000 }));
    await assertFails(setDoc(doc(db, 'users/alice'), { ...newUser('alice'), level: 99 }));
    await assertFails(setDoc(doc(db, 'users/alice'), { ...newUser('alice'), followers: 1e6 }));
  });

  test('you cannot raise your counts later', async () => {
    await seed({ 'users/alice': { displayName: 'Alice', xp: 0, level: 1, followers: 0, following: 0 } });
    const db = as('alice');
    await assertFails(updateDoc(doc(db, 'users/alice'), { xp: 10 }));
    await assertFails(updateDoc(doc(db, 'users/alice'), { followers: 10 }));
  });

  test('you cannot backdate when you joined', async () => {
    await assertFails(setDoc(doc(as('alice'), 'users/alice'),
      { ...newUser('alice'), joinedAt: Timestamp.fromMillis(0) }));
  });

  test('the email stored is the one you signed in with', async () => {
    await assertFails(setDoc(doc(as('alice'), 'users/alice'),
      { ...newUser('alice'), email: 'ceo@bank.com' }));
  });

  test('fields the app does not use are refused', async () => {
    await assertFails(setDoc(doc(as('alice'), 'users/alice'), { ...newUser('alice'), isAdmin: true }));
  });

  test('a name over 80 characters is refused', async () => {
    await assertFails(setDoc(doc(as('alice'), 'users/alice'),
      { ...newUser('alice'), displayName: 'a'.repeat(81) }));
  });
});

/* ── sessions/{uid} and "sign out of every device" ─────────────────── */

describe('sessions', () => {
  test('you can sign out everywhere, stamped with now', async () => {
    await assertSucceeds(setDoc(doc(as('alice'), 'sessions/alice'), { revokedAt: serverTimestamp() }));
  });

  test('you cannot pick the time yourself', async () => {
    await assertFails(setDoc(doc(as('alice'), 'sessions/alice'),
      { revokedAt: Timestamp.fromMillis(Date.now() + 864e5) }));
  });

  test('nobody else can read or set it', async () => {
    await seed({ 'sessions/alice': { revokedAt: Timestamp.now() } });
    await assertFails(getDoc(doc(as('bob'), 'sessions/alice')));
    await assertFails(setDoc(doc(as('bob'), 'sessions/alice'), { revokedAt: serverTimestamp() }));
  });

  test('a session that signed in before the sign-out is shut out', async () => {
    const signedIn = now() - 3600;
    await seed({
      'users/alice': { displayName: 'Alice' },
      'sessions/alice': { revokedAt: Timestamp.fromMillis((signedIn + 60) * 1000) },
    });
    const old = as('alice', { auth_time: signedIn });
    await assertFails(getDoc(doc(old, 'users/alice')));
    await assertFails(updateDoc(doc(old, 'users/alice'), { displayName: 'x' }));
    // It can still read the sign-out time - that is how it learns it was signed out.
    await assertSucceeds(getDoc(doc(old, 'sessions/alice')));
  });

  test('a session that signed in after it works', async () => {
    await seed({
      'users/alice': { displayName: 'Alice' },
      'sessions/alice': { revokedAt: Timestamp.fromMillis((now() - 3600) * 1000) },
    });
    await assertSucceeds(getDoc(doc(as('alice'), 'users/alice')));
  });
});

/* ── handles/{name} and profiles/{uid} ─────────────────────────────── */

function claim(db, uid, name, displayName = 'Alice') {
  const b = writeBatch(db);
  b.set(doc(db, `handles/${name}`), { uid, at: serverTimestamp() });
  b.set(doc(db, `profiles/${uid}`), { name, displayName, at: serverTimestamp() });
  return b.commit();
}

describe('handles and public profiles', () => {
  test('anyone can read them', async () => {
    await seedIdentity('alice', 'alice', 'Alice');
    await assertSucceeds(getDoc(doc(guest(), 'handles/alice')));
    await assertSucceeds(getDoc(doc(guest(), 'profiles/alice')));
  });

  test('a confirmed account claims a handle with its profile', async () => {
    await assertSucceeds(claim(as('alice'), 'alice', 'alice'));
  });

  test('a phone account counts as confirmed', async () => {
    await assertSucceeds(claim(viaPhone('alice'), 'alice', 'alice'));
  });

  test('an unconfirmed email account cannot', async () => {
    await assertFails(claim(unconfirmed('alice'), 'alice', 'alice'));
  });

  test('a handle someone holds cannot be taken', async () => {
    await seedIdentity('bob', 'bob', 'Bob');
    await assertFails(claim(as('alice'), 'alice', 'bob'));
  });

  test('reserved and badly shaped handles are refused', async () => {
    for (const name of ['admin', 'support', 'trending', 'ab', 'Alice', '.alice', 'al..ice', 'alice.']) {
      await env.clearFirestore();
      await assertFails(claim(as('alice'), 'alice', name), `handle ${name}`);
    }
  });

  test('a handle cannot be claimed without the profile that uses it', async () => {
    await assertFails(setDoc(doc(as('alice'), 'handles/alice'), { uid: 'alice', at: serverTimestamp() }));
  });

  test('a profile cannot point at a handle it does not hold', async () => {
    await seedIdentity('bob', 'bob', 'Bob');
    await assertFails(setDoc(doc(as('alice'), 'profiles/alice'),
      { name: 'bob', displayName: 'Bob', at: serverTimestamp() }));
  });

  test('a display name with markup in it is refused', async () => {
    await assertFails(claim(as('alice'), 'alice', 'alice', '<img src=x onerror=alert(1)>'));
  });

  test('moving handle gives the old one up in the same batch', async () => {
    await seedIdentity('alice', 'alice', 'Alice');
    const db = as('alice');
    const keep = writeBatch(db);
    keep.set(doc(db, 'handles/alice2'), { uid: 'alice', at: serverTimestamp() });
    keep.set(doc(db, 'profiles/alice'), { name: 'alice2', displayName: 'Alice', at: serverTimestamp() });
    await assertFails(keep.commit());

    const move = writeBatch(db);
    move.set(doc(db, 'handles/alice2'), { uid: 'alice', at: serverTimestamp() });
    move.set(doc(db, 'profiles/alice'), { name: 'alice2', displayName: 'Alice', at: serverTimestamp() });
    move.delete(doc(db, 'handles/alice'));
    await assertSucceeds(move.commit());
  });

  test('only the holder can give a handle up', async () => {
    await seedIdentity('alice', 'alice', 'Alice');
    await assertFails(deleteDoc(doc(as('bob'), 'handles/alice')));
    await assertFails(deleteDoc(doc(as('bob'), 'profiles/alice')));
  });
});

/* ── posts/{id} ────────────────────────────────────────────────────── */

describe('posts', () => {
  beforeEach(async () => { await seedIdentity('alice', 'alice', 'Alice'); });

  test('anyone can read the feed', async () => {
    await seed({ 'posts/AAAAAAAAAAAAAAAAAAAA': { ...newPost('alice'), time: Timestamp.now() } });
    await assertSucceeds(getDoc(doc(guest(), 'posts/AAAAAAAAAAAAAAAAAAAA')));
  });

  test('a confirmed account posts as its own handle', async () => {
    await assertSucceeds(addDoc(collection(as('alice'), 'posts'), newPost('alice')));
  });

  test('a guest or unconfirmed account cannot post', async () => {
    await assertFails(addDoc(collection(guest(), 'posts'), newPost('alice')));
    await assertFails(addDoc(collection(unconfirmed('alice'), 'posts'), newPost('alice')));
  });

  test('nobody can post as someone else', async () => {
    await seedIdentity('bob', 'bob', 'Bob');
    const db = as('bob');
    await assertFails(addDoc(collection(db, 'posts'), newPost('alice')));
    await assertFails(addDoc(collection(db, 'posts'), newPost('bob')));          // Alice's handle on Bob's uid
    await assertFails(addDoc(collection(db, 'posts'), newPost('bob', { handle: '@bob' }))); // Alice's name
  });

  test('a post cannot start with likes, comments or shares', async () => {
    const db = as('alice');
    await assertFails(addDoc(collection(db, 'posts'), newPost('alice', { likes: 500 })));
    await assertFails(addDoc(collection(db, 'posts'), newPost('alice', { comments: 3 })));
    await assertFails(addDoc(collection(db, 'posts'), newPost('alice', { shares: 9 })));
  });

  test('a post cannot be backdated', async () => {
    await assertFails(addDoc(collection(as('alice'), 'posts'),
      newPost('alice', { time: Timestamp.fromMillis(0) })));
  });

  test('a post id must be one Firestore generated', async () => {
    await assertFails(setDoc(doc(as('alice'), 'posts/"><script>'), newPost('alice')));
    await assertFails(setDoc(doc(as('alice'), 'posts/mine'), newPost('alice')));
  });

  test('bad bodies, tags and extra fields are refused', async () => {
    const db = as('alice');
    await assertFails(addDoc(collection(db, 'posts'), newPost('alice', { body: '' })));
    await assertFails(addDoc(collection(db, 'posts'), newPost('alice', { body: 'x'.repeat(5001) })));
    await assertFails(addDoc(collection(db, 'posts'), newPost('alice', { tags: ['#<b>'] })));
    await assertFails(addDoc(collection(db, 'posts'),
      newPost('alice', { tags: ['#a', '#b', '#c', '#d', '#e', '#f', '#g'] })));
    await assertFails(addDoc(collection(db, 'posts'), newPost('alice', { pinned: true })));
  });

  test('only the author can delete a post, even unconfirmed', async () => {
    const id = 'BBBBBBBBBBBBBBBBBBBB';
    await seed({ [`posts/${id}`]: { ...newPost('alice'), time: Timestamp.now() } });
    await assertFails(deleteDoc(doc(as('bob'), `posts/${id}`)));
    await assertSucceeds(deleteDoc(doc(unconfirmed('alice'), `posts/${id}`)));
  });

  test('nobody can edit the body of a post', async () => {
    const id = 'CCCCCCCCCCCCCCCCCCCC';
    await seed({ [`posts/${id}`]: { ...newPost('alice'), time: Timestamp.now() } });
    await assertFails(updateDoc(doc(as('alice'), `posts/${id}`), { body: 'edited' }));
  });
});

/* ── likes ─────────────────────────────────────────────────────────── */

describe('likes', () => {
  const id = 'DDDDDDDDDDDDDDDDDDDD';
  beforeEach(async () => {
    await seed({ [`posts/${id}`]: { ...newPost('alice'), time: Timestamp.now() } });
  });

  function like(db, uid) {
    const b = writeBatch(db);
    b.set(doc(db, `posts/${id}/likes/${uid}`), { at: serverTimestamp() });
    b.update(doc(db, `posts/${id}`), { likes: increment(1) });
    return b.commit();
  }
  function unlike(db, uid) {
    const b = writeBatch(db);
    b.delete(doc(db, `posts/${id}/likes/${uid}`));
    b.update(doc(db, `posts/${id}`), { likes: increment(-1) });
    return b.commit();
  }

  test('you can like a post once, and unlike it', async () => {
    const db = as('bob');
    await assertSucceeds(like(db, 'bob'));
    await assertFails(like(db, 'bob'));
    await assertSucceeds(unlike(db, 'bob'));
  });

  test('the count cannot move without a like behind it', async () => {
    const db = as('bob');
    await assertFails(updateDoc(doc(db, `posts/${id}`), { likes: increment(1) }));
    await assertFails(updateDoc(doc(db, `posts/${id}`), { likes: 1000 }));
    await assertFails(setDoc(doc(db, `posts/${id}/likes/bob`), { at: serverTimestamp() }));
  });

  test('you cannot like on someone else\'s behalf', async () => {
    const db = as('bob');
    const b = writeBatch(db);
    b.set(doc(db, `posts/${id}/likes/carol`), { at: serverTimestamp() });
    b.update(doc(db, `posts/${id}`), { likes: increment(1) });
    await assertFails(b.commit());
  });

  test('an unconfirmed account cannot like', async () => {
    await assertFails(like(unconfirmed('bob'), 'bob'));
  });

  test('who liked a post is only visible to the liker', async () => {
    await seed({ [`posts/${id}/likes/bob`]: { at: Timestamp.now() } });
    await assertSucceeds(getDoc(doc(as('bob'), `posts/${id}/likes/bob`)));
    await assertFails(getDoc(doc(as('alice'), `posts/${id}/likes/bob`)));
    await assertFails(getDoc(doc(guest(), `posts/${id}/likes/bob`)));
  });
});

/* ── Chat and everything the rules do not name ─────────────────────── */

describe('chat data and unnamed collections', () => {
  // HiFi's chats are not kept in Firestore yet. Until a rule opens them,
  // nobody - signed in or not - can read or write a conversation there.
  for (const p of ['chats/c1', 'chats/c1/messages/m1', 'messages/m1', 'conversations/c1', 'dms/alice_bob', 'admin/config']) {
    test(`${p} is closed`, async () => {
      await seed({ [p]: { text: 'hi', from: 'alice' } });
      await assertFails(getDoc(doc(as('alice'), p)));
      await assertFails(getDoc(doc(guest(), p)));
      await assertFails(setDoc(doc(as('alice'), p), { text: 'hi', from: 'alice' }));
      await assertFails(deleteDoc(doc(as('alice'), p)));
    });
  }
});
