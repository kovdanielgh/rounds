"use client";

import { useState } from "react";
import Link from "next/link";
import { usePrivy } from "@privy-io/react-auth";
import { useAccount, useReadContracts } from "wagmi";
import ShareButton from "@/components/ShareButton";
import { Line, RowSkeleton } from "@/components/Skeletons";
import { statusText } from "@/components/VaultCard";
import { useBlock, useRounds, type RoundView } from "@/hooks/useRounds";
import { useTx } from "@/hooks/useTx";
import { erc20Abi, roundsAbi } from "@/lib/abi";
import { AUSD, ROUNDS, THESIS, TOKEN_SYMBOL } from "@/lib/config";
import { fmtToken, fmtYield, shortAddr } from "@/lib/format";

type Row = { r: RoundView; stake: bigint; claimed: boolean; prize: bigint; earned: bigint };

/** Profit of the row: prize (if any) plus the base yield of the stake and prize. Deposit is never lost. */
function Result({ x, me }: { x: Row; me?: string }) {
  const place = x.r.winners.findIndex((w) => w.toLowerCase() === me?.toLowerCase());
  if (x.prize > 0n)
    return (
      <span className="won">
        +{fmtToken(x.prize + x.earned)} {TOKEN_SYMBOL} · {["1st", "2nd", "3rd"][place] ?? "won"}
      </span>
    );
  return (
    <span className="yield">
      <span className="muted">{x.r.phase < 4 ? "Yield so far" : "Deposit safe"} · </span>+{fmtYield(x.earned)}
    </span>
  );
}

