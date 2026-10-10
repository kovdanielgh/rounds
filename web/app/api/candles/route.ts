import { NextResponse } from "next/server";

const PERPL = "https://testnet.perpl.xyz/api/v1/market-data";
const RESOLUTIONS = new Set([60, 300, 900, 1800, 3600]);

/** Proxy for Perpl candles (their API sends no CORS headers). Short cache: prices move. */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const market = Number(q.get("market"));
  const res = Number(q.get("res"));
  const from = Number(q.get("from"));
  const to = Number(q.get("to"));
  if (!Number.isInteger(market) || !RESOLUTIONS.has(res) || !(from > 0) || !(to > from)) {
    return NextResponse.json({ error: "bad params" }, { status: 400 });
  }
  try {
    const r = await fetch(`${PERPL}/${market}/candles/${res}/${from}-${to}`, { next: { revalidate: 10 } });
    if (!r.ok) return NextResponse.json({ d: [] }, { status: 200 });
    const body = (await r.json()) as { d?: { t: number; c: number }[] };
    // Only what the chart needs: time (s) and close (scaled price).
    return NextResponse.json(
      { d: (body.d ?? []).map((c) => ({ t: Math.floor(c.t / 1000), c: c.c })) },
      { headers: { "Cache-Control": "public, max-age=10" } },
    );
  } catch {
    return NextResponse.json({ d: [] });
  }
}
