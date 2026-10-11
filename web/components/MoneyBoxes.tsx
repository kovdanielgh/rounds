import { TOKEN_SYMBOL } from "@/lib/config";
import { fmtToken } from "@/lib/format";

/**
 * The answer to "who pays and what can I lose", as two boxes: the deposit (never trades) and the
 * prize pool (paid by Rounds, the only thing that trades). Numbers when we know them.
 */
export default function MoneyBoxes({ amount, prize }: { amount?: bigint; prize?: bigint }) {
  return (
    <div className="money-boxes">
      <div className="money-box safe">
        <span className="money-label">Your deposit{amount ? ` · ${fmtToken(amount)} ${TOKEN_SYMBOL}` : ""}</span>
        <strong>Locked, never traded</strong>
        <span className="muted small">Comes back to your wallet when the round ends.</span>
      </div>
      <div className="money-box pool">
        <span className="money-label">Prize pool{prize !== undefined ? ` · ${fmtToken(prize)} ${TOKEN_SYMBOL}` : ""}</span>
        <strong>Paid by Rounds, trades on Perpl</strong>
        <span className="muted small">Right call: 3 players split it.</span>
      </div>
    </div>
  );
}
