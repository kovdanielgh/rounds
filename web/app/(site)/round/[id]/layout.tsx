import type { Metadata } from "next";

type Props = { params: Promise<{ id: string }> };

/** The round page is a client component: its title lives here. "Round #12 · Rounds". */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  return { title: /^\d+$/.test(id) ? `Round #${id}` : "Round" };
}

export default function RoundLayout({ children }: { children: React.ReactNode }) {
  return children;
}
