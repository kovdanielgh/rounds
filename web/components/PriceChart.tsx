"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { RoundView } from "@/hooks/useRounds";
import { BLOCK_SECONDS, assetMeta } from "@/lib/config";

const W = 800;
const H = 280;
const PAD = { l: 12, r: 78, t: 26, b: 28 };

/**
 * Live price over the whole life of the round (start → end, fixed axis):
 * Bulls zone above the strike (green), Bears zone below (pink), strike line, key moments.
 * Before the window closes, the dashed line shows where the strike would be now.
 */
export default function PriceChart({ r, block }: { r: RoundView; block?: bigint }) {
  const [points, setPoints] = useState<{ t: number; v: number }[]>([]);
  const nowRef = useRef(Math.floor(Date.now() / 1000));
  const scale = 10 ** assetMeta(r.asset).priceDecimals;

  // Block -> wall time, from the current block.
  const now = Math.floor(Date.now() / 1000);
  nowRef.current = now;
  const timeOf = (b: bigint) => (block ? Math.floor(now + (Number(b) - Number(block)) * BLOCK_SECONDS) : now);
  const startT = timeOf(r.start);
  const entryT = timeOf(r.entryEnd);
  const endT = timeOf(r.end);
  // Open: the whole life of the round, with a little history. Closed and later: fixed to the live phase.
  const fromT = r.phase >= 2 ? entryT : startT - Math.max(300, Math.floor((endT - startT) * 0.1));
  const res = endT - fromT <= 16 * 3600 ? 60 : endT - fromT <= 3 * 86400 ? 300 : 900;

  // Candle history (Perpl, through our proxy), refreshed every 15 s.
  useEffect(() => {
    if (!block) return;
    let alive = true;
    const load = async () => {
      const to = Math.min(endT, Math.floor(Date.now() / 1000));
      if (to <= fromT) return;
      const resp = await fetch(`/api/candles?market=${r.marketId}&res=${res}&from=${fromT * 1000}&to=${to * 1000 + 1}`);
      const { d } = (await resp.json()) as { d: { t: number; c: number }[] };
      if (alive) setPoints(d.map((c) => ({ t: c.t, v: c.c / scale })));
    };
    load();
    const id = setInterval(load, 15000);
    return () => {
      alive = false;
      clearInterval(id);
    };
    // block only gates the first load; times are stable per round
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [r.id, r.marketId, res, !!block, r.phase >= 2]);

  const live = r.finalPrice || r.price;
  const liveV = live ? Number(live) / scale : undefined;
  const strikeV = r.strike ? Number(r.strike) / scale : undefined;

  const ended = now >= endT || r.phase >= 3; // the round is over: the chart freezes at its end
  const view = useMemo(() => {
    const data = points.filter((p) => p.t <= endT);
    if (r.phase === 4 && r.finalPrice) data.push({ t: endT, v: Number(r.finalPrice) / scale }); // the settle price
    else if (liveV && !ended && (!data.length || now > data[data.length - 1].t)) data.push({ t: now, v: liveV });
    if (!data.length) return null;
    const base = strikeV ?? liveV ?? data[data.length - 1].v; // strike, or "strike if entry closed now"
    const vals = data.map((p) => p.v).concat(base);
    let lo = Math.min(...vals);
    let hi = Math.max(...vals);
    const pad = (hi - lo || hi * 0.001) * 0.18;
    lo -= pad;
    hi += pad;
    const x = (t: number) => PAD.l + ((t - fromT) / (endT - fromT)) * (W - PAD.l - PAD.r);
    const y = (v: number) => PAD.t + (1 - (v - lo) / (hi - lo)) * (H - PAD.t - PAD.b);
    const line = data.map((p) => `${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");
    const first = data[0];
    const last = data[data.length - 1];
    const by = y(base);
    const area = `${x(first.t).toFixed(1)},${by} ${line} ${x(last.t).toFixed(1)},${by}`;
    // Point on the line at the moment the strike was fixed.
    const atEntry = data.reduce((a, p) => (Math.abs(p.t - entryT) < Math.abs(a.t - entryT) ? p : a), data[0]);
    return { x, y, line, area, by, base, last, atEntry, lo, hi };
  }, [points, liveV, strikeV, r.phase, r.finalPrice, ended, now, fromT, endT, entryT, scale]);

  const hhmm = (t: number) => new Date(t * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const fmt = (v: number) => v.toLocaleString("en-US", { maximumFractionDigits: v < 1 ? 5 : 2 });

  if (!view) return <span className="skeleton" style={{ display: "block", height: 280 }} aria-hidden />;
  const { x, y, line, area, by, base, last, atEntry } = view;
  const id = `pc-${r.id}`;
  const bottom = H - PAD.b;

  return (
    <div className="price-chart">
      <svg viewBox={`0 0 ${W} ${H}`} className="price-svg" role="img" aria-label={`${r.asset} price chart`}>
        <defs>
          <clipPath id={`${id}-up`}><rect x="0" y="0" width={W} height={by} /></clipPath>
          <clipPath id={`${id}-down`}><rect x="0" y={by} width={W} height={H - by} /></clipPath>
          <linearGradient id={`${id}-gu`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--acid)" stopOpacity="0.32" />
            <stop offset="1" stopColor="var(--acid)" stopOpacity="0.02" />
          </linearGradient>
          <linearGradient id={`${id}-gd`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--bear)" stopOpacity="0.02" />
            <stop offset="1" stopColor="var(--bear)" stopOpacity="0.32" />
          </linearGradient>
        </defs>

        {/* zones */}
        <text x={PAD.l + 4} y={PAD.t + 12} className="zone-label up">BULLS ZONE</text>
        <text x={PAD.l + 4} y={bottom - 6} className="zone-label down">BEARS ZONE</text>

        {/* key moments */}
        {[
          ...(r.phase === 1 ? [{ t: entryT, label: "entry closes" }] : []),
          { t: endT, label: "round ends" },
        ].map((m) => (
          <g key={m.label}>
            <line x1={x(m.t)} x2={x(m.t)} y1={PAD.t - 8} y2={bottom} className="moment" />
            <text x={x(m.t) - 4} y={PAD.t - 12} className="moment-label" textAnchor="end">{m.label}</text>
            <text x={x(m.t)} y={H - 8} className="axis-label" textAnchor="middle">{hhmm(m.t)}</text>
          </g>
        ))}

        {/* price: filled to the strike, green above, pink below */}
        <polygon points={area} fill={`url(#${id}-gu)`} clipPath={`url(#${id}-up)`} />
        <polygon points={area} fill={`url(#${id}-gd)`} clipPath={`url(#${id}-down)`} />
        <polyline points={line} className="price-line up" clipPath={`url(#${id}-up)`} />
        <polyline points={line} className="price-line down" clipPath={`url(#${id}-down)`} />

        {/* strike */}
        <line x1={PAD.l} x2={W - PAD.r} y1={by} y2={by} className={strikeV ? "strike" : "strike pending"} />
        <rect x={W - PAD.r + 4} y={by - 11} width={PAD.r - 6} height={22} rx="5" className="strike-tag" />
        <text x={W - PAD.r + 4 + (PAD.r - 6) / 2} y={by + 4} className="strike-tag-text" textAnchor="middle">{fmt(base)}</text>
        <text x={W - PAD.r - 6} y={by - 6} className="strike-label" textAnchor="end">
          {strikeV ? "start price" : "start price if entry closed now"}
        </text>
        {strikeV && <circle cx={x(atEntry.t)} cy={by} r="5" className="strike-dot" />}

        {/* now */}
        <circle cx={x(last.t)} cy={y(last.v)} r="9" className={`now-halo ${last.v >= base ? "up" : "down"}`} />
        <circle cx={x(last.t)} cy={y(last.v)} r="4.5" className={`now-dot ${last.v >= base ? "up" : "down"}`} />
      </svg>
    </div>
  );
}

/** "BTC is 0.12% above the start price. Bulls are winning." */
export function chartCaption(r: RoundView) {
  const live = r.finalPrice || r.price;
  if (!r.strike || !live) return "The start price is set when entry closes. Until then, watch the price.";
  const diff = (Number(live) - Number(r.strike)) / Number(r.strike);
  const pct = `${Math.abs(diff * 100).toFixed(2)}%`;
  if (diff === 0) return `${r.asset} is exactly at the start price.`;
  const side = diff > 0 ? "Bulls" : "Bears";
  if (r.phase === 4) return `${r.asset} ended ${pct} ${diff > 0 ? "above" : "below"} the start price. ${side} won.`;
  return `${r.asset} is ${pct} ${diff > 0 ? "above" : "below"} the start price. ${side} are winning.`;
}
