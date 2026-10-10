"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import ConnectButton from "./ConnectButton";
import FaucetButton from "./FaucetButton";

export default function Header() {
  const path = usePathname();
  return (
    <header className="header">
      <Link href="/" className="logo" aria-label="Rounds home">
        ROUNDS<span>·</span>
      </Link>
      <nav aria-label="Main">
        <Link href="/" className={`navlink ${path === "/" ? "active" : ""}`}>Rounds</Link>
        <Link href="/season" className={`navlink ${path === "/season" ? "active" : ""}`}>Season</Link>
        <Link href="/profile" className={`navlink ${path === "/profile" ? "active" : ""}`}>Profile</Link>
      </nav>
      <FaucetButton />
      <ConnectButton />
    </header>
  );
}
