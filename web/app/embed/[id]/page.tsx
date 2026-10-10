"use client";

import { useParams, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import EmbedRound from "@/components/EmbedRound";

function Embed() {
  const { id } = useParams<{ id: string }>();
  const asset = useSearchParams().get("asset") ?? undefined;
  return <EmbedRound id={id} asset={asset} />;
}

/** Chromeless round card for iframes: /embed/12 or /embed/live?asset=BTC */
export default function EmbedPage() {
  return (
    <main className="embed-page">
      <Suspense>
        <Embed />
      </Suspense>
    </main>
  );
}
