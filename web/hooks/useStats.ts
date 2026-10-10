"use client";

import { useReadContracts } from "wagmi";
import { engineAbi, roundsAbi } from "@/lib/abi";
import { ENGINE, ROUNDS, leverageOf } from "@/lib/config";
import type { RoundView } from "./useRounds";

/**
 * Product stats from contract state (no event logs: the public RPC limits getLogs ranges).
 * TVL: user balances + round pools + treasury. Volume: margin * leverage of every real Perpl
 * position, twice (open and close).
 */
export function useStats(rounds: RoundView[]) {
  const { data: totals } = useReadContracts({
    allowFailure: false,
    contracts: [
      { address: ROUNDS, abi: roundsAbi, functionName: "totalBalances" },
      { address: ROUNDS, abi: roundsAbi, functionName: "reserved" },
      { address: ROUNDS, abi: roundsAbi, functionName: "treasury" },
    ],
    query: { refetchInterval: 15000 },
  });
  const traded = rounds.filter((r) => r.phase >= 2 && r.totalStake > 0n); // only these can have a position
  const { data: positions } = useReadContracts({
    allowFailure: true,
    contracts: traded.map((r) => ({ address: ENGINE, abi: engineAbi, functionName: "positions", args: [r.id] }) as const),
    query: { enabled: !!ENGINE && traded.length > 0, refetchInterval: 30000 },
  });

  const settled = rounds.filter((r) => r.phase === 4);
  const drawn = settled.filter((r) => r.thesisWon && !/^0x0+$/.test(r.winners[0]));
  let volume = 0n;
  traded.forEach((r, i) => {
    const p = positions?.[i]?.result as readonly [bigint, bigint, bigint, bigint, boolean, boolean, boolean] | undefined;
    if (!p || p[1] === 0n) return;
    const legs = p[6] ? 2n : 1n; // closed positions traded twice
    volume += p[1] * BigInt(leverageOf(r.marketId, r.leverage)) * legs;
  });

  return {
    tvl: totals ? totals[0] + totals[1] + totals[2] : undefined,
    played: settled.length,
    prizes: drawn.reduce((s, r) => s + r.pool, 0n),
    volume,
    winRate: settled.length ? Math.round((settled.filter((r) => r.thesisWon).length / settled.length) * 100) : undefined,
    ready: !!totals,
  };
}
