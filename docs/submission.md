# Rounds

**Wrong call? Every dollar back.**

Rounds is a no-loss up/down market on Monad: you call crypto up or down, only a prize pool trades on Perpl, and your deposit always comes back.

Live app: https://saverounds.vercel.app · Code: https://github.com/kovdanielgh/rounds · Network: Monad testnet · Demo video: _add link_

---

## Who it is for first

**A perp trader on Monad who just got liquidated** and is afraid to open the next position. They still want to make market calls and still want the rare big win, but every way to act on a call puts the deposit at risk.

- **Why this market does not exist yet:** no-loss products (PoolTogether) give the deposit back, but you cannot pick a side and nothing trades. Prediction markets and perps let you pick a side, but they take the deposit when you are wrong.
- **Counterparties:** Perpl is the execution venue (Rounds is a "no-loss mode" that brings it new traders). Agora's AUSD is the deposit and the yield source.

## How it works

1. **You deposit dollars and call it:** up or down on BTC, ETH, SOL, ZEC or MON.
2. **Only the prize pool trades, never your deposit.** When entry closes, the contract opens a real 3x–15x position on Perpl with the prize pool. Today Rounds pays the pool as a launch budget; on mainnet it is the interest that all deposits earn.
3. **Right call:** up to 10 different depositors win. Three big prizes (50%, 20%, 10%) and seven small ones (3% or 2.5%). Pyth Entropy draws them, weighted by stake.
4. **Wrong call:** every dollar comes back. Everyone also earns a base yield (target: Aave + 0.1%, about 5.9% a year).

## Why only on Monad

- **Every round is its own trade on an on-chain order book.** One transaction reads the Perpl price, fixes it as the start price and opens the position, in the same block, so nobody can trade against a stale price.
- **Cheap transactions:** a 15-minute round costs a few transactions. On Ethereum the gas would be larger than the prize.
- **A new structure:** principal and yield are split, the user picks the side of the yield leg, and the yield leg trades on a CLOB. Both sides of an up/down pair get a real position (long and short on separate Perpl accounts).

## You do not need to trust us

- Prices come from the Perpl mark price on-chain. Nobody types a price.
- Anyone can call `setStrike` and `settle`, inside a 150-block window. Pyth Entropy gives the random number.
- Deposits never go to the trading engine. The maximum loss is the prize pool.
- **A stop-loss guard** closes a position at 70% loss of its margin, before Perpl liquidates it, so the rest returns to the pool. Tested live.
- The base yield is never more than the vault earns, so it can never eat into deposits.
- 55 Foundry tests pass (9 are fork tests against the real Perpl exchange). All contracts are verified on MonadScan.

## What works today (Monad testnet)

- Rounds open and settle by themselves: hourly SOL (with rollover) and ZEC, a BTC up/down pair every 6 hours, an ETH Round of the day, a daily MON round, a weekly ETH jackpot.
- Log in with email or Google (Privy); test USD and gas arrive by themselves. One signature to deposit, one click to claim.
- Your call record ("7 right of 11"), a Season 0 leaderboard ranked by right calls, and share cards that read the result from the contract.
- An embeddable round for wallets: one iframe, 10 lines of code.

## Traction and testing

Counted from the contracts on 11 Oct, team wallets excluded: **89 rounds** created and **67 settled** by the bots, **13 real positions on Perpl**, **5 real players, 14 entries, 351 USD** deposited, **0 deposits lost**.

We watched first-time users (Hotjar, an in-app form, messages) and fixed what they hit:

1. "Why are there numbers in the corner?" Now the header shows the Google name or email, not a wallet address.
2. "How does it work? Looks like scam." We cut everything but one promise, who pays the prize, and the rules in plain words.
3. People read with the mouse to understand the idea. Each card became one question, one number and one button.
4. A tester found a rendering bug on Android. Heavy effects are now off on touch screens.

The latest feedback: clear what happens to the money: **Yes**, come back tomorrow: **Yes**, "User-friendly interface, quite transparent in use, I like it." From the Perpl team: *"I like this."* (Arich). A Perpl mentor reviewed Rounds with us: "know your enemy, and your enemy is stable yield."

## Why not just lend on Aave?

That is the real competitor: a flat ~5.8% (Aave AUSD on Monad), no lock. Rounds puts deposits in the best AUSD vault, pays everyone a bit more than Aave, and turns the rest into prizes. The money is locked only for a round (from 15 minutes), and you can exit before entry closes.

Daily APY of real AUSD vaults on Monad mainnet over the last 90 days (DefiLlama):

| Vault (TVL) | Worst 10% of days | Typical | Best 10% of days |
|---|---|---|---|
| Aave AUSD, the benchmark (3.2M) | 5.80% | 5.96% | 8.31% |
| Euler eAUSD-16 (1.6M) | 7.20% | 8.20% | 10.33% |
| Accountable AUSD (30.8M) | 7.11% | 8.00% | 8.15% |
| Morpho CSA AUSD (3.0M) | 5.70% | 7.09% | 8.07% |
| Upshift earnAUSD loop, a looping vault (2.4M, 14 days) | 0.60% | 7.67% | 9.23% |

**At 1M USD deposited** with the base at 5.94%: prizes are about **12–23k USD a year** in a typical case, 12–13k in the worst 10% of days with Euler or Accountable, up to 44k in the best. Looping vaults have the best upside (up to 13.6%) but also days at 0%, so they are not the core. The best vaults are small, so at scale deposits are split across them.

**We will keep looking for better yield strategies and partnerships** to raise the average prize and the base APY. Every extra percent of yield adds 10k USD a year of prizes per 1M USD. Special strategies (MON staking plus an equal MON short on Perpl now, ETH or BTC staking later) run only on treasury money with a hard budget cap, so they can never touch a deposit. Today the MON basis gives about 7% net (sMON 11.56% measured on-chain, Perpl MON funding −1.3% a year on average), no better than the best AUSD vaults, and Perpl's MON market holds only ~71k USD of open interest, so it stays small.

## Partners we are talking to

- **Perpl:** every round trades on its order book; Rounds brings it new traders.
- **Agora (AUSD issuer):** recommended Aave AUSD for mainnet; its partner model shares rewards with apps that hold AUSD float, and it offered to flag higher-yield AUSD lending.
- **Next yield source:** tokenized stocks that pay holders (xStocks): the stock stays, only its payouts play.

## Business model

- A 3% fee on prize profit only, plus the yield above the base.
- Distribution through partners, not ads: Perpl, Agora, and wallets that embed a round.
- No token and no points at launch.

## Risks and legal

- **Prize draws are regulated** in some countries. Each user picks a side, so Rounds is closer to a market than to a draw. Legal advice before mainnet, restricted regions geo-blocked. Testnet only today.
- **Smart-contract risk** is the one way a deposit could be at risk.
- **Perps are linear:** more leverage gives rarer, bigger prizes, not a bigger average.

## Next

- **Mainnet beta:** the best AUSD vaults, a deposit cap, "no-loss mode" with Perpl. Target for the first 60 days: 300 depositors and 100k AUSD; main metric: deposits that stay after the third round.
- **More kinds of rounds on the same contract** (a new engine each): stock perps (NVDA, TSLA), Turbo (a perp that adds its profit to the position), event rounds on prediction markets, options.
- **Product:** deposit with any token or a card, "Play again" by default, an SDK for wallets.

Built during the hackathon by one developer.
