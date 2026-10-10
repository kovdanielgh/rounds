"use client";

import { useState } from "react";
import MirrorCard from "@/components/MirrorCard";
import { CardSkeleton } from "@/components/Skeletons";
import VaultCard from "@/components/VaultCard";
import { groupMirrors, useBlock, useRounds, type Item, type RoundView } from "@/hooks/useRounds";
import { useFlip } from "@/hooks/useFlip";
import { usePopList } from "@/hooks/usePopList";
import { BLOCK_SECONDS } from "@/lib/config";

// Round length buckets, by blocks from creation to end.
const TERMS = { all: Infinity, day: 86_400, week: 604_800, month: 2_592_000 } as const;
type Term = keyof typeof TERMS;
const lengthSeconds = (r: RoundView) => Number(r.end - r.start) * BLOCK_SECONDS;

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
  const [term, setTerm] = useState<Term>("all");
  const { rounds, ready } = useRounds();
  const block = useBlock();
  const shown = groupMirrors(
    rounds.filter((r) => (tab === "open" ? r.phase === 1 : r.phase > 1) && lengthSeconds(r) <= TERMS[term]),
  );
  // Cards that leave (entry window closed) pop like bubbles; the rest glide to their new place.
  // Mirror pairs first: they take a full row, so the grid of single cards below has no holes.
  const ordered = [...shown.filter((it) => it.kind === "mirror"), ...shown.filter((it) => it.kind === "single")];
  const list = usePopList(ordered, itemKey, `${tab}:${term}`);
  const grid = useFlip<HTMLDivElement>();

  return (
    <main className="page">
      <section className="hero">
        <h1>Save. Pick a thesis. Never lose the deposit.</h1>
        <p className="muted">
          Your deposit earns yield. The yield of each round trades the thesis on Perpl. If the thesis wins, three
          depositors share the prize: 80% · 15% · 5%.
        </p>
      </section>
      <div className="tabs">
        <button className={tab === "open" ? "active" : ""} onClick={() => setTab("open")}>Open vaults</button>
        <button className={tab === "closed" ? "active" : ""} onClick={() => setTab("closed")}>Closed vaults</button>
        <div className="terms">
          {(Object.keys(TERMS) as Term[]).map((t) => (
            <button key={t} className={`navlink ${term === t ? "active" : ""}`} onClick={() => setTerm(t)}>
              {t === "all" ? "All" : `≤ 1 ${t}`}
            </button>
          ))}
        </div>
      </div>
      {ready && shown.length === 0 && <p className="muted">No {tab} vaults right now.</p>}
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
