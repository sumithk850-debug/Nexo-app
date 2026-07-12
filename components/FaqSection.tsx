const faqs = [
  {
    q: "Is NEXO really free to start?",
    a: "Yes. NEXO Nexio 1.1 and NEXO Spadec 3.5 are free forever, with 50 messages a day — no credit card required.",
  },
  {
    q: "What makes NEXO different from ChatGPT or Gemini?",
    a: "NEXO is priced for Sri Lanka, built with native Sinhala support, and accepts local payment methods like PayHere — none of which the global platforms offer well.",
  },
  {
    q: "Can I switch models mid-conversation?",
    a: "Yes. Every plan lets you switch between your available NEXO models at any point in a chat.",
  },
  {
    q: "How is NEXO this fast?",
    a: "Our infrastructure is tuned for streaming responses at up to 176 words per second on supported models, so replies feel instant.",
  },
];

export function FaqSection() {
  return (
    <section id="faq" className="border-t border-edge bg-void py-24">
      <div className="mx-auto max-w-3xl px-6">
        <span className="font-mono text-xs uppercase tracking-widest text-cyan">
          Questions
        </span>
        <h2 className="mt-3 font-display text-3xl font-bold text-ink md:text-4xl">
          Good to know
        </h2>

        <div className="mt-10 divide-y divide-edge border-t border-edge">
          {faqs.map((item) => (
            <details key={item.q} className="group py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between font-display text-base font-semibold text-ink">
                {item.q}
                <span className="ml-4 text-cyan transition group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-ink-muted">
                {item.a}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
