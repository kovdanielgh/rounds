"use client";

import { maxUint256 } from "viem";
import { useAccount, useReadContract } from "wagmi";
import type { RoundView } from "@/hooks/useRounds";
import { useTx } from "@/hooks/useTx";
import { erc20Abi, roundsAbi } from "@/lib/abi";
import { AUSD, ROUNDS, CHAIN_ID } from "@/lib/config";

/** Next open round of the same series: same asset, side and leverage. */
export function nextRoundOf(r: RoundView, rounds: RoundView[]) {
  return rounds.find((o) => o.id !== r.id && o.phase === 1 && o.asset === r.asset && o.thesis === r.thesis && o.leverage === r.leverage);
}

/**
 * "Play again": claim this round (money to the wallet) and put the same stake into the next open
 * round of the series, in one click (two transactions, no extra approval after the first time).
 */
export default function PlayAgainButton({ r, stake, rounds, small, onDone }: {
  r: RoundView; stake: bigint; rounds: RoundView[]; small?: boolean; onDone?: () => void;
}) {
  const { address } = useAccount();
  const { run, status, busy } = useTx();
  const next = nextRoundOf(r, rounds);
  const { data: allowance } = useReadContract({
    chainId: CHAIN_ID,
    address: AUSD, abi: erc20Abi, functionName: "allowance", args: [address!, ROUNDS], query: { enabled: !!address },
  });
  if (!next || !address) return null;

  async function play() {
    const ok = await run([
      { label: "Claiming…", tx: { chainId: CHAIN_ID, address: ROUNDS, abi: roundsAbi, functionName: "claim", args: [[r.id]] } },
      ...((allowance ?? 0n) < stake
        ? [{ label: "Allowing your USD, only once…", tx: { chainId: CHAIN_ID, address: AUSD, abi: erc20Abi, functionName: "approve", args: [ROUNDS, maxUint256] } }]
        : []),
      { label: "Joining next round…", tx: { chainId: CHAIN_ID, address: ROUNDS, abi: roundsAbi, functionName: "depositAndEnter", args: [next!.id, stake] } },
    ] as Parameters<typeof run>[0]);
    if (ok) onDone?.();
  }

  return (
    <button className={`btn ${small ? "small" : "wide"}`} disabled={busy} onClick={play} title={`Claim, then join round #${next.id}`}>
      {status ?? "Play again"}
    </button>
  );
}
