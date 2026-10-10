"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Keeps items that left the list on screen for `ms` with popping = true, at their old place,
 * so they can play an exit animation. A change of `resetKey` (tab, filter) skips the animation.
 */
export function usePopList<T>(items: T[], keyOf: (t: T) => string, resetKey: string, ms = 600) {
  const last = useRef(new Map<string, T>());
  for (const i of items) last.current.set(keyOf(i), i);

  const sig = items.map(keyOf).join("|");
  const [popping, setPopping] = useState<{ k: string; at: number }[]>([]);
  const prev = useRef<{ sig: string; keys: string[]; reset: string }>({ sig, keys: sig ? sig.split("|") : [], reset: resetKey });

  useEffect(() => {
    const p = prev.current;
    const keys = sig ? sig.split("|") : [];
    if (p.reset !== resetKey) {
      setPopping([]);
    } else if (p.sig !== sig) {
      const cur = new Set(keys);
      const gone = p.keys.map((k, at) => ({ k, at })).filter((x) => !cur.has(x.k));
      if (gone.length) setPopping((old) => [...old.filter((o) => !gone.some((g) => g.k === o.k)), ...gone]);
    }
    prev.current = { sig, keys, reset: resetKey };
  }, [sig, resetKey]);

  useEffect(() => {
    if (!popping.length) return;
    const t = setTimeout(() => setPopping([]), ms);
    return () => clearTimeout(t);
  }, [popping, ms]);

  const list = items.map((item) => ({ k: keyOf(item), item, popping: false }));
  for (const { k, at } of popping) {
    const item = last.current.get(k);
    if (item && !list.some((x) => x.k === k)) list.splice(Math.min(at, list.length), 0, { k, item, popping: true });
  }
  return list;
}
