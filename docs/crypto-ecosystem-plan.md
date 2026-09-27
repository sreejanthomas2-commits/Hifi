# Trending Crypto — audit and build plan

*26 September 2026. Phases A and B are built (see §9). Everything else in this
document is a proposal, and isn't built unless it says "exists".*

## The short version

1. **Most of the screens exist, and most of them are honest.** Live prices, a
   trading desk, Convert, Wallet, Assets, P2P, Earn, Pay/QR, deposit, withdrawal
   and send screens are all there, about 21,000 lines of crypto code.
2. **But every balance outside the custody service lives in the browser's
   storage.** Anyone can open the browser tools and give themselves a million
   USDT. The custody service that would keep real balances on the server is
   built, but it is switched off and has never run against a real database.
   The brief's rule "never trust a balance calculated only by the frontend" is
   the biggest gap.
3. **A few screens show things that aren't true:**
   - an invented order book for pairs Binance doesn't list
   - P2P escrow that releases by itself 2.6 seconds after "Paid"
   - made-up P2P merchants and copy traders, with invented track records
   - fixed Earn rates up to 34% with no risk wording
4. **The real-money versions of trading, P2P, fiat, Earn, remittance and the
   card cannot be switched on by code.** Each needs two things in every country
   it runs in:
   - a licence or registration
   - a regulated partner: identity checks, bank or payment provider, trading
     liquidity, payout network, card issuer

   Those are legal and business steps for you to take. I can't sign up for
   those services, and I don't give legal advice.
5. **So the plan builds each product end to end, on sandbox money.** "End to
   end" means server, database, ledger, status tracking, security, error
   handling and tests. The sandbox money is labelled as sandbox everywhere.
   A product switchboard keeps each real-money product off until its licence
   and partner exist. When they do, going live means adding a provider
   connection, not rebuilding.

---

## 1. What exists today

| Product | What is there | Where the money lives | Honest today? | Main gaps against the brief |
|---|---|---|---|---|
| Market prices, asset details | Live Binance stream (prices, order book, trades, candles). CoinGecko for names, market caps and news. Crypto Market page (16 widgets), token pages | — | Yes. Old prices are flagged and can't be traded | Asset detail is spread over three places |
| Spot trading | Market, limit and stop-limit orders. Market orders fill by walking the real Binance book. Open orders hold their funds. Order and trade history, cancel, 0.1% fee | Browser (`ts_trade`), 100,000 paper USDT | Mostly. **Invented order book** ("simulated depth") for pairs Binance doesn't list | Orders on the server. Confirmation for large orders. Limit and stop orders only fill while the tab is open |
| Convert | One engine, 1% fee. Both coins need a live price. Re-quotes at confirm if the price moved more than 0.5% | Browser | Yes | No visible quote timer or auto-refresh. No server quote |
| Wallet, Assets, Portfolio | Funding, Spot and Earn accounts, one price source, history (300 lines) | Browser | Yes, labelled simulated | Available / locked / pending not shown per coin. Balance kept by the browser |
| Crypto deposit | Self-custody: QR of *your own* address, server network list, warnings. Custodial deposits built on the server (address issuing, chain watcher, double-entry ledger, confirmations) but **off** | Server ledger (off) | Yes | Needs a database, an always-on server and an operator key ceremony |
| Crypto withdrawal | Full flow: server address check, fee quoted from the chain, two-factor code, funds held, retry protection, status table, signing queue | Server ledger (off) | Yes | No signer. Nothing tracks confirmations after broadcast. Token withdrawals refused. No saved-address list with a lock on new addresses. No rate limit |
| Send / Receive crypto | Prepares a transfer for your own wallet app. Address book, "mark as sent", explorer link | Your wallet | Yes | — |
| Pay, QR payments | Pay ID, QR code, scan, requests with expiry | Browser | Partly. Simulated contacts **decline 15% of requests at random** and pay you money the app invents | Transfers between real Trending accounts, on the server |
| P2P | Ad list, buy and sell, escrow, order history, your own ads, 7 currencies | Browser | **No:** 10 made-up merchants with made-up completion stats; **escrow releases 2.6 s after "Paid"**; exchange rates typed into the code | Real merchants, server escrow, countdown, dispute, appeal, fraud warnings |
| Earn | Flexible and locked staking, launchpool, copy trading, quizzes | Browser | **No:** fixed rates up to 34% with no risk wording; 6 made-up traders with invented ROI, win rate, copier count and assets | Risk disclosure, indicative vs past rates, redemption terms, a real source of yield |
| Fiat deposit / withdrawal | Nothing | — | — | Everything |
| Cross-border transfer | Nothing | — | — | Everything |
| Crypto card | Practice Trending Card (see `docs/card.md`): virtual and physical cards, freeze, controls, limits, coin choice, every decline explained, refunds, reversals, reports, outages. ECB exchange rates from the server | Browser (rules) + server (status, rates) | Yes, labelled practice. Its "number" is zeros that fail every card check | A card-issuing partner, and authorisation on the server against the ledger |
| Security Center | Spread across Settings: withdrawal 2FA, devices, sign out everywhere, re-login for sensitive changes, email confirmation | Firebase + server | Yes | Anti-phishing code, sign-in alerts, saved-address list, one activity log |
| Transaction history | Browser history for paper money; server lists for deposits and withdrawals | Browser + server | Yes | One history across products, with ID, fee breakdown, status timeline and "Report a problem" |
| Support | Problem reports saved on the device only | Browser | Says so | Tickets linked to transactions; a staff console |
| Crypto Hub | No single hub. A quick rail on Home, plus sidebar links to Trade, P2P, Portfolio, Earn and Crypto Market | — | — | The hub, and the switchboard behind it |

