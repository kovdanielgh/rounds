"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useAccount } from "wagmi";
import { DISCORD_URL } from "@/lib/config";

/** The window opens by itself after the 5th result the player sees. The button opens it any time. */
const ASK_AT = [5];
const key = (a?: string) => `rounds.results.${a?.toLowerCase() ?? "anon"}`;

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
  const [step, setStep] = useState(0);
  const [state, setState] = useState<"idle" | "sending" | "sent" | "failed">("idle");

  function show() {
    setStep(0);
    setState("idle");
    setOpen(true);
  }

  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const onResult = (e: Event) => {
      const n = count((e as CustomEvent<string | undefined>).detail);
      setDeposits(n);
      // Let the result toast be read first.
      if (ASK_AT.includes(n)) t = setTimeout(show, 4000);
    };
    window.addEventListener("rounds:result", onResult);
    return () => {
      window.removeEventListener("rounds:result", onResult);
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
    if (!clear && !annoyed.trim() && !back && !note.trim()) return setOpen(false);
    setState("sending");
    const res = await fetch("/api/feedback", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ clear, annoyed, back, note, deposits, address, page }),
    }).catch(() => null);
    if (!res?.ok) return setState("failed");
    setState("sent");
  }

  /** A choice moves on by itself; a text field has Next (or Send on the last question). */
  const pick = (set: (v: string) => void) => (v: string) => {
    set(v);
    if (v) setTimeout(() => setStep((s) => s + 1), 250);
  };
  const steps = [
    { q: "Is it clear what happens to your money?", body: <Choice name="Clear" value={clear} set={pick(setClear)} options={["Yes", "Kind of", "No"]} /> },
    { q: "What annoyed you?", body: <input autoFocus value={annoyed} onChange={(e) => setAnnoyed(e.target.value)} onKeyDown={(e) => e.key === "Enter" && setStep(2)} placeholder="Anything slow, confusing or ugly" maxLength={500} aria-label="What annoyed you?" />, text: true },
    { q: "Will you come back tomorrow?", body: <Choice name="Back" value={back} set={pick(setBack)} options={["Yes", "Maybe", "No"]} /> },
    { q: "Anything else?", body: <textarea autoFocus value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={1000} aria-label="Anything else?" />, text: true },
  ];
  const last = step === steps.length - 1;
  const cur = steps[Math.min(step, steps.length - 1)];

  return (
    <>
      <button className="feedback-tab" onClick={show}>Feedback</button>
      {open && (
        <div className="modal-back" onClick={() => setOpen(false)}>
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="fb-title" onClick={(e) => e.stopPropagation()}>
            <button className="toast-x modal-x" aria-label="Close" onClick={() => setOpen(false)}>×</button>
            {state === "sent" ? (
              <>
                <h2 id="fb-title">Thank you! 🙌</h2>
                <p className="muted small">
                  Want to talk to us or see what we build next?{" "}
                  <a href={DISCORD_URL} target="_blank" rel="noopener noreferrer" className="link">Join our Discord →</a>
                </p>
              </>
            ) : (
              <>
                <h2 id="fb-title" className="fb-q">{cur.q}</h2>
                {cur.body}
                {state === "failed" && <div className="error small">Could not send. Please try again.</div>}
                <div className="fb-nav">
                  {step > 0 && <button className="btn small ghost" onClick={() => setStep(step - 1)}>Back</button>}
                  {last ? (
                    <button className="btn small" disabled={state === "sending"} onClick={send}>{state === "sending" ? "Sending…" : "Send"}</button>
                  ) : (
                    <button className={`btn small ${cur.text ? "" : "ghost"}`} onClick={() => setStep(step + 1)}>{cur.text && annoyed.trim() ? "Next" : "Skip"}</button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
