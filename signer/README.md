# Trending signer

A separate program, run on a separate machine, that turns approved withdrawals
into broadcast transactions.

```
node signer/index.js status    what it can see and do
node signer/index.js once      one pass over the queue, then exit
node signer/index.js run       keep working the queue
```

## Why it is separate

The web tier can authorise a withdrawal and hold the funds. It cannot sign one,
and there is nowhere in it to put a key that could. This program does the
signing step — and it still does not hold a key. It asks a device that does.

The direction matters: **the signer pulls.** Nothing pushes to it, it listens on
no port, and it has no inbound route from the internet. An intruder in the web
tier can add a row to a queue. They cannot reach this process, cannot make it
sign faster, and cannot raise its limits, because its limits live here.

## What it does with each withdrawal

1. Fetches it itself, rather than trusting a payload handed to it.
2. Re-validates the destination address with its own copy of the rules.
3. Asks its **own** policy file: sign, ask a human, or refuse.
4. Reads the chain for the nonce and current fees.
5. Refuses if the queued fee and the chain's fee differ wildly — a sign the two
   are not looking at the same network.
6. Builds the transaction and prints every field.
7. Gets a signature from a device this process cannot read.
8. Broadcasts, and reports only the transaction hash back.

The web tier's checks are re-done here on purpose. If the web tier is
compromised, its checks are the attacker's checks.

## Signing backends

| | |
|---|---|
| `airgap` *(default)* | Prints the transaction and the hash. You compare them against your hardware wallet's screen, sign there, and type `r`, `s` and the parity bit back. The key never touches a networked machine. |
| `external` | Posts the hash to an HSM or KMS at `SIGNER_HSM_URL`, which applies its own policy and returns the signature. |
| `dryrun` | Builds and prints, signs nothing. For rehearsing the whole path. |

There is **no backend that reads a private key from an environment variable**,
and asking for one by name fails with an explanation. That backend is how hot
wallets get drained, and adding it would undo the reason this program exists.

## Configuration

On the signer's machine only:

```
SIGNER_API=https://your-trending-host
SIGNER_TOKEN=…                    # matches SIGNER_TOKEN on the web tier
SIGNER_FROM=0x…                   # the account it spends from
SIGNER_BACKEND=airgap
SIGNER_RPC_ETHEREUM=https://…     # its own RPC, not the web tier's
SIGNER_POLICY=/etc/trending/policy.json
SIGNER_INTERVAL_MS=30000
```

### policy.json

```json
{
  "hotLimit":   { "ETH": "500000000000000000" },
  "dailyLimit": { "ETH": "5000000000000000000" },
  "allowList":  [],
  "denyList":   [],
  "maxAgeMinutes": 180,
  "maxFeeDriftPercent": 300
}
```

Amounts are base units — wei for ETH, satoshi for BTC. **With no `hotLimit` set
for an asset, every withdrawal of it needs a human.** That is the safe default,
and it is deliberate: forgetting to configure a limit should not mean an
unlimited one.

## Before it signs anything real

1. Run `status` and check every line, especially `spends from` and the limits.
2. Run with `SIGNER_BACKEND=dryrun` and watch a real queued withdrawal build.
   Compare the printed fields against what the user actually asked for.
3. Do one real withdrawal at the smallest amount the network allows, with
   `airgap`, and compare every field against the hardware wallet screen before
   approving.
4. Only then consider raising `hotLimit` — and keep it to what you can afford to
   lose to a bad day, because that is exactly what it is.

## What is not implemented

- **Bitcoin.** It needs UTXO selection, change outputs and a different signing
  flow. The signer skips Bitcoin withdrawals and says so rather than
  half-building it.
- **Batching.** One transaction per withdrawal.
- **Fee replacement.** A transaction stuck at a low fee is not currently bumped.
- **Multi-signature approval.** `approve` is one human at the prompt. A treasury
  moving serious money wants a quorum, and that belongs in the HSM's own policy.
