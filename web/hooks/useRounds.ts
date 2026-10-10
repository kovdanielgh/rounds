"use client";

import { useBlockNumber, useReadContract, useReadContracts } from "wagmi";
import { priceSourceAbi, roundsAbi } from "@/lib/abi";
import { BLOCK_SECONDS, PRICE_SOURCE, ROUNDS, leverageOf } from "@/lib/config";
import { assetLabel } from "@/lib/format";

export type RoundView = {
  id: bigint;
  asset: string;
  marketId: bigint;
  thesis: number; // 1 Bullish, 2 Bearish
  phase: number; // 1 Open, 2 Closed, 3 Drawing, 4 Settled
  thesisWon: boolean;
  start: bigint;
  entryEnd: bigint;
  end: bigint;
  pool: bigint; // budget in the vault + money in the engine position (book value)
  budget: bigint;
  borrowed: bigint; // margin in the Perpl position, 0 if none
  livePool: bigint; // pool now: estimate with current stakes (Open) or the position marked to the price (Live)
  poolLive: boolean; // livePool is an estimate that moves
  funded: bigint;
  strike: bigint;
  finalPrice: bigint;
  totalStake: bigint;
  count: number;
  leverage: number; // 0 = engine default (market cap)
  winners: readonly `0x${string}`[];
  description: string;
  rules: string;
  price?: bigint; // live on-chain price
  ended?: boolean; // the end block has passed (settle may still be pending)
};

/** Current block, refreshed about every second. */
export function useBlock() {
  return useBlockNumber({ watch: true, query: { refetchInterval: 1000 } }).data;
}

/** All rounds with phase, texts and live price. Small n, one multicall. */
export function useRounds() {
  const { data: count, isFetched: countFetched } = useReadContract({
    address: ROUNDS,
    abi: roundsAbi,
    functionName: "roundCount",
    query: { refetchInterval: 4000 },
  });
  // Economics for the live pool estimate: the same numbers the contract uses at the window close.
  const { data: econ } = useReadContracts({
    allowFailure: false,
    contracts: [
      { address: ROUNDS, abi: roundsAbi, functionName: "roundAprBps" },
      { address: ROUNDS, abi: roundsAbi, functionName: "blocksPerYear" },
      { address: ROUNDS, abi: roundsAbi, functionName: "treasury" },
    ],
    query: { refetchInterval: 15000 },
  });
  const n = Number(count ?? 0n);
  const ids = Array.from({ length: n }, (_, i) => BigInt(i + 1));

  const { data, isLoading } = useReadContracts({
    allowFailure: false,
    contracts: ids.flatMap((id) => [
      { address: ROUNDS, abi: roundsAbi, functionName: "getRound", args: [id] } as const,
      { address: ROUNDS, abi: roundsAbi, functionName: "phase", args: [id] } as const,
      { address: ROUNDS, abi: roundsAbi, functionName: "descriptionOf", args: [id] } as const,
      { address: ROUNDS, abi: roundsAbi, functionName: "rulesOf", args: [id] } as const,
    ]),
    query: { enabled: n > 0, refetchInterval: 3000 },
  });

  const base = ids.map((id, i) => {
    if (!data) return undefined;
    const r = data[i * 4] as {
      asset: `0x${string}`; marketId: bigint; thesis: number; status: number; thesisWon: boolean;
      entryEnd: bigint; end: bigint; count: number; budget: bigint; borrowed: bigint; strike: bigint;
      finalPrice: bigint; totalStake: bigint; winners: readonly `0x${string}`[]; funded: bigint; start: bigint;
      leverage: number;
    };
    return {
      id,
      asset: assetLabel(r.asset),
      marketId: r.marketId,
      thesis: r.thesis,
      phase: Number(data[i * 4 + 1]),
      thesisWon: r.thesisWon,
      start: r.start,
      entryEnd: r.entryEnd,
      end: r.end,
      pool: r.budget + r.borrowed,
      budget: r.budget,
      borrowed: r.borrowed,
      livePool: r.budget + r.borrowed,
      poolLive: false,
      funded: r.funded,
      strike: r.strike,
      finalPrice: r.finalPrice,
      totalStake: r.totalStake,
      count: r.count,
      leverage: r.leverage,
      winners: r.winners,
      description: data[i * 4 + 2] as string,
      rules: data[i * 4 + 3] as string,
    } satisfies RoundView;
  });
  const rounds = base.filter(Boolean) as RoundView[];

  // Live prices, one per distinct market.
  const markets = [...new Set(rounds.map((r) => r.marketId))];
  const { data: prices } = useReadContracts({
    allowFailure: true,
    contracts: markets.map((m) => ({ address: PRICE_SOURCE, abi: priceSourceAbi, functionName: "price", args: [m] }) as const),
    query: { enabled: markets.length > 0, refetchInterval: 3000 },
  });
  const priceOf = new Map(markets.map((m, i) => [m, prices?.[i]?.result as bigint | undefined]));

  const { data: head } = useBlockNumber({ watch: true, query: { refetchInterval: 3000 } });
  const withLive = rounds.map((r) => {
    const ended = head !== undefined && head > r.end;
    const price = priceOf.get(r.marketId);
    const live = livePoolOf({ ...r, price, ended }, econ as readonly [bigint, bigint, bigint] | undefined);
    return { ...r, price, ended, livePool: live.value, poolLive: live.moving };
  });
  // ready: we know how many rounds there are, and their data has arrived (for skeletons).
  const ready = countFetched && (n === 0 || !!data);
  return { rounds: withLive.reverse(), isLoading: !ready || (isLoading && n > 0), ready };
}

