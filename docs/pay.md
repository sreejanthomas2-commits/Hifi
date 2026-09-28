# Trending Pay

Payments between Trending accounts, and cross-border payouts. The server
decides every balance and every status.

**Practice mode.** Balances are practice money kept in the server's book, and
cross-border payouts go to a sandbox payout partner that pays nobody.

**Frontend state is never evidence.** Money is never marked sent, received,
refunded or settled because of anything the browser says. Status comes from
the server's ledger, or from a signed event of a payout partner that the
server has verified.

## Where it lives

| Piece | File | What it does |
|---|---|---|
| Book | `services/pay/store.js` | See [Storage](#storage). Double-entry ledger, conditional debits, one change at a time. |
| Engine | `services/pay/engine.js` | Quotes, confirmation, the state machine, requests and signed codes, merchants, cross-border, partner events, reviews and receipts |
| Directory | `services/pay/directory.js` | Who a @handle belongs to, from the app's own Firestore handle records. Also look-alike handle detection. |
| Partner | `services/pay/partner-sandbox.js` | A stand-in payout partner with its own records and signed webhook events |
| Routes | `routes/pay.js` | `/api/pay/*`, plus the raw-body webhook router mounted before the JSON parser |
| Screen | `public/js/features/trending-pay.js`, `public/css/trending-pay.css` | Covers Send, Receive, QR Pay, Request, Merchant Pay, Cross-border, History, Track and Receipt. It only draws what `/api/pay` returns. |
| Entry points | `public/js/features/pay.js` | See [Entry points](#entry-points). |
| Config | `config/pay.json` | Assets, limits, practice grant, quote life, fees, corridors |
| Tests | `scripts/test-pay.js` | Run with `node --test scripts/test-pay.js`. 23 tests. |

### Storage

- **Default:** the book is a file at `.paydata/pay-book.json`. It is rewritten
  atomically after every change and is not committed.
- **With `MONGO_URI` set:** the book is kept in MongoDB, with transactions.
- **In production without MongoDB:** Pay refuses to start.

### Entry points

`public/js/features/pay.js` is the old Pay. It keeps the QR encoder (`QRGEN`),
and every Pay button in the app opens Trending Pay: Profile → Send, Receive and
Scan, requests from chat, the Home hub and the withdraw scanner.

The old browser-only payments are retired. They never debit or credit
anything. Old chat payment cards say they are archived and are not proof of
payment.

## The flow

```
recipient (@handle / Pay ID / scan) → amount → asset → quote → review
  → confirm it's you → pay → track → completed → receipt
```

1. **The recipient comes from the server.** A Pay ID or @handle is looked up;
   a QR code's contents are only a pointer to the server's record.
2. **The quote (60 seconds)** holds:
   - who is paid, through which payment rail
   - how much, and in which asset
   - the exchange rate and its source
   - every fee as its own line
   - the total, what the recipient receives, and the estimated arrival

   All of it is sealed under a hash, which also covers any warnings. The
   review screen shows every line before confirmation.
3. **Confirm-it's-you:** the sign-in must be less than 5 minutes old.
   Otherwise the screen asks for the password or a fresh Google or Apple
   sign-in.
4. **Confirming** re-checks the quote: still open, not expired, unchanged, and
   the handle still belongs to the same account. It also checks warnings were
   acknowledged, then limits and risk. Then, in one change:
   - the quote is spent
   - the transfer is written
   - the money moves, or is held
5. **Tracking** reads the transfer from the server; the screen polls it.

## States

| State | Meaning |
|---|---|
| Awaiting confirmation | The quote is made and shown; nothing has moved |
| Processing | Confirmed; the money is held or moving |
| Sent | The payout partner accepted it |
| Recipient processing | The partner is paying it into the recipient's account |
| Completed | Arrived. Between Trending accounts this is instant |
| Failed | It didn't happen, and nothing left your balance (a hold is released) |
| Refunded | The money came back: a failed payout (fees included), or a merchant refund |
| Under review | Held for a safety review, or while a partner's answer is unconfirmed |
| Action required | The partner needs your answer (for example, the account name differs) |

A state only moves along allowed edges. Late, duplicate or out-of-order
partner events are ignored, and a completed payout can never be turned into a
refund by a failure event.

## Protections

| Threat | What stops it |
|---|---|
| Fake QR codes | Codes are `TP1.<id>.<signature>`. The HMAC (server key) covers all of the request's terms, and the server's record is authoritative. Unknown ids and bad signatures are refused. |
| Recipient substitution | The recipient comes from the directory and the quote seals it. At confirmation, a handle that now belongs to someone else stops the payment. |
| Duplicate payments | See [Duplicates and replays](#duplicates-and-replays). |
| Replay attacks | See [Duplicates and replays](#duplicates-and-replays). |
| Modified payment requests | The request's terms are hashed into the quote and checked again when you confirm. The code's signature covers the note and order reference too. |
| Expired payment requests | Expiry is checked on scan, on quote and in the confirmation itself. Single-use requests are reserved, then paid, once. |
| Incorrect networks | Trending Pay never pays a blockchain address. A scanned wallet address goes to the wallet send flow, which checks the network, checksum and look-alikes first. |
| Address poisoning | Handled by the wallet send flow for addresses. For handles, a new recipient whose handle looks like one you've paid (`0/o`, `1/l`, `rn/m`, one character apart) must be acknowledged. |
| Phishing | See [Phishing](#phishing). |
| Account takeover | See [Account takeover](#account-takeover). |
| Unauthorized payments | The payer is taken only from the verified sign-in token, never from the request. Other accounts' transfers, receipts and recipients answer "not found". Webhooks need a valid signature. |

### Duplicates and replays

- **Retry key.** Every confirmation carries an `Idempotency-Key`. A retry
  returns the first transfer, even after a restart.
- **Quotes are single-use.**
- **Repeat warning.** The same person, asset and amount within 10 minutes
  needs an acknowledged warning on a fresh quote.
- **Webhook events** are signed, stamped within 5 minutes and recorded by id,
  so one can't be played twice.

### Phishing

- A link to another host is refused as a possible fake.
- A link with a login, a query or a different path is refused.
- The host is trusted only from `PAY_PUBLIC_ORIGIN` (or localhost in
  development), never from the request's `Host` header.
- Codes with hidden characters inside are refused.

### Account takeover

- Recent sign-in is required to pay, refund or answer the partner.
- Daily limits apply per asset.
- A risk score flags first payments to new people, large amounts and bursts.
  - At 50 points or more, the payment is held for review.
  - At 80 or more, it is blocked; nothing moves.

## Cross-border

- **Paid from:** USDT or USDC.
- **Corridors:** India, the Philippines, Mexico, Indonesia, the United Kingdom,
  Germany (euro), Brazil and Thailand.
- **Before confirmation, the screen shows:** you send, exchange rate, Trending
  fee, payout partner fee, total, what the recipient receives, and estimated
  arrival.

**The rate has no markup.** It is the European Central Bank's reference rate
for the day, after "1 USDT = 1 USD" (stated as Trending's practice rate). Both
parts and their sources are shown.

**Fees are separate lines:**
- Trending: 0.5% of the amount, at least 0.99.
- Payout partner: a fixed fee per corridor.

**Recipients** are a name, a country and how they receive money. Account
numbers are never asked for. A live partner would collect them in its own
secure form, and Trending would keep only its reference.

**Status moves only on the partner's signed events.** The money stays held
until the partner reports the payout paid out or failed.
- If the partner's reply is lost, the money stays held and the transfer shows
  Under review; it never becomes a guessed failure.
- If the partner then says it has no record, the payout is sent again under the
  same reference, so it can't pay twice.
- After 5 tries, an operator decides. They can send it again, or stop it — but
  only once the partner confirms it never received it.

**Practice situations.** The sandbox partner decides what happens from the
recipient's name:
- a name containing `fail` is rejected, then refunded
- `review` is checked first, then paid
- `check` has a differing account name, so the partner asks you

## Merchant Pay

Any account can turn on merchant payments with a business name.

**Verification.** A self-declared business name is marked "not verified".

**Charges** are fixed-amount, single-use codes with an order reference. They
expire after 15 minutes.

**Fees.** The payer sees the merchant's 0.5% fee as its own line, paid by the
business, and exactly what the business receives.

**Refunds.** A merchant can refund a completed payment in full, once, and must
have confirmed it's them recently.

## Receipts

A receipt is the transfer record in words. It contains:
- transaction ID, date and time
- sender and recipient (with Pay IDs)
- amount and asset
- exchange rate, each fee, and the total
- expected and received amounts
- status and payment rail

A receipt only says an amount was received once the payment is completed.

## Settings

| Variable | Default | What it does |
|---|---|---|
| `MONGO_URI` | unset | Keeps the book in MongoDB (Atlas) instead of the local file |
| `PAY_STORE_FILE` | `.paydata/pay-book.json` | Where the file book lives |
| `PAY_MODE` | `practice` | Anything else turns Pay off, because no live-money adapter exists yet |
| `PAY_PUBLIC_ORIGIN` | unset | The app's public address, used to trust payment links (required outside localhost) |
| `PAY_WORKER_ROLE` | on in development | `primary` runs the background worker in production (on one server only); `off` disables it |
| `PAY_QR_SECRET`, `PAY_SANDBOX_WEBHOOK_SECRET` | generated | Signing keys. Generated and kept in the book when unset. Set them explicitly in production. |
| `FIREBASE_PROJECT_ID` | none | Needed for sign-in checks. It is public and set in `.env`. |

**Paying by @handle** needs the app's handle directory in Firestore. That
needs the published `firestore.rules`. Until then, pay with a Pay ID or a
code.

## Going live

A live version needs, per country:
- a licensed payout partner and custody or stablecoin provider
- identity checks and sanctions screening
- a live adapter behind the same interface as the sandbox partner
  (`createPayout`, `lookup`, `resolve`, signed events)
- MongoDB
- the partner's own webhook signing secret

None of these exist. `/api/pay/status` says so, and the screen says
"Practice" everywhere.
