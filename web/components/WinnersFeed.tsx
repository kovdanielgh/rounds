"use client";

import Link from "next/link";
import type { RoundView } from "@/hooks/useRounds";
import { BLOCK_SECONDS, TEAM, THESIS, TOKEN_SYMBOL } from "@/lib/config";
import { fmtDuration, fmtToken, shortAddr } from "@/lib/format";

const SHARES = [8000n, 1500n, 500n];

/**
 * Real wins only, read from settled rounds: winners and the pool are in the round data, so no extra
 * reads. Team wallets are marked. One quiet line that scrolls; it stops on hover.
 */
export default function WinnersFeed({ rounds, block }: { rounds: RoundView[]; block?: bigint }) {
  const wins = rounds
    .filter((r) => r.phase === 4 && r.thesisWon && !/^0x0+$/.test(r.winners[0]))
    .sort((a, b) => Number(b.end - a.end))
    .slice(0, 8)
    .flatMap((r) =>
      r.winners
        .filter((w) => !/^0x0+$/.test(w))
        .map((w, i) => ({ r, w, prize: (r.pool * SHARES[i]) / 10000n, place: i })),
    )
    .filter((x) => x.place === 0 || x.prize >= 1_000_000n) // keep the line short: 1st places and wins of 1 USD or more
    .slice(0, 10);
  if (!wins.length) return null;
  const ago = (r: RoundView) => (block && block > r.end ? `${fmtDuration(Number(block - r.end) * BLOCK_SECONDS)} ago` : "just now");
  const items = wins.map(({ r, w, prize }) => (
    <Link key={`${r.id}-${w}`} href={`/round/${r.id}`} className="win-item">
      <span className="mono">{shortAddr(w)}</span>
      {TEAM.includes(w.toLowerCase()) && <span className="muted"> (team)</span>} won{" "}
      <b>
        {fmtToken(prize)} {TOKEN_SYMBOL}
      </b>{" "}
      <span className="muted">
        · {r.asset} {THESIS[r.thesis]} · {ago(r)}
      </span>
    </Link>
  ));
  return (
    <div className="winners-feed" aria-label="Recent wins">
      <span className="winners-label">Recent wins</span>
      <div className="winners-track">
        <div className="winners-row">
          {items}
          {/* second copy for a seamless loop */}
          <span aria-hidden className="winners-copy">{items}</span>
        </div>
      </div>
    </div>
  );
}
