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
/** Earlier Rounds contracts. They only finish their rounds; players take their money out from the profile. */
export const PREVIOUS_ROUNDS = [
  { label: "the second version", address: envAddress("0xA04679b2A4f457d6056bd1a8Cf375618eF90715a") },
  { label: "the first version", address: envAddress("0xF265552D95De56AecdC1711966f2C17f89965bd0") },
];

/** Base yield to every depositor, a year (Rounds.baseAprBps: Aave AUSD + 0.1%). */
export const BASE_APR_BPS = 594;

/** Prize shares per place (bps), as in Rounds.prizeShares(): three large prizes, seven small ones. */
export const PRIZE_SHARES = [5000, 2000, 1000, 300, 300, 300, 300, 300, 250, 250];
/** Prizes per place for a pool: places nobody can take (fewer players) go to the 1st place. */
export function prizeSplit(pool: bigint, players: number) {
  const places = Math.max(1, Math.min(PRIZE_SHARES.length, players));
  const out = PRIZE_SHARES.slice(0, places).map((s) => (pool * BigInt(s)) / 10_000n);
  out[0] = pool - out.slice(1).reduce((a, b) => a + b, 0n);
  return out;
}
export const DISCORD_URL = "https://discord.gg/QZMqnBeKC";
/** Our own wallets, marked "team" on the Season page (honest stats). */
/** Test players we funded ourselves, always marked "team" (never counted as real users). */
const TEST_WALLETS = [
  "0xA5b8BD1b0EA6Afa0dFFA62296b776C817F743cE2",
  "0x5fb85f0C94a884A2b318334FA6CdF178C4b56f81",
  "0x91503C4f1e216f79B21eB726C9b7d521111EdBb3",
  "0xE96EE40cd0f73821c99e94fDa613988174Cdb828",
  "0x234fF607e36Cb17ED3a5EC9b821a629568c9334B",
  // Season 0 test players (13.10), also ours
  "0x516DCCbECfaff6EE6c39f1929D546Bf77b36B0B1",
  "0x7aa7868Add45040B9C839B56D648caA257506729",
  "0xd1f5850111f780B03F249212F739705EF57DAa62",
  "0x12aFAFEb736f50690b4EFD64fEe2A5cec54EA85e",
  "0x59D7D87Fa78630a448158a500C36b3C25B49461d",
  "0xD4fb4072331b9Ef9a64D129bd324ea7148602f0E",
  "0x3e9C3A2a32863E8bFE9b9d330818f319355B83A5",
  "0xe2182911789AbA353D1C00F425B0959C3168826C",
  "0x0a1C0373caA37edb315C20f13C5a22E6B2C23A40",
  "0x387DaBD0bcf3dcbA872037Ee29A8169b1C87b8ad",
  "0xE782390B2c8B853440b644C67ACa37eF9E52445f",
  "0xA7A6676F580E24C55fE147CA93b91A5C497BaDdC",
  "0xcE5dD1586352d757824080E04f8D9F80963641B6",
  "0x01d82E553A2e6eC9eb7564A4AD48E3CF50F19CCb",
  "0xc0543d2ca6d31113FA56978f9A0C096a47621D8f",
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

export const THESIS = ["None", "Up", "Down"] as const; // the side, as users see it: one word everywhere
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
/** A round that lasts about a year (one-year BTC pair). */
export const isYearLong = (r: { start: bigint; end: bigint }) => Number(r.end - r.start) * BLOCK_SECONDS > 300 * 86400;
export const MAX_RIDE_LEGS = 3;

