"use client";

import { useEffect, useRef, useState } from "react";
import { useAccount, usePublicClient, useSwitchChain, useWriteContract } from "wagmi";
import { BaseError, ContractFunctionRevertedError } from "viem";
import { chain } from "@/lib/config";

type WriteArgs = Parameters<ReturnType<typeof useWriteContract>["writeContractAsync"]>[0];
type Step = { label: string; tx: WriteArgs };

/** Where a transaction is: waiting for the signature, on the network, or just done. */
export type TxPhase = "idle" | "confirm" | "sending" | "done";

const DONE_MS = 1800;

/** Contract errors (Rounds.sol) in plain words. Some depend on what the user tried to do. */
function revertText(name: string, fn: string): string | undefined {
  const claiming = fn === "claim";
  switch (name) {
    case "WrongPhase":
      return claiming ? "This round is not finished yet. Try again when it settles." : "Entry for this round is closed. Pick an open round.";
    case "InsufficientFree":
      return "Not enough USD for this amount. Try a smaller amount.";
    case "BadAmount":
      return "Enter an amount above 0.";
    case "NotEntered":
      return claiming ? "Nothing to claim here. It may be claimed already." : "You are not in this round.";
    case "OutsideWindow":
      return "The time for this action has passed.";
    case "TransferFailed":
      return "The USD transfer did not go through. Check your balance and try again.";
    case "EngineOpen":
      return "The round's trade is still open. Try again in a minute.";
    case "InsufficientFee":
      return "The draw fee is too low. Try again.";
    case "NotOwner":
    case "NotEntropy":
    case "BadVault":
    case "BadTimes":
    case "BadThesis":
      return "This action is not allowed.";
  }
  return undefined;
}

/** Any wallet, RPC or contract error -> one short sentence with what to do next. */
export function humanError(e: unknown, fn = ""): string {
  const parts: string[] = [];
  let revert: string | undefined;
  let code: number | undefined;
  if (e instanceof BaseError) {
    const rev = e.walk((x) => x instanceof ContractFunctionRevertedError) as ContractFunctionRevertedError | null;
    revert = rev?.data?.errorName;
    e.walk((x) => {
      const c = (x as { code?: unknown }).code;
      if (typeof c === "number" && code === undefined) code = c;
      parts.push((x as Error).name, (x as BaseError).shortMessage ?? "", (x as BaseError).details ?? "");
      return false;
    });
  } else if (e && typeof e === "object") {
    const c = (e as { code?: unknown }).code;
    if (typeof c === "number") code = c;
    parts.push((e as Error).name ?? "", (e as Error).message ?? "");
  } else {
    parts.push(String(e));
  }
  const text = parts.join(" ").toLowerCase();

  if (code === 4001 || /userrejected|user rejected|rejected the request|user denied|denied transaction|user cancel|cancelled by user|closed modal/.test(text))
    return "You cancelled. Nothing was sent.";
  const known = revert && revertText(revert, fn);
  if (known) return known;
  if (/insufficientfunds|insufficient funds|gas required exceeds|exceeds the balance of the account|insufficient balance for transfer/.test(text))
    return "You need a little MON for gas. Use Get test USD at the top.";
  if (/transfer amount exceeds balance|insufficient balance|erc20insufficientbalance/.test(text))
    return "You don't have enough USD for this amount. Use Get test USD at the top.";
  if (/switchchain|chain mismatch|unsupported chain|does not match the target chain/.test(text))
    return "Switch your wallet to Monad testnet and try again.";
  if (/timeout|timed out|took too long/.test(text))
    return "The network is slow. Check your profile in a minute before you try again.";
  if (/http request failed|fetch failed|failed to fetch|network/.test(text))
    return "Network problem. Check your connection and try again.";
  if (revert || /reverted/.test(text)) return "The transaction failed. Nothing changed. Please try again.";
  return "Something went wrong. Please try again.";
}

/**
 * Send transactions one after another on Monad testnet and wait for each receipt.
 * status: "Confirm in your wallet…" -> the step label (on the network) -> "Done ✓" for a moment.
 * run(steps) resolves true when every step landed. error is a plain sentence.
 */
export function useTx() {
  const { chainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const [lastHash, setLastHash] = useState<`0x${string}`>();
  const { writeContractAsync } = useWriteContract();
  const client = usePublicClient({ chainId: chain.id });
  const [phase, setPhase] = useState<TxPhase>("idle");
  const [status, setStatus] = useState<string>();
  const [error, setError] = useState<string>();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  async function run(steps: Step[]) {
    clearTimeout(timer.current);
    setError(undefined);
    let fn = "";
    try {
      if (chainId !== chain.id) {
        setPhase("confirm");
        setStatus("Switching network…");
        await switchChainAsync({ chainId: chain.id });
      }
      for (const [i, s] of steps.entries()) {
        fn = String((s.tx as { functionName?: string }).functionName ?? "");
        const prefix = steps.length > 1 ? `${i + 1}/${steps.length} · ` : "";
        setPhase("confirm");
        setStatus(`${prefix}Confirm in your wallet…`);
        const hash = await writeContractAsync(s.tx);
        setLastHash(hash);
        setPhase("sending");
        setStatus(`${prefix}${s.label || "Sending…"}`);
        const receipt = await client!.waitForTransactionReceipt({ hash });
        if (receipt.status === "reverted") throw new Error("Transaction reverted");
      }
      setPhase("done");
      setStatus("Done ✓");
      timer.current = setTimeout(() => {
        setPhase("idle");
        setStatus(undefined);
      }, DONE_MS);
      return true;
    } catch (e) {
      console.error("tx failed", e);
      setPhase("idle");
      setStatus(undefined);
      setError(humanError(e, fn));
      return false;
    }
  }

  const busy = phase === "confirm" || phase === "sending";
  return { run, status, error, busy, phase, lastHash };
}
