"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import ConnectButton from "./ConnectButton";
import FaucetButton from "./FaucetButton";

export default function Header() {
  const path = usePathname();
  return (
    <header className="header">
      {/* Same width as the page: the menu lines up with the content, the button with its right edge.
          No logo: "Rounds" is the first menu item. */}
      <div className="header-in">
        <nav aria-label="Main">
          <Link href="/" className={`navlink ${path === "/" ? "active" : ""}`}>Rounds</Link>
          <Link href="/season" className={`navlink ${path === "/season" ? "active" : ""}`}>Season</Link>
          <Link href="/profile" className={`navlink ${path === "/profile" ? "active" : ""}`}>Profile</Link>
        </nav>
        <FaucetButton />
        <ConnectButton />
      </div>
    </header>
  );
}
