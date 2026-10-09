"use client";

import { useState } from "react";
import { useAccount, usePublicClient, useSwitchChain, useWriteContract } from "wagmi";
import { BaseError } from "viem";
import { chain } from "@/lib/config";

type WriteArgs = Parameters<ReturnType<typeof useWriteContract>["writeContractAsync"]>[0];

/** Send transactions one after another on Monad testnet and wait for each receipt. */
export function useTx() {
  const { chainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const client = usePublicClient({ chainId: chain.id });
  const [status, setStatus] = useState<string>();
  const [error, setError] = useState<string>();

  async function run(steps: { label: string; tx: WriteArgs }[]) {
    setError(undefined);
    try {
      if (chainId !== chain.id) await switchChainAsync({ chainId: chain.id });
      for (const s of steps) {
        setStatus(s.label);
        const hash = await writeContractAsync(s.tx);
        await client!.waitForTransactionReceipt({ hash });
      }
      setStatus(undefined);
      return true;
    } catch (e) {
      setStatus(undefined);
      setError(e instanceof BaseError ? e.shortMessage : String(e));
      return false;
    }
  }

  return { run, status, error, busy: status !== undefined };
}
