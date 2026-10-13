# Rounds

**Wrong call? Every dollar back.**

Rounds is a no-loss up/down market on Monad. You pick up or down on BTC. Every round has a prize pool, paid by Rounds today (on mainnet: the interest on all deposits). Only the pool trades, as a real position on Perpl, an on-chain order book. Right call: three players split the pool. Wrong call: you get your whole deposit back.

**Who pays the prize?** Today Rounds pays it as a launch budget. On mainnet, the interest on all deposits pays it.

> Live app: [saverounds.vercel.app](https://saverounds.vercel.app/) · Network: Monad testnet (chain 10143) · Demo video: _add link_

---

## The idea in 30 seconds

1. **You deposit dollars** into a round, for example "BTC goes up in the next 24 hours".
2. **Only the round's prize pool trades.** Your deposit never trades.
3. **When the round ends,** you get your deposit back. If the idea was correct, up to 10 different depositors win the prize: three big prizes (50%, 20%, 10%) and seven small ones (3% or 2.5% each).

A larger deposit gives a larger chance to win. Nobody can lose the deposit.

---

## Where the money goes

```mermaid
flowchart LR
    U(["You"]) -- "deposit" --> R["Rounds contract"]
    R -- "all deposits" --> V[("Yield vault<br/>ERC-4626")]
    V -- "yield" --> H{"harvest"}
    H -- "base yield (target: Aave + 0.1%)" --> D(["All depositors"])
    H -- "the rest" --> T["Treasury"]
    T -- "advance:<br/>yield of this round" --> E["PerplEngine"]
    E -- "long or short" --> P[("Perpl<br/>order book")]
    P -- "position closes" --> Pot["Prize pool"]
    Pot -- "50 · 20 · 10% + 7 small" --> W(["up to 10 winners"])
    R -- "claim: deposit<br/>always comes back" --> U
```

In plain words:

- **Deposits stay in the vault.** They earn yield all the time.
- **Everyone gets base yield** (target on mainnet: Aave + 0.1%, about 5.9% a year). Nobody needs to win for this.
- **The treasury pays the round in advance.** When the entry window closes, the treasury gives the round the yield that the stakes will earn during the round. The round does not wait. The yield that comes in later pays the treasury back.
- **Only this advance trades.** The engine opens one position on Perpl with it. The maximum loss is this advance.
- **The prize earns yield too.** A winner gets the prize at the draw. The prize earns base yield until the winner claims it.

---

## Life of a round

```mermaid
flowchart LR
    A["<b>Open</b><br/>deposit or exit"] -- "window closes" --> B["Strike = Perpl price<br/>Position opens"]
    B --> C["<b>Closed</b><br/>stakes locked"]
    C -- "round ends" --> D["Final = Perpl price<br/>Position closes"]
    D --> Q{"Idea correct?"}
    Q -- "yes" --> R{"Rollover round<br/>and less than<br/>3 in a row?"}
    R -- "yes" --> N["Pool moves into<br/>the next round"]
    R -- "no" --> F["Pyth Entropy<br/>draws up to 10 winners"]
    N --> H2
    Q -- "no" --> G["Pool goes back<br/>to the treasury"]
    F --> H["<b>Claim</b><br/>deposit + prize + yield<br/>to your wallet"]
    G --> H2["<b>Claim</b><br/>deposit + yield<br/>to your wallet"]
```

| Phase | What you can do | What happens |
|---|---|---|
| **Open** | Deposit, add more, exit | Nothing trades yet |
| **Closed** | Wait | The strike is fixed. The position on Perpl is open. Your stake is locked. |
| **Drawing** | Wait (about 2 blocks) | Pyth Entropy sends a random number. The contract picks up to 10 different winners. |
| **Settled** | Claim | One click sends your deposit, prize and yield to your wallet |

### Kinds of rounds (live now)

| Round | How it works |
|---|---|
| **Quick rounds** | Every hour, 15 minutes. SOL (rollover) and ZEC. |
| **Rollover** | A won pool is not drawn. It moves into the next round of the series and trades again on Perpl. The third win in a row draws the big pool. A loss sends the pool back to the treasury. |
| **Bulls vs Bears pairs** | BTC every 6 hours. Two rounds on the same blocks, one per side. |
| **Round of the day** | ETH, always ends at 18:00 UTC. |
| **Jackpot of the week** | ETH, Sunday 20:00 UTC. 100 USD, +50 USD after every week nobody wins (up to 500). |

Each series is a few lines in `scripts/series.json`. The rollover link is on-chain: `linkRide(id, next)`, at most `maxRideLegs` (3) pools in a row.

---

## An example

You put **100 USD** into "Bullish BTC, 15x". The round has a pool of **20 USD**.

| What happens | You get back |
|---|---|
| BTC goes down. The idea is wrong. | 100 USD + base yield |
| BTC goes up. The idea is correct, but you are not drawn. | 100 USD + base yield |
| BTC goes up 2%. The 15x position makes +30%. The pool grows to 26 USD. A 3% fee comes off the 6 USD profit, so the pool is 25.82 USD. You are drawn 1st and get 50% of it. | 100 USD + about 12.91 USD + base yield |

Your chance to be drawn is your stake divided by all stakes in the round.

---

## Why Monad

- **The contract trades on an on-chain order book.** One transaction fixes the strike and places a real order on Perpl. This needs a fast chain with a fully on-chain order book.
- **Short rounds are cheap.** A 10-minute round costs a few transactions. Blocks are about 0.4 s.
- **A new round is a function call.** All rounds live in one contract. Mirror pairs (Bullish and Bearish on the same blocks) show as one card.
- **I like monad ecosystem**.


---

## You do not need to trust us

- **The price is read on-chain.** `setStrike` and `settle` read the Perpl mark price inside the contract. Nobody types a price.
- **Anyone can call them, but only in a short window** (150 blocks, about 45 s) after the phase ends. A caller cannot pick a better moment.
- **The draw uses Pyth Entropy,** a verifiable random number. A retry is owner-only, so nobody can cancel a result they do not like.
- **User deposits never go to the engine.** Only the round budget does. The contract keeps this rule.
- **55 tests pass.** 9 of them are fork tests against the real Perpl exchange on Monad testnet.

---

## Embed a round in any wallet

Wallets, exchanges and neobanks can add "play the market, keep your money" to their app. One round is one iframe. `live` always shows the current open round, so the link never goes stale.

```tsx
export function RoundCard({ asset = "BTC" }) {
  return (
    <iframe
      src={`https://saverounds.vercel.app/embed/live?asset=${asset}`}
      width={360}
      height={760}
      style={{ border: 0, borderRadius: 16 }}
      title="Rounds"
    />
  );
}
```

- `/embed/live` · `/embed/live?asset=BTC` · `/embed/<round id>`
- Live demo inside a wallet: [saverounds.vercel.app/embed](https://saverounds.vercel.app/embed)
- Next step: an SDK that uses the host wallet directly, without a second login.

---

## Contracts on Monad testnet

All our contracts are **verified on MonadScan**: click an address to read the source code, or call functions with Read/Write Contract.

| Contract | Address | Job |
|---|---|---|
| `Rounds` | [`0x030b…62ad`](https://testnet.monadscan.com/address/0x030b1D29A5f99f99efD4bcDFbEE78d6C19e162ad#code) | Rounds, deposits, yield split, draw, claim |
| `SplitEngine` | [`0x6990…87A3`](https://testnet.monadscan.com/address/0x69904dDEC56Fcfe2A87a77b2e1ae4547611A87A3#code) | Engine router: longs to one Perpl account, shorts to another, so both sides of a pair trade |
| `PerplEngine` (longs) | [`0xD2dB…cD7b`](https://testnet.monadscan.com/address/0xD2dBCbF1BF3F2acE53726e7077825C7F6810cD7b#code) | Opens and closes the long positions on Perpl |
| `PerplEngine` (shorts) | [`0xd58F…DD8e`](https://testnet.monadscan.com/address/0xd58F556534eAdF858CFAaf9Af80cC552eE85DD8e#code) | Opens and closes the short positions on Perpl |
| `PerplPriceSource` | [`0xcF23…23D3`](https://testnet.monadscan.com/address/0xcF23CC9d662d1d623546BA3AB2A8fE07231723D3#code) | Reads the Perpl mark price |
| `Faucet` | [`0xbCF1…7e19`](https://testnet.monadscan.com/address/0xbCF1beF801CC4A9c948A464410DB210Fe2d07e19#code) | Test USD and a little MON for new players; our relayer pays the gas |
| `MockYieldVault` | [`0xF731…BfBc0`](https://testnet.monadscan.com/address/0xF73182502D01fF6E564bF683FB2e7f7D180BfBc0#code) | ERC-4626 vault with fixed APR (testnet only) |
| AUSD (collateral) | [`0xa901…22dC`](https://testnet.monadscan.com/address/0xa9012a055bd4e0eDfF8Ce09f960291C09D5322dC) | Dollar stablecoin by Agora, shown as USD |
| Pyth Entropy | [`0x825c…3c07`](https://testnet.monadscan.com/address/0x825c0390f379C631f3Cf11A82a37D20BddF93c07) | Random numbers |
| Perpl Exchange | [`0x1964…80cc`](https://testnet.monadscan.com/address/0x1964C32f0bE608E7D29302AFF5E61268E72080cc) | On-chain perpetuals order book |

Earlier `Rounds` contracts only finish their last rounds, and players take their money out of them from the profile page: v2 [`0xA046…715a`](https://testnet.monadscan.com/address/0xA04679b2A4f457d6056bd1a8Cf375618eF90715a#code) (before 10 winners and the fixed base rate) and v1 [`0xF265…5bd0`](https://testnet.monadscan.com/address/0xF265552D95De56AecdC1711966f2C17f89965bd0#code) (before rollover).

Leverage caps per market: BTC 15x, ETH 12x, SOL 10x, MON 3x. Each round sets its own leverage up to the cap.

---

## Run it

**Contracts** (Foundry):

```bash
cd contracts
forge test                                   # 28 unit tests
set -a; . ../.env; set +a; forge test        # + 9 fork tests on real Perpl (needs MONAD_TESTNET_RPC)
```

`foundry.toml` points `solc` to a local binary. If you do not have `/opt/homebrew/bin/solc`, set `solc = "0.8.36"`.

**Bots: keeper and scheduler** (one light Node process, runs 24/7 on a small server as a systemd service):

```bash
cd bots && npm ci && npm start   # needs MONAD_TESTNET_RPC, ROUNDS, KEEPER_PK, PRIVATE_KEY in ../.env
DRY_RUN=1 npm start              # read the chain and log what it would send, send nothing
SCHEDULER=0 ROUNDS=0x… npm start # keeper only: finish the rounds of an old contract
```

- **Keeper:** calls `settleMany`, then `setStrikeMany`, at the right block, with a key without owner rights. If a call fails because the window passed (for example after downtime), it retries with the owner key.
- **Scheduler:** keeps one open round (or mirror pair) per series from `scripts/series.json`, and opens the next one when a window closes. It grows the weekly jackpot and links rollover rounds (`linkRide`).

The keeper decides nothing: the contract reads the price on-chain, and anyone can make these calls inside the window.

**Web app** (Next.js, wagmi, Privy):

```bash
cd web
npm install
cp .env.local.example .env.local             # Privy app id and contract addresses
npm run dev
```

---

## Repository map

```
contracts/src/Rounds.sol            rounds, vault accounting, draw, claim
contracts/src/PerplEngine.sol       Perpl adapter (one position per round)
contracts/src/SplitEngine.sol       router: longs and shorts on separate Perpl accounts
contracts/src/PerplPriceSource.sol  on-chain price for strike and settle
contracts/src/MockYieldVault.sol    ERC-4626 stand-in for Aave AUSD (static aToken wrapper)
contracts/src/Faucet.sol            testnet faucet: 100 USD + 0.3 MON per day, daily cap
contracts/test/                     unit tests and Perpl fork tests
bots/index.mjs                      keeper + scheduler (Node, viem)
scripts/series.json                 round series: asset, side, leverage, prize, timing
web/                                Next.js app (site, /season, /embed, share cards)
```

---

## Mainnet yield plan (numbers read on Monad mainnet, 13 Oct)

| Source | Yield | How we know |
|---|---|---|
| Aave AUSD (the benchmark) | 5.84% (3.37 base + 2.47 rewards) | DefiLlama |
| Best AUSD vaults: Euler, Morpho, Upshift | 7.1–8.9% | DefiLlama |
| MON liquid staking (Kintsu sMON) | 11.56% | on-chain: sMON/MON rate over 5.3 days |
| MON short on Perpl: funding | −1.3% a year on average (−4 … +4 per 100k per interval) | on-chain: Perpl `getPerpetualInfo`, 28 samples over a week |
| Perpl MON open interest | ~2.9M MON ≈ 71k USD | on-chain |

```mermaid
flowchart LR
    U["Users<br/>deposit AUSD"] --> R["Rounds"]
    R --> V["Core: best AUSD vault<br/>~7.5–8.9%, no cap"]
    R -. "treasury only,<br/>hard budget cap" .-> S["Special strategies<br/>MON basis now,<br/>ETH / BTC staking later"]
    A["Agora partner rewards<br/>for AUSD float"] -.-> R
    V --> Y{"Yield"}
    S --> Y
    Y -- "base: benchmark + 0.1%<br/>~5.9% to every depositor" --> U
    Y -- "everything above" --> P["Prize pool"]
    P --> E["Perpl position 3x–15x<br/>stop-loss at 70%"]
    E -- "right call" --> W["Winners"]
    E -- "wrong call" --> T["Treasury"]
