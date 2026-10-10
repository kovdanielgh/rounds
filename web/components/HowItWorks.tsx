/** Three steps, no jargon: what you do, what the money does, what you get. */
const STEPS = [
  { n: "1", title: "Deposit and pick a side", text: "Put in dollars. Choose Bulls or Bears on BTC, ETH, SOL or MON." },
  { n: "2", title: "Your yield plays, your money stays", text: "Only the yield of the round trades your idea on Perpl. Your deposit never trades." },
  { n: "3", title: "Win, or get your money back", text: "If your side is right, three players share the prize: 80%, 15%, 5%. If not, your deposit comes back with base yield." },
];

export default function HowItWorks() {
  return (
    <section className="how">
      {STEPS.map((s) => (
        <div key={s.n} className="how-step">
          <span className="how-n">{s.n}</span>
          <h3>{s.title}</h3>
          <p className="muted">{s.text}</p>
        </div>
      ))}
    </section>
  );
}
