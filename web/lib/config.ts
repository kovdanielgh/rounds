import { monadTestnet } from "viem/chains";

export const chain = monadTestnet;
/** Every read and write names the chain: reads must not follow the wallet when it sits on another network. */
export const CHAIN_ID = monadTestnet.id;
export const ROUNDS = process.env.NEXT_PUBLIC_ROUNDS as `0x${string}`;
export const AUSD = process.env.NEXT_PUBLIC_AUSD as `0x${string}`;
export const PRICE_SOURCE = process.env.NEXT_PUBLIC_PRICE_SOURCE as `0x${string}`;
export const ENGINE = process.env.NEXT_PUBLIC_ENGINE as `0x${string}`;
/** Our own wallets, marked "team" on the Season page (honest stats). */
export const TEAM = (process.env.NEXT_PUBLIC_TEAM ?? "0xB2979F7369DF11ac17B8B58CDEcB36b6f095E7Fe")
  .toLowerCase()
  .split(",");

export const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? "";

export const EXPLORER = "https://testnet.monadscan.com";
export const txUrl = (hash: string) => `${EXPLORER}/tx/${hash}`;
export const addressUrl = (a: string) => `${EXPLORER}/address/${a}`;

export const TOKEN_DECIMALS = 6;
export const TOKEN_SYMBOL = "USD"; // AUSD on-chain, shown as USD
export const BLOCK_SECONDS = 0.3; // measured on Monad testnet

export const THESIS = ["None", "Bulls", "Bears"] as const; // the side, as users see it
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
/** Risk in one word for cards (leverage stays in details): 10x and more is a Moonshot. */
export const riskOf = (lev: number) => (lev >= 10 ? "Moonshot" : "Steady");

export const assetMeta = (asset: string) =>
  ASSETS[asset] ?? { name: asset, glyph: asset.slice(0, 1), hue: 200, priceDecimals: 0 };
