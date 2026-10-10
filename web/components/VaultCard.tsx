"use client";

import Link from "next/link";
import Art from "./Art";
import ProgressBar from "./ProgressBar";
import { progressOf, shakeOf, type RoundView } from "@/hooks/useRounds";
import { BLOCK_SECONDS, THESIS, TOKEN_SYMBOL, leverageOf } from "@/lib/config";
import { fmtDuration, fmtPrice, fmtToken } from "@/lib/format";

export function statusText(r: RoundView, block?: bigint) {
  const left = (to: bigint) => (block && to > block ? fmtDuration(Number(to - block) * BLOCK_SECONDS) : "now");
  if (r.phase === 1) return `Open · closes in ${left(r.entryEnd)}`;
  // The end block only allows settle; the round closes when the settle transaction lands.
  if (r.phase === 2) return block && block >= r.end ? "Settling…" : `Live · ends in ${left(r.end)}`;
  if (r.phase === 3) return "Drawing winners";
  return r.thesisWon ? "Settled · thesis won" : "Settled · thesis lost";
}

export default function VaultCard({ r, block }: { r: RoundView; block?: bigint }) {
  const bear = r.thesis === 2;
  return (
    <Link href={`/vault/${r.id}`} className={`card ${shakeOf(r, block)} ${r.phase === 4 ? "done" : ""}`}>
      <Art asset={r.asset} thesis={r.thesis} />
      <div className="card-body">
        <div className="card-title">
          <span className={bear ? "tag bear" : "tag"}>{THESIS[r.thesis]}</span>
          <h3>{r.asset}</h3>
          <span className="lev">{leverageOf(r.marketId, r.leverage)}x</span>
        </div>
        <div className="muted small status-line">{statusText(r, block)}</div>
        <dl className="stats">
          <div>
            <dt>Prize pool</dt>
            <dd>{fmtToken(r.pool)} {TOKEN_SYMBOL}</dd>
          </div>
          <div>
            <dt>Base APY</dt>
            <dd>~2%</dd>
          </div>
          <div className="price-row">
            <dt>{r.strike ? "Strike · Now" : "Price now"}</dt>
            <dd>{r.strike ? `${fmtPrice(r.strike, r.asset)} · ${fmtPrice(r.price, r.asset)}` : fmtPrice(r.price, r.asset)}</dd>
          </div>
        </dl>
        {r.phase === 1 && <span className="btn small">Deposit</span>}
      </div>
      <ProgressBar value={progressOf(r, block)} bearish={bear} />
    </Link>
  );
}