export default function Profile() {
  const { authenticated, login } = usePrivy();
  const { address } = useAccount();
  const { rounds, ready } = useRounds();
  const block = useBlock();
  const { run, status, error, busy } = useTx();
  const [tab, setTab] = useState<"active" | "history">("active");
  const [rowBusy, setRowBusy] = useState<bigint>(); // round id, or -1n for "claim all"

  const { data: bal } = useReadContracts({
    allowFailure: false,
    contracts: [
      { address: AUSD, abi: erc20Abi, functionName: "balanceOf", args: [address!] },
      { address: ROUNDS, abi: roundsAbi, functionName: "balanceWithYield", args: [address!] },
    ],
    query: { enabled: !!address, refetchInterval: 4000 },
  });
  const { data: entries, refetch: refetchEntries } = useReadContracts({
    allowFailure: false,
    contracts: rounds.map((r) => ({ address: ROUNDS, abi: roundsAbi, functionName: "entries", args: [r.id, address!] }) as const),
    query: { enabled: !!address && rounds.length > 0, refetchInterval: 4000 },
  });
  const { data: prizes, refetch: refetchPrizes } = useReadContracts({
    allowFailure: false,
    contracts: rounds.map((r) => ({ address: ROUNDS, abi: roundsAbi, functionName: "prizeOf", args: [r.id, address!] }) as const),
    query: { enabled: !!address && rounds.length > 0, refetchInterval: 4000 },
  });
  const { data: earned } = useReadContracts({
    allowFailure: false,
    contracts: rounds.map((r) => ({ address: ROUNDS, abi: roundsAbi, functionName: "earnedOf", args: [r.id, address!] }) as const),
    query: { enabled: !!address && rounds.length > 0, refetchInterval: 4000 },
  });

  if (!authenticated)
    return (
      <main className="page">
        <h1>Profile</h1>
        <button className="btn" onClick={login}>Connect</button>
      </main>
    );

  const [wallet, balance] = bal ?? []; // wagmi keeps the last good value if a refetch fails
  const rows: Row[] = rounds.flatMap((r, i) => {
    const e = entries?.[i];
    if (!e || e[0] === 0) return []; // never entered
    return [{ r, stake: e[1], claimed: e[2], prize: prizes?.[i] ?? 0n, earned: earned?.[i] ?? 0n }];
  });
  const active = rows.filter((x) => x.stake > 0n && !x.claimed);
  const history = rows.filter((x) => x.claimed || x.stake === 0n);
  const claimable = active.filter((x) => x.r.phase === 4);
  const shown = tab === "active" ? active : history;

  async function act(target: Row[], kind: "claim" | "exit") {
    setRowBusy(target.length === 1 ? target[0].r.id : -1n);
    // Claim is one transaction for any number of rounds; stake + prize + yield go to the wallet.
    await run(
      (kind === "claim"
        ? [{ label: "Claiming…", tx: { address: ROUNDS, abi: roundsAbi, functionName: "claim", args: [target.map((x) => x.r.id)] } }]
        : [{ label: "Exiting…", tx: { address: ROUNDS, abi: roundsAbi, functionName: "exitRound", args: [target[0].r.id] } }]
      ) as Parameters<typeof run>[0],
    );
    setRowBusy(undefined);
    refetchEntries();
    refetchPrizes();
  }

  return (
    <main className="page">
      <h1>
        Profile <span className="muted small mono">{shortAddr(address)}</span>
      </h1>
      <div className="panel balances">
        <dl className="stats">
          <div><dt>In vaults (stakes, prizes, yield)</dt><dd>{balance === undefined ? <Line w={110} /> : `${fmtToken(balance, 4)} ${TOKEN_SYMBOL}`}</dd></div>
          <div><dt>Wallet</dt><dd>{wallet === undefined ? <Line w={110} /> : `${fmtToken(wallet)} ${TOKEN_SYMBOL}`}</dd></div>
        </dl>
        {error && <div className="error small">{error}</div>}
      </div>

      <div className="tabs">
        <button className={tab === "active" ? "active" : ""} onClick={() => setTab("active")}>
          Active{active.length ? ` · ${active.length}` : ""}
        </button>
        <button className={tab === "history" ? "active" : ""} onClick={() => setTab("history")}>History</button>
        {tab === "active" && claimable.length > 1 && (
          <button className="btn small claim-all" disabled={busy} onClick={() => act(claimable, "claim")}>
            {rowBusy === -1n && status ? status : `Claim all · ${claimable.length}`}
          </button>
        )}
      </div>

      {!ready || (rounds.length > 0 && (!entries || !prizes)) ? (
        <div className="table-wrap">
          <table className="table">
            <tbody>
              {[0, 1, 2].map((i) => <RowSkeleton key={i} cols={6} />)}
            </tbody>
          </table>
        </div>
      ) : shown.length === 0 ? (
        <p className="muted">{tab === "active" ? "You are not in any vault right now." : "No history yet."}</p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Vault</th>
                <th>Status</th>
                <th className="num">Stake</th>
                <th className="num">Pool</th>
                <th>Result</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {shown.map((x) => (
                <tr key={x.r.id.toString()}>
                  <td>
                    <Link href={`/vault/${x.r.id}`} className="vault-cell">
                      <span className={x.r.thesis === 2 ? "tag bear" : "tag"}>{THESIS[x.r.thesis]}</span>
                      {x.r.asset} <span className="muted">#{x.r.id.toString()}</span>
                    </Link>
                  </td>
                  <td className="muted">{x.stake === 0n && !x.claimed ? "Exited" : statusText(x.r, block)}</td>
                  <td className="num">{x.stake === 0n ? "—" : fmtToken(x.stake)}</td>
                  <td className="num">{fmtToken(x.r.pool)}</td>
                  <td><Result x={x} me={address} /></td>
                  <td className="action">
                    {x.r.phase === 4 && !x.claimed && x.stake > 0n && (
                      <button className="btn small" disabled={busy} onClick={() => act([x], "claim")}>
                        {rowBusy === x.r.id && status ? status : `Claim ${fmtToken(x.stake + x.prize)}`}
                      </button>
                    )}
                    {x.prize > 0n && (x.claimed || x.r.phase === 4) && (
                      <ShareButton small id={x.r.id} text={`I won ${fmtToken(x.prize)} USD on Rounds and kept my deposit.`} />
                    )}
                    {x.r.phase === 1 && x.stake > 0n && (
                      <button className="btn small ghost" disabled={busy} onClick={() => act([x], "exit")}>
                        {rowBusy === x.r.id && status ? status : "Exit"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
