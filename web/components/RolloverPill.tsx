import type { RoundView } from "@/hooks/useRounds";
import { MAX_RIDE_LEGS, TOKEN_SYMBOL, isRollover } from "@/lib/config";
import { fmtToken } from "@/lib/format";

/** Rollover rounds: which pool in a row this is, and what rolled in from the last round. */
export function rolloverText(r: RoundView) {
  const leg = Math.max(1, r.rideLeg);
  if (leg >= MAX_RIDE_LEGS) return `Round ${leg} of ${MAX_RIDE_LEGS}: a win draws the big pool (+${fmtToken(r.rolledIn)} ${TOKEN_SYMBOL} rolled in)`;
  if (leg > 1) return `Round ${leg} of ${MAX_RIDE_LEGS}: +${fmtToken(r.rolledIn)} ${TOKEN_SYMBOL} rolled in. A win rolls the pool on`;
  return "A win rolls the pool into the next round, up to 3 in a row";
}

export default function RolloverPill({ r }: { r: RoundView }) {
  if (!isRollover(r.description)) return null;
  const leg = Math.max(1, r.rideLeg);
  return (
    <span className="pill ride" title={rolloverText(r)}>
      Rollover{leg > 1 ? ` ${leg}/${MAX_RIDE_LEGS} · +${fmtToken(r.rolledIn)} ${TOKEN_SYMBOL}` : ""}
    </span>
  );
}
