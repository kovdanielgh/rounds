"use client";

import { useAccount } from "wagmi";
import { useBlock, useRounds } from "@/hooks/useRounds";
import { useSeason } from "@/hooks/useSeason";
import { RowSkeleton } from "@/components/Skeletons";
import { TEAM, TOKEN_SYMBOL } from "@/lib/config";
import { fmtToken, shortAddr } from "@/lib/format";

/** Season 0: how much money people kept safe and how much they won. Nothing else. */
export default function Season() {
  const { rounds, ready } = useRounds();
  const block = useBlock();
  const { address } = useAccount();
  const { players, totalPrizes, totalKept, biggestWin, isLoading } = useSeason(rounds, block);
  const me = address?.toLowerCase();

  return (
    <main className="page">
      <section className="hero">
        <h1>Season 0 Stats</h1>
      </section>

      <div className="panel balances">
        <dl className="stats season-stats">
          <div><dt>Kept safe</dt><dd>{fmtToken(totalKept)} {TOKEN_SYMBOL}</dd></div>
          <div><dt>Won</dt><dd>{fmtToken(totalPrizes)} {TOKEN_SYMBOL}</dd></div>
          <div><dt>Biggest win</dt><dd>{biggestWin > 0n ? `${fmtToken(biggestWin)} ${TOKEN_SYMBOL}` : "—"}</dd></div>
        </dl>
      </div>

      {(!ready || isLoading) && (
        <div className="table-wrap">
          <table className="table">
            <tbody>
              {[0, 1, 2, 3].map((i) => <RowSkeleton key={i} cols={4} />)}
            </tbody>
          </table>
        </div>
      )}
      {ready && !isLoading && players.length === 0 && <p className="muted">No players yet. Be the first: pick a round and deposit.</p>}
      {players.length > 0 && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Player</th>
                <th className="num">Kept safe</th>
                <th className="num">Won</th>
                <th className="num">Biggest win</th>
              </tr>
            </thead>
            <tbody>
              {players.map((p) => {
                const mine = p.address.toLowerCase() === me;
                const team = TEAM.includes(p.address.toLowerCase());
                return (
                  <tr key={p.address} className={mine ? "me-row" : ""}>
                    <td className="mono">
                      {shortAddr(p.address)}
                      {mine && <span className="tag small-tag">you</span>}
                      {team && <span className="tag bear small-tag">team</span>}
                    </td>
                    <td className="num">{fmtToken(p.staked)}</td>
                    <td className="num won">{p.prizes > 0n ? `+${fmtToken(p.prizes)}` : "—"}</td>
                    <td className="num">{p.best > 0n ? fmtToken(p.best) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
