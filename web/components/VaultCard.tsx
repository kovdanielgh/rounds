"use client";

import Link from "next/link";
import RolloverCorner from "./RolloverCorner";
import Art from "./Art";
import Pool from "./Pool";
import ProgressBar from "./ProgressBar";
import { progressOf, shakeOf, type RoundView } from "@/hooks/useRounds";
import { TOKEN_SYMBOL, BLOCK_SECONDS, isRoundOfDay, isJackpot, isRollover } from "@/lib/config";
import { fmtDuration, fmtToken } from "@/lib/format";

export function statusText(r: RoundView, block?: bigint) {
  const left = (to: bigint) => (block && to > block ? fmtDuration(Number(to - block) * BLOCK_SECONDS) : "now");
  if (r.phase === 1) return `Open · closes in ${left(r.entryEnd)}`;
  // The end block only allows settle; the round closes when the settle transaction lands.
  if (r.phase === 2) {
    if (block && block >= r.end) return "Settling…";
    // "Live · BTC +0.12% · Bulls winning · 4m left"
    if (r.strike && r.price) {
      const d = (Number(r.price) - Number(r.strike)) / Number(r.strike);
      const pct = `${d >= 0 ? "+" : "−"}${Math.abs(d * 100).toFixed(2)}%`;
      return `Live · ${r.asset} ${pct} · ${d >= 0 ? "Bulls" : "Bears"} winning · ${left(r.end)} left`;
    }
    return `Live · ends in ${left(r.end)}`;
  }
  if (r.phase === 3) return "Drawing winners";
  // Rollover: the round won, but its pool moved into the next round instead of a draw.
  if (r.thesisWon && r.totalStake > 0n && /^0x0+$/.test(r.winners[0] ?? "0x0") && isRollover(r.description))
    return "Settled · won · pool rolled into the next round";
  // The side the final price favoured. Same price as the start: nobody's side won.
  if (r.finalPrice && r.strike) {
    if (r.finalPrice === r.strike) return "Settled · no change";
    return `Settled · ${r.finalPrice > r.strike ? "Bulls" : "Bears"} won`;
  }
  return `Settled · ${(r.thesis === 1) === r.thesisWon ? "Bulls" : "Bears"} won`;
}

export default function VaultCard({ r, block }: { r: RoundView; block?: bigint }) {
  const bear = r.thesis === 2;
  return (
    <Link href={`/round/${r.id}`} className={`card ${shakeOf(r, block)} ${r.phase === 4 ? "done" : ""}`}>
      <Art asset={r.asset} thesis={r.thesis} />
      <RolloverCorner r={r} />
      <div className="card-body">
        <div className="card-title">
          <h3>{r.asset} goes {bear ? "down" : "up"}?</h3>
          {isRoundOfDay(r.description) && <span className="pill day">☀ Round of the day</span>}{isJackpot(r.description) && <span className="pill jackpot">🏆 Jackpot</span>}
        </div>
        <div className="muted small status-line">{statusText(r, block)}</div>
        <dl className="stats">
          <div>
            <dt>Prize</dt>
            <dd><Pool r={r} /></dd>
          </div>
          {r.totalStake > 0n && (
            <div>
              <dt>Everyone put in</dt>
              <dd>{fmtToken(r.totalStake)} {TOKEN_SYMBOL}</dd>
            </div>
          )}
        </dl>
        {r.phase === 1 && <span className="btn small">Deposit</span>}
      </div>
      <ProgressBar value={progressOf(r, block)} bearish={bear} />
    </Link>
  );
}
