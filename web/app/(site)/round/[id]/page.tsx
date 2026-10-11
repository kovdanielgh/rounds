"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useAccount, useReadContract, useReadContracts } from "wagmi";
import Confetti from "@/components/Confetti";
import DepositForm from "@/components/DepositForm";
import WhosIn from "@/components/WhosIn";
import PriceChart, { chartCaption } from "@/components/PriceChart";
import Pool, { payoutPool } from "@/components/Pool";
import ProgressBar from "@/components/ProgressBar";
import { CardSkeleton, Line } from "@/components/Skeletons";
import PlayAgainButton, { nextRoundOf } from "@/components/PlayAgainButton";
import ShareButton from "@/components/ShareButton";
import { statusText } from "@/components/VaultCard";
import { progressOf, useBlock, useRounds } from "@/hooks/useRounds";
import { useTx } from "@/hooks/useTx";
import { roundsAbi } from "@/lib/abi";
import { isRollover, ROUNDS, THESIS, TOKEN_SYMBOL, leverageOf, CHAIN_ID, ENGINE, addressUrl } from "@/lib/config";
import { fmtPrice, fmtToken, shortAddr } from "@/lib/format";

const SHARES = [8000n, 1500n, 500n];

export default function VaultPage() {
  const { id: idParam } = useParams<{ id: string }>();
  const id = BigInt(idParam);
  const { rounds } = useRounds();
  const block = useBlock();
  const { address } = useAccount();
  const { run, status, error, busy } = useTx();
  const r = rounds.find((x) => x.id === id);
  const { data: feeBps } = useReadContract({ chainId: CHAIN_ID, address: ROUNDS, abi: roundsAbi, functionName: "feeBps" });

  const { data: mine, refetch } = useReadContracts({
    allowFailure: false,
    contracts: [
      { chainId: CHAIN_ID, address: ROUNDS, abi: roundsAbi, functionName: "entries", args: [id, address!] },
      { chainId: CHAIN_ID, address: ROUNDS, abi: roundsAbi, functionName: "prizeOf", args: [id, address!] },
    ],
    query: { enabled: !!address, refetchInterval: 3000 },
  });
  const [, stake, claimed] = (mine?.[0] as readonly [number, bigint, boolean, bigint, bigint]) ?? [0, 0n, false];
  const prize = (mine?.[1] as bigint) ?? 0n;

  if (!r)
    return (
      <main className="page vault">
        <div className="vault-grid">
          <section>
            <Line w="40%" h={34} />
            <Line w="25%" />
            <span className="skeleton" style={{ display: "block", height: 280, marginTop: 20 }} />
          </section>
          <CardSkeleton />
        </div>
      </main>
    );
  const prizePool = payoutPool(r, feeBps ?? 300n);
  const bear = r.thesis === 2;
  // Chance as a frequency ("1 in 8"): easier to feel than a percent.
  const chanceIn = r.totalStake > 0n && stake > 0n ? Math.max(1, Math.round(Number(r.totalStake) / Number(stake))) : 0;
  const next = nextRoundOf(r, rounds);

  return (
    <main className="page vault">
      <div className="vault-grid">
        <section>
          <div className="card-title">
            <span className={bear ? "tag bear" : "tag"}>{THESIS[r.thesis]}</span>
            <h1>{r.asset} · Round #{r.id.toString()}</h1>
          </div>
          <p className="muted">{statusText(r, block)}</p>
          <div className="promise">
            <strong>Your money always comes back.</strong> Only the yield of the round plays.
          </div>
          <p className={`chart-caption ${r.strike && (r.finalPrice || r.price) ? ((r.finalPrice || r.price)! > r.strike ? "up" : "down") : ""}`}>
            {chartCaption(r)}
          </p>
          {/* Open: the bar under the chart shows the entry window. Closed: only the chart, fixed to the live phase. */}
          <div className="card static chart-card">
            <PriceChart r={r} block={block} />
            {r.phase === 1 && <ProgressBar value={progressOf(r, block)} bearish={bear} />}
          </div>
          <h2>About this round</h2>
          <p>{r.description || "—"}</p>
          <details className="details">
            <summary>Rules</summary>
            <p>{r.rules || "—"}</p>
          </details>
          <WhosIn r={r} />
        </section>

        <aside className="panel">
          <h2>Prize</h2>
          <dl className="stats col">
            <div><dt>Total{r.poolLive ? " · live" : ""}</dt><dd><Pool r={r} /></dd></div>
            <div><dt>Everyone put in · {r.count} {r.count === 1 ? "player" : "players"}</dt><dd>{fmtToken(r.totalStake)} {TOKEN_SYMBOL}</dd></div>
            {/* Settled and nobody's side won: no places to show. */}
            {!(r.phase === 4 && /^0x0+$/.test(r.winners[0] ?? "0x0")) &&
              SHARES.map((s, i) => (
                <div key={i}>
                  <dt>{["1st", "2nd", "3rd"][i]} place</dt>
                  <dd>{fmtToken((prizePool * s) / 10000n)} {TOKEN_SYMBOL}</dd>
                </div>
              ))}
            {stake > 0n && <div><dt>You put in · chance</dt><dd>{fmtToken(stake)} · 1 in {chanceIn}</dd></div>}
          </dl>
          <p className="muted small prize-how">
            {r.phase === 4 && /^0x0+$/.test(r.winners[0] ?? "0x0")
              ? "Nobody won this round. Everyone got their own money back."
              : `The prize is a bonus from Rounds${isRollover(r.description) ? " plus pools rolled in from earlier rounds" : ""}, plus interest on everyone's money. It trades on Perpl, so it grows or shrinks with the price. Three players win it. Everyone gets their own money back.`}
          </p>
          {/* Technical numbers live here, out of the way (dictionary: strike, leverage only in Details). */}
          <details className="details">
            <summary>Details</summary>
            <dl className="stats col">
              <div><dt>Start price (strike)</dt><dd>{fmtPrice(r.strike, r.asset)}</dd></div>
              <div><dt>{r.finalPrice ? "Final price" : "Price now"}</dt><dd>{fmtPrice(r.finalPrice || r.price, r.asset)}</dd></div>
              <div><dt>Leverage on Perpl</dt><dd>{leverageOf(r.marketId, r.leverage)}x</dd></div>
              <div><dt>Base yield (everyone)</dt><dd>~2% a year</dd></div>
              <div><dt>Prize split</dt><dd>80% · 15% · 5%</dd></div>
            </dl>
            <p className="small">
              <a className="tx-link" href={addressUrl(ENGINE)} target="_blank" rel="noreferrer">View the Perpl position (engine) ↗</a>
              {" · "}
              <a className="tx-link" href={addressUrl(ROUNDS)} target="_blank" rel="noreferrer">Contract ↗</a>
            </p>
          </details>

          {r.phase === 1 && <DepositForm id={r.id} />}
          {r.phase !== 1 && stake === 0n && (
            <Link href="/" className="btn wide">See open rounds</Link>
          )}

          {r.phase === 1 && stake > 0n && (
            <button
              className="btn ghost wide"
              disabled={busy}
              onClick={async () => {
                await run([{ label: "Exiting…", tx: { chainId: CHAIN_ID, address: ROUNDS, abi: roundsAbi, functionName: "exitRound", args: [id] } }]);
                refetch();
              }}
            >
              {status ?? "Exit round"}
            </button>
          )}

          {r.phase === 4 && prize > 0n && (
            <div className={`win-peak ${bear ? "bear" : ""}`}>
              <Confetti id={`${r.id}-${address}`} bear={bear} />
              <span className="muted small">You won</span>
              <strong>{fmtToken(prize)} {TOKEN_SYMBOL}</strong>
              <span className="muted small">and your {fmtToken(stake)} {TOKEN_SYMBOL} came back too.</span>
            </div>
          )}
          {r.phase === 4 && stake > 0n && prize === 0n && (
            <p className="soft-landing">
              Your {fmtToken(stake)} {TOKEN_SYMBOL} {claimed ? "came back" : "is back"}.{" "}
              {next ? `Next round in ${statusText(next, block).replace("Open · closes in ", "")}.` : "A new round opens soon."}
            </p>
          )}
          {r.phase === 4 && stake > 0n && !claimed && (
            <PlayAgainButton r={r} stake={stake} rounds={rounds} onDone={() => refetch()} />
          )}
          {r.phase === 4 && stake > 0n && !claimed && (
            <button
              className="btn wide"
              disabled={busy}
              onClick={async () => {
                await run([{ label: "Claiming…", tx: { chainId: CHAIN_ID, address: ROUNDS, abi: roundsAbi, functionName: "claim", args: [[id]] } }]);
                refetch();
              }}
            >
              {status ?? (prize > 0n ? `Claim ${fmtToken(stake + prize)} ${TOKEN_SYMBOL}` : `Claim ${fmtToken(stake)} ${TOKEN_SYMBOL}`)}
            </button>
          )}
          {claimed && <p className="muted small">Claimed to your wallet{prize > 0n ? `, prize +${fmtToken(prize)} ${TOKEN_SYMBOL}` : ""}.</p>}
          {r.phase === 4 && stake > 0n && (
            <div className="share-row">
              <ShareButton
                id={r.id}
                text={
                  prize > 0n
                    ? `I won ${fmtToken(prize)} USD on Rounds and kept my deposit.`
                    : `I played ${r.asset} with the ${THESIS[r.thesis]} on Rounds and got my ${fmtToken(stake)} USD back.`
                }
              />
            </div>
          )}
          {error && <div className="error small">{error}</div>}

          {r.phase === 4 && r.winners[0] !== "0x0000000000000000000000000000000000000000" && (
            <>
              <h2>Winners</h2>
              <ol className="winners">
                {r.winners.filter((w) => !/^0x0+$/.test(w)).map((w) => (
                  <li key={w} className={w === address ? "me" : ""}>{shortAddr(w)}</li>
                ))}
              </ol>
            </>
          )}
        </aside>
      </div>
    </main>
  );
}
