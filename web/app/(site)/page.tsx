"use client";

import { useState } from "react";
import MirrorCard from "@/components/MirrorCard";
import HowItWorks from "@/components/HowItWorks";
import { CardSkeleton } from "@/components/Skeletons";
import StatsBar from "@/components/StatsBar";
import WinnersFeed from "@/components/WinnersFeed";
import VaultCard from "@/components/VaultCard";
import { groupMirrors, useBlock, useRounds, type Item } from "@/hooks/useRounds";
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
  const [tab, setTab] = useState<"open" | "closed">("open");
  const { rounds, ready } = useRounds();
  const block = useBlock();
  const shown = groupMirrors(
    rounds.filter((r) => (tab === "open" ? r.phase === 1 : r.phase > 1)),
  );
  // Cards that leave (entry window closed) pop like bubbles; the rest glide to their new place.
  // Quick rounds first, long ones (jackpots) last. Mirror pairs take a full row, so the order leaves no holes.
  const lengthOf = (it: Item) => {
    const r = it.kind === "mirror" ? it.bull : it.r;
    return Number(r.end - r.start);
  };
  const ordered = [...shown].sort((a, b) => lengthOf(a) - lengthOf(b));
  const list = usePopList(ordered, itemKey, tab);
  const grid = useFlip<HTMLDivElement>();

  return (
    <main className="page">
      <section className="hero">
        <h1>Play the market. Keep your money.</h1>
        <HowItWorks />
        <StatsBar rounds={rounds} ready={ready} />
        <WinnersFeed rounds={rounds} block={block} />
      </section>
      <div className="tabs">
        <button className={tab === "open" ? "active" : ""} onClick={() => setTab("open")}>Open rounds</button>
        <button className={tab === "closed" ? "active" : ""} onClick={() => setTab("closed")}>Closed rounds</button>
      </div>
      {ready && shown.length === 0 && <p className="muted">No {tab} rounds right now. A new one opens soon.</p>}
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
              <VaultCard r={item.r} block={block} />
            )}
            {popping && <Droplets bear={item.kind === "single" && item.r.thesis === 2} />}
          </div>
        ))}
      </div>
    </main>
  );
}
