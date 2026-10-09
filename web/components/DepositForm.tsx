"use client";

import { useState } from "react";
import { parseUnits } from "viem";
import { useAccount, useReadContracts } from "wagmi";
import { usePrivy } from "@privy-io/react-auth";
import { erc20Abi, roundsAbi } from "@/lib/abi";
import { AUSD, ROUNDS, TOKEN_DECIMALS, TOKEN_SYMBOL } from "@/lib/config";
import { fmtToken } from "@/lib/format";
import { useTx } from "@/hooks/useTx";

/** Deposit into a round: uses the free balance in the contract first, else approve + depositAndEnter. */
export default function DepositForm({ id }: { id: bigint }) {
  const { address } = useAccount();
  const { authenticated, login } = usePrivy();
  const [amount, setAmount] = useState("");
  const { run, status, error, busy } = useTx();

  const { data, refetch } = useReadContracts({
    allowFailure: false,
    contracts: [
      { address: AUSD, abi: erc20Abi, functionName: "balanceOf", args: [address!] },
      { address: AUSD, abi: erc20Abi, functionName: "allowance", args: [address!, ROUNDS] },
      { address: ROUNDS, abi: roundsAbi, functionName: "freeBalanceOf", args: [address!] },
    ],
    query: { enabled: !!address, refetchInterval: 5000 },
  });
  const [wallet, allowance, free] = data ?? [0n, 0n, 0n];

  if (!authenticated) return <button className="btn wide" onClick={login}>Connect to deposit</button>;

  async function submit() {
    let amt: bigint;
    try {
      amt = parseUnits(amount || "0", TOKEN_DECIMALS);
    } catch {
      return;
    }
    if (amt === 0n) return;
    const steps =
      free >= amt
        ? [{ label: "Entering…", tx: { address: ROUNDS, abi: roundsAbi, functionName: "enter", args: [id, amt] } }]
        : [
            ...(allowance < amt
              ? [{ label: "Approving…", tx: { address: AUSD, abi: erc20Abi, functionName: "approve", args: [ROUNDS, amt] } }]
              : []),
            { label: "Depositing…", tx: { address: ROUNDS, abi: roundsAbi, functionName: "depositAndEnter", args: [id, amt] } },
          ];
    if (await run(steps as Parameters<typeof run>[0])) {
      setAmount("");
      refetch();
    }
  }

  return (
    <div className="deposit">
      <div className="row">
        <input
          inputMode="decimal"
          placeholder={`Amount, ${TOKEN_SYMBOL}`}
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(",", "."))}
        />
        <button className="btn" onClick={submit} disabled={busy}>{status ?? "Deposit"}</button>
      </div>
      <div className="muted small">
        Wallet {fmtToken(wallet)} {TOKEN_SYMBOL} · Free in vaults {fmtToken(free)} {TOKEN_SYMBOL}
      </div>
      {error && <div className="error small">{error}</div>}
    </div>
  );
}
