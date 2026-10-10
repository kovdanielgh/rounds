"use client";

import { useParams } from "next/navigation";
import { useAccount, useReadContracts } from "wagmi";
import Art from "@/components/Art";
import DepositForm from "@/components/DepositForm";
import ProgressBar from "@/components/ProgressBar";
import ShareButton from "@/components/ShareButton";
import { statusText } from "@/components/VaultCard";
import { progressOf, useBlock, useRounds } from "@/hooks/useRounds";
import { useTx } from "@/hooks/useTx";
import { roundsAbi } from "@/lib/abi";
import { ROUNDS, THESIS, TOKEN_SYMBOL, leverageOf } from "@/lib/config";
import { fmtPrice, fmtToken, shortAddr } from "@/lib/format";

const SHARES = [8000n, 1500n, 500n];

export default function VaultPage() {
  const { id: idParam } = useParams<{ id: string }>();
  const id = BigInt(idParam);
  const { rounds } = useRounds();
  const block = useBlock();
  const { address } = useAccount();
  const { run, status, error, busy } = useTx();
  const r = rounds.find((x) => x.id === id);

  const { data: mine, refetch } = useReadContracts({
    allowFailure: false,
    contracts: [
      { address: ROUNDS, abi: roundsAbi, functionName: "entries", args: [id, address!] },
      { address: ROUNDS, abi: roundsAbi, functionName: "prizeOf", args: [id, address!] },
    ],
    query: { enabled: !!address, refetchInterval: 3000 },
  });
  const [, stake, claimed] = (mine?.[0] as readonly [number, bigint, boolean, bigint, bigint]) ?? [0, 0n, false];
  const prize = (mine?.[1] as bigint) ?? 0n;

  if (!r) return <main className="page"><p className="muted">Loading vault #{idParam}…</p></main>;
  const bear = r.thesis === 2;
  const chance = r.totalStake > 0n && stake > 0n ? Number((stake * 10000n) / r.totalStake) / 100 : 0;

  return (
    <main className="page vault">
      <div className="vault-head card static">
        <Art asset={r.asset} thesis={r.thesis} />
        <ProgressBar value={progressOf(r, block)} bearish={bear} />
      </div>

      <div className="vault-grid">
        <section>
          <div className="card-title">
            <span className={bear ? "tag bear" : "tag"}>{THESIS[r.thesis]}</span>
            <h1>{r.asset} · Vault #{r.id.toString()}</h1>
          </div>
          <p className="muted">{statusText(r, block)}</p>
          <h2>Description</h2>
          <p>{r.description || "—"}</p>
          <h2>Rules</h2>
          <p>{r.rules || "—"}</p>
          <p className="muted small">
            Your deposit is never at risk: only the round budget trades. Stakes are locked from the moment the entry
            window closes until the round settles.
          </p>
        </section>

        <aside className="panel">
          <h2>Profits</h2>
          <dl className="stats col">
            <div><dt>Prize pool</dt><dd>{fmtToken(r.pool)} {TOKEN_SYMBOL}</dd></div>
            {SHARES.map((s, i) => (
              <div key={i}>
                <dt>{["1st", "2nd", "3rd"][i]} place</dt>
                <dd>{fmtToken((r.pool * s) / 10000n)} {TOKEN_SYMBOL}</dd>
              </div>
            ))}
            <div><dt>Base APY (everyone)</dt><dd>~2%</dd></div>
            <div><dt>Leverage on Perpl</dt><dd>{leverageOf(r.marketId, r.leverage)}x</dd></div>
            <div><dt>Total staked</dt><dd>{fmtToken(r.totalStake)} {TOKEN_SYMBOL}</dd></div>
            <div><dt>Strike</dt><dd>{fmtPrice(r.strike, r.asset)}</dd></div>
            <div><dt>{r.finalPrice ? "Final price" : "Price now"}</dt><dd>{fmtPrice(r.finalPrice || r.price, r.asset)}</dd></div>
            {stake > 0n && <div><dt>Your stake · chance</dt><dd>{fmtToken(stake)} · {chance}%</dd></div>}
          </dl>

          {r.phase === 1 && <DepositForm id={r.id} />}

          {r.phase === 1 && stake > 0n && (
            <button
              className="btn ghost wide"
              disabled={busy}
              onClick={async () => {
                await run([{ label: "Exiting…", tx: { address: ROUNDS, abi: roundsAbi, functionName: "exitRound", args: [id] } }]);
                refetch();
              }}
            >
              {status ?? "Exit vault"}
            </button>
          )}

          {r.phase === 4 && stake > 0n && !claimed && (
            <button
              className="btn wide"
              disabled={busy}
              onClick={async () => {
                await run([{ label: "Claiming…", tx: { address: ROUNDS, abi: roundsAbi, functionName: "claim", args: [[id]] } }]);
                refetch();
              }}
            >
              {status ?? (prize > 0n ? `Claim ${fmtToken(stake + prize)} ${TOKEN_SYMBOL}` : `Claim ${fmtToken(stake)} ${TOKEN_SYMBOL}`)}
            </button>
          )}
          {claimed && <p className="muted small">Claimed to your wallet{prize > 0n ? `, prize +${fmtToken(prize)} ${TOKEN_SYMBOL}` : ""}.</p>}
          {r.phase === 4 && stake > 0n && (
            <div className="share-row">
              <ShareButton
                id={r.id}
                text={
                  prize > 0n
                    ? `I won ${fmtToken(prize)} USD on Rounds and kept my deposit.`
                    : `I played ${THESIS[r.thesis]} ${r.asset} on Rounds and kept my ${fmtToken(stake)} USD deposit.`
                }
              />
            </div>
          )}
          {error && <div className="error small">{error}</div>}

          {r.phase === 4 && r.winners[0] !== "0x0000000000000000000000000000000000000000" && (
            <>
              <h2>Winners</h2>
              <ol className="winners">
                {r.winners.filter((w) => !/^0x0+$/.test(w)).map((w) => (
                  <li key={w} className={w === address ? "me" : ""}>{shortAddr(w)}</li>
                ))}
              </ol>
            </>
          )}
        </aside>
      </div>
    </main>
  );
}
