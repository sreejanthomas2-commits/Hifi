# Crypto deposits — architecture and operations

Trending ships **two deposit modes**. Which one is live is decided by the
server, not the client.

| | Self-custody (default) | Custodial |
|---|---|---|
| Destination | An address the user controls | An address Trending issues |
| Who holds the key | The user | The operator, in hardware |
| Balance credited | No — the coins are already theirs | Yes, after confirmations |
| Needs | Nothing | An account xpub, a database, a watcher |
| Switch | `CUSTODY_ENABLED` unset | `CUSTODY_ENABLED=true` |

With custody off the client never even asks for an address. `GET /api/crypto/config`
returns `custody: "none"`, and the deposit screen stays on the path where the
destination belongs to the user.

---

## The idea that makes custody safe here

A deposit address can be issued from an **extended public key**. The operator
generates the account key in a hardware wallet or HSM, exports only the `xpub`
(or `zpub`), and gives that to the server. From it the server derives an endless
run of receiving addresses and watches them — and can do nothing else with them.
Spending needs the private key, which never leaves the device that made it.

So a full compromise of this server leaks *which addresses belong to which user*.
It does not lose funds. `lib/crypto.js` has no signing function, no private-key
type and no seed handling — not as policy, but because the code to do it is not
there.

---

## What is built

```
lib/crypto.js            secp256k1, keccak-256, base58check, bech32, BIP-32 CKDpub
config/crypto-deposit.js the asset and network catalogue (server-authoritative)
models/custody.js        six collections and the constraints that keep them honest
services/custody.js      xpub registry, address assignment, operator preview
services/ledger.js       append-only double-entry ledger, idempotent credit
services/watcher.js      chain watcher, Bitcoin and EVM drivers
routes/crypto.js         public catalogue API
routes/deposit.js        authenticated wallet API
middleware/auth.js       JWT sessions; closed when unconfigured
scripts/test-custody.js      35 checks — derivation, hashes, refusals, ledger maths
scripts/test-deposit-api.js  14 checks — auth, gating, error ordering
```

### Endpoints

```
Public
  GET  /api/crypto/assets                     what can be deposited
  GET  /api/crypto/assets/:symbol/networks    chains for one asset
  GET  /api/crypto/networks
  GET  /api/crypto/config                     version, and whether custody is on

Authenticated (Bearer JWT)
  POST /api/crypto/deposit/address            issue or reuse this user's address
  GET  /api/crypto/deposit/addresses
  GET  /api/crypto/deposits
  GET  /api/crypto/deposits/:id
  GET  /api/crypto/deposits/:id/status
  GET  /api/crypto/balances                   from the ledger, never the client

Admin
  GET  /api/crypto/custody/preview?network=…  derive the first addresses to check the key
```

### The constraints that do the real work

```
deposit_addresses  unique (network, address)
                   unique (xpubId, change, index)   ← one index, one user, ever
deposit_txs        unique (network, txHash, vout)   ← the idempotency key
ledger_entries     unique (referenceType, referenceId, direction)
```

Crediting twice is not prevented by an `if` that a race can slip past — it fails
at the database, and the duplicate-key error is caught and read as "already
done". That is what makes the watcher safe to kill and restart at any line.

### The credit path

```
watcher sees a payment to an address we issued
  → whose address is it?
  → is the asset the one that address was issued for?      (else: rejected, flagged)
  → record it                                              (unique key blocks replays)
  → follow it until confirmations ≥ policy for that chain
  → ledger.credit(): credit user, debit omnibus, one group, idempotent
  → mark credited, write the audit entry
```

A reorg does not edit history: it writes a compensating entry, so the trail still
shows what was believed and when.

---

## Turning custody on

1. **Generate the account key offline.** Hardware wallet or HSM, at
   `m/44'/0'/0'` for Bitcoin and `m/44'/60'/0'` for EVM. Never on this server.
2. **Export the public key only.** `xpub…` or `zpub…`. If anything you are about
   to paste starts with `xprv`/`zprv`, stop — the parser refuses it, but the fact
   that it was in your clipboard means it should be treated as compromised.
3. **Configure the environment:**
   ```
   CUSTODY_ENABLED=true
   CUSTODY_XPUB_BITCOIN=zpub…
   CUSTODY_XPUB_EVM=xpub…
   JWT_SECRET=…
   MONGO_URI=…
   WATCHER_ROLE=primary          # exactly ONE process
   WATCHER_RPC_ETHEREUM=https://…
   WATCHER_BITCOIN_API=https://your-esplora/api
   CONF_BITCOIN=2  CONF_ETHEREUM=12  …
   ```
