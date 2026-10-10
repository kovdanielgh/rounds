import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next"
import { JetBrains_Mono, Space_Grotesk } from "next/font/google";
import Header from "@/components/Header";
import Providers from "./providers";
import "./globals.css";

const sans = Space_Grotesk({ subsets: ["latin"], variable: "--font-sans" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://saverounds.vercel.app"),
  title: "Rounds",
  description: "Play the market. Keep your money. No-loss savings rounds on Monad.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body>
        <Providers>
          <Header />
          {children}
        </Providers>
        <Analytics />
        <SpeedInsights/>
      </body>
    </html>
  );
}
