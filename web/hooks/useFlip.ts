"use client";

import { useLayoutEffect, useRef } from "react";

/** FLIP: children with data-k that moved inside the container glide from the old place to the new one. */
export function useFlip<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const pos = useRef(new Map<string, { x: number; y: number }>());

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Reduced motion: cards jump to the new place, no glide (the Web Animations API ignores CSS media queries).
    const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const next = new Map<string, { x: number; y: number }>();
    for (const child of Array.from(el.children) as HTMLElement[]) {
      const k = child.dataset.k;
      if (!k) continue;
      const p = { x: child.offsetLeft, y: child.offsetTop };
      next.set(k, p);
      const old = pos.current.get(k);
      if (!still && old && (old.x !== p.x || old.y !== p.y) && !child.classList.contains("popping")) {
        child.animate(
          [{ transform: `translate(${old.x - p.x}px, ${old.y - p.y}px)` }, { transform: "translate(0, 0)" }],
          { duration: 450, easing: "cubic-bezier(.2,.8,.2,1)" },
        );
      }
    }
    pos.current = next;
  });

  return ref;
}