**Server and infrastructure facts found during the audit:**

- **The server cannot connect to a database at all.** `server.js` passes two
  connect options (`useNewUrlParser`, `useUnifiedTopology`) that MongoDB's driver
  7.6 now refuses. Setting `MONGO_URI` today gives
  `MongoParseError: options usenewurlparser, useunifiedtopology are not supported`.
  This is a one-line fix, and it goes in Phase C.
- **No database is configured.** There is no `.env`, so custody is forced off.
  A balance change that spans several records needs a MongoDB replica set;
  MongoDB Atlas provides one, even on its free tier.
- **Hosting is Vercel serverless.** That suits the website and short API calls.
  It does not suit the chain watcher, the monitor for limit and stop orders,
  P2P timers or transfer tracking, which all need a process that keeps running.
- **Amounts:** the server uses whole base units (BigInt), which is correct. The
  browser's paper money uses floating point.
- **Tests:** 14 suites and 655 checks, all passing. All of them run against an
  in-memory stand-in, not a real MongoDB.

---

## 2. What is missing

- **Hub:** one Crypto Hub, plus a switchboard that decides, per product, country
  and user: live, sandbox, or unavailable with a reason.
- **Server-side money:**
  - all balances on the server, split into available, locked and pending
  - a sandbox book kept apart from the live one
  - retry protection on every money request
  - a single history
- **Spot:**
  - orders, matching and stop triggers on the server
  - confirmation for large orders
  - no invented order book, ever
- **Convert:** server quotes that expire after 15 s and refresh on their own,
  with a visible countdown.
- **P2P:**
  - real merchants only
  - escrow held on the server
  - order countdown
  - release only by the seller or by a dispute decision
  - disputes, appeals and fraud warnings
- **Fiat in / out:** provider connections, signed provider notifications, limits,
  fee and exchange-rate disclosure, failure, refund and reversal handling.
- **Earn:** risk disclosure on every product; indicative and past rates shown
  apart; redemption terms; real traders, or none.
- **Cross-border transfer:** everything — corridors, quotes, recipients, rails,
  the twelve statuses, tracking.
- **Card:** a clear "not available" page (no fake card).
- **Security:**
  - anti-phishing code
  - sign-in alerts
  - saved-address list, with a lock on new addresses
  - per-user rate limits on money routes
  - risk scoring
  - one Security Center
