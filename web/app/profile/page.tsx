"use client";

import { useState } from "react";
import { parseUnits } from "viem";
import { usePrivy } from "@privy-io/react-auth";
import { useAccount, useReadContracts } from "wagmi";
import VaultCard from "@/components/VaultCard";
import { useBlock, useRounds } from "@/hooks/useRounds";
import { useTx } from "@/hooks/useTx";
import { erc20Abi, roundsAbi } from "@/lib/abi";
import { AUSD, ROUNDS, TOKEN_DECIMALS, TOKEN_SYMBOL } from "@/lib/config";
import { fmtToken, shortAddr } from "@/lib/format";

export default function Profile() {
  const { authenticated, login } = usePrivy();
  const { address } = useAccount();
  const { rounds } = useRounds();
  const block = useBlock();
  const { run, status, error, busy } = useTx();
  const [amount, setAmount] = useState("");

  const { data: bal } = useReadContracts({
    allowFailure: false,
    contracts: [
      { address: AUSD, abi: erc20Abi, functionName: "balanceOf", args: [address!] },
      { address: ROUNDS, abi: roundsAbi, functionName: "balanceWithYield", args: [address!] },
      { address: ROUNDS, abi: roundsAbi, functionName: "freeBalanceOf", args: [address!] },
    ],
    query: { enabled: !!address, refetchInterval: 4000 },
  });
  const { data: entries } = useReadContracts({
    allowFailure: false,
    contracts: rounds.map((r) => ({ address: ROUNDS, abi: roundsAbi, functionName: "entries", args: [r.id, address!] }) as const),
    query: { enabled: !!address && rounds.length > 0, refetchInterval: 4000 },
  });

  if (!authenticated)
    return (
      <main className="page">
        <h1>Profile</h1>
        <button className="btn" onClick={login}>Connect</button>
      </main>
    );

  const [wallet, balance, free] = bal ?? [];
  // Entered at least once (slot index > 0): shows active and finished vaults.
  const mine = rounds.filter((_, i) => (entries?.[i]?.[0] ?? 0) > 0);

  async function withdraw() {
    const amt = parseUnits(amount || "0", TOKEN_DECIMALS);
    if (amt === 0n) return;
    if (await run([{ label: "Withdrawing…", tx: { address: ROUNDS, abi: roundsAbi, functionName: "withdraw", args: [amt] } }]))
      setAmount("");
  }

  return (
    <main className="page">
      <h1>Profile <span className="muted small mono">{shortAddr(address)}</span></h1>
      <div className="panel balances">
        <dl className="stats">
          <div><dt>In vaults (with yield)</dt><dd>{fmtToken(balance, 4)} {TOKEN_SYMBOL}</dd></div>
          <div><dt>Free to withdraw</dt><dd>{fmtToken(free, 4)} {TOKEN_SYMBOL}</dd></div>
          <div><dt>Wallet</dt><dd>{fmtToken(wallet)} {TOKEN_SYMBOL}</dd></div>
        </dl>
        <div className="row">
          <input inputMode="decimal" placeholder={`Amount, ${TOKEN_SYMBOL}`} value={amount} onChange={(e) => setAmount(e.target.value.replace(",", "."))} />
          <button className="btn ghost" onClick={() => free !== undefined && setAmount((Number(free) / 10 ** TOKEN_DECIMALS).toString())}>Max</button>
          <button className="btn" onClick={withdraw} disabled={busy}>{status ?? "Withdraw"}</button>
        </div>
        {error && <div className="error small">{error}</div>}
      </div>

      <h2>My vaults</h2>
      {mine.length === 0 && <p className="muted">You are not in any vault yet.</p>}
      <div className="grid">
        {mine.map((r) => <VaultCard key={r.id.toString()} r={r} block={block} />)}
      </div>
    </main>
  );
}
