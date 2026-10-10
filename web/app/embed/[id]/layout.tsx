import type { Metadata } from "next";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  return { title: /^\d+$/.test(id) ? `Round #${id}` : "Live round" };
}

export default function EmbedLayout({ children }: { children: React.ReactNode }) {
  return children;
}
