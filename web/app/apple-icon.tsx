import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** Home-screen icon: "R·" on the dark chrome, the dot in acid green (same as the logo). */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center",
          background: "linear-gradient(160deg, #1a2436 0%, #06090f 100%)",
          color: "#e6f0ff", fontSize: 120, fontWeight: 800, fontFamily: "monospace",
        }}
      >
        R
        <div style={{ display: "flex", width: 22, height: 22, borderRadius: 22, background: "#b6ff1a", marginLeft: 10, marginTop: 30 }} />
      </div>
    ),
    { ...size },
  );
}
