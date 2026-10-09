import { formatUnits, hexToString } from "viem";
import { TOKEN_DECIMALS, assetMeta } from "./config";

export const fmtToken = (v: bigint | undefined, digits = 2) =>
  v === undefined ? "—" : Number(formatUnits(v, TOKEN_DECIMALS)).toLocaleString("en-US", { maximumFractionDigits: digits });

export const fmtPrice = (v: bigint | undefined, asset: string) => {
  if (!v) return "—";
  const d = assetMeta(asset).priceDecimals;
  return "$" + Number(formatUnits(v, d)).toLocaleString("en-US", { maximumFractionDigits: Math.max(2, d) });
};

export const shortAddr = (a?: string) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "");

export const assetLabel = (b32: `0x${string}`) => hexToString(b32, { size: 32 }).replace(/\0/g, "");

export const fmtDuration = (seconds: number) => {
  if (seconds <= 0) return "now";
  if (seconds < 60) return `${Math.ceil(seconds)}s`;
  if (seconds < 3600) return `${Math.ceil(seconds / 60)}m`;
  return `${(seconds / 3600).toFixed(1)}h`;
};
