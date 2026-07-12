import { NEXO_MODELS } from "@/lib/models";

const tierColor: Record<string, string> = {
  Free: "text-ink-muted border-edge",
  Galex: "text-cyan border-cyan/40",
  Brainex: "text-indigo border-indigo/40",
  Craft: "text-cyan-dim border-cyan/60",
};

export function ModelsSection() {
  return (
    <section id="models" className="border-t border-edge bg-void py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mb-14 max-w-2xl">
          <span className="font-mono text-xs uppercase tracking-widest text-cyan">
            The lineup
          </span>
          <h2 className="mt-3 font-display text-3xl font-bold text-ink md:text-4xl">
            One platform, five minds
          </h2>
          <p className="mt-4 text-ink-muted">
            Each NEXO model is tuned for a different job — from quick replies
            to deep research to production code. Switch anytime, mid-conversation.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {NEXO_MODELS.map((model) => (
            <div
              key={model.id}
              className="group relative overflow-hidden rounded-2xl border border-edge bg-panel p-6 shadow-sm transition hover:border-cyan/40 hover:shadow-md"
            >
              <div
                className={`inline-block rounded-full border px-2.5 py-0.5 font-mono text-[10px] tracking-widest ${tierColor[model.tier]}`}
              >
                {model.badge}
              </div>
              <h3 className="mt-4 font-display text-xl font-semibold text-ink">
                {model.name}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-muted">
                {model.tagline}
              </p>
              <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-cyan/0 blur-2xl transition group-hover:bg-cyan/10" />
            </div>
          ))}

          {/* Closing card */}
          <div className="flex flex-col justify-center rounded-2xl border border-dashed border-edge p-6">
            <p className="font-display text-lg font-semibold text-ink">
              Not sure which one?
            </p>
            <p className="mt-2 text-sm text-ink-muted">
              Start with Nexio — it&apos;s free, and NEXO will suggest an
              upgrade only when a question actually needs it.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
