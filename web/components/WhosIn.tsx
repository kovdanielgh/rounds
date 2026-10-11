"use client";

import { useAccount, useReadContracts } from "wagmi";
import type { RoundView } from "@/hooks/useRounds";
import { roundsAbi } from "@/lib/abi";
import { ROUNDS, TOKEN_SYMBOL, CHAIN_ID } from "@/lib/config";
import { fmtToken, shortAddr } from "@/lib/format";

/** Players of the round, biggest stake first. After your first deposit you see yourself here. */
export default function WhosIn({ r }: { r: RoundView }) {
  const { address } = useAccount();
  const slots = Array.from({ length: r.count }, (_, i) => BigInt(i + 1));
  const { data: users } = useReadContracts({
    allowFailure: false,
    contracts: slots.map((s) => ({ chainId: CHAIN_ID, address: ROUNDS, abi: roundsAbi, functionName: "userAt", args: [r.id, s] }) as const),
    query: { enabled: r.count > 0, refetchInterval: 5000 },
  });
  const list = (users ?? []) as `0x${string}`[];
  const { data: entries } = useReadContracts({
    allowFailure: false,
    contracts: list.map((u) => ({ chainId: CHAIN_ID, address: ROUNDS, abi: roundsAbi, functionName: "entries", args: [r.id, u] }) as const),
    query: { enabled: list.length > 0, refetchInterval: 5000 },
  });
  const players = list
    .map((u, i) => ({ u, stake: (entries?.[i] as readonly [number, bigint, boolean, bigint, bigint] | undefined)?.[1] ?? 0n }))
    .filter((p) => p.stake > 0n)
    .sort((a, b) => (b.stake > a.stake ? 1 : b.stake < a.stake ? -1 : 0));
  const me = address?.toLowerCase();
  const bear = r.thesis === 2;

  if (players.length === 0) return null; // "Be the first" already sits next to the prize

  return (
    <div className="whos-in">
      <h2>Who&apos;s in · {players.length}</h2>
      <ul>
        {players.slice(0, 12).map((p) => (
          <li key={p.u} className={`${bear ? "bear" : ""} ${p.u.toLowerCase() === me ? "me" : ""}`}>
            <span className="dot" />
            <span className="mono">{p.u.toLowerCase() === me ? "you" : shortAddr(p.u)}</span>
            <span className="mono muted">{fmtToken(p.stake)} {TOKEN_SYMBOL}</span>
          </li>
        ))}
        {players.length > 12 && <li className="muted small">+{players.length - 12} more</li>}
      </ul>
    </div>
  );
}
