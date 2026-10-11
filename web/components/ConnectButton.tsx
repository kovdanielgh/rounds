"use client";

import Link from "next/link";
import { usePrivy } from "@privy-io/react-auth";
import { useAccount } from "wagmi";
import { shortAddr } from "@/lib/format";

/** A person's own name, not a wallet code: Google name, then email, then the address (wallet login). */
export function useDisplayName() {
  const { user } = usePrivy();
  const { address } = useAccount();
  return user?.google?.name || user?.google?.email || user?.email?.address || shortAddr(address) || "Account";
}

export default function ConnectButton() {
  const { ready, authenticated, login } = usePrivy();
  const name = useDisplayName();
  if (!ready) return <button className="connect" disabled>Log in</button>;
  if (!authenticated) return <button className="connect" onClick={login}>Log in</button>;
  // Opens the profile; logging out lives there, so one click never logs anyone out by accident.
  return (
    <Link href="/profile" className="connect account" title="Your profile">
      {name}
    </Link>
  );
}