- **Compliance:** hooks for identity levels, screening, limits, Travel Rule
  data, age and country rules. All start closed.
- **Support:** tickets linked to transaction IDs; "Report a problem" on every
  transaction; a read-only staff console.
- **Shared UI:**
  - confirmation sheet
  - status timeline
  - problem card that answers the six questions
  - loading skeletons, empty states, offline banner

---

## 3. Architecture proposal

```
Browser (Trending UI)   never holds a balance - shows what the server says
   | Firebase sign-in token (the server already checks it itself)
Web tier (Express)      validates, authorises, retry protection, rate limits
   |- products     switchboard: is this on, for this user, in this country?
   |- ledger       double entry, two books: sandbox | live
   |- wallet       balances, transfers between Trending users, Pay/QR
   |- quotes       convert and FX; server-issued quote IDs; 15 s lifetime
   |- trading      orders, matching, fills
   |- p2p          ads, orders, escrow, disputes
   |- remittance   corridors, recipients, transfers, tracking
   |- fiat         provider adapters + signed webhooks
   |- earn         products, positions, accrual
   |- compliance   identity level, screening, limits, Travel Rule hooks
   |- risk         velocity, new device, new address, unusual amounts
   |- support      tickets linked to transaction IDs; staff console
   '- audit        append-only log (exists)
Worker (ONE always-on process)
   |- server-side prices; limit and stop triggers
   |- P2P timers, quote expiry, transfer tracking
   '- chain watcher (exists) + withdrawal confirmation tracker
MongoDB replica set     every balance change inside a transaction
Outside, per product and country (needs contracts):
   identity checks, bank / payment provider, liquidity, payout partners,
   card issuer, signing hardware
```

**The rules the design is built on:**

1. **Two books, one ledger engine.** Every account and entry carries
   `book: 'sandbox' | 'live'`. The ledger refuses any movement whose two sides
   are in different books. So sandbox money can never become withdrawable. This
   keeps the existing rule that paper balances stay separate.
2. **The server is the only source of a balance.** The browser keeps a copy for
   display, marked with its age.
3. **Every money request carries an `Idempotency-Key`.** A retry gets the first
   answer. The same key with a different request is refused.
4. **No double spending.** A balance change is a MongoDB transaction with a
   conditional update (`available >= amount`), so two requests can't spend the
   same money. Today's custody code uses write-then-check; it moves to
   transactions once a replica set exists.
5. **Every product has a status table**, like withdrawals already do. Each
   status has user-facing text that answers the six questions in the brief:
   what happened, are my funds safe, what is the status now, do I need to act,
   what can I do, and how do I reach support.
6. **Switchboard: product × country × identity level × account state → on,
   sandbox, or off (with a reason).** Live products default to off. The server
   refuses to turn one on unless its entry names the licence and the partner.
7. **Adapters.** Every outside dependency sits behind one interface, with a
   sandbox version. Going live = a new adapter + keys in the server's
   environment. Keys never reach the browser.
8. **The server prices things**, not the browser, so a client can't bring its
   own price.
9. **Hosting:** the website can stay on Vercel. The worker and the database
   need an always-on host plus MongoDB Atlas (a Phase C decision).

**How each product works in sandbox, and what live would need:**

- **Spot.**
  - Orders live on the server.
  - A market order fills by walking the real Binance book at that moment,
    labelled "sandbox fill at Binance prices".
  - Limit and stop orders are watched by the worker, so they fill with the tab
    closed.
  - The book shown is Binance's, labelled as Binance's.
  - A pair with no real book shows **no book**, and says so. It keeps price-only
    paper trading, labelled "fills at the last price".
  - Going live needs either a licensed exchange partner (broker model) or
    Trending's own licence plus matching engine plus market makers.
- **Convert.**
  - The server issues `{quoteId, rate, spread, fee, youGet, expiresAt}`.
  - The screen counts down from 15 s and fetches a new quote at zero.
  - Confirming sends the quote ID. The server refuses an expired or already-used
    quote, and re-checks the price.