4. **Verify before any money moves.** `GET /api/crypto/custody/preview?network=ethereum`
   and compare the addresses against what the hardware wallet shows for the same
   path. If they differ by one character, the key is wrong and every coin sent to
   a derived address is unrecoverable. This check costs a minute.
5. **Send a test deposit** at the smallest sensible amount, on one chain, and
   watch it through `detected → confirming → confirmed → credited`.
6. **Reconcile on a schedule.** `ledger.reconcile(userId, asset)` replays the
   entries and compares them with the cached balance. A mismatch is an incident.

### Run exactly one watcher

`WATCHER_ROLE=primary` gates it. A serverless deployment scales to many
instances, and many watchers on one chain is how you discover whether your
idempotency really works — on production money. Run it as a single worker.

---

## Still missing before real deposits

- **Withdrawals.** Out of scope here, and the harder half: it needs the signing
  side, approval quorums and limits.
- **Token contract allow-lists.** The watcher records the contract on every token
  transfer, but nothing yet refuses an unknown one. Until it does, a token with a
  familiar-looking symbol could be credited as the real thing.
- **Reorg handling beyond the compensating entry.** The path exists; it has not
  been exercised against a real reorg.
- **XRP Ledger and Solana derivation.** Both use different address schemes;
  `lib/crypto.js` covers secp256k1 chains only.
- **Key ceremony, rotation, recovery** — documented and rehearsed, not improvised.
- **On-call.** Chains do not stop at 3am.

---

## Why paper balances stay separate

Spot, Futures, Earn and P2P elsewhere in Trending are simulated paper trading.
A real deposit credits the custody ledger, which is a different set of accounts
with its own collections. They are never added together. Mixing them would make
both numbers meaningless and could let someone believe simulated profits are
withdrawable.

---

# Withdrawals

Deposits were safe to build here because watching a chain needs no key.
**Sending needs one.** So the withdrawal service takes a request as far as it can
go without a key, and stops at a queue.

```
requested → validated → authorised (2FA) → funds held → queued_for_signing
                                                       ↓
                                      [a separate signer, holding keys elsewhere]
                                                       ↓
                                      broadcast → confirming → completed
```

Nothing in the web process can sign or broadcast, and there is nowhere in it to
put a key that could. A web server that can move funds is the one thing every
exchange breach has in common. With no signer connected, a withdrawal waits in
`queued_for_signing` and the screen says exactly that.

## Built

| | |
|---|---|
| `lib/address.js` | Server-side address validation per family, checksums included |
| `lib/totp.js` | RFC 6238 two-factor, constant-time compare, replay-blocked |
| `services/fees.js` | Fees quoted from the chain — EIP-1559 base fee, or sat/vB |
| `services/withdraw.js` | Quote, guard, hold, request, state machine |
| `routes/withdraw.js` | `/withdraw/quote`, `/withdraw/validate`, `/withdraw`, `/withdrawals[/:id[/cancel]]` |
| `public/js/features/withdraw.js` | The whole flow, one state object |

### Controls on the path to `queued_for_signing`

- Session required; the router mounts auth in front of every route.
- Asset/network pair checked **before** anything else, so an impossible pair is
  answered with the warning that saves money rather than a deployment error.
- Address validated server-side; the client's opinion is only for the red line.
- Anything shaped like a recovery phrase or private key is refused **first**,
  before the "contains a space" check that would otherwise teach someone to
  strip the spaces and retry.
- Fee must be fresh; a stale quote is refused, not used.
- Per-request, per-day and per-24h-count limits, from the ledger.
- TOTP verified server-side, and a used counter cannot be replayed.
- Funds held in the ledger at request time, so the same balance cannot leave
  twice.
- `UNIQUE(userId, idempotencyKey)` — a retried request returns the first
  withdrawal rather than sending a second.
- Transitions restricted by a table; `queued → completed` is not expressible.
- Cancel allowed only while still queued; it releases the hold.

## The signer (not built)

`WITHDRAW_SIGNER_URL` is the hook. What goes behind it:

- Runs outside the web tier, with no inbound route from the internet.
- Pulls `queued_for_signing` rows; the web tier never pushes to it.
- Holds keys in an HSM, or relays to an air-gapped signer.
- Enforces its own policy independently — an amount over the hot-wallet
  threshold needs a human approval, not just a queue row.
- Re-derives the destination and amount from its own copy of the record before
  signing. A compromised web tier must not be able to rewrite a destination.
- Reports back only a transaction hash; the web tier advances the status.

Until it exists, the flow is complete and correct right up to the point where a
key would be needed, and honest about stopping there.
