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
  // Wrong calls too: "being wrong cost nothing" is the point. Same line, sorted by time.
  const wrong = rounds
    .filter((r) => r.phase === 4 && !r.thesisWon && r.totalStake > 0n)
    .sort((a, b) => Number(b.end - a.end))
    .slice(0, 4);
  if (!wins.length && !wrong.length) return null;
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
  const wrongItems = wrong.map((r) => (
    <Link key={`w${r.id}`} href={`/round/${r.id}`} className="win-item">
      Wrong call on {r.asset} · <b>{fmtToken(r.totalStake)} {TOKEN_SYMBOL}</b> went back{" "}
      <span className="muted">· {ago(r)}</span>
    </Link>
  ));
  const all = [...items, ...wrongItems];
  return (
    <div className="winners-feed" aria-label="Latest rounds">
      <span className="winners-label">Latest rounds</span>
      <div className="winners-track">
        <div className="winners-row">
          {all}
          {/* second copy for a seamless loop */}
          <span aria-hidden className="winners-copy">{all}</span>
        </div>
      </div>
    </div>
  );
}
