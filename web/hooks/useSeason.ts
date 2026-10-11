"use client";

import { useReadContracts } from "wagmi";
import { roundsAbi } from "@/lib/abi";
import { BLOCK_SECONDS, ROUNDS, CHAIN_ID } from "@/lib/config";
import type { RoundView } from "./useRounds";

export type Player = {
  address: `0x${string}`;
  rounds: number;
  wins: number;
  prizes: bigint;
  best: bigint; // biggest single prize
  staked: bigint; // money put into rounds, all of it came back or will
  streak: number; // days in a row (UTC) with at least one round, up to today or yesterday
  lastDay: number;
};

const DAY = 86_400;

/**
 * Season table from contract state (no event logs: the public RPC limits getLogs ranges).
 * Step 1: participants of every round (userAt). Step 2: their entries and prizes.
 */
export function useSeason(rounds: RoundView[], block?: bigint) {
  const slots = rounds.flatMap((r) => Array.from({ length: r.count }, (_, i) => ({ r, slot: BigInt(i + 1) })));

  const { data: users } = useReadContracts({
    allowFailure: false,
    contracts: slots.map(({ r, slot }) => ({ chainId: CHAIN_ID, address: ROUNDS, abi: roundsAbi, functionName: "userAt", args: [r.id, slot] }) as const),
    query: { enabled: slots.length > 0, refetchInterval: 15000 },
  });

  const pairs = users ? slots.map((s, i) => ({ r: s.r, user: users[i] as `0x${string}` })) : [];
  const { data: info, isLoading } = useReadContracts({
    allowFailure: false,
    contracts: pairs.flatMap(({ r, user }) => [
      { chainId: CHAIN_ID, address: ROUNDS, abi: roundsAbi, functionName: "entries", args: [r.id, user] } as const,
      { chainId: CHAIN_ID, address: ROUNDS, abi: roundsAbi, functionName: "prizeOf", args: [r.id, user] } as const,
    ]),
    query: { enabled: pairs.length > 0, refetchInterval: 15000 },
  });

  // Day of a round = day of its entry window close, estimated from blocks.
  const now = Math.floor(Date.now() / 1000);
  const dayOf = (r: RoundView) => {
    const ago = block && block > r.entryEnd ? Number(block - r.entryEnd) * BLOCK_SECONDS : 0;
    return Math.floor((now - ago) / DAY);
  };

  const byUser = new Map<string, Player & { days: Set<number> }>();
  if (info) {
    pairs.forEach(({ r, user }, i) => {
      const [, stake] = info[i * 2] as readonly [number, bigint, boolean, bigint, bigint];
      const prize = info[i * 2 + 1] as bigint;
      if (stake === 0n) return; // exited before the window closed
      const p = byUser.get(user) ?? {
        address: user, rounds: 0, wins: 0, prizes: 0n, best: 0n, staked: 0n, streak: 0, lastDay: 0, days: new Set<number>(),
      };
      p.rounds += 1;
      p.staked += stake;
      if (prize > 0n) {
        p.wins += 1;
        p.prizes += prize;
        if (prize > p.best) p.best = prize;
      }
      p.days.add(dayOf(r));
      byUser.set(user, p);
    });
  }

  const today = Math.floor(now / DAY);
  const players: Player[] = [...byUser.values()].map(({ days, ...p }) => {
    let d = days.has(today) ? today : today - 1;
    let streak = 0;
    while (days.has(d)) {
      streak += 1;
      d -= 1;
    }
    return { ...p, streak, lastDay: Math.max(...days) };
  });
  // Most kept safe first: the mission is to keep and grow people's money, not to rank luck.
  players.sort((a, b) => (b.staked > a.staked ? 1 : b.staked < a.staked ? -1 : b.prizes > a.prizes ? 1 : b.prizes < a.prizes ? -1 : 0));

  return {
    players,
    totalPrizes: players.reduce((s, p) => s + p.prizes, 0n),
    totalKept: players.reduce((s, p) => s + p.staked, 0n),
    biggestWin: players.reduce((m, p) => (p.best > m ? p.best : m), 0n),
    isLoading: isLoading && pairs.length > 0,
  };
}
