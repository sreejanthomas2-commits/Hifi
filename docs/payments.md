# Payments

Everything in the app that moves a balance goes through one module:
`public/js/features/money.js`, the global `MNY`.

Run its tests with:

```bash
node scripts/test-money.js
```

## What was wrong

There were three pots and nobody in charge of them.

| Pot | Where it lived | Who spent from it |
|---|---|---|
| Funding | `DATA.wallet.balances` | tips, Pay, SocialFi rewards, the Wallet tab |
| Spot | `TR.state` | trading, **and chat crypto** |
| Earn | `EN` | staking |

That split produced a set of bugs that all looked unrelated from the outside
and were really one bug:

- **Chat spent from Spot; everything else spent from Funding.** A tip you
  received could not be sent in a chat. Worse, a payment *request* sent from
  chat was routed through Pay and paid **into Funding**, while a *send* from
  the same button row came **out of Spot**. Same row, two accounts.
- **Transfer moved USDT only.** `TR.deposit` / `TR.withdraw` hard-coded the
  quote currency, so a coin that arrived in Funding — a tip, a payment, a gift
  packet — could never reach the trading desk.
- **Four prices for one coin.** TREND was $0.10 in Pay, $0.1 hard-coded in the
  Wallet tab, and $0 everywhere else — so it showed as worthless on the Assets
  page and chat refused to send it at all. NEON, 14,500 of which sit in the
  seed wallet, had no price anywhere. The Wallet tab and its swap read
  `DATA.cryptoMarkets`, a static mock table, while every other screen read the
  live feed.
- **Totals that disagreed.** The home dashboard showed Spot equity alone. The
  Assets page showed Spot + Funding + Earn. The Wallet tab showed five named
  coins out of the seven held, priced off the mock table, under a hard-coded
  "+2.4% (24h)". Three screens, three answers, same money.
- **Pay accepted six assets; chat accepted anything priced.** A request chat
  created was one Pay rejected.
- **A fabricated history.** The Wallet tab's "Ledger History" was three fixed
  rows — "+500 TREND · Just now" — that never changed whatever you did.

## What it is now

`MNY` owns the accounts, the prices, the movements and the record.

```
MNY.price(sym) / quote(sym)      one price, and what kind it is
MNY.balanceOf(sym, account)      funding | spot
MNY.spendable(sym)               funding + spot — what a payment can reach
MNY.spend(sym, amount, meta)     pay out
MNY.receive(sym, amount, meta)   take in, through the daily cap
MNY.transfer(sym, amt, from, to) any asset, either direction
MNY.holdings() / total() / netWorth()
MNY.ledger(n) / record(entry)
```

### One price, and it says which kind

`quote()` returns `{ usd, known, live, reference }`.

- **live** — a market is quoting it right now.
- **reference** — a number the product declares for a token no exchange lists
  (TREND at $0.10, NEON at $2.45, both the figures the app already carried).
  Screens that show one say "reference price", because it is not a market.
- **neither** — the coin is shown with its quantity, its value reads `—`
  rather than `$0.00`, and it stays out of every total. "We don't know" and
  "it's worthless" are different statements and the UI now makes different
  ones.

A conversion requires a **live** price on both sides. A price card and an alert
require a live price. A payment only needs a price.

### Paying reaches both accounts

Funding is the payments account. `spend()` takes what it can from Funding and,
if that is short, moves the difference over from Spot and says so in the
result and in the ledger:

```
spend  out  60,000 USDT  via Chat  → Sarah Chen
transfer move 10,000 USDT via Auto top-up  Spot → Funding
```

Both halves are recorded. A refusal moves nothing — including the case where
the sweep had already happened, which is rolled back.

Pass `sweep: false` to refuse instead of moving, and the message then says
where the rest of the money is.

### The ledger

Append-only, capped at 300 entries, in `localStorage` under
`ts_money_ledger_v1`. Every send, tip, request, swap, P2P settlement and
transfer writes one line. It is what the Wallet tab's History and the Assets
page's History tab read.

## Convert

`public/js/features/convert.js` (`CVT`) turns one coin into another, and is the
only thing that does. The Convert button on every balance row and the Convert
panel on the Wallet tab both come through it, so they cannot quote different
numbers — which is what happened to the rest of the payment system.

```bash
node scripts/test-convert.js
```

The row button used to say **Trade**, which meant the order book: pick a pair,
a side and a price, to do something that is not a trading decision.

Three rules make it honest:

- **Both sides need a live market price.** A token the app prices by declared
  reference has no market to convert at, so the button is disabled and names
  the coin and the reason rather than converting at a number we made up.
- **The quote is taken again at the moment you confirm.** If the output has
  moved more than 0.5% since the preview, nothing is converted — the new figure
  is shown on the same screen and you are asked again. You never get a
  different deal than the one on the button.
- **It spends through `MNY`,** so a conversion draws on the same balance a
  payment does, can reach Spot when Funding is short, and writes both legs to
  the history.

The fee is 1%, taken in the coin being paid, and shown as a quantity and a
dollar figure before you confirm.

## Who calls it

| Module | What changed |
|---|---|
| `features/chatfi.js` | sends, gift packets and splits spend through `MNY`; requests settle into Funding, the same account Pay pays into |
| `features/pay.js` | one balance, one asset list; `debit`/`credit` go through the ledger |
| `features/walletview.js` | **new** — the Wallet tab, merged with Assets |
| `features/convert.js` | **new** — the one conversion engine and its sheet |
| `utils/engine.js` | tips; the coin list now includes anything you hold |
| `pages/assets.js` | rows, prices and the day's move come from `MNY`; Transfer and History tabs added; each row's second button is Convert |
| `pages/trade.js` | Deposit / Withdraw are `MNY.transfer` |
| `pages/p2p.js` | escrow and settlement move in Funding, which is what the page always said |
| `features/socialfi.js` | rewards and gates |
| `pages/homehub.js` | the headline total is the whole balance, not Spot alone |
| `pages/profile.js` | the Wallet tab renders `WV.html()`; the crypto card reads `MNY` |

## Wallet and Assets are one screen

The Wallet tab was a second, worse Assets page. It is now `WV`, reading the
same source, and it keeps everything it had: connect, send, request, scan, my
code, convert, staking and NFTs. What changed is that the numbers are true.

Two claims were removed rather than fixed, because they were not true and a
user might have relied on them:

- the **"E2E Encrypted"** badge — balances are simulated and sit in this
  browser's storage;
- the hard-coded **"+2.4% (24h)"** — the figure is now computed from the 24h
  change on what is actually held.

## What this is not

All of it is simulated paper money, and every screen says so. Nothing here
touches a chain, a card or a bank. Real deposits and withdrawals are a
separate system with its own server-side ledger — see
[crypto-deposit-architecture.md](crypto-deposit-architecture.md) — and the two
are deliberately not connected.
