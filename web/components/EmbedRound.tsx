"use client";

import Art from "./Art";
import DepositForm from "./DepositForm";
import MirrorArt from "./MirrorArt";
import Pool from "./Pool";
import { CardSkeleton } from "./Skeletons";
import ProgressBar from "./ProgressBar";
import { statusText } from "./VaultCard";
import { progressOf, useBlock, useRounds } from "@/hooks/useRounds";
import { THESIS, TOKEN_SYMBOL, leverageOf, riskOf } from "@/lib/config";
import { fmtPrice, fmtToken } from "@/lib/format";

/** One round, compact, for an iframe inside another app. id: round id or "live". */
export default function EmbedRound({ id, asset }: { id: string; asset?: string }) {
  const { rounds, isLoading } = useRounds();
  const block = useBlock();
  const r =
    id === "live"
      ? rounds.find((x) => x.phase === 1 && (!asset || x.asset === asset.toUpperCase()))
      : rounds.find((x) => x.id.toString() === id);

  if (!r && isLoading) return <CardSkeleton />;
  if (!r) {
    return (
      <div className="embed card static">
        <div className="card-body">
          <p className="muted">{isLoading || rounds.length === 0 ? "Loading round…" : "No open round right now."}</p>
        </div>
      </div>
    );
  }
  const bear = r.thesis === 2;
  const twin = rounds.find(
    (o) => o.id !== r.id && o.marketId === r.marketId && o.entryEnd === r.entryEnd && o.end === r.end && o.thesis !== r.thesis,
  );

  return (
    <div className="embed card static">
      {twin ? <MirrorArt asset={r.asset} /> : <Art asset={r.asset} thesis={r.thesis} />}
      <div className="card-body">
        <div className="card-title">
          <span className={bear ? "tag bear" : "tag"}>{THESIS[r.thesis]}</span>
          <h3>{r.asset}</h3>
          <span className="lev" title={`${leverageOf(r.marketId, r.leverage)}x on Perpl`}>{riskOf(leverageOf(r.marketId, r.leverage))}</span>
        </div>
        <div className="muted small status-line">{statusText(r, block)}</div>
        <p className="embed-desc">{r.description}</p>
        <dl className="stats">
          <div><dt>Prize pool</dt><dd><Pool r={r} /></dd></div>
          <div><dt>Price now</dt><dd>{fmtPrice(r.price, r.asset)}</dd></div>
        </dl>
        {r.phase === 1 ? <DepositForm id={r.id} /> : <p className="muted small">Entry is closed. The next round opens soon.</p>}
        <p className="embed-promise">Your money always comes back.</p>
        <a className="embed-powered" href={`https://saverounds.vercel.app/vault/${r.id}`} target="_blank" rel="noreferrer">
          Powered by ROUNDS<span>·</span>
        </a>
      </div>
      <ProgressBar value={progressOf(r, block)} bearish={bear} />
    </div>
  );
}
