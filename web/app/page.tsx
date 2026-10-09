"use client";

import { useState } from "react";
import VaultCard from "@/components/VaultCard";
import { useBlock, useRounds } from "@/hooks/useRounds";

export default function Home() {
  const [tab, setTab] = useState<"open" | "closed">("open");
  const { rounds, isLoading } = useRounds();
  const block = useBlock();
  const shown = rounds.filter((r) => (tab === "open" ? r.phase === 1 : r.phase > 1));

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
      </div>
      {isLoading && <p className="muted">Loading…</p>}
      {!isLoading && shown.length === 0 && <p className="muted">No {tab} vaults right now.</p>}
      <div className="grid">
        {shown.map((r) => <VaultCard key={r.id.toString()} r={r} block={block} />)}
      </div>
    </main>
  );
}
