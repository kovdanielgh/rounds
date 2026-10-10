"use client";

import { useState } from "react";

const SNIPPET = `export function RoundCard({ asset = "BTC" }) {
  return (
    <iframe
      src={\`https://saverounds.vercel.app/embed/live?asset=\${asset}\`}
      width={360}
      height={760}
      style={{ border: 0, borderRadius: 16 }}
      title="Rounds"
    />
  );
}`;

/** Demo: a made-up wallet with a Rounds card in its Earn tab, and the code to embed it. */
export default function EmbedDemo() {
  const [copied, setCopied] = useState(false);
  return (
    <main className="page embed-demo">
      <section className="hero">
        <h1>Add a no-loss round to any wallet</h1>
        <p className="muted">
          Wallets, exchanges and neobanks can give their users &quot;play the market, keep your money&quot; in 10 lines.
          The card below is live: it shows the current open round on Monad testnet.
        </p>
      </section>
      <div className="embed-demo-grid">
        <div className="phone">
          <div className="phone-top">
            <span className="muted small">My Wallet</span>
            <strong>$1,240.50</strong>
            <div className="phone-tabs">
              <span>Tokens</span>
              <span>Swap</span>
              <span className="active">Earn</span>
            </div>
          </div>
          <iframe src="/embed/live" title="Rounds round" className="phone-frame" />
        </div>
        <div className="snippet">
          <div className="snippet-head">
            <span className="muted small">RoundCard.tsx · 10 lines</span>
            <button
              className="btn small ghost"
              onClick={async () => {
                await navigator.clipboard.writeText(SNIPPET);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <pre>{SNIPPET}</pre>
          <p className="muted small">
            Plain HTML works too: an <code>&lt;iframe&gt;</code> with <code>/embed/live</code> or <code>/embed/&lt;round id&gt;</code>.
            Next step: an SDK that uses the host wallet directly, without a second login.
          </p>
        </div>
      </div>
    </main>
  );
}
