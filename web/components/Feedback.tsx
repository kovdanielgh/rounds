"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useAccount } from "wagmi";

/** The window opens by itself after the 1st and the 5th deposit. The button opens it any time. */
const ASK_AT = [1, 5];
const key = (a?: string) => `rounds.deposits.${a?.toLowerCase() ?? "anon"}`;

function count(a?: string) {
  try {
    const n = Number(localStorage.getItem(key(a)) ?? 0) + 1;
    localStorage.setItem(key(a), String(n));
    return n;
  } catch {
    return 0;
  }
}

function Choice({ name, value, set, options }: { name: string; value: string; set: (v: string) => void; options: string[] }) {
  return (
    <div className="choices" role="radiogroup" aria-label={name}>
      {options.map((o) => (
        <button key={o} type="button" role="radio" aria-checked={value === o} className={value === o ? "on" : ""} onClick={() => set(value === o ? "" : o)}>
          {o}
        </button>
      ))}
    </div>
  );
}

export default function Feedback() {
  const { address } = useAccount();
  const page = usePathname();
  const [open, setOpen] = useState(false);
  const [deposits, setDeposits] = useState(0);
  const [clear, setClear] = useState("");
  const [annoyed, setAnnoyed] = useState("");
  const [back, setBack] = useState("");
  const [note, setNote] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "failed">("idle");

  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const onDeposit = (e: Event) => {
      const n = count((e as CustomEvent<string | undefined>).detail);
      setDeposits(n);
      // Let "You're in" and the confetti play first.
      if (ASK_AT.includes(n)) t = setTimeout(() => setOpen(true), 2500);
    };
    window.addEventListener("rounds:deposit", onDeposit);
    return () => {
      window.removeEventListener("rounds:deposit", onDeposit);
      clearTimeout(t);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  async function send() {
    setState("sending");
    const res = await fetch("/api/feedback", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ clear, annoyed, back, note, deposits, address, page }),
    }).catch(() => null);
    if (!res?.ok) return setState("failed");
    setState("sent");
    setTimeout(() => setOpen(false), 1500);
  }

  const empty = !clear && !annoyed.trim() && !back && !note.trim();

  return (
    <>
      <button className="feedback-tab" onClick={() => { setState("idle"); setOpen(true); }}>Feedback</button>
      {open && (
        <div className="modal-back" onClick={() => setOpen(false)}>
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="fb-title" onClick={(e) => e.stopPropagation()}>
            <button className="toast-x modal-x" aria-label="Close" onClick={() => setOpen(false)}>×</button>
            {state === "sent" ? (
              <h2 id="fb-title">Thank you! 🙌</h2>
            ) : (
              <>
                <h2 id="fb-title">Quick question</h2>
                <p className="muted small">Three questions, 20 seconds. It helps us a lot.</p>
                <label>Is it clear what happens to your money?</label>
                <Choice name="Clear" value={clear} set={setClear} options={["Yes", "Kind of", "No"]} />
                <label htmlFor="fb-annoyed">What annoyed you?</label>
                <input id="fb-annoyed" value={annoyed} onChange={(e) => setAnnoyed(e.target.value)} placeholder="Anything slow, confusing or ugly" maxLength={500} />
                <label>Will you come back tomorrow?</label>
                <Choice name="Back" value={back} set={setBack} options={["Yes", "Maybe", "No"]} />
                <label htmlFor="fb-note">Anything else?</label>
                <textarea id="fb-note" value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={1000} />
                {state === "failed" && <div className="error small">Could not send. Please try again.</div>}
                <button className="btn wide" disabled={empty || state === "sending"} onClick={send}>
                  {state === "sending" ? "Sending…" : "Send"}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
