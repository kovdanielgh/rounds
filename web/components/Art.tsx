import { assetMeta } from "@/lib/config";

/** Procedural card art: one picture per asset + thesis (Bullish BTC differs from Bullish NVDA). */
export default function Art({ asset, thesis, wide }: { asset: string; thesis: number; wide?: boolean }) {
  const W = wide ? 800 : 400; // wide: the round page header
  const meta = assetMeta(asset);
  const bull = thesis === 1;
  const color = bull ? "var(--acid)" : "var(--bear)";
  const id = `${asset}-${thesis}${wide ? "-w" : ""}`;

  // Deterministic random walk from the asset name, trending with the thesis.
  let seed = [...asset].reduce((a, c) => a * 31 + c.charCodeAt(0), 7) + thesis * 101;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  const pts: [number, number][] = [];
  let y = bull ? 190 : 70;
  const steps = wide ? 28 : 14;
  const x0 = wide ? 230 : 150;
  const dx = (W - 20 - x0) / steps;
  for (let i = 0; i <= steps; i++) {
    pts.push([x0 + i * dx, y]);
    y += ((bull ? -9 : 9) + (rnd() - 0.5) * 34) * (wide ? 0.5 : 1);
    y = Math.min(210, Math.max(40, y));
  }
  const line = pts.map((p) => p.join(",")).join(" ");
  const [ex, ey] = pts[pts.length - 1];

  return (
    <svg viewBox={`0 0 ${W} 220`} className="art" preserveAspectRatio="xMidYMid slice" role="img" aria-label={`${bull ? "Bulls" : "Bears"} · ${meta.name}`}>
      <defs>
        <linearGradient id={`bg-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#1c2840" />
          <stop offset="1" stopColor="#090d16" />
        </linearGradient>
        <radialGradient id={`glow-${id}`} cx={bull ? "0.85" : "0.85"} cy={bull ? "0.15" : "0.9"} r="0.7">
          <stop offset="0" stopColor={color} stopOpacity="0.35" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`chrome-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f4f9ff" />
          <stop offset="0.5" stopColor="#7f97b8" />
          <stop offset="0.55" stopColor="#c9d8ec" />
          <stop offset="1" stopColor="#5d7394" />
        </linearGradient>
        <filter id={`blur-${id}`}>
          <feGaussianBlur stdDeviation="6" />
        </filter>
      </defs>
      <rect width={W} height="220" fill={`url(#bg-${id})`} />
      <rect width={W} height="220" fill={`url(#glow-${id})`} />
      {[44, 88, 132, 176].map((gy) => (
        <line key={gy} x1="0" x2={W} y1={gy} y2={gy} stroke="#9fb6d8" strokeOpacity="0.06" />
      ))}
      <circle cx="90" cy="112" r="64" fill={`hsl(${meta.hue} 70% 55% / 0.12)`} stroke={`hsl(${meta.hue} 70% 65% / 0.35)`} />
      <text x="90" y="146" textAnchor="middle" fontSize="96" fontWeight="700" fill={`url(#chrome-${id})`}>
        {meta.glyph}
      </text>
      <polyline points={line} fill="none" stroke={color} strokeWidth="6" opacity="0.6" filter={`url(#blur-${id})`} />
      <polyline points={line} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" />
      <circle cx={ex} cy={ey} r="5" fill={color} />
      <text x="20" y="30" fontSize="13" fill="#9fb6d8" fontFamily="var(--font-mono)" letterSpacing="2">
        {meta.name.toUpperCase()}
      </text>
    </svg>
  );
}
