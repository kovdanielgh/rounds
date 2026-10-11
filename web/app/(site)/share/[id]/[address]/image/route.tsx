import { ImageResponse } from "next/og";
import { readShare, usd } from "@/lib/server/readShare";

const W = 1200;
const H = 630;
const ACID = "#b6ff1a";
const BEAR = "#ff2e88";

/** 1200x630 share card. The amount comes from the contract, not from the URL. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string; address: string }> }) {
  const { id, address } = await params;
  const d = await readShare(id, address);
  const bull = d?.side !== "Down";
  const color = bull ? ACID : BEAR;

  // Chart line: up for Bulls, down for Bears, ends at a dot.
  const pts: string[] = [];
  let y = bull ? 330 : 90;
  let seed = [...(d?.asset ?? "R")].reduce((a, c) => a * 31 + c.charCodeAt(0), 7) + (bull ? 1 : 2);
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  for (let i = 0; i <= 14; i++) {
    pts.push(`${20 + i * 30},${Math.round(y)}`);
    y += (bull ? -16 : 16) + (rnd() - 0.5) * 50;
    y = Math.min(360, Math.max(40, y));
  }
  const [ex, ey] = pts[pts.length - 1].split(",").map(Number);

  const headline = !d ? "Call it." : d.prize > 0 ? `I won ${usd(d.prize)} USD` : d.right ? "I called it." : "Money back.";
  const sub = !d
    ? "Keep your money."
    : d.prize > 0
      ? "and kept my deposit."
      : `${usd(d.stake)} USD back, plus yield.`;

  return new ImageResponse(
    (
      <div
        style={{
          width: W, height: H, display: "flex", flexDirection: "column", position: "relative",
          background: "linear-gradient(160deg, #1c2840 0%, #0b1019 55%, #06090f 100%)", color: "#d6e4f5",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            position: "absolute", right: -120, top: bull ? -160 : 260, width: 700, height: 700, borderRadius: 700,
            background: `radial-gradient(circle, ${color}55 0%, ${color}00 65%)`, display: "flex",
          }}
        />
        <div style={{ display: "flex", flex: 1, padding: "64px 72px 0 72px" }}>
          <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "center" }}>
            <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 28 }}>
              <div
                style={{
                  display: "flex", padding: "6px 14px", borderRadius: 10, border: `2px solid ${color}`, color,
                  fontSize: 24, fontWeight: 700, letterSpacing: 2,
                }}
              >
                {(d?.side ?? "Rounds").toUpperCase()}
              </div>
              <div style={{ display: "flex", fontSize: 30, fontWeight: 700 }}>{d ? `${d.asset} · ${d.leverage}x` : ""}</div>
            </div>
            <div style={{ display: "flex", fontSize: 92, fontWeight: 800, color: d && d.prize > 0 ? ACID : "#f4f9ff", lineHeight: 1 }}>
              {headline}
            </div>
            <div style={{ display: "flex", fontSize: 40, marginTop: 18, color: "#9fb6d8" }}>{sub}</div>
          </div>
          <div style={{ display: "flex", width: 470, alignItems: "center", justifyContent: "center" }}>
            <svg width="460" height="400" viewBox="0 0 460 400">
              <polyline points={pts.join(" ")} fill="none" stroke={color} strokeOpacity="0.25" strokeWidth="18" strokeLinejoin="round" />
              <polyline points={pts.join(" ")} fill="none" stroke={color} strokeWidth="6" strokeLinejoin="round" />
              <circle cx={ex} cy={ey} r="22" fill={color} fillOpacity="0.25" />
              <circle cx={ex} cy={ey} r="11" fill={color} />
            </svg>
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 72px 40px 72px" }}>
          <div style={{ display: "flex", fontSize: 28, letterSpacing: 6, fontWeight: 700, color: "#c9d8ec" }}>
            ROUNDS<span style={{ color: ACID }}>·</span>
          </div>
          <div style={{ display: "flex", fontSize: 26, color: "#9fb6d8" }}>Play the market. Keep your money. · saverounds.vercel.app</div>
        </div>
        <div style={{ display: "flex", height: 8, width: "100%", background: `linear-gradient(90deg, ${color}, #efffc2, ${color})` }} />
      </div>
    ),
    { width: W, height: H },
  );
}
