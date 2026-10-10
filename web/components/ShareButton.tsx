"use client";

import { useState } from "react";
import { useAccount } from "wagmi";

/** Share a round result. The link opens a page whose card reads the prize from the contract. */
export default function ShareButton({ id, text, small }: { id: bigint; text: string; small?: boolean }) {
  const { address } = useAccount();
  const [copied, setCopied] = useState(false);
  if (!address) return null;
  const url = `${window.location.origin}/share/${id}/${address}`;

  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ title: "Rounds", text, url });
        return;
      } catch {
        // cancelled: fall through to X
      }
    }
    const x = `https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
    window.open(x, "_blank", "noopener,noreferrer");
  }

  async function copy() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <span className="share-btns">
      <button className={`btn ${small ? "small" : ""}`} onClick={share}>Share</button>
      <button className={`btn ghost ${small ? "small" : ""}`} onClick={copy}>{copied ? "Copied" : "Copy link"}</button>
    </span>
  );
}
