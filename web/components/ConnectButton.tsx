"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useAccount } from "wagmi";
import { shortAddr } from "@/lib/format";

export default function ConnectButton() {
  const { ready, authenticated, login, logout } = usePrivy();
  const { address } = useAccount();
  if (!ready) return <button className="connect" disabled>Connect</button>;
  if (!authenticated) return <button className="connect" onClick={login}>Connect</button>;
  return (
    <button className="connect account" onClick={logout} title="Log out">
      {shortAddr(address) || "Account"}
    </button>
  );
}
