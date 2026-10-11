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
  title: { default: "Rounds · Call the market. Your deposit never trades.", template: "%s · Rounds" },
  description: "A no-loss prediction market on Monad. Pick up or down. Only a prize pool paid by Rounds trades on Perpl; your deposit never trades and always comes back. Testnet.",
  applicationName: "Rounds",
  keywords: ["no-loss", "prediction market", "Monad", "Perpl", "Bulls or Bears", "BTC", "testnet", "AUSD"],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "Rounds",
    title: "Rounds · Call the market. Your deposit never trades.",
    description: "Pick up or down. Only the prize pool trades. Your deposit always comes back.",
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
