import { Zap, Sparkles, Cake, Globe2, ShieldCheck } from "lucide-react";

const features = [
  {
    icon: Zap,
    title: "176 words / sec",
    desc: "Groq-powered streaming makes NEXO feel instant, not just fast.",
  },
  {
    icon: Globe2,
    title: "Built for Sinhala",
    desc: "Native Sinhala understanding and output — not a translation layer bolted on.",
  },
  {
    icon: Sparkles,
    title: "Image generation",
    desc: "Turn a few keywords into visuals, right inside the chat.",
  },
  {
    icon: Cake,
    title: "Birthday wishes",
    desc: "Personalized AI-written wishes in Sinhala, English, or Tamil.",
  },
  {
    icon: ShieldCheck,
    title: "Local payments",
    desc: "Pay the way Sri Lanka pays — PayHere support, no international card needed.",
  },
];

export function FeaturesSection() {
  return (
    <section className="border-t border-edge bg-panel-raised py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mb-14 max-w-2xl">
          <span className="font-mono text-xs uppercase tracking-widest text-cyan">
            Why NEXO
          </span>
          <h2 className="mt-3 font-display text-3xl font-bold text-ink md:text-4xl">
            Everything ChatGPT has.
            <br className="hidden md:block" /> Plus what it doesn&apos;t.
          </h2>
        </div>

        <div className="grid gap-px overflow-hidden rounded-2xl border border-edge bg-edge sm:grid-cols-2 lg:grid-cols-5">
          {features.map((f) => (
            <div key={f.title} className="bg-panel p-6">
              <f.icon className="h-5 w-5 text-cyan" strokeWidth={1.75} />
              <h3 className="mt-4 font-display text-base font-semibold text-ink">
                {f.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-muted">
                {f.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
