/** 4 px bar along the card's bottom edge and corner arcs: crawls with the phase, shimmers left to right. */
export default function ProgressBar({ value, bearish }: { value: number; bearish?: boolean }) {
  return (
    <div className={`bar ${bearish ? "bear" : ""}`}>
      {/* the fill also covers the 4 px side borders, so width is relative to the full card width */}
      <i style={{ width: `calc((100% + 8px) * ${value.toFixed(5)})` }} />
    </div>
  );
}
