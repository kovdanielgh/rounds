"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAccount, useReadContracts } from "wagmi";
import { useRounds } from "@/hooks/useRounds";
import { roundsAbi } from "@/lib/abi";
import { ROUNDS, THESIS, TOKEN_SYMBOL, CHAIN_ID } from "@/lib/config";
import { fmtToken } from "@/lib/format";

const load = (k: string): string[] => {
  try {
    return JSON.parse(localStorage.getItem(k) ?? "[]");
  } catch {
    return [];
  }
};
const save = (k: string, v: string[]) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {
    // storage blocked: toasts just come back next visit
  }
};

/** The result finds the player: a toast on the site, and a browser notification if the tab is hidden. */
export default function ResultToasts() {
  const { address } = useAccount();
  const { rounds } = useRounds();
  const settled = rounds.filter((r) => r.phase === 4 && r.count > 0);
  const { data } = useReadContracts({
    allowFailure: false,
    contracts: settled.flatMap((r) => [
      { chainId: CHAIN_ID, address: ROUNDS, abi: roundsAbi, functionName: "entries", args: [r.id, address!] } as const,
      { chainId: CHAIN_ID, address: ROUNDS, abi: roundsAbi, functionName: "prizeOf", args: [r.id, address!] } as const,
    ]),
    query: { enabled: !!address && settled.length > 0, refetchInterval: 10000 },
  });
  const seenKey = `rounds-seen-${address}`;
  const [seen, setSeen] = useState<string[]>([]);
  useEffect(() => setSeen(address ? load(seenKey) : []), [address, seenKey]);

  const results = settled.flatMap((r, i) => {
    const e = data?.[i * 2] as readonly [number, bigint, boolean, bigint, bigint] | undefined;
    const prize = (data?.[i * 2 + 1] as bigint | undefined) ?? 0n;
    if (!e || e[1] === 0n || e[2] || seen.includes(r.id.toString())) return [];
    return [{ r, stake: e[1], prize }];
  });

  // The feedback window asks after the 1st and the 5th result, not after a deposit: by then the
  // player has seen what happens to the money (components/Feedback.tsx). Once per round.
  useEffect(() => {
    if (!address || !results.length) return;
    const askedKey = `rounds-results-${address}`;
    const asked = load(askedKey);
    const fresh = results.map(({ r }) => r.id.toString()).filter((id) => !asked.includes(id));
    if (!fresh.length) return;
    save(askedKey, [...asked, ...fresh]);
    window.dispatchEvent(new CustomEvent("rounds:result", { detail: address }));
  }, [address, results]);

  // Browser notification once per round, only when the tab is in the background.
  useEffect(() => {
    if (!address || typeof Notification === "undefined" || Notification.permission !== "granted" || !document.hidden) return;
    const notifiedKey = `rounds-notified-${address}`;
    const notified = load(notifiedKey);
    for (const { r, stake, prize } of results) {
      const id = r.id.toString();
      if (notified.includes(id)) continue;
      new Notification(prize > 0n ? `You won ${fmtToken(prize)} USD` : `Your ${fmtToken(stake)} USD is back`, {
        body: `${r.asset} ${THESIS[r.thesis].toLowerCase()} · Round #${id}. Open Rounds to claim.`,
      });
      notified.push(id);
    }
    save(notifiedKey, notified);
  }, [address, results]);

  if (!results.length) return null;
  const dismiss = (id: bigint) => {
    const next = [...seen, id.toString()];
    setSeen(next);
    save(seenKey, next);
  };

  return (
    <div className="toasts">
      {results.slice(0, 3).map(({ r, stake, prize }) => (
        <div key={r.id.toString()} className={`toast ${prize > 0n ? "won" : ""}`}>
          <div>
            <strong>
              {prize > 0n
                ? `You won ${fmtToken(prize)} ${TOKEN_SYMBOL} 🎉`
                : r.thesisWon
                  ? "Your call was right"
                  : `Your ${fmtToken(stake)} ${TOKEN_SYMBOL} is back`}
            </strong>
            {prize === 0n && r.thesisWon && <span className="small">Not drawn this time. Your {fmtToken(stake)} {TOKEN_SYMBOL} is back.</span>}
            <span className="muted small">{r.asset} {THESIS[r.thesis].toLowerCase()} · Round #{r.id.toString()}</span>
          </div>
          <Link href={`/round/${r.id}`} className="btn small" onClick={() => dismiss(r.id)}>Claim</Link>
          <button className="toast-x" onClick={() => dismiss(r.id)} aria-label="Dismiss">×</button>
        </div>
      ))}
    </div>
  );
}
