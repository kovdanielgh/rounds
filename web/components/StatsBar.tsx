"use client";

import { Line } from "./Skeletons";
import type { RoundView } from "@/hooks/useRounds";
import { useStats } from "@/hooks/useStats";
import { TOKEN_SYMBOL } from "@/lib/config";
import { fmtToken } from "@/lib/format";

/** Live product numbers, read from the contracts. */
export default function StatsBar({ rounds, ready }: { rounds: RoundView[]; ready: boolean }) {
  const s = useStats(rounds);
  const ok = ready && s.ready;
  const items = [
    { label: "Total value locked", value: s.tvl === undefined ? undefined : `${fmtToken(s.tvl, 0)} ${TOKEN_SYMBOL}` },
    { label: "Rounds played", value: `${s.played}` },
    { label: "Prizes paid", value: `${fmtToken(s.prizes)} ${TOKEN_SYMBOL}` },
    { label: "Traded on Perpl", value: `${fmtToken(s.volume, 0)} ${TOKEN_SYMBOL}` },
    { label: "Ideas that won", value: s.winRate === undefined ? "—" : `${s.winRate}%` },
  ];
  return (
    <dl className="stats-bar">
      {items.map((it) => (
        <div key={it.label}>
          <dt>{it.label}</dt>
          <dd>{ok && it.value !== undefined ? it.value : <Line w={90} h={18} />}</dd>
        </div>
      ))}
    </dl>
  );
}
