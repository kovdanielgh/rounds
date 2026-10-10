/** Shimmering placeholders: the layout appears at once, data fills it in. */
export function Line({ w = "100%", h = 14 }: { w?: string | number; h?: number }) {
  return <span className="skeleton" style={{ width: w, height: h }} />;
}

export function CardSkeleton() {
  return (
    <div className="card static skeleton-card" aria-hidden>
      <span className="skeleton skeleton-art" />
      <div className="card-body">
        <Line w="45%" h={22} />
        <Line w="60%" />
        <div className="skeleton-grid">
          <Line w="70%" />
          <Line w="50%" />
        </div>
        <Line w="35%" h={30} />
      </div>
    </div>
  );
}

export function RowSkeleton({ cols }: { cols: number }) {
  return (
    <tr aria-hidden>
      {Array.from({ length: cols }, (_, i) => (
        <td key={i}>
          <Line w={i === 0 ? "80%" : "60%"} />
        </td>
      ))}
    </tr>
  );
}
