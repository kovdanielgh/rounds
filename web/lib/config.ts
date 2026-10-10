import { monadTestnet } from "viem/chains";

export const chain = monadTestnet;
export const ROUNDS = process.env.NEXT_PUBLIC_ROUNDS as `0x${string}`;
export const AUSD = process.env.NEXT_PUBLIC_AUSD as `0x${string}`;
export const PRICE_SOURCE = process.env.NEXT_PUBLIC_PRICE_SOURCE as `0x${string}`;
/** Our own wallets, marked "team" on the Season page (honest stats). */
export const TEAM = (process.env.NEXT_PUBLIC_TEAM ?? "0xB2979F7369DF11ac17B8B58CDEcB36b6f095E7Fe")
  .toLowerCase()
  .split(",");

export const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? "";

export const TOKEN_DECIMALS = 6;
export const TOKEN_SYMBOL = "USD"; // AUSD on-chain, shown as USD
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

/** Engine leverage caps per market id (PerplEngine.setLeverage). Round leverage 0 = the cap. */
export const LEVERAGE_CAP: Record<string, number> = { "16": 15, "32": 12, "48": 10, "64": 3 };
export const leverageOf = (marketId: bigint, leverage: number) => leverage || LEVERAGE_CAP[marketId.toString()] || 0;

export const assetMeta = (asset: string) =>
  ASSETS[asset] ?? { name: asset, glyph: asset.slice(0, 1), hue: 200, priceDecimals: 0 };
