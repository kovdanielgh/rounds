"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import ConnectButton from "./ConnectButton";

export default function Header() {
  const path = usePathname();
  return (
    <header className="header">
      <Link href="/" className="logo">
        ROUNDS<span>·</span>
      </Link>
      <nav>
        <Link href="/" className={`navlink ${path === "/" ? "active" : ""}`}>Vaults</Link>
        <Link href="/season" className={`navlink ${path === "/season" ? "active" : ""}`}>Season</Link>
        <Link href="/profile" className={`navlink ${path === "/profile" ? "active" : ""}`}>Profile</Link>
      </nav>
      <ConnectButton />
    </header>
  );
}
