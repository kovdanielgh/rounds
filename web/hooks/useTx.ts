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
  if (/insufficientfunds|insufficient funds|gas required exceeds|exceeds the balance of the account|insufficient balance for transfer|signer had insufficient balance/.test(text))
    return "You need a little MON for gas. Use Get test USD at the top.";
  if (/erc20insufficientallowance|insufficient allowance|exceeds allowance/.test(text))
    return "USD is not enabled for Rounds yet. Try again: the first deposit asks for it once.";
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
  const { chainId, address } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const [lastHash, setLastHash] = useState<`0x${string}`>();
  const { writeContractAsync } = useWriteContract();
  const client = usePublicClient({ chainId: chain.id });
  const [phase, setPhase] = useState<TxPhase>("idle");
  const [status, setStatus] = useState<string>();
  const [error, setError] = useState<string>();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  /**
   * Gas and a legacy gas price, estimated by us. Mobile wallets (MetaMask Mobile, WalletConnect) often
   * reject EIP-1559 fee fields on a custom network with "Missing or invalid parameters". If our estimate
   * fails, the wallet estimates as before.
   */
  async function feeFields(tx: WriteArgs) {
    if (!client || !address) return {};
    const t = tx as unknown as { address: `0x${string}`; abi: readonly unknown[]; functionName: string; args?: readonly unknown[]; value?: bigint };
    const call = { address: t.address, abi: t.abi as never, functionName: t.functionName as never, args: t.args as never, value: t.value, account: address };
    // 1. Dry run: if the call would revert, show the real reason here instead of a wallet's vague
    //    "Missing or invalid parameters". This throw goes to humanError().
    await client.simulateContract(call);
    // 2. Our own gas and a legacy gas price: mobile wallets often reject EIP-1559 fields on a custom network.
    let fields: { type: "legacy"; gas: bigint; gasPrice: bigint };
    try {
      const [gas, gasPrice] = await Promise.all([client.estimateContractGas(call), client.getGasPrice()]);
      fields = { type: "legacy", gas: (gas * 115n) / 100n, gasPrice }; // Monad charges the gas limit: small buffer
    } catch {
      return {};
    }
    // 3. Not enough MON for gas: say it here, before the wallet shows "Signer had insufficient balance".
    const mon = await client.getBalance({ address });
    if (mon < fields.gas * fields.gasPrice + (t.value ?? 0n)) throw new Error("insufficient funds for gas");
    return fields;
  }


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
        const send = async () => writeContractAsync({ ...s.tx, ...(await feeFields(s.tx)) } as WriteArgs);
        let hash: `0x${string}`;
        try {
          hash = await send();
        } catch (e) {
          // Monad checks the balance a few blocks back: MON that just came from the faucet is not
          // seen yet. Our own check (feeFields) passed, so wait a moment and try once more.
          if (!/signer had insufficient balance/i.test(String((e as Error)?.message ?? e))) throw e;
          await new Promise((r) => setTimeout(r, 2500));
          hash = await send();
        }
        setLastHash(hash);
        setPhase("sending");
        setStatus(`${prefix}${s.label || "Sending…"}`);
        const receipt = await client!.waitForTransactionReceipt({ hash });
        if (receipt.status === "reverted") throw new Error("Transaction reverted");
      }
      // A deposit (not an approve) landed: the feedback window counts it (components/Feedback.tsx).
      if (steps.some((s) => ["depositAndEnter", "enter"].includes(String((s.tx as { functionName?: string }).functionName))))
        window.dispatchEvent(new CustomEvent("rounds:deposit", { detail: address }));
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