/** 0..1 progress of the current phase, from blocks. */
export function progressOf(r: RoundView, block?: bigint) {
  if (r.phase >= 3) return 1;
  if (!block) return 0;
  const [from, to] = r.phase === 1 ? [r.start, r.entryEnd] : [r.entryEnd, r.end];
  if (to <= from) return 1;
  const p = Number(block - from) / Number(to - from);
  return Math.min(1, Math.max(0, p));
}

export type Item = { kind: "single"; r: RoundView } | { kind: "mirror"; bull: RoundView; bear: RoundView };

/** Group mirror pairs: same market, same blocks, opposite thesis. Everything else stays single. */
export function groupMirrors(rounds: RoundView[]): Item[] {
  const used = new Set<bigint>();
  const items: Item[] = [];
  for (const r of rounds) {
    if (used.has(r.id)) continue;
    const twin = rounds.find(
      (o) =>
        !used.has(o.id) && o.id !== r.id && o.marketId === r.marketId && o.thesis !== r.thesis &&
        o.entryEnd === r.entryEnd && o.end === r.end,
    );
    if (twin) {
      used.add(r.id).add(twin.id);
      const [bull, bear] = r.thesis === 1 ? [r, twin] : [twin, r];
      items.push({ kind: "mirror", bull, bear });
    } else {
      used.add(r.id);
      items.push({ kind: "single", r });
    }
  }
  return items;
}

/** Card shake near the end of a phase: "" | "shake" (last 20 s) | "shake hard" (last 5 s). */
export function shakeOf(r: RoundView, block?: bigint) {
  if (!block || r.phase > 2) return "";
  const to = r.phase === 1 ? r.entryEnd : r.end;
  if (block >= to) return "";
  const left = Number(to - block) * BLOCK_SECONDS;
  return left <= 5 ? "shake hard" : left <= 20 ? "shake" : "";
}

/**
 * Prize pool now.
 * Open: the bonus plus the yield advance the current stakes will get at the window close.
 * Live with a Perpl position: margin * (1 + leverage * side * move from the strike), never below 0.
 * This is an estimate: the real fill has spread and fees. Settled: the final pool.
 */
export function livePoolOf(r: RoundView, econ?: readonly [bigint, bigint, bigint]) {
  if (r.phase === 1) {
    if (!econ || r.totalStake === 0n) return { value: r.pool, moving: false };
    const [aprBps, blocksPerYear, treasury] = econ;
    let advance = (r.totalStake * aprBps * (r.end - r.entryEnd)) / (10_000n * blocksPerYear);
    if (advance > treasury) advance = treasury;
    return { value: r.pool + advance, moving: advance > 0n };
  }
  // After the end block the price no longer counts: keep the last estimate frozen (settle will set the real pool).
  if (r.phase === 2 && r.borrowed > 0n && r.strike > 0n && r.price && !r.ended) {
    const lev = leverageOf(r.marketId, r.leverage);
    const side = r.thesis === 1 ? 1 : -1;
    const move = (Number(r.price) - Number(r.strike)) / Number(r.strike);
    const factor = Math.max(0, 1 + lev * side * move);
    const value = (r.borrowed * BigInt(Math.round(factor * 1_000_000))) / 1_000_000n + r.budget;
    return { value, moving: true };
  }
  return { value: r.pool, moving: false };
}
