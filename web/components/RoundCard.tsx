/**
 * Drop-in card for any app: one Rounds round in an iframe.
 * id: a round id, or "live" for the current open round (optionally of one asset).
 *
 *   <RoundCard id="live" asset="BTC" />
 */
export default function RoundCard({ id = "live", asset, width = 360, height = 760 }: {
  id?: number | "live"; asset?: string; width?: number; height?: number;
}) {
  const src = `https://saverounds.vercel.app/embed/${id}${asset ? `?asset=${asset}` : ""}`;
  return <iframe src={src} width={width} height={height} style={{ border: 0, borderRadius: 16 }} title="Rounds" />;
}