- **P2P.**
  - Ads come only from real accounts. The made-up roster goes; in sandbox the
    other side is a real second sandbox account.
  - The seller's crypto is held in the ledger when an order opens.
  - Status flow: `awaiting_payment` (15-minute countdown) → `buyer_marked_paid`
    → `released`, or `cancelled` / `expired` / `disputed` → `resolved_release` /
    `resolved_refund` → `appealed`.
  - **Release happens only when the seller confirms, or when staff decide a
    dispute.**
  - Fraud warnings sit at the points scams happen: paying outside the order,
    "release first", third-party payers.
  - Payment details: today's rule is that Trending never collects bank details.
    Sandbox shows method names only. Live P2P needs a decision on storing
    payment details.
- **Fiat in and out.**
  - Status flow: payment intent → `pending` → `confirmed` → `credited`.
  - `confirmed` only happens on a provider notification whose signature checks
    out and whose amount and currency match.
  - Other statuses: `failed`, `refunded`, `reversed`, `chargeback`.
  - Nothing shows as successful before that confirmation arrives.
- **Earn.**
  - Each product is a config entry: coin, type, indicative rate, where the rate
    comes from, term, redemption rules, fees, risk text.
  - Sandbox rates are labelled "sandbox rate — not an offer, not a promise".
  - Copy trading lists only real accounts, with their real sandbox record.
- **Cross-border transfer.**
  - **Corridors** set, for each route: country and currency at both ends, rails,
    limits, fees and delivery time.
  - **The quote shows eight lines:**
    - amount sent
    - exchange rate, with its source and time
    - Trending fee
    - network or provider fee
    - total cost
    - recipient gets
    - recipient currency
    - estimated arrival
  - Any markup on the rate is shown as its own line, never hidden in the rate.
  - **Statuses:** Preparing → Awaiting payment → Payment received → Processing →
    Sent → Recipient processing → Completed, plus Failed, Cancelled, Refunded,
    Under review and Action required.
  - **Rails:** payout goes through an adapter (sandbox only). The crypto and
    stablecoin rail reuses the existing send flow.
- **Card.** A practice card, built (`docs/card.md`). It never shows a number
  that could pass for a real one: the practice number is twelve zeros and
  four digits that fail the Luhn check, built when shown and never stored.
- **Security Center.** One page gathering:
  - two-factor
  - devices and sign-in history
  - anti-phishing code
  - saved withdrawal addresses (a new address is locked for 24 h)
  - limits
  - the activity log
- **Support.**
  - Tickets record ID, user, transaction reference, category, status and
    messages.
  - "Report a problem" appears on every transaction.
  - A staff console for `ADMIN_UIDS` shows transaction state read-only.
  - Every staff view is written to the audit log, and staff never see a
    password, token or key.

---

## 4. Database changes

| Collection | Key fields | Constraints |
|---|---|---|
| `wallet_accounts` (exists) | + `book`, `locked`, `pending` | unique (userId, asset, kind, book) |
| `ledger_entries` (exists) | + `book` | unique (referenceType, referenceId, direction); both sides in the same book |
| `idempotency_keys` | userId, scope, key, requestHash, response, createdAt | unique (userId, scope, key) |
| `quotes` | userId, kind (convert / fx / remit), in, out, rate, spread, fee, source, expiresAt, usedAt | used at most once, conditional on `usedAt: null` |
| `orders`, `trades` | pair, side, type, qty, limit, stop, status, filled, fee, book | status changes only through the status table |
| `p2p_ads`, `p2p_orders`, `p2p_disputes` | merchant, limits, methods; escrow hold ref; deadlines; evidence refs | one open escrow per order |
| `fiat_intents`, `provider_events` | provider, providerRef, amount, currency, status | unique (provider, eventId), so a replayed notification does nothing |
| `remit_recipients`, `remit_transfers`, `remit_events` | corridor, quote, recipient, rail, status history | every status change is an event |
| `earn_products`, `earn_positions`, `earn_accruals` | terms, rate source, position, accrual per period | unique (positionId, period) |
| `kyc_profiles` | userId, level, status, provider, providerRef | **no ID documents stored by Trending** — the provider holds them |
| `risk_events`, `limit_usage` | userId, kind, score, window | — |
| `address_allowlist` | userId, network, address, label, addedAt, usableAfter | unique (userId, network, address) |
| `support_tickets` | userId, txRef, category, status, messages | — |
| `notifications` | userId, kind, ref, readAt | — |
| `audit_log` (exists) | actor, action, target, at | append-only |

