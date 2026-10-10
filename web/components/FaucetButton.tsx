"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { usePrivy } from "@privy-io/react-auth";
import { useAccount, useBalance, useReadContract } from "wagmi";
import { erc20Abi } from "@/lib/abi";
import { AUSD, CHAIN_ID } from "@/lib/config";

/**
 * Test money for an empty wallet: it arrives by itself on the first visit (no crypto needed),
 * and the button stays as a fallback. Gas is paid by our faucet operator.
 */
export default function FaucetButton() {
  const { authenticated } = usePrivy();
  const { address } = useAccount();
  const qc = useQueryClient();
  const { data: mon } = useBalance({ address, chainId: CHAIN_ID, query: { enabled: !!address, refetchInterval: 10000 } });
  const { data: usd } = useReadContract({
    chainId: CHAIN_ID,
    address: AUSD, abi: erc20Abi, functionName: "balanceOf", args: [address!],
    query: { enabled: !!address, refetchInterval: 10000 },
  });
  const [state, setState] = useState<"idle" | "busy" | "done" | "wait" | "off" | "error">("idle");
  const auto = useRef(false);

  const empty = usd !== undefined && mon !== undefined && (usd < 1_000_000n || mon.value < 5_000_000_000_000_000n);

  async function request() {
    if (!address || state === "busy") return;
    setState("busy");
    try {
      const r = await fetch("/api/faucet", { method: "POST", body: JSON.stringify({ address }) });
      const { status } = (await r.json()) as { status: string };
      setState(
        status === "ok" || status === "not-needed" ? "done"
          : status === "cooldown" ? "wait"
          : status === "off" ? "off" // the server has no faucet key: say so instead of a silent retry
          : "error",
      );
      qc.invalidateQueries();
    } catch {
      setState("error");
    }
  }

  // First visit with an empty wallet: send test money once, without a click.
  useEffect(() => {
    if (!authenticated || !address || !empty || auto.current) return;
    const key = `rounds-faucet-${address}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      // storage blocked: still try once
    }
    auto.current = true;
    request();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authenticated, address, empty]);

  if (!authenticated || !address) return null;
  if (state === "busy") return <span className="faucet busy">Sending test USD…</span>;
  if (state === "done") return empty ? <span className="faucet busy">Test USD on the way…</span> : <span className="faucet ok">+100 test USD ✓</span>;
  if (state === "wait") return <span className="faucet muted">Test USD: once a day</span>;
  if (state === "off") return <span className="faucet muted" title="The faucet is not set up on this server">Test USD is not available yet</span>;
  if (!empty) return null;
  return (
    <button className="faucet" onClick={request} title="Free test USD and a little MON for gas">
      {state === "error" ? "Retry test USD" : "Get test USD"}
    </button>
  );
}
