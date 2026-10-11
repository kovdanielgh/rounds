"use client";

import { useState } from "react";
import { shortAddr } from "@/lib/format";

/** The wallet address, short, with one click to copy the full one (for MonadScan or a transfer). */
export default function CopyAddress({ address }: { address?: `0x${string}` }) {
  const [copied, setCopied] = useState(false);
  if (!address) return null;
  async function copy() {
    try {
      await navigator.clipboard.writeText(address!);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard blocked: nothing to do, the address is still visible
    }
  }
  return (
    <button className="copy-address" onClick={copy} title={address} aria-label="Copy wallet address">
      <span className="mono">{shortAddr(address)}</span>
      <span className="copy-icon" aria-hidden>{copied ? "✓" : "⧉"}</span>
      {copied && <span className="sr-only">Copied</span>}
    </button>
  );
}