---

## 5. API requirements

**Rules for every endpoint:**

- Firebase sign-in token checked by the server (exists).
- Every POST that moves value needs an `Idempotency-Key` header.
- Amounts travel as strings.
- Every error has one shape:
  `{ error, message, fundsSafe, status, action, support }`.

```
GET  /api/products                       what's on, sandbox or off for me, and why
GET  /api/wallet/balances                available / locked / pending, per book
GET  /api/wallet/history?product=&cursor= one history, every product
POST /api/wallet/transfer                between Trending users (Pay, chat, QR)
POST /api/quotes/convert                 -> quoteId, 15 s
POST /api/convert                        { quoteId }
GET  /api/trade/pairs | /book/:pair | /trades/:pair | /candles/:pair
POST /api/trade/orders                   market | limit | stop
DELETE /api/trade/orders/:id
GET  /api/trade/orders?status= | /fills
GET  /api/p2p/ads      POST /api/p2p/ads
POST /api/p2p/orders   POST /api/p2p/orders/:id/{paid|release|cancel|dispute|appeal}
GET  /api/remit/corridors   POST /api/remit/quotes   POST /api/remit/transfers
GET  /api/remit/transfers/:id   (full timeline)   POST /api/remit/recipients
POST /api/fiat/deposits | /withdrawals     POST /api/fiat/webhooks/:provider (signed)
GET  /api/earn/products   POST /api/earn/positions   POST /api/earn/positions/:id/redeem
GET  /api/security/overview | POST /api/security/addresses | /anti-phishing
POST /api/support/tickets   GET /api/support/tickets/:id
GET  /api/admin/tx/:ref   (staff only, read-only, audited)
     existing: /api/crypto/* deposits, withdrawals, 2FA, signer queue
```

---

## 6. Security requirements

| Requirement | Today | Plan |
|---|---|---|
| Sign-in checked on the server | Done (Phase 1) | Keep |
| 2FA / step-up | TOTP for withdrawals; re-login for sensitive settings | TOTP on every live money action above a limit; re-login for new addresses |
| Devices, sessions, sign out everywhere | Done | Sign-in history and alerts |
| Session expiry | Firebase token lifetime; revocation works | Idle timeout on money screens |
| Withdrawal confirmation, new-address protection | Confirmation screen; 24 h cool-off after 2FA changes | Saved-address list; a new address is usable after 24 h |
| Anti-phishing | — | Personal code shown in every Trending email and in the app header |
| Rate limiting | Link preview only | Per-user and per-IP limits on every money route; shared store once hosted |
| Server-side validation | Withdrawals, deposits | Every new route: schema check, whitelisted fields, amount strings |
| CSRF | Not needed: the API takes a Bearer token, not a cookie | Keep it that way |
| XSS / injection | Escaping audit done; Firestore rules; Mongo queries built from typed values | Keep; add query-operator stripping on every body |
| Encryption | HTTPS; 2FA secrets sealed (AES-256-GCM) | Seal provider tokens and any payment details the same way |
| Secrets | Server env only | Same; a secret-shape check in the tests |
| Audit logs | Custody actions | Every money action and every staff view |
| Risk monitoring | Withdrawal limits | Velocity, new device + new address + large amount, unusual corridor |
| Address and network validation | Server-side, with checksums | Reuse for Send, P2P and remittance crypto rails |
| Signing | Web tier cannot sign; separate signer (not built) | Unchanged: keys only in the signer, never the web tier |
| Replay protection | 2FA counters; unique deposit keys | + quote IDs used once; webhook event IDs unique |
| Webhook signatures | — | HMAC or provider signature, timestamp window, raw-body check |
| Transaction integrity | Write-then-check holds | MongoDB transactions with conditional updates |
| Error handling | JSON errors, no stack traces | + the six-answer problem card |

