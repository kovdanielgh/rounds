import { ImageResponse } from "next/og";

export const alt = "Rounds: play the market, keep your money.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const ACID = "#b6ff1a";
const BEAR = "#ff2e88";

/** Default share card for every page (same style as the per-result card in /share). */
export default function OpengraphImage() {
  // Two mirrored lines: Bulls up, Bears down, both end at a dot.
  const up = "20,330 60,300 100,310 140,260 180,270 220,220 260,230 300,170 340,180 380,120 420,90";
  const down = "20,80 60,110 100,100 140,150 180,140 220,190 260,180 300,240 340,230 380,290 420,320";
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%", height: "100%", display: "flex", flexDirection: "column", position: "relative",
          background: "linear-gradient(160deg, #1c2840 0%, #0b1019 55%, #06090f 100%)", color: "#d6e4f5",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", flex: 1, padding: "64px 72px 0 72px" }}>
          <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "center" }}>
            <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 32 }}>
              <div style={{ display: "flex", padding: "6px 14px", borderRadius: 10, border: `2px solid ${ACID}`, color: ACID, fontSize: 24, fontWeight: 700, letterSpacing: 2 }}>
                BULLS
              </div>
              <div style={{ display: "flex", padding: "6px 14px", borderRadius: 10, border: `2px solid ${BEAR}`, color: BEAR, fontSize: 24, fontWeight: 700, letterSpacing: 2 }}>
                BEARS
              </div>
            </div>
            <div style={{ display: "flex", fontSize: 84, fontWeight: 800, color: "#f4f9ff", lineHeight: 1 }}>Play the market.</div>
            <div style={{ display: "flex", fontSize: 84, fontWeight: 800, color: ACID, lineHeight: 1, marginTop: 8 }}>Keep your money.</div>
            <div style={{ display: "flex", fontSize: 34, marginTop: 28, color: "#9fb6d8" }}>Pick a side. Your money comes back.</div>
          </div>
          <div style={{ display: "flex", width: 260, alignItems: "center", justifyContent: "center" }}>
            <svg width="260" height="350" viewBox="0 0 460 400">
              <polyline points={down} fill="none" stroke={BEAR} strokeOpacity="0.5" strokeWidth="6" strokeLinejoin="round" />
              <circle cx="420" cy="320" r="10" fill={BEAR} />
              <polyline points={up} fill="none" stroke={ACID} strokeOpacity="0.25" strokeWidth="18" strokeLinejoin="round" />
              <polyline points={up} fill="none" stroke={ACID} strokeWidth="6" strokeLinejoin="round" />
              <circle cx="420" cy="90" r="22" fill={ACID} fillOpacity="0.25" />
              <circle cx="420" cy="90" r="11" fill={ACID} />
            </svg>
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 72px 40px 72px" }}>
          <div style={{ display: "flex", fontSize: 28, letterSpacing: 6, fontWeight: 700, color: "#c9d8ec" }}>
            ROUNDS<span style={{ color: ACID }}>·</span>
          </div>
          <div style={{ display: "flex", fontSize: 26, color: "#9fb6d8" }}>Testnet · Monad · saverounds.vercel.app</div>
        </div>
        <div style={{ display: "flex", height: 8, width: "100%", background: `linear-gradient(90deg, ${ACID}, #efffc2, ${ACID})` }} />
      </div>
    ),
    { ...size },
  );
}
