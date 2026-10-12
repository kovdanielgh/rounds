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

/** "Daniel Krasilnikoff" -> "DK", "kopx@free.fr" -> "K", "0xB297…E7Fe" stays as it is. */
function initials(name: string) {
  if (name.startsWith("0x")) return name;
  const words = name.split("@")[0].split(/[\s._-]+/).filter(Boolean);
  return words.slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || name.slice(0, 1).toUpperCase();
}

export default function ConnectButton() {
  const { ready, authenticated, login } = usePrivy();
  const name = useDisplayName();
  if (!ready) return <button className="connect" disabled>Log in</button>;
  if (!authenticated) return <button className="connect" onClick={login}>Log in</button>;
  // Opens the profile; logging out lives there, so one click never logs anyone out by accident.
  return (
    <Link href="/profile" className="connect account" title={name}>
      <span className="name-full">{name}</span>
      {/* Phones: initials only, so the menu never gets squeezed by a long name. */}
      <span className="name-short">{initials(name)}</span>
    </Link>
  );
}