---

## 7. Compliance dependencies

This is a list of what the architecture has to plug into. It is **not legal
advice**. A lawyer in each country Trending serves has to confirm it.

| Product | What must exist before it goes live |
|---|---|
| Any live crypto service | Registration as a crypto (virtual asset) service provider where required. In India, for example, that is registration with FIU-IND under the PMLA. Identity checks (KYC), AML programme, sanctions screening, transaction monitoring, record keeping |
| Spot, Convert | The above, plus a liquidity partner or Trending's own market making. India also has 1% TDS on crypto transfers and a 30% tax on gains, so tax reporting is needed |
| Withdrawals to outside wallets | Travel Rule data exchange for transfers to other providers above the local threshold |
| P2P | Merchant vetting; rules on payment details; dispute staff |
| Fiat deposit / withdrawal | A bank or licensed payment provider; payment-institution rules where Trending holds funds |
| Cross-border transfer | A licensed money-transfer partner in each corridor (in India, outward transfers run through authorised banks under FEMA/LRS); FX disclosure rules |
| Earn | In some countries a yield product is treated as a deposit or a security. It may need its own licence, or may be unavailable |
| Card | A card-issuing partner and scheme membership through them |
| All | 18+ check; country blocking; data-protection rules (for example India's DPDP Act, the EU's GDPR); complaints handling |

**What the code does about it:**

- Every item above is a switchboard condition, and each one defaults to closed.
- Screens name what is missing: "Cross-border transfers aren't available in
  India yet", never a broken button.
- Identity documents are held by the identity provider. Trending keeps only
  the level and a reference.

---

## 8. UI/UX architecture

- **No separate hub, and no feature offered twice.** A Crypto Hub page was
  built, then moved onto the Profile's Crypto tab, then removed. Every tile
  repeated a button that already existed, and one more place to find things
  made the app harder to use. Each crypto action now has one home:
  - **Profile crypto card:** Send, Receive, Scan, Swap (opens Convert),
    Trade, Earn, P2P, NFTs. Assets, Wallet and Staked figures.
  - **Profile → Crypto tab (wallet):** Request, Add funds, connect or create a
    wallet, balances, transfer between accounts, history, NFTs.
  - **Home dashboard:** balance, Add Funds, P2P, Send Money, markets. The
    Earn shelf sits beside it.
  - **Menu:** Crypto Market, Trade, P2P, Assets, Earn.
  - **One Convert** (features/convert.js), reached from Swap, from Trade and
    from Add Funds.
  - **Settings** holds settings only, not shortcuts.

  The server switchboard (`GET /api/products`) still decides whether each
  product is practice, unavailable or real money. When a product changes
  state, its existing button says so; no new page is added for it.
- **Shared components**, built once and used by every product:
  - confirmation sheet with the nine lines from §12 of the brief
  - status timeline
  - problem card (the six answers)
  - quote countdown
  - "can't be reversed" banner on every on-chain send
  - loading skeletons and empty states
  - offline / reconnecting banner
- **Look:** Trending's own colour tokens and type. Trending's layout rather than
  an exchange's: one task per screen, the balance always one tap away, and the
  money you'll be left with shown before the button.
- **Accessibility:** status changes announced to screen readers, 44 px tap
  targets, contrast checked in both themes, full keyboard use.
- **Language:** no "profit", "earn up to" or "guaranteed". Rates are
  "indicative", past rates are "past", and sandbox is "sandbox".

---

## 9. Implementation phases

A phase is **done** only when its screens, server routes, database state,
security checks, validation, error handling, status flows and tests all work
together. A screen on its own doesn't count.

