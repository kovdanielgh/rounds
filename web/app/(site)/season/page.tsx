"use client";

import { useAccount } from "wagmi";
import { useBlock, useRounds } from "@/hooks/useRounds";
import { useSeason } from "@/hooks/useSeason";
import { RowSkeleton } from "@/components/Skeletons";
import { TEAM, TOKEN_SYMBOL } from "@/lib/config";
import { fmtToken, shortAddr } from "@/lib/format";

export default function Season() {
  const { rounds, ready } = useRounds();
  const block = useBlock();
  const { address } = useAccount();
  const { players, totalPrizes, totalRounds, isLoading } = useSeason(rounds, block);
  const me = address?.toLowerCase();

  return (
    <main className="page">
      <section className="hero">
        <h1>Season 0</h1>
        <p className="muted">Testnet. Real people, test money. Play rounds, win prizes, keep your deposit.</p>
      </section>

      <div className="panel balances">
        <dl className="stats season-stats">
          <div><dt>Players</dt><dd>{players.length}</dd></div>
          <div><dt>Rounds finished</dt><dd>{totalRounds}</dd></div>
          <div><dt>Prizes won</dt><dd>{fmtToken(totalPrizes)} {TOKEN_SYMBOL}</dd></div>
        </dl>
      </div>

      {(!ready || isLoading) && (
        <div className="table-wrap">
          <table className="table">
            <tbody>
              {[0, 1, 2, 3].map((i) => <RowSkeleton key={i} cols={6} />)}
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
                <th className="num">#</th>
                <th>Player</th>
                <th className="num">Rounds</th>
                <th className="num">Wins</th>
                <th className="num">Prizes won</th>
                <th className="num">Streak</th>
              </tr>
            </thead>
            <tbody>
              {players.map((p, i) => {
                const mine = p.address.toLowerCase() === me;
                const team = TEAM.includes(p.address.toLowerCase());
                return (
                  <tr key={p.address} className={mine ? "me-row" : ""}>
                    <td className="num muted">{i + 1}</td>
                    <td className="mono">
                      {shortAddr(p.address)}
                      {mine && <span className="tag small-tag">you</span>}
                      {team && <span className="tag bear small-tag">team</span>}
                    </td>
                    <td className="num">{p.rounds}</td>
                    <td className="num">{p.wins}</td>
                    <td className="num won">{p.prizes > 0n ? `+${fmtToken(p.prizes)}` : "—"}</td>
                    <td className="num">{p.streak > 0 ? `${p.streak} 🔥` : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="muted small">Streak: days in a row with at least one round. Team wallets are marked and test the product.</p>
    </main>
  );
}
