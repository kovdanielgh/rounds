import "server-only";
import { createPublicClient, formatUnits, hexToString, http, isAddress } from "viem";
import { roundsAbi } from "@/lib/abi";
import { ROUNDS, TOKEN_DECIMALS, assetMeta, chain, leverageOf } from "@/lib/config";

const client = createPublicClient({ chain, transport: http() });

export type ShareData = {
  id: string;
  address: `0x${string}`;
  asset: string;
  assetName: string;
  glyph: string;
  side: "Up" | "Down";
  leverage: number;
  stake: number;
  prize: number;
  settled: boolean;
  right: boolean; // settled and the side was right (a prize is a separate draw)
};

/** Read the round result from the contract, so a share link cannot fake the amount. */
export async function readShare(idParam: string, addressParam: string): Promise<ShareData | null> {
  if (!/^\d+$/.test(idParam) || !isAddress(addressParam)) return null;
  const id = BigInt(idParam);
  const address = addressParam as `0x${string}`;
  try {
    const [round, entry, prize, phase] = await Promise.all([
      client.readContract({ address: ROUNDS, abi: roundsAbi, functionName: "getRound", args: [id] }),
      client.readContract({ address: ROUNDS, abi: roundsAbi, functionName: "entries", args: [id, address] }),
      client.readContract({ address: ROUNDS, abi: roundsAbi, functionName: "prizeOf", args: [id, address] }),
      client.readContract({ address: ROUNDS, abi: roundsAbi, functionName: "phase", args: [id] }),
    ]);
    if (round.thesis === 0 || entry[0] === 0) return null; // no such round, or this address never entered
    const asset = hexToString(round.asset, { size: 32 }).replace(/\0/g, "");
    const meta = assetMeta(asset);
    return {
      id: idParam,
      address,
      asset,
      assetName: meta.name,
      glyph: meta.glyph,
      side: round.thesis === 1 ? "Up" : "Down",
      leverage: leverageOf(round.marketId, round.leverage),
      stake: Number(formatUnits(entry[1], TOKEN_DECIMALS)),
      prize: Number(formatUnits(prize, TOKEN_DECIMALS)),
      settled: Number(phase) === 4,
      right: Number(phase) === 4 && round.thesisWon,
    };
  } catch {
    return null;
  }
}

export const usd = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: n < 10 ? 2 : 0 });

export function shareText(d: ShareData) {
  const call = `I called ${d.asset} ${d.side.toLowerCase()}.`;
  if (d.prize > 0) return `${call} Right, and won ${usd(d.prize)} USD. My deposit never traded.`;
  if (d.right) return `${call} Right. My deposit never traded.`;
  if (d.settled) return `I was wrong about ${d.asset} and still got my ${usd(d.stake)} USD back.`;
  return `${call} My deposit never trades. Rounds.`;
}
