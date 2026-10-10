import type { Metadata } from "next";

export const metadata: Metadata = { title: "Season 0" };

export default function SeasonLayout({ children }: { children: React.ReactNode }) {
  return children;
}
