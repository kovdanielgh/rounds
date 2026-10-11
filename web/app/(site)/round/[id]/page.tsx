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
import { progressOf, useBlock, useRounds, type RoundView } from "@/hooks/useRounds";
import { useTx } from "@/hooks/useTx";
import { roundsAbi } from "@/lib/abi";
import { ROUNDS, TOKEN_SYMBOL, isFixedPrize, isRollover, isYearLong, leverageOf, CHAIN_ID } from "@/lib/config";
import { fmtPrice, fmtToken, shortAddr } from "@/lib/format";

const SHARES = [8000n, 1500n, 500n];

/**
 * The rules in plain words, built from the round itself (the same for every round, old or new),
 * not from the text stored at creation.
 */
function rulesOf(r: RoundView) {
  const up = r.thesis !== 2;
  return [
    "Start price: the Perpl price when entry closes.",
    "Final price: the price when the round ends.",
    `${up ? "Up" : "Down"} is right if the final price is ${up ? "above" : "below"} the start price.`,
    "Right call: 3 winners are drawn at random. A bigger deposit gives a bigger chance.",
    ...(isRollover(r.description) ? ["A win rolls the prize into the next round, up to 3 in a row. The third win is drawn."] : []),
    "Wrong call: everyone gets their whole deposit back.",
    "You can exit before entry closes.",
  ];
}

/** Price move from the start price, signed, as "+0.21%" / "−0.21%". */
function movePct(r: RoundView) {
  const live = r.finalPrice || r.price;
  if (!r.strike || !live) return undefined;
  const d = (Number(live) - Number(r.strike)) / Number(r.strike);
  return { d, text: `${d >= 0 ? "+" : "−"}${Math.abs(d * 100).toFixed(2)}%` };
}

/** A settled round that nobody won: what happened, in one honest story. */
function wrongStory(r: RoundView) {
  if (r.totalStake === 0n) return "Nobody played this round.";
  const move = r.strike && r.finalPrice ? (Number(r.finalPrice) - Number(r.strike)) / Number(r.strike) : 0;
  const how = move === 0 ? "did not move" : `went ${move > 0 ? "up" : "down"} ${Math.abs(move * 100).toFixed(2)}%`;
  const who = r.count === 1 ? "The player's" : "The players'";
  return `The call was wrong: ${r.asset} ${how}. ${who} ${fmtToken(r.totalStake)} ${TOKEN_SYMBOL} went straight back. Being wrong cost nothing.`;
}

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
          <div className="round-head">
            <h1>{r.asset} goes {bear ? "down" : "up"}{isYearLong(r) ? " in a year" : ""}?</h1>
            <p className="muted">
              Round #{r.id.toString()} ·{" "}
              {(() => {
                // While the round runs, talk about the player's call, not about "sides".
                const m = movePct(r);
                if (r.phase !== 2 || stake === 0n || !m || (block !== undefined && block >= r.end)) return statusText(r, block);
                const right = bear ? m.d < 0 : m.d > 0;
                return `Your call: ${bear ? "down" : "up"} · ${r.asset} ${m.text} · ${right ? "you're right so far" : "not yet"} · ${statusText(r, block).split(" · ").pop()}`;
              })()}
            </p>
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
            <ul className="rules">
              {rulesOf(r).map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </details>
          <WhosIn r={r} />
        </section>

        <aside className="panel">
          <h2>Prize</h2>
          <dl className="stats col">
            <div><dt>Total{r.poolLive ? " · live" : ""}</dt><dd><Pool r={r} /></dd></div>
            {/* Settled and nobody's side won: no places to show. */}
            {!(r.phase === 4 && /^0x0+$/.test(r.winners[0] ?? "0x0")) && (
              <div><dt>1st · 2nd · 3rd</dt><dd>{SHARES.map((s) => fmtToken((prizePool * s) / 10000n)).join(" · ")} {TOKEN_SYMBOL}</dd></div>
            )}
            <div><dt>Everyone put in</dt><dd>{r.totalStake > 0n ? `${fmtToken(r.totalStake)} ${TOKEN_SYMBOL}` : "Be the first"}</dd></div>
            {stake > 0n && <div><dt>You put in · chance</dt><dd>{fmtToken(stake)} · 1 in {chanceIn}</dd></div>}
          </dl>
          {/* The worst case, told as a story: the call was wrong and it cost nothing. */}
          {r.phase === 4 && /^0x0+$/.test(r.winners[0] ?? "0x0") && <p className="prize-how wrong-story">{wrongStory(r)}</p>}
          {/* Technical numbers live here, out of the way (dictionary: strike, leverage only in Details). */}
          <details className="details">
            <summary>Details</summary>
            <dl className="stats col">
              <div><dt>Start price (strike)</dt><dd>{fmtPrice(r.strike, r.asset)}</dd></div>
              <div><dt>{r.finalPrice ? "Final price" : "Price now"}</dt><dd>{fmtPrice(r.finalPrice || r.price, r.asset)}</dd></div>
              <div>
                <dt>Prize trade on Perpl</dt>
                <dd>
                  {isFixedPrize(r.marketId, r.leverage)
                    ? "None: fixed prize"
                    : r.phase === 2 && r.strike > 0n && r.borrowed === 0n
                      ? `None this round: another round holds the ${r.asset} position. The prize stays fixed.`
                      : `${leverageOf(r.marketId, r.leverage)}x`}
                </dd>
              </div>
              <div><dt>Prize split</dt><dd>80% · 15% · 5%</dd></div>
            </dl>
          </details>

          {r.phase === 1 && <DepositForm id={r.id} />}
          {/* After entry: always a way back to the open rounds (players wait here too). */}
          {(r.phase === 2 || r.phase === 3 || (r.phase === 4 && (stake === 0n || claimed))) && (
            <Link href="/" className={`btn wide ${stake > 0n ? "ghost" : ""}`}>See open rounds</Link>
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
              {r.thesisWon ? (
                <>
                  <strong>Your call was right.</strong> {r.asset} {movePct(r)?.text ?? ""}. Not drawn this time
                  {chanceIn > 1 ? ` (1 in ${chanceIn} chance)` : ""}.{" "}
                </>
              ) : (
                <>Wrong call, nothing lost. </>
              )}
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
                    ? `I called ${r.asset} ${bear ? "down" : "up"}. Right, and won ${fmtToken(prize)} USD. My deposit never traded.`
                    : r.thesisWon
                      ? `I called ${r.asset} ${bear ? "down" : "up"}. Right. My deposit never traded.`
                      : `I was wrong about ${r.asset} and still got my ${fmtToken(stake)} USD back. Rounds.`
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
