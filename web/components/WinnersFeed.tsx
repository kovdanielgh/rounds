"use client";

import Link from "next/link";
import type { RoundView } from "@/hooks/useRounds";
import { BLOCK_SECONDS, TEAM, TOKEN_SYMBOL } from "@/lib/config";
import { fmtDuration, fmtToken, shortAddr } from "@/lib/format";

const SHARES = [8000n, 1500n, 500n]; // 1st place gets SHARES[0]

/**
 * The latest finished round, one still line (no ticker: motion on the first screen is noise).
 * A win shows the 1st place; a wrong call shows that the money went back. Team wallets are marked.
 */
export default function WinnersFeed({ rounds, block }: { rounds: RoundView[]; block?: bigint }) {
  const last = rounds
    .filter((r) => r.phase === 4 && r.totalStake > 0n)
    .sort((a, b) => Number(b.end - a.end))[0];
  if (!last) return null;
  const ago = block && block > last.end ? `${fmtDuration(Number(block - last.end) * BLOCK_SECONDS)} ago` : "just now";
  const side = `${last.asset} ${last.thesis === 2 ? "down" : "up"}`;
  const winner = last.thesisWon && !/^0x0+$/.test(last.winners[0]) ? last.winners[0] : undefined;
  return (
    <p className="winners-feed static">
      <span className="winners-label">Latest round</span>
      <Link href={`/round/${last.id}`} className="win-item">
        {winner ? (
          <>
            <span className="mono">{shortAddr(winner)}</span>
            {TEAM.includes(winner.toLowerCase()) && <span className="muted"> (team)</span>} won{" "}
            <b>{fmtToken((last.pool * SHARES[0]) / 10000n)} {TOKEN_SYMBOL}</b> on {side}
          </>
        ) : (
          <>
            {side} was the wrong call · <b>{fmtToken(last.totalStake)} {TOKEN_SYMBOL}</b> went back
          </>
        )}{" "}
        <span className="muted">· {ago}</span>
      </Link>
    </p>
  );
}
