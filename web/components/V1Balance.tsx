"use client";

import { useAccount, useReadContract, useReadContracts } from "wagmi";
import { useTx } from "@/hooks/useTx";
import { roundsAbi } from "@/lib/abi";
import { CHAIN_ID, ROUNDS, ROUNDS_V1, TOKEN_SYMBOL } from "@/lib/config";
import { fmtToken } from "@/lib/format";

/**
 * Money left in the first Rounds contract. One button sends it to the wallet: claim of the settled
 * rounds (stake + prize + yield) or, if nothing is left to claim, a withdraw of the free balance.
 */
export default function V1Balance() {
  const { address } = useAccount();
  const { run, status, error, busy } = useTx();
  const on = !!address && !!ROUNDS_V1 && ROUNDS_V1 !== ROUNDS;
  const { data: count } = useReadContract({ chainId: CHAIN_ID, address: ROUNDS_V1, abi: roundsAbi, functionName: "roundCount", query: { enabled: on } });
  const ids = Array.from({ length: Number(count ?? 0n) }, (_, i) => BigInt(i + 1));
  const { data: base, refetch } = useReadContracts({
    allowFailure: false,
    contracts: [
      { chainId: CHAIN_ID, address: ROUNDS_V1, abi: roundsAbi, functionName: "balanceWithYield", args: [address!] },
      { chainId: CHAIN_ID, address: ROUNDS_V1, abi: roundsAbi, functionName: "freeBalanceOf", args: [address!] },
    ],
    query: { enabled: on, refetchInterval: 10000 },
  });
  const { data: rows } = useReadContracts({
    allowFailure: false,
    contracts: ids.flatMap((id) => [
      { chainId: CHAIN_ID, address: ROUNDS_V1, abi: roundsAbi, functionName: "entries", args: [id, address!] } as const,
      { chainId: CHAIN_ID, address: ROUNDS_V1, abi: roundsAbi, functionName: "phase", args: [id] } as const,
    ]),
    query: { enabled: on && ids.length > 0, refetchInterval: 10000 },
  });
  const [total, free] = base ?? [];
  if (!on || !total || total < 10_000n) return null; // nothing there (dust below 0.01)

  const claimable = ids.filter((_, i) => {
    const e = rows?.[i * 2] as readonly [number, bigint, boolean] | undefined;
    return e && e[0] !== 0 && e[1] > 0n && !e[2] && Number(rows?.[i * 2 + 1]) === 4;
  });
  const locked = total - (free ?? 0n) > 10_000n && claimable.length === 0;

  async function take() {
    const tx = claimable.length
      ? { chainId: CHAIN_ID, address: ROUNDS_V1, abi: roundsAbi, functionName: "claim", args: [claimable] }
      : { chainId: CHAIN_ID, address: ROUNDS_V1, abi: roundsAbi, functionName: "withdraw", args: [free!] };
    if (await run([{ label: "Sending to your wallet…", tx }] as Parameters<typeof run>[0])) refetch();
  }

  return (
    <div className="panel v1">
      <p className="small">
        You have <strong>{fmtToken(total)} {TOKEN_SYMBOL}</strong> in the first version of Rounds.
        {locked ? " It unlocks when your round there ends." : " Take it to your wallet:"}
      </p>
      {!locked && (
        <button className="btn small" disabled={busy} onClick={take}>{status ?? "Move to wallet"}</button>
      )}
      {error && <div className="error small">{error}</div>}
    </div>
  );
}
