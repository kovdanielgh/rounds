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

/** Rollover mark: a corner in the side color (top right of a card) with a black loop icon. */
export default function RolloverCorner({ r }: { r: RoundView }) {
  if (!isRollover(r.description)) return null;
  const leg = Math.max(1, r.rideLeg);
  return (
    <span className={`ride-corner ${r.thesis === 2 ? "bear" : ""}`} title={`Rollover${leg > 1 ? ` ${leg}/${MAX_RIDE_LEGS}` : ""}: ${rolloverText(r)}`} aria-label="Rollover round">
      <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="m17 2 4 4-4 4" />
        <path d="M3 11v-1a4 4 0 0 1 4-4h14" />
        <path d="m7 22-4-4 4-4" />
        <path d="M21 13v1a4 4 0 0 1-4 4H3" />
      </svg>
    </span>
  );
}
