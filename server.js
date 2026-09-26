const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const compression = require('compression');
const path = require('path');
require('dotenv').config();

const app = express();

/* Custody stays off. The three flaws this block was first written for are
   fixed - token contracts are allow-listed, withdrawal holds are keyed
   server-side and checked after writing, and the withdrawal second factor
   is stored and checked - but holding people's money needs more than the
   absence of known bugs, and these are still missing:
     - confirmation tracking for withdrawals: nothing moves one past
       "broadcast" by checking the chain, so held funds never settle, and
       the signer's word is all that says a transaction was sent
     - reorganisation handling after a deposit is credited
     - a run of the custody tests against a real MongoDB replica set;
       scripts/test-custody-flows.js uses an in-memory stand-in
   So CUSTODY_ENABLED=true is refused here rather than trusted. Forcing it
   off - instead of exiting - keeps the rest of the app up: every custodial
   route answers 503 "custody_disabled", and the chain watcher below does
   not start. The services read the flag at call time, so overriding it
   here covers them too. */
if (String(process.env.CUSTODY_ENABLED || '').toLowerCase() === 'true') {
  console.error('CUSTODY_ENABLED=true refused: custody is not ready to hold funds (no withdrawal confirmation ' +
    'tracking, no reorg handling, not yet tested against a real database). Running with custody off.');
  process.env.CUSTODY_ENABLED = 'false';
}

// Middleware
app.use(compression());
app.use(cors());
app.use(express.json());

// Serve static frontend files from 'public' directory.
// Assets are cache-busted via ?v= query strings, so a long cache is safe
// in production; index.html itself must always revalidate.
//
// In development that long cache is a trap. The ?v= on a module lives in
// whatever IMPORTS it, so editing a file and forgetting to bump its
// importer leaves the browser serving a week-old copy with nothing on
// screen to say so. That cost three separate debugging detours in one
// afternoon - globals.js, lazy.js and the converted page modules each
// "did not take" until the version in their importer changed, and the
// symptom every time was code that looked wrong rather than code that
// was stale. So outside production, script and style are never stored.
const DEV = process.env.NODE_ENV !== 'production';

app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: DEV ? 0 : '7d',
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('index.html')) {
      res.setHeader('Cache-Control', 'no-cache');
    } else if (DEV && /\.(?:js|mjs|css)$/i.test(filePath)) {
      res.setHeader('Cache-Control', 'no-store, must-revalidate');
    }
  }
}));

// Database Connection (Fallback to in-memory/mock if no URI)
if (process.env.MONGO_URI) {
  mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('MongoDB Connected via Atlas'))
    .catch(err => console.error('MongoDB Connection Error:', err));
} else {
  console.log('No MONGO_URI provided. Running with in-memory Mock Data mode.');
}

// API Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Everything App API is running flawlessly.' });
});

app.get('/api/posts', (req, res) => {
  // TODO: Replace with real MongoDB query `Post.find()`
  res.json([{ id: 1, text: 'Hello from the Node.js backend!', author: '@system' }]);
});

// Link previews for Trending Notes (server-side fetch with SSRF protections)
app.use('/api/link-preview', require('./routes/linkPreview'));

// Network fee estimates for payments to a wallet address. Read-only and
// public: a network name in, the network's current fee out. Trending does
// not send these payments; the estimate is shown so the person knows the
// cost before sending from their own wallet app.
app.use('/api/fees', require('./routes/fees'));

// The signer's queue. Mounted BEFORE the /api/crypto routers: a router
// mounted on a prefix runs its middleware over every path beneath it, so
// the user-session check on /api/crypto would otherwise answer these
// calls first — and the signer is not a user. It PULLS from here on its
// own machine; nothing in this process can reach it, make it sign, or
// raise its limits. Closed with 503 until SIGNER_TOKEN is set.
app.use('/api/crypto/signer', require('./routes/signer'));

// Deposit configuration: which assets and chains the deposit screen may
// offer, and the state each chain is in. Read-only, no user data.
app.use('/api/crypto', require('./routes/crypto'));

// Custodial deposits: issuing addresses, reading deposits and balances.
// Every route behind a signed session; the router itself answers 503
// until custody is configured, so mounting it changes nothing on a
// deployment that has not opted in.
app.use('/api/crypto', require('./routes/deposit'));

// Withdrawals: quoting, validating and requesting. This process can
// authorise a withdrawal and hold the funds; it cannot sign or broadcast
// one, and there is nowhere in it to put a key that could.
app.use('/api/crypto', require('./routes/withdraw'));


// The chain watcher is the only thing allowed to credit a balance. It
// starts only when custody is switched on AND this process is meant to
// run it — a serverless deployment scales to many instances, and many
// watchers on one chain is a way to find out whether your idempotency
// really works. Run it as one worker.
if (process.env.CUSTODY_ENABLED === 'true' && process.env.WATCHER_ROLE === 'primary') {
  const watcher = require('./services/watcher');
  if (watcher.start()) console.log('Chain watcher started');
}

// Catch-all to serve index.html for Single Page App routing
app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Port configuration for Vercel/Local
const PORT = process.env.PORT || 3000;
// Start building the coin catalogue now, so the first person to open
// Deposit or Send gets the full list without waiting for it.
require('./services/catalog').warm();

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}/`);
});

// Export the Express API for Vercel Serverless
module.exports = app;
