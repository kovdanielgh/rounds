"use client";

import { useState } from "react";
import Link from "next/link";
import { maxUint256, parseUnits } from "viem";
import { useAccount, useReadContracts } from "wagmi";
import { usePrivy } from "@privy-io/react-auth";
import { erc20Abi, roundsAbi } from "@/lib/abi";
import { AUSD, ROUNDS, TOKEN_DECIMALS, TOKEN_SYMBOL, CHAIN_ID, txUrl } from "@/lib/config";
import { fmtToken } from "@/lib/format";
import { useBlock, useRounds } from "@/hooks/useRounds";
import { useTx } from "@/hooks/useTx";

const PRESETS = [10, 50, 100];
const ONE = 10n ** BigInt(TOKEN_DECIMALS);

/**
 * Deposit into a round in one click: pick 10 / 50 / 100 (or type), press Deposit.
 * Uses the free balance in the contract first, else approve (once) + depositAndEnter.
 * Covers every state on the way: logged out, wallet being created, no test USD yet,
 * entry closed while the form is open, and "You're in" after the deposit.
 */
export default function DepositForm({ id }: { id: bigint }) {
  const { address } = useAccount();
  const { ready, authenticated, login } = usePrivy();
  const [amount, setAmount] = useState<string | null>(null); // null: use the suggested amount
  const [justIn, setJustIn] = useState(false);
  const { run, status, error, busy, lastHash } = useTx();
  const { rounds } = useRounds();
  const block = useBlock();
  const r = rounds.find((x) => x.id === id);

  const { data, refetch } = useReadContracts({
    allowFailure: true, // one failing read must not hide the others
    contracts: [
      { chainId: CHAIN_ID, address: AUSD, abi: erc20Abi, functionName: "balanceOf", args: [address!] },
      { chainId: CHAIN_ID, address: AUSD, abi: erc20Abi, functionName: "allowance", args: [address!, ROUNDS] },
      { chainId: CHAIN_ID, address: ROUNDS, abi: roundsAbi, functionName: "freeBalanceOf", args: [address!] },
      { chainId: CHAIN_ID, address: ROUNDS, abi: roundsAbi, functionName: "entries", args: [id, address!] },
    ],
    query: { enabled: !!address, refetchInterval: 5000 },
  });
  const loaded = data?.[0]?.status === "success";
  const wallet = (data?.[0]?.result as bigint | undefined) ?? 0n;
  const allowance = (data?.[1]?.result as bigint | undefined) ?? 0n;
  const free = (data?.[2]?.result as bigint | undefined) ?? 0n;
  const entry = data?.[3]?.result;
  const stake = (entry as readonly [number, bigint, boolean, bigint, bigint] | undefined)?.[1] ?? 0n;
  const side = r?.thesis === 2 ? "Bears" : "Bulls";

  // The window closes by block, a few seconds before the phase read catches up: trust the block.
  const closed = !!r && (r.phase !== 1 || (block !== undefined && block > r.entryEnd));

  if (!ready) return <button className="btn wide" disabled>Loading…</button>;
  if (!authenticated)
    return (
      <div className="deposit">
        <button className="btn wide" onClick={login}>Log in to play</button>
        <p className="muted small deposit-note">Log in with email. Free test USD arrives by itself.</p>
        <div className="promise-line small">Your money always comes back.</div>
      </div>
    );

  // Deposit uses either the free balance in Rounds or the wallet, never both at once.
  const max = wallet > free ? wallet : free;
  const suggested = !loaded || max >= 100n * ONE ? "100" : max >= ONE ? String(max / ONE) : "";
  const value = amount ?? suggested;
  let amt = 0n;
  try {
    amt = parseUnits(value || "0", TOKEN_DECIMALS);
  } catch {
    amt = 0n;
  }
  const empty = loaded && max < ONE; // the faucet sends test USD by itself to such a wallet
  const tooMuch = loaded && amt > max;

  const youreIn = stake > 0n && (
    <div className={`youre-in ${r?.thesis === 2 ? "bear" : ""} ${justIn ? "fresh" : ""}`} role="status">
      <strong>You&apos;re in ✓</strong>
      <span>
        {fmtToken(stake)} {TOKEN_SYMBOL} on {side}. Your money comes back when the round ends.
      </span>
      {lastHash && (
        <a className="tx-link small" href={txUrl(lastHash)} target="_blank" rel="noreferrer">View transaction ↗</a>
      )}
    </div>
  );

  if (closed)
    return (
      <div className="deposit">
        {youreIn}
        {!stake && (
          <p className="deposit-closed">
            Entry for this round is closed. <Link href="/">See open rounds →</Link>
          </p>
        )}
      </div>
    );

  if (!address)
    return (
      <div className="deposit">
        <button className="btn wide" disabled>Setting up your wallet…</button>
      </div>
    );

  async function submit() {
    if (amt === 0n || tooMuch) return;
    const steps =
      free >= amt
        ? [{ label: "Entering…", tx: { chainId: CHAIN_ID, address: ROUNDS, abi: roundsAbi, functionName: "enter", args: [id, amt] } }]
        : [
            // One-time permission for USD: every later deposit is a single signature.
            ...(allowance < amt
              ? [{ label: "Enabling USD (once)…", tx: { chainId: CHAIN_ID, address: AUSD, abi: erc20Abi, functionName: "approve", args: [ROUNDS, maxUint256] } }]
              : []),
            { label: "Depositing…", tx: { chainId: CHAIN_ID, address: ROUNDS, abi: roundsAbi, functionName: "depositAndEnter", args: [id, amt] } },
          ];
    if (await run(steps as Parameters<typeof run>[0])) {
      setAmount(null);
      setJustIn(true);
      refetch();
      // Ask once, so the result can reach the player when the tab is in the background.
      if (typeof Notification !== "undefined" && Notification.permission === "default") Notification.requestPermission();
    }
  }

  const label = status ?? (amt > 0n ? `${stake > 0n ? "Add" : "Deposit"} ${fmtToken(amt)} ${TOKEN_SYMBOL}` : "Deposit");

  return (
    <div className="deposit">
      {youreIn}
      {empty ? (
        <div className="deposit-wait" role="status">
          <strong>Test USD is on the way…</strong>
          <span className="muted small">
            It arrives by itself in a few seconds. Nothing after a minute? Use Get test USD at the top.
          </span>
        </div>
      ) : (
        <>
          <div className="presets" role="group" aria-label="Amount">
            {PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                className={value === String(p) ? "active" : ""}
                disabled={busy || (loaded && BigInt(p) * ONE > max)}
                onClick={() => setAmount(String(p))}
              >
                {p}
              </button>
            ))}
            <input
              inputMode="decimal"
              aria-label={`Amount, ${TOKEN_SYMBOL}`}
              placeholder={`Amount, ${TOKEN_SYMBOL}`}
              value={value}
              disabled={busy}
              onChange={(e) => setAmount(e.target.value.replace(",", "."))}
            />
          </div>
          <button className="btn wide" onClick={submit} disabled={busy || amt === 0n || tooMuch} /* not blocked while the balance loads: the wallet checks it too */>
            {label}
          </button>
        </>
      )}
      <div className="muted small">
        {tooMuch
          ? `You have ${fmtToken(max)} ${TOKEN_SYMBOL}. Try a smaller amount.`
          : `Wallet ${loaded ? fmtToken(wallet) : "…"} ${TOKEN_SYMBOL}${free > 0n ? ` · ${fmtToken(free)} ${TOKEN_SYMBOL} unused in Rounds` : ""}`}
      </div>
      <div className="promise-line small">Your money always comes back.</div>
      {error && <div className="error small" role="alert">{error}</div>}
    </div>
  );
}
