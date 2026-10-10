"use client";

import Link from "next/link";
import MirrorArt from "./MirrorArt";
import Pool from "./Pool";
import { statusText } from "./VaultCard";
import { progressOf, shakeOf, type RoundView } from "@/hooks/useRounds";
import { TOKEN_SYMBOL, leverageOf, riskOf } from "@/lib/config";
import { fmtPrice, fmtToken } from "@/lib/format";

function Side({ r, label }: { r: RoundView; label: string }) {
  const bear = r.thesis === 2;
  return (
    <div className={`side ${bear ? "bear" : ""}`}>
      <dl className="stats col">
        <div><dt>Prize pool</dt><dd><Pool r={r} /></dd></div>
        <div><dt>Staked</dt><dd>{fmtToken(r.totalStake)} {TOKEN_SYMBOL}</dd></div>
      </dl>
      <Link href={`/round/${r.id}`} className={`btn small ${bear ? "bear" : ""}`}>
        {r.phase === 1 ? `Go ${label}` : label}
      </Link>
    </div>
  );
}

/** One card for a Bullish/Bearish pair on the same market and blocks. The bar grows from the middle. */
export default function MirrorCard({ bull, bear, block }: { bull: RoundView; bear: RoundView; block?: bigint }) {
  const p = progressOf(bull, block);
  return (
    <div className={`card mirror ${shakeOf(bull, block)} ${bull.phase === 4 && bear.phase === 4 ? "done" : ""}`}>
      <div className="mirror-art">
        <MirrorArt asset={bull.asset} />
        {/* left half opens the bull side, right half the bear side */}
        <Link href={`/round/${bull.id}`} className="half-link left" aria-label={`Bulls · ${bull.asset}`} />
        <Link href={`/round/${bear.id}`} className="half-link right" aria-label={`Bears · ${bear.asset}`} />
      </div>
      <div className="card-body">
        <div className="card-title">
          <span className="tag">Bulls</span>
          <h3>{bull.asset}</h3>
          <span className="tag bear">Bears</span>
          <span className="lev" title={`${leverageOf(bull.marketId, bull.leverage)}x on Perpl`}>{riskOf(leverageOf(bull.marketId, bull.leverage))}</span>
        </div>
        <div className="muted small status-line">{statusText(bull, block)}</div>
        <div className="muted small status-line mono">
          Price now {fmtPrice(bull.price, bull.asset)}
        </div>
        <div className="sides">
          <Side r={bull} label="Bulls" />
          <Side r={bear} label="Bears" />
        </div>
      </div>
      <div className="bar half left"><i style={{ width: `calc((100% + 4px) * ${p.toFixed(5)})` }} /></div>
      <div className="bar half right bear"><i style={{ width: `calc((100% + 4px) * ${p.toFixed(5)})` }} /></div>
    </div>
  );
}
