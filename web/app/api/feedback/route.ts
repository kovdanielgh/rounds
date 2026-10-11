import { NextResponse } from "next/server";

const cut = (v: unknown, n: number) => (typeof v === "string" ? v.trim().slice(0, n) : "");

/**
 * Feedback from the 3-question window. Each answer goes to a Discord channel (FEEDBACK_WEBHOOK,
 * server-only) and to the Vercel logs, so nothing is lost if the webhook is not set.
 */
export async function POST(req: Request) {
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const f = {
    clear: cut(b.clear, 20),
    annoyed: cut(b.annoyed, 500),
    back: cut(b.back, 20),
    note: cut(b.note, 1000),
    deposits: Number(b.deposits) || 0,
    address: cut(b.address, 42),
    page: cut(b.page, 100),
  };
  if (!f.clear && !f.annoyed && !f.back && !f.note) return NextResponse.json({ status: "empty" }, { status: 400 });
  console.log("feedback", JSON.stringify(f));

  const hook = process.env.FEEDBACK_WEBHOOK;
  if (hook) {
    const content = [
      `**Feedback** after result #${f.deposits} · ${f.address || "no wallet"} · ${f.page}`,
      `Clear what happens to the money: **${f.clear || "—"}**`,
      `Come back tomorrow: **${f.back || "—"}**`,
      `Annoyed: ${f.annoyed || "—"}`,
      `Other: ${f.note || "—"}`,
    ].join("\n");
    await fetch(hook, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ content }) }).catch(() => {});
  }
  return NextResponse.json({ status: "ok" });
}
