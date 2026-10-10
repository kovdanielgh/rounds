"use client";

import { Line } from "./Skeletons";
import type { RoundView } from "@/hooks/useRounds";
import { useStats } from "@/hooks/useStats";
import { TOKEN_SYMBOL } from "@/lib/config";
import { fmtToken } from "@/lib/format";

/** Live product numbers, read from the contracts. One quiet line. */
export default function StatsBar({ rounds, ready }: { rounds: RoundView[]; ready: boolean }) {
  const s = useStats(rounds);
  if (!ready || !s.ready || s.tvl === undefined) return <p className="stats-line"><Line w={360} h={12} /></p>;
  return (
    <p className="stats-line">
      {fmtToken(s.tvl, 0)} {TOKEN_SYMBOL} locked · {s.played} rounds played · {fmtToken(s.prizes)} {TOKEN_SYMBOL} in prizes ·{" "}
      {fmtToken(s.volume, 0)} {TOKEN_SYMBOL} traded on Perpl
    </p>
  );
}
