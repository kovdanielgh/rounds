import type { RoundView } from "@/hooks/useRounds";
import { TOKEN_SYMBOL } from "@/lib/config";
import { fmtToken, fmtYield } from "@/lib/format";

/** Prize pool now. Live: "25 → 31.4 USD ↑". Open: "25 USD +0.0007" while stakes come in. */
export default function Pool({ r }: { r: RoundView }) {
  const v = r.livePool;
  if (r.phase === 2 && r.poolLive) {
    const base = r.funded || r.pool;
    const up = v >= base;
    return (
      <span className="pool live">
        <span className="muted">{fmtToken(base)} → </span>
        <span className={up ? "up" : "down"}>{fmtToken(v)} {TOKEN_SYMBOL} {up ? "↑" : "↓"}</span>
      </span>
    );
  }
  if (r.phase === 1 && r.poolLive && v > r.pool) {
    return (
      <span className="pool">
        {fmtToken(r.pool)} {TOKEN_SYMBOL} <span className="up small">+{fmtYield(v - r.pool)}</span>
      </span>
    );
  }
  return <span className="pool">{fmtToken(v)} {TOKEN_SYMBOL}</span>;
}

/** What winners would share now: the live pool minus the fee on profit. */
export function payoutPool(r: RoundView, feeBps: bigint) {
  const v = r.livePool;
  const base = r.funded || r.pool;
  return v > base ? v - ((v - base) * feeBps) / 10_000n : v;
}