| Phase | What | Needs from you |
|---|---|---|
| **A. Honesty fixes** (browser only, small) | Remove the invented order book. P2P: no automatic release after "Paid" — the seller confirms, plus countdown, dispute button, fraud warnings. Label the made-up merchants and traders as demo. Earn: risk wording, "indicative" rates, redemption terms. Convert: visible 15 s countdown and auto-refresh. Pay: label the random declines as simulated | Approval |
| **B. Switchboard** | `GET /api/products`: which products are practice, unavailable or (never yet) real money. The hub page built alongside it was removed, because every tile repeated an existing button. Shared components: problem card, skeletons, offline banner. The status timeline and confirmation sheet move to Phase D, so they're built against the first real server transaction | Approval |
| **C. Server foundation** | Fix the database connect bug. Two-book ledger, retry protection, per-user rate limits, audit on every action, compliance and risk hooks (closed by default), support tickets. Tests against a **real** MongoDB | A database: MongoDB Atlas (you create it), or my downloading MongoDB's official test server for local tests (I'll give the size and ask first) |
| **D. Wallet on the server** | Balances (available / locked / pending), transfers between Trending users, Pay/QR, server Convert quotes, one history, the status timeline and the confirmation sheet. Old browser balances can't be trusted (anyone could edit them), so sandbox accounts start fresh; the old history stays visible | Approval to reset sandbox balances |
| **E. Spot on the server** | Orders, fills at the real Binance book, limit and stop triggers in the worker, cancel, histories, large-order confirmation | An always-on host for the worker |
| **F. P2P on the server** | Real ads, ledger escrow, timers, seller release, disputes, appeals, staff console | Decision on payment details |
| **G. Earn on the server** | Product config with disclosures, positions, accrual, redemption; copy trading from real accounts | — |
| **H. Cross-border transfer** | Corridors, recipients, eight-line quote, twelve statuses, tracking, sandbox payout adapter; crypto rail via Send | Which corridors to design first |
| **I. Fiat in / out** | Provider adapter interface, signed webhooks, sandbox provider, failure, refund and reversal flows | — (a real provider later) |
| **J. Security Center + support** | One security page, saved addresses, anti-phishing code, sign-in alerts, tickets, "Report a problem" everywhere | — |
| **Card (practice, built)** | The Trending Card on the practice balance: rules in `features/cardcore.js`, page in `pages/card.js`, `/api/card` for status and ECB rates. Moves its authorisation to the server with Phase D | A card-issuing partner, for a real card |
| **K. Going live, per product and country** | Licences, partners, identity vendor, signer, security audit, penetration test | Business and legal work |

A to J can all be built and tested without a licence, because they run on
sandbox money. K is the step that makes any of it real, and it is not a coding
step.

---

## 10. Testing strategy

- **State machines:** every allowed transition works, and every forbidden one is
  refused (P2P `buyer_marked_paid → released` without the seller must fail).
- **Money maths:** base-unit strings only. Fee and FX rounding go in the
  customer's favour and are tested at the edges.
- **Concurrency (against a real MongoDB replica set):** 20 simultaneous spends
  of one balance must never overspend. Cancel racing fill; release racing dispute.
- **Retry protection:** the same key twice gives one transaction. The same key
  with a different body is refused.
- **Quotes:** expired, reused, or priced off a moved market — each refused with
  the right message.
- **Webhooks:** bad signature, replay, wrong amount, out-of-order events,
  duplicate delivery.
- **Failure injection:** provider timeout and 5xx, stream drop, stale price,
  worker killed mid-transfer then restarted — the state must stay correct and
  the user must be told.
- **Access:** user A can never read or act on user B's order, transfer or ticket.
  Staff routes refuse non-staff.
- **Rendering:** every status and error renders its six answers. The existing
  escaping tests are extended to the new screens. The frontend audit stays clean.
- **Reconciliation:** each book sums to zero, and the sandbox and live books
  never touch.
- **In the browser:** a pass in a session where the browser tools work, at phone
  and desktop widths, light and dark.
