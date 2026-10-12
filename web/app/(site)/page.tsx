"use client";

import { usePrivy } from "@privy-io/react-auth";
import MirrorCard from "@/components/MirrorCard";
import { CardSkeleton } from "@/components/Skeletons";
import WinnersFeed from "@/components/WinnersFeed";
import VaultCard from "@/components/VaultCard";
import { groupMirrors, useBlock, useRounds, type Item, type RoundView } from "@/hooks/useRounds";
import { BLOCK_SECONDS, isJackpot, isRoundOfDay, isYearLong } from "@/lib/config";
import { fmtDuration } from "@/lib/format";
import { useFlip } from "@/hooks/useFlip";
import { usePopList } from "@/hooks/usePopList";


const itemKey = (it: Item) => (it.kind === "mirror" ? `m${it.bull.id}` : `r${it.r.id}`);

/** Little drops that fly out when a card pops. */
function Droplets({ bear }: { bear: boolean }) {
  return (
    <div className={`droplets ${bear ? "bear" : ""}`} aria-hidden>
      {Array.from({ length: 10 }, (_, i) => (
        <span key={i} style={{ "--a": `${i * 36 + 8}deg`, "--d": `${120 + (i % 3) * 50}px` } as React.CSSProperties} />
      ))}
    </div>
  );
}

export default function Home() {
  const { rounds, ready } = useRounds();
  const block = useBlock();
  const shown = groupMirrors(
    rounds.filter((r) => r.phase === 1), // closed rounds live in the profile
  );
  // Cards that leave (entry window closed) pop like bubbles; the rest glide to their new place.
  // Quick rounds first, long ones (jackpots) last. Mirror pairs take a full row, so the order leaves no holes.
  const lengthOf = (it: Item) => {
    const r = it.kind === "mirror" ? it.bull : it.r;
    return Number(r.end - r.start);
  };
  // BTC up/down first: the reference market for the first segment (perp traders). Then quick rounds, long ones last.
  const isBtcPair = (it: Item) =>
    it.kind === "mirror" && it.bull.asset === "BTC" && !isYearLong(it.bull) && !isJackpot(it.bull.description) && !isRoundOfDay(it.bull.description);
  const ordered = [...shown].sort((a, b) => Number(isBtcPair(b)) - Number(isBtcPair(a)) || lengthOf(a) - lengthOf(b));
  const list = usePopList(ordered, itemKey, "open");
  // First visit (not logged in): point at the round that finishes soonest, so the first result comes fast.
  const { authenticated } = usePrivy();
  const soonest = ordered
    .flatMap((it) => (it.kind === "single" ? [it.r] : []))
    .sort((a, b) => Number(a.end - b.end))[0];
  const hintFor = (r: RoundView) =>
    !authenticated && soonest?.id === r.id && block && r.end > block
      ? `First time? This one ends in ${fmtDuration(Number(r.end - block) * BLOCK_SECONDS)}.`
      : undefined;
  const grid = useFlip<HTMLDivElement>();

  return (
    <main className="page">
      <section className="hero">
        <h1>
          Wrong call? <span className="hero-accent">Every dollar back.</span>
        </h1>
        {/* The one comparison that made first-time testers get it. */}
        <p className="hero-why">Like a savings account: instead of interest, you get a chance at a prize.</p>
        {/* StatsBar is hidden until the numbers are worth showing (plan: "Скрыто до поры"). */}
        <WinnersFeed rounds={rounds} block={block} />
      </section>
      {ready && shown.length === 0 && <p className="muted">No open rounds right now. A new one opens soon.</p>}
      {!ready && (
        <div className="grid">
          {[0, 1, 2].map((i) => <CardSkeleton key={i} />)}
        </div>
      )}
      <div className="grid" ref={grid}>
        {list.map(({ k, item, popping }) => (
          <div key={k} data-k={k} className={`cell ${item.kind === "mirror" ? "span2" : ""} ${popping ? "popping" : ""}`}>
            {item.kind === "mirror" ? (
              <MirrorCard bull={item.bull} bear={item.bear} block={block} />
            ) : (
              <VaultCard r={item.r} block={block} hint={hintFor(item.r)} />
            )}
            {popping && <Droplets bear={item.kind === "single" && item.r.thesis === 2} />}
          </div>
        ))}
      </div>
    </main>
  );
}
