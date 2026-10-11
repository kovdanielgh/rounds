import { getAddress } from "viem";
import { monadTestnet } from "viem/chains";

export const chain = monadTestnet;
/** Every read and write names the chain: reads must not follow the wallet when it sits on another network. */
export const CHAIN_ID = monadTestnet.id;
/**
 * Address from an env var, cleaned: a copy-paste with spaces or a trailing dot must not break the site.
 * Keeps "0x" + 40 hex characters and fixes the checksum.
 */
function envAddress(v: string | undefined) {
  const m = (v ?? "").match(/0x[0-9a-fA-F]{40}/);
  return (m ? getAddress(m[0]) : undefined) as `0x${string}`;
}

// NEXT_PUBLIC_* must be read with the full literal name, so Next can inline them at build time.
export const ROUNDS = envAddress(process.env.NEXT_PUBLIC_ROUNDS);
export const AUSD = envAddress(process.env.NEXT_PUBLIC_AUSD);
export const PRICE_SOURCE = envAddress(process.env.NEXT_PUBLIC_PRICE_SOURCE);
export const ENGINE = envAddress(process.env.NEXT_PUBLIC_ENGINE);
/** The first Rounds contract (before rollover). Players can still take their money out of it. */
export const ROUNDS_V1 = envAddress(process.env.NEXT_PUBLIC_ROUNDS_V1 || "0xF265552D95De56AecdC1711966f2C17f89965bd0");
export const DISCORD_URL = "https://discord.gg/QZMqnBeKC";
/** Our own wallets, marked "team" on the Season page (honest stats). */
/** Test players we funded ourselves (one-year BTC rounds #38/#39), always marked "team". */
const TEST_WALLETS = [
  "0xA5b8BD1b0EA6Afa0dFFA62296b776C817F743cE2",
  "0x5fb85f0C94a884A2b318334FA6CdF178C4b56f81",
  "0x91503C4f1e216f79B21eB726C9b7d521111EdBb3",
  "0xE96EE40cd0f73821c99e94fDa613988174Cdb828",
  "0x234fF607e36Cb17ED3a5EC9b821a629568c9334B",
];
export const TEAM = [...(process.env.NEXT_PUBLIC_TEAM ?? "0xB2979F7369DF11ac17B8B58CDEcB36b6f095E7Fe").split(","), ...TEST_WALLETS].map((a) =>
  a.trim().toLowerCase(),
);
/** A round asks for more leverage than the market allows: the engine refuses on purpose, the prize never trades. */
export const isFixedPrize = (marketId: bigint, leverage: number) => leverage > (LEVERAGE_CAP[marketId.toString()] ?? 0);

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
  ZEC: { name: "Zcash", glyph: "ⓩ", hue: 45, priceDecimals: 3 },
  NVDA: { name: "NVIDIA", glyph: "N", hue: 95, priceDecimals: 2 },
};

/** Engine leverage caps per market id (PerplEngine.setLeverage). Round leverage 0 = the cap. */
export const LEVERAGE_CAP: Record<string, number> = { "16": 15, "32": 12, "48": 10, "64": 3, "256": 5 };
export const leverageOf = (marketId: bigint, leverage: number) => leverage || LEVERAGE_CAP[marketId.toString()] || 0;

export const assetMeta = (asset: string) =>
  ASSETS[asset] ?? { name: asset, glyph: asset.slice(0, 1), hue: 200, priceDecimals: 0 };

/** "Round of the day": the series that always ends at the same UTC time (scheduler: endAtUtc). */
export const isRoundOfDay = (description: string) => description.startsWith("Round of the day");

/** Jackpot rounds: long rounds with a big prize that grows when nobody wins (scheduler: jackpot). */
export const isJackpot = (description: string) => description.startsWith("Jackpot");
/** Rollover series: a won pool moves into the next round, drawn after MAX_RIDE_LEGS pools in a row. */
export const isRollover = (description: string) => description.startsWith("Rollover");
export const MAX_RIDE_LEGS = 3;

