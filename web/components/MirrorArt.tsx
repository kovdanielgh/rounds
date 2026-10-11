import { assetMeta } from "@/lib/config";

/** Art for a Bullish/Bearish pair: one logo, the bull line rises into the middle and the bear line
 *  continues from the same point down to the right, so the two charts meet and read as one. */
export default function MirrorArt({ asset, wide }: { asset: string; wide?: boolean }) {
  const meta = assetMeta(asset);
  const id = `mirror-${asset}`;
  const W = wide ? 1400 : 800; // wide: the same height on a full-row card, so the pair is lower, not cropped
  const H = 220;
  const peak: [number, number] = [W / 2, 58];

  let seed = [...asset].reduce((a, c) => a * 31 + c.charCodeAt(0), 11);
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  // Walk from an edge to the peak; the right side is built the same way and mirrored.
  const walk = (fromX: number) => {
    const pts: [number, number][] = [];
    const steps = 16;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = fromX + (peak[0] - fromX) * t;
      const base = 196 + (peak[1] - 196) * t;
      const noise = i === 0 || i === steps ? 0 : (rnd() - 0.5) * 38 * (1 - t * 0.6);
      pts.push([x, Math.min(208, Math.max(30, base + noise))]);
    }
    return pts;
  };
  const left = walk(0);
  const right = walk(W).reverse(); // from the peak down to the right edge
  const toStr = (p: [number, number][]) => p.map((q) => q.join(",")).join(" ");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="art" preserveAspectRatio="xMidYMid slice" role="img" aria-label={`${meta.name}: up or down`}>
      <defs>
        <linearGradient id={`bg-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#1c2840" />
          <stop offset="1" stopColor="#090d16" />
        </linearGradient>
        <radialGradient id={`gl-${id}`} cx="0.1" cy="0.2" r="0.6">
          <stop offset="0" stopColor="var(--acid)" stopOpacity="0.28" />
          <stop offset="1" stopColor="var(--acid)" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`gr-${id}`} cx="0.9" cy="0.9" r="0.6">
          <stop offset="0" stopColor="var(--bear)" stopOpacity="0.28" />
          <stop offset="1" stopColor="var(--bear)" stopOpacity="0" />
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
      <rect width={W} height={H} fill={`url(#bg-${id})`} />
      <rect width={W} height={H} fill={`url(#gl-${id})`} />
      <rect width={W} height={H} fill={`url(#gr-${id})`} />
      {[44, 88, 132, 176].map((gy) => (
        <line key={gy} x1="0" x2={W} y1={gy} y2={gy} stroke="#9fb6d8" strokeOpacity="0.06" />
      ))}

      <circle cx={W / 2} cy="150" r="52" fill={`hsl(${meta.hue} 70% 55% / 0.12)`} stroke={`hsl(${meta.hue} 70% 65% / 0.35)`} />
      <text x={W / 2} y="178" textAnchor="middle" fontSize="80" fontWeight="700" fill={`url(#chrome-${id})`}>
        {meta.glyph}
      </text>

      <polyline className="glow" points={toStr(left)} fill="none" stroke="var(--acid)" strokeWidth="6" opacity="0.6" filter={`url(#blur-${id})`} />
      <polyline className="glow" points={toStr(right)} fill="none" stroke="var(--bear)" strokeWidth="6" opacity="0.6" filter={`url(#blur-${id})`} />
      <polyline points={toStr(left)} fill="none" stroke="var(--acid)" strokeWidth="2.5" strokeLinejoin="round" />
      <polyline points={toStr(right)} fill="none" stroke="var(--bear)" strokeWidth="2.5" strokeLinejoin="round" />
      <circle cx={peak[0]} cy={peak[1]} r="6" fill="#f4f9ff" />
      <circle cx={peak[0]} cy={peak[1]} r="11" fill="none" stroke="#f4f9ff" strokeOpacity="0.35" />

      <text x="20" y="30" fontSize="13" fill="var(--acid)" fontFamily="var(--font-mono)" letterSpacing="2">UP</text>
      <text x={W - 20} y="30" fontSize="13" fill="var(--bear)" fontFamily="var(--font-mono)" letterSpacing="2" textAnchor="end">
        DOWN
      </text>
      <text x={W / 2} y="30" fontSize="13" fill="#9fb6d8" fontFamily="var(--font-mono)" letterSpacing="2" textAnchor="middle">
        {meta.name.toUpperCase()}
      </text>
    </svg>
  );
}
