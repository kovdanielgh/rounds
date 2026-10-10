# Rounds

**Premium Bonds meets Polymarket, on Monad's on-chain order book.**

Play the market. Keep your money.

**Short description (one line):** Rounds is a no-loss market on Monad: you pick a side on BTC, the yield of your deposit trades it on Perpl, and your deposit always comes back.

Live app: https://saverounds.vercel.app · Code: https://github.com/kovdanielgh/sava · Network: Monad testnet · Demo video: _add link_

---

## The problem

People like to play: lottery tickets, sports bets, prediction markets. Almost always, they lose money.

Safe savings pay about 4–5% a year. Safe savings are boring.

Prize-linked savings tried to join the two. PoolTogether gives the deposit back, but its prizes are small (about 2.5% a year) and come from pure luck. Its TVL fell 97% from the peak.

## The solution

Rounds is a no-loss round on Monad.

1. **You deposit dollars and pick a side**, for example Bulls or Bears on BTC.
2. **The yield trades, your deposit does not.** When the entry window closes, the treasury advances the yield that the stakes will earn during the round. The contract trades only this yield on Perpl, an on-chain order book on Monad, with up to 15x leverage.
3. **If your side is right, three depositors win the result:** 80%, 15% and 5%. Pyth Entropy draws them, weighted by stake.
4. **Your deposit always comes back**, plus base yield of about 2% a year.

Your yield plays, your money stays.

## Category and alternatives

**Category:** prize-linked savings, rebuilt on Monad's on-chain order book.

| What people use today | Good at | Where it falls short |
|---|---|---|
| Lottery tickets, sports bets | excitement, big prizes | the money is almost always lost |
| Polymarket, perps | excitement, control | you can lose everything |
| Lending (Morpho, Aave), savings accounts | safe | boring, about 4–5% a year |
| PoolTogether | deposit comes back | small prizes (about 2.5% a year), pure luck, no choice |
| Premium Bonds (UK) | deposit comes back, state guarantee | UK only, no crypto, no choice of side |

**Rounds:** the deposit comes back, the prize grows from a real position on Perpl, and the user picks a side. Proof: real 3x–15x positions on Perpl testnet, verified contracts, 44 tests.

## Why Monad

- **The contract trades on an on-chain order book.** One transaction fixes the strike and places a real order on Perpl. This needs fast blocks and a fully on-chain order book.
- **Short rounds are cheap.** A round of 15 minutes or of one day costs a few transactions.
- **A round is a function call.** All rounds live in one contract. A Bulls and a Bears round on the same blocks form a mirror pair.

## You do not need to trust us

- The contract reads the Perpl mark price on-chain. Nobody types a price.
- Anyone can call `setStrike` and `settle`, but only in a 150-block window after the phase ends. After the window, only the owner can call them.
- Pyth Entropy gives the random number for the draw.
- User deposits never go to the trading engine. The maximum loss is the round budget.
- 44 Foundry tests pass, 9 of them are fork tests against the real Perpl exchange.
- All contracts are verified on MonadScan.

## What works today (Monad testnet)

- Rounds open automatically: a quick SOL round every hour, a BTC Bulls vs Bears pair every 6 hours, daily ETH and MON rounds.
- Each round opens a real 3x–15x position on Perpl when entry closes and closes it at settle.
- One-click claim: deposit, prize and yield go straight to the wallet.
- A live price chart with the strike, and a live prize pool that moves with the price.
- Season 0 leaderboard. Share cards: the card reads the prize from the contract, so nobody can fake it.
- An embeddable round for wallets: one iframe, 10 lines of code.
- No crypto needed to start: log in with email, and test USD plus a little MON for gas arrive by themselves.

## Business model and go-to-market

- **Revenue:** a 3% fee on round profit only, plus a share of the vault yield.
- **B2B2C:** wallets, exchanges and neobanks embed a round in 10 lines. Distribution through partners, not ads.
- **Partners on Monad:** a "no-loss mode" brings new traders and volume to Perpl. All deposits sit in AUSD, which grows AUSD TVL for Agora.
- **No token and no points at launch.** PoolTogether grew on token rewards and then shrank.

## Legal

Testnet only. The legal structure (prize-linked savings vs. a market) is under review. Mainnet will geo-block restricted regions.

## Risks, honestly

- **Regulation of prize draws.** In mirror pairs each user picks a side, so the product is closer to a market than to a draw. We will get legal advice before mainnet.
- **Perps are linear.** Higher leverage gives larger and rarer prizes, not a larger average. A growing jackpot and options can add bigger prizes later.
- **The testnet vault is a mock** with a fixed APR. On mainnet, a Morpho AUSD vault replaces it with no code change (both are ERC-4626).

## Next

1. Mainnet with a Morpho AUSD vault.
2. Risk levels per round: Steady (3x) and Moonshot (15x).
3. A jackpot that grows from lost rounds.
4. An SDK that uses the host wallet directly, without a second login.
5. Robinhood Chain for stock rounds (NVDA, TSLA).

Built during the hackathon by one developer.
