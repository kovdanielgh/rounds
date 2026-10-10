"use client";

import { useEffect, useState } from "react";

/** A short confetti burst in the side's colors, once per round per player (remembered in localStorage). */
export default function Confetti({ id, bear }: { id: string; bear: boolean }) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const key = `rounds-celebrated-${id}`;
    try {
      if (localStorage.getItem(key)) return;
      localStorage.setItem(key, "1");
    } catch {
      // storage blocked: celebrate anyway
    }
    setOn(true);
    const t = setTimeout(() => setOn(false), 3200);
    return () => clearTimeout(t);
  }, [id]);
  if (!on) return null;
  const colors = bear ? ["var(--bear)", "#ffc2dd", "#f4f9ff"] : ["var(--acid)", "#efffc2", "#f4f9ff"];
  return (
    <div className="confetti" aria-hidden>
      {Array.from({ length: 70 }, (_, i) => (
        <i
          key={i}
          style={
            {
              left: `${(i * 37) % 100}%`,
              background: colors[i % 3],
              "--dx": `${((i * 53) % 120) - 60}px`,
              "--rot": `${(i * 47) % 720}deg`,
              animationDelay: `${(i % 10) * 60}ms`,
              animationDuration: `${1800 + ((i * 29) % 1200)}ms`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
