import { monadTestnet } from "viem/chains";

export const chain = monadTestnet;
export const ROUNDS = process.env.NEXT_PUBLIC_ROUNDS as `0x${string}`;
export const AUSD = process.env.NEXT_PUBLIC_AUSD as `0x${string}`;
export const PRICE_SOURCE = process.env.NEXT_PUBLIC_PRICE_SOURCE as `0x${string}`;
export const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? "";

export const TOKEN_DECIMALS = 6;
export const TOKEN_SYMBOL = "AUSD";
export const BLOCK_SECONDS = 0.3; // measured on Monad testnet

export const THESIS = ["None", "Bullish", "Bearish"] as const;
export const PHASE = ["None", "Open", "Closed", "Drawing", "Settled"] as const;

/** Per-asset look and Perpl price decimals (price units = price * 10^priceDecimals). */
export const ASSETS: Record<string, { name: string; glyph: string; hue: number; priceDecimals: number }> = {
  BTC: { name: "Bitcoin", glyph: "₿", hue: 32, priceDecimals: 1 },
  ETH: { name: "Ether", glyph: "Ξ", hue: 230, priceDecimals: 2 },
  SOL: { name: "Solana", glyph: "◎", hue: 280, priceDecimals: 2 },
  MON: { name: "Monad", glyph: "M", hue: 265, priceDecimals: 5 },
  NVDA: { name: "NVIDIA", glyph: "N", hue: 95, priceDecimals: 2 },
};

export const assetMeta = (asset: string) =>
  ASSETS[asset] ?? { name: asset, glyph: asset.slice(0, 1), hue: 200, priceDecimals: 0 };
