# Trending Card

A card that spends crypto. Today it is a **practice card**: Trending has no
card-issuing partner, so there is no real card, no real card number and no real
money. It spends the practice balance at made-up shops. The rules are the ones a
real programme would need, so moving to a real card changes who runs the
rules, not what they are.

Open it from **Profile → Card**. It has no other entry point.

## Where it lives

| Piece | File | What it does |
|---|---|---|
| Rules | `public/js/features/cardcore.js` (`CDX`) | Every decision: authorise or decline, conversion, fees, limits, settle, reverse, refund, report, stand-in, offline, replace. Plain functions over a plain state, with no screen |
| Page | `public/js/pages/card.js` (`TCD`) | Draws the card and its tabs (Activity, Controls, Assets, Manage, Help) and the practice shop. Asks `CDX` for every decision |
| Money | `features/money.js` (`MNY`) | The practice balance. Card payments show in the wallet history as "Card payment" |
| Server | `routes/card.js`, `services/fx.js` | `GET /api/card/status` (the switchboard's answer) and `GET /api/card/fx` (ECB rates) |
| Switch | `config/crypto-products.json` → `card` | `sandbox`. `PRODUCTS_PAUSED=card` pauses it and every payment declines with a reason |
| Tests | `scripts/test-card.js` | 217 checks: rules, page, rates service, routes |

## How paying with crypto works

This is shown before the card exists, in Assets at any time, and before every
practice payment.

1. The card account is in **US dollars**. At approval, Trending sells just
   enough of the chosen coin, at its **live** price. A coin with no live price
   (stale, reference-priced or missing) is never sold. The payment declines
   instead.
2. A payment in another currency uses the **European Central Bank reference
   rate** for the day, plus a **1% foreign-currency fee**. There is no markup
   in the rate. A rate fetched more than 26 hours ago, or dated more than 7
   days ago, is not used.
3. **Conversion fee:** 1% for BTC, ETH, SOL and BNB. None for USDT or USDC,
   which count as dollars.
4. **Coins:** the preferred coin pays first. With back-up on, the next coin
   that is turned on and can cover the payment pays instead. One coin pays
   each payment. BTC, ETH, SOL and BNB start off, so selling them is always a
   choice.
5. **Rounding:** debits round up to the coin's smallest unit and credits round
   down. The maths uses whole cents and whole coin units (BigInt), never
   floats.

## What a person can always see

Each payment's detail shows, in order:

- What the shop charged and in which currency, and what it finally collected.
- The rate, with its source and date.
- The amount in dollars, the foreign-currency fee and any cash-machine fee.
- The card charge.
- Which coin paid, how much of it, and at what price.
- The conversion fee.
- Anything that came back (the shop collected less), a tip taken later, the
  net total, and money owed.
- Each refund: the share from the shop, the share of fees, and the coin and
  price.
- The status, a timeline, the transaction reference and the network reference.

## States

**Card:**
- `active`, `frozen`, `inactive` (a physical card before activation), `lost`,
  `stolen`, `closed`, `replaced`.
- `expired` is worked out from the expiry date.

**Payment:**
- `pending`: approved and held.
- `offline`: approved by the terminal and not yet sent.
- `completed`, `declined`, `reversed`, `partially_refunded`, `refunded`.
- On top of these: a pending refund, and a report (`submitted`, `review`,
  `won`, `lost`, `withdrawn`).

## Situations handled

| Situation | What happens |
|---|---|
| Declined, for any of 28 reasons | Nothing moves. The payment says why, what to do, and offers a button that does it |
| Not enough balance | Declined. It lists what each coin had against what was needed |
| Card expired or frozen | Declined. Expired offers renewal; frozen offers unfreeze |
| Shop category not allowed | Gambling, buying crypto, money transfer and brokers are always declined (the partner's rule). Categories the person blocks are declined too |
| Conversion failure | No live price: declined, naming the coin. The sale itself fails: declined, and nothing is taken |
| Card partner down | The network approves up to $50 by itself. It checks freezes, blocks and expiry, but not the person's own controls, limits or balance. Nothing is taken until the partner is back; then the coin is sold at that moment's price, or the amount is owed |
| Same network message twice | The same answer, and money moves once. The payment shows how many times it arrived |
| Same shop and amount within 2 minutes | Both are approved, the second is flagged as a possible double charge, and a message says what to do |
| Shop cancels, or no collection in 7 days | Reversed: exactly the coin taken comes back, whatever the price is now |
| Shop collects less | The unused part comes back at the approval's price |
| Restaurant or taxi adds a tip | Up to 20% more is allowed. The extra is converted at today's price |
| Refund | Pending, then credited: the shop's share plus the matching share of fees, in the same coin at that day's price. USDT if that coin has no live price. Money owed is paid first |
| Offline chip sale | Approved without going online (up to $100). Taken when the shop sends it, or owed |
| Money owed | New payments decline until it is paid. Refunds pay it first |
| Report (dispute) | Only once collected, within 120 days, one open report at a time. The shop answers, then it is decided either way |
| Lost or stolen | Blocked at once, for good, without a confirmation step. Then it shows recent payments to check, and offers a replacement |
| Replacement | Damaged or expiring: same number, and the old card works until the new one is activated. Compromised, lost or stolen: new number, and the old card stops now. Controls carry over; limits are the account's anyway |

## Who has to prove who they are

A sensitive action asks the person to confirm it's them, using the app's
existing step-up (`TP.verify`: their password, or a fresh Google or Apple
sign-in):

- getting a card
- unfreezing
- turning a control back on, or unblocking a kind of shop
- raising a limit
- ordering, activating, replacing or closing a card

**Showing the card details** asks every time, even within the usual 5-minute
window.

These ask nothing, because they only protect the person: freezing, reporting
lost or stolen, turning something off, and lowering a limit.

## Card data

- The stored state holds the **last 4 digits and the expiry**, nothing else.
  A stored number, security code or PIN, from wherever it came, is deleted on
  load.
- The practice number is `0000 0000 0000` plus the last 4 digits, chosen so
  the whole thing fails the Luhn check. It is built only when shown.
- Shown details stay on screen for 30 seconds. They hide when the tab is left,
  are never written to storage and never logged. Tests check all of this.
- Support messages carry the payment's reference, never card data. A message
  or report that looks like it contains a card number is refused before it is
  sent.

## Going live

This needs a licensed **card-issuing partner** (BIN sponsor and processor), a
card network, identity verification by that partner, and approval in each
country. The code then needs:

1. **An issuer adapter** on the server:
   - Issue, freeze, unfreeze, report, replace and close through the partner.
   - Store the partner's card id and the last 4 digits only. The number,
     security code and PIN stay with the partner, which keeps Trending out of
     PCI card-data scope.
2. **Showing the number** through the partner's own secure frame:
   - The frame opens with a short-lived key.
   - The server mints that key only after checking the sign-in is recent.
3. **An authorisation webhook:**
   - The partner signs each request, and the server verifies the signature.
   - A repeated request is looked up by the network's transaction id and
     gets the same answer.
   - The request is decided by the same rules as `cardcore.js`.
   - The coin is sold on the server ledger, in one transaction with the hold.
   - Then the clearing, reversal, refund and dispute webhooks.
4. **The switchboard:**
   - Add `card` to the `LIVE` backends.
   - Set `PRODUCTS_LIVE` with the partner, the licence, the countries and the
     identity-verification level (`services/products.js`).
   - Until all of that is in place, the card stays practice.
