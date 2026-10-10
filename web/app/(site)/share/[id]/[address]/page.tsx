import type { Metadata } from "next";
import Link from "next/link";
import { readShare, shareText } from "@/lib/server/readShare";

type Props = { params: Promise<{ id: string; address: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id, address } = await params;
  const d = await readShare(id, address);
  const title = d ? shareText(d) : "Rounds: play the market, keep your money";
  const image = `/share/${id}/${address}/image`;
  return {
    title: { absolute: title }, // a full sentence already: no "· Rounds" suffix
    description: "Pick a side on BTC. Your money always comes back.",
    openGraph: { title, images: [{ url: image, width: 1200, height: 630 }] },
    twitter: { card: "summary_large_image", title, images: [image] },
  };
}

export default async function SharePage({ params }: Props) {
  const { id, address } = await params;
  const d = await readShare(id, address);
  return (
    <main className="page share-page">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="share-img" src={`/share/${id}/${address}/image`} alt={d ? shareText(d) : "Rounds"} width={1200} height={630} />
      <h1>{d ? shareText(d) : "Play the market. Keep your money."}</h1>
      <p className="muted">Pick a side. If you are right, three players share the prize. If not, your money comes back.</p>
      <div className="row share-actions">
        <Link href="/" className="btn">Play a round</Link>
        {d && <Link href={`/round/${d.id}`} className="btn ghost">See round #{d.id}</Link>}
      </div>
    </main>
  );
}
