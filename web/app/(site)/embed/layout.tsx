import type { Metadata } from "next";

export const metadata: Metadata = { title: "Add a round to your app" };

export default function EmbedDemoLayout({ children }: { children: React.ReactNode }) {
  return children;
}