```

### Yield scenarios: worst, typical, best (last 90 days, DefiLlama daily APY)

We checked how each real AUSD vault on Monad mainnet behaved over the last 90 days, not one snapshot. "Worst 10% of days" means the rate was at or below this number on 10% of the days.

| Vault (TVL, days of data) | Worst 10% of days | Typical (median) | Best 10% of days | Range seen |
|---|---|---|---|---|
| Aave v3 AUSD, the benchmark (3.2M, 90d) | 5.80% | 5.96% | 8.31% | 2.68–10.47% |
| Euler eAUSD-16 (1.6M, 90d) | 7.20% | 8.20% | 10.33% | 5.73–11.90% |
| Euler eAUSD-17 (1.4M, 90d) | 6.27% | 6.58% | 7.73% | 6.15–7.97% |
| Morpho CSA AUSD (3.0M, 90d) | 5.70% | 7.09% | 8.07% | 3.30–9.83% |
| Accountable AUSD (30.8M, 79d) | 7.11% | 8.00% | 8.15% | 0.00–8.25% |
| Upshift earnAUSD (19.2M, 90d) | 3.66% | 5.49% | 7.37% | 2.99–7.82% |
| Morpho Y10K AUSD (5.6M, 20d) | 5.91% | 8.29% | 8.88% | 2.16–11.16% |
| Upshift earnAUSD loop, a looping vault (2.4M, 14d) | 0.60% | 7.67% | 9.23% | 0.00–13.62% |

**What Rounds would pay at 1M USD**, with a base of 5.94% (Aave + 0.1%) to every depositor and the rest as prizes:

| At 1M USD in the vault | Worst 10% | Typical | Best 10% |
|---|---|---|---|
| Euler eAUSD-16 | base 5.94%, prizes 13k/yr (1.0k/mo) | base 5.94%, prizes 23k/yr (1.9k/mo) | base 5.94%, prizes 44k/yr (3.7k/mo) |
| Accountable AUSD | base 5.94%, prizes 12k/yr (1.0k/mo) | base 5.94%, prizes 21k/yr (1.7k/mo) | base 5.94%, prizes 22k/yr (1.8k/mo) |
| Morpho CSA AUSD | base 5.70%, no prizes | base 5.94%, prizes 12k/yr (1.0k/mo) | base 5.94%, prizes 21k/yr (1.8k/mo) |
| Upshift earnAUSD | base 3.66%, no prizes | base 5.49%, no prizes | base 5.94%, prizes 14k/yr (1.2k/mo) |

How to read it:

- **The base is never more than the vault earns.** In the worst case of a weak vault the base falls below Aave and there are no prizes; the deposit itself is still safe.
- **The best vaults beat Aave on most days.** With Euler or Accountable, prizes stay positive even in the worst 10% of days.
- **Looping vaults** (they borrow against their own deposit and lend again) show the best upside, up to 13.6%, but also the worst days, down to 0%, and a short history. A very good case is possible but less likely, so they are not the core vault.
- **Capacity matters.** Several of the best vaults hold 1.4–3M USD; 1M USD more would lower their rate. At scale the core is split across vaults.
- **MON staking** (Kintsu sMON 11.1–13.9%, FastLane shMON 11.1–13.8% on 80% of days) is higher but in MON, not dollars, so it stays a capped treasury strategy.

**Where this goes next.** We will keep looking for better yield strategies and partnerships to raise the average jackpot and the base APY: Agora's partner rewards for AUSD float, the best AUSD vaults, capped treasury strategies (MON basis now, ETH or BTC staking later). With today's vaults the prizes are about 12–23k USD a year per 1M USD; every extra percent of yield adds 10k USD a year to the prizes.

**Strategies and their caps.** User deposits go only to the core vault. Special strategies run on treasury money with a hard budget, so a strategy can lose only its own budget, never a deposit.

| Strategy | Expected now | Budget cap | Status |
|---|---|---|---|
| Core AUSD vault (Euler / Morpho / Aave) | ~7.5–8.9% | none | mainnet beta |
| Agora rewards for AUSD float | on top, terms open | — | in talks |
| MON basis: sMON (11.56%) + equal MON short on Perpl | ~7% net at today's funding | max 10% of the treasury and below Perpl MON open interest | special, treasury only |
| ETH / BTC staking + short (same pattern) | to measure | own cap each | later |

**At 1M USD deposited:** the core vault (~7.5%) earns ~75,000 USD a year. ~59,400 USD (Aave + 0.1%) goes to every depositor as base yield, ~15,600 USD a year (~1,300 USD a month) becomes prizes before the Perpl trade multiplies them. Honest note: the MON basis does not beat the best AUSD vaults today (funding is slightly negative, and Perpl's MON market is small), so it stays a capped special strategy.

**On testnet** the yield vault is a mock. It now pays 7.5% (the rate of the best AUSD vaults), depositors get ~5.9%, and 1.56% of stakes a year funds the prizes. Today the base is a share of the vault yield. A fixed base rate (benchmark + 0.1%) per balance is the next contract change.

## Partners we are talking to

- **Perpl** (execution venue): every round trades on Perpl's on-chain order book. Rounds is a "no-loss mode" that brings new traders to it. From the Perpl team: *"I like this."* (Arich, Perpl, quoted with permission.)
- **Agora** (the AUSD issuer): Agora recommended Aave AUSD as the yield source for mainnet. Their partner model shares rewards with apps that hold AUSD float, and they offered to flag AUSD lending opportunities with a higher yield (bigger prizes for the same deposits). We will only use venues that keep the "every dollar back" promise.
- **Next yield sources:** tokenized stocks that now pay their holders (xStocks): a holder keeps the stock, and only its payouts play in a round.

## Status and limits

- **Testnet only.** The yield vault is a mock with a fixed APR, paid from a reserve that we fund. On mainnet, Aave AUSD replaces it through Aave's ERC-4626 wrapper, with no change to `Rounds`. Agora, the AUSD issuer, recommended Aave for instant withdrawals.
- **Perps are linear.** Higher leverage gives larger and rarer prizes, not a larger average. Options or outcome tokens can add convexity later.
- **One position per market and side:** Perpl nets positions per account, so each engine (longs, shorts) holds one position per market. Two rounds on the same market and side at the same time: the second one plays for a fixed prize.
- **A stop-loss guard:** the keeper closes a position at 70% loss of its margin, before Perpl liquidates it, so the rest returns to the prize pool (`STOP_LOSS` in `bots/index.mjs`).
- **A random draw has legal risk** in some countries. In mirror pairs each user picks a side, which makes the product closer to a derivative.

## Next

The full table with the prize multiples is in [docs/submission.md](docs/submission.md#next). In short:

1. **More kinds of rounds, same contract:** Turbo on Perpl (convex payoff), stock and pre-IPO perps (NVDA, TSLA, SpaceX), event rounds on prediction markets, new-token baskets on Kuru or nad.fun, options.
2. **Mainnet** with Aave AUSD as the yield source (recommended by Agora), deposit with any token or a card.
3. **"Play again" by default:** the money stays in the series until the user takes it out.
4. **The engine as a module** for wallets and exchanges, and an SDK without a second login.
5. **Robinhood Chain** for stock rounds.
