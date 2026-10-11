import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next"
import { JetBrains_Mono, Space_Grotesk } from "next/font/google";
import Providers from "./providers";
import "./globals.css";

const sans = Space_Grotesk({ subsets: ["latin"], variable: "--font-sans" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://saverounds.vercel.app"),
  // Pages set a short title ("Round #12", "Profile"); the template adds the brand.
  title: { default: "Rounds · Call crypto up or down. Wrong? You get every dollar back.", template: "%s · Rounds" },
  description: "Call crypto up or down. Wrong? You get every dollar back. Right? You share a prize we pay for. A no-loss up/down market on Monad testnet.",
  applicationName: "Rounds",
  keywords: ["no-loss", "prediction market", "Monad", "Perpl", "Bulls or Bears", "BTC", "testnet", "AUSD"],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "Rounds",
    title: "Rounds · Call crypto up or down. Wrong? You get every dollar back.",
    description: "Right? You share a prize we pay for. Put in 50, get 50 back either way.",
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = { themeColor: "#06090f", colorScheme: "dark" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <head>
        {/* Warm up the connections the first screen needs: chain reads and login. */}
        <link rel="preconnect" href="https://testnet-rpc.monad.xyz" crossOrigin="" />
        <link rel="preconnect" href="https://auth.privy.io" crossOrigin="" />
      </head>
      <body>
        <Providers>
          {children}
        </Providers>
        <Analytics />
        <SpeedInsights/>
      </body>
    </html>
  );
}
