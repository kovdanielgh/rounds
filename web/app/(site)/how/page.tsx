import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "How it works",
  description: "Like a savings account: instead of interest, you get a chance at a prize. Wrong call? Every dollar back.",
};

/** The rules for people who want them, in plain words. No tour, no pop-ups: one page you open yourself. */
export default function How() {
  return (
    <main className="page how">
      <h1>How it works</h1>
      <p className="hero-why">Like a savings account: instead of interest, you get a chance at a prize.</p>
      <ol className="how-steps">
        <li>
          <strong>Pick a round and call it.</strong> Will the price go up or down by the end of the round? For example,
          &ldquo;BTC goes up?&rdquo; in the next 6 hours.
        </li>
        <li>
          <strong>Put in money.</strong> It stays yours and is never traded. Before entry closes you can take it out again.
        </li>
        <li>
          <strong>Every round has a prize.</strong> Today Rounds pays it. On mainnet the interest on everyone&apos;s money
          pays it. Only the prize is traded, as a real position on Perpl, so it can grow.
        </li>
        <li>
          <strong>Right call:</strong> 3 winners are drawn at random and share the prize (80%, 15%, 5%). A bigger deposit
          gives a bigger chance.
        </li>
        <li>
          <strong>Wrong call:</strong> nothing is lost. Everyone gets their whole deposit back.
        </li>
        <li>
          <strong>Take your money.</strong> When the round ends, open Profile and press Claim: your deposit and any prize go to
          your wallet.
        </li>
      </ol>
      <p className="muted small">
        Testnet only: the money is test money and arrives by itself when you log in. The one risk to a deposit is a bug in
        the smart contract, which is open and verified.
      </p>
      <Link href="/" className="btn">See the rounds</Link>
    </main>
  );
}
