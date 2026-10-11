import { ImageResponse } from "next/og";

export const alt = "Rounds: call the market, your deposit never trades.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const ACID = "#b6ff1a";

/** Default share card for every page: the name, big, and one line that says what it is. */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%", height: "100%", display: "flex", flexDirection: "column",
          background: "linear-gradient(160deg, #1c2840 0%, #0b1019 55%, #06090f 100%)", color: "#d6e4f5",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", flex: 1, flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <div style={{ display: "flex", alignItems: "flex-end", fontSize: 200, fontWeight: 800, letterSpacing: 16, color: "#f4f9ff", lineHeight: 1 }}>
            ROUNDS
            <div style={{ display: "flex", width: 44, height: 44, borderRadius: 44, background: ACID, marginLeft: 8, marginBottom: 22 }} />
          </div>
          <div style={{ display: "flex", fontSize: 42, marginTop: 40, color: "#9fb6d8" }}>
            Call the market. Your deposit never trades.
          </div>
        </div>
        <div style={{ display: "flex", height: 8, width: "100%", background: `linear-gradient(90deg, ${ACID}, #efffc2, ${ACID})` }} />
      </div>
    ),
    { ...size },
  );
}
