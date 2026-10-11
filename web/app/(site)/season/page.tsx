"use client";

import { useAccount } from "wagmi";
import { useBlock, useRounds } from "@/hooks/useRounds";
import { useSeason } from "@/hooks/useSeason";
import { RowSkeleton } from "@/components/Skeletons";
import { ROUNDS, TEAM, TOKEN_SYMBOL, addressUrl } from "@/lib/config";
import { fmtToken, shortAddr } from "@/lib/format";

/** Season 0: how much money people kept safe and how much they won. Nothing else. */
export default function Season() {
  const { rounds, ready } = useRounds();
  const block = useBlock();
  const { address } = useAccount();
  const { players, isLoading } = useSeason(rounds, block);
  // Headline numbers count real players only: team wallets stay in the table, marked.
  const real = players.filter((p) => !TEAM.includes(p.address.toLowerCase()));
  const totalKept = real.reduce((s, p) => s + p.staked, 0n);
  const totalPrizes = real.reduce((s, p) => s + p.prizes, 0n);
  const biggestWin = real.reduce((m, p) => (p.best > m ? p.best : m), 0n);
  const me = address?.toLowerCase();
  const played = rounds.filter((r) => r.phase === 4 && r.count > 0).length;

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
        {/* Credible, and anyone can check it: every deposit came back, including wrong calls. */}
        <p className="proof-line">
          {played} rounds finished. Deposits lost: 0.{" "}
          <a href={addressUrl(ROUNDS)} target="_blank" rel="noopener noreferrer" className="link">Check every claim on MonadScan ↗</a>
        </p>
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
                <th className="num">Right calls</th>
                <th className="num">Kept safe</th>
                <th className="num">Won</th>
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
                    <td className="num">{p.calls > 0 ? `${p.right} of ${p.calls}` : "—"}</td>
                    <td className="num">{fmtToken(p.staked)}</td>
                    <td className="num won">{p.prizes > 0n ? `+${fmtToken(p.prizes)}` : "—"}</td>
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
