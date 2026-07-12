"use client";

import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { Check, Sparkles } from "lucide-react";
import { useState } from "react";

const plans = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    desc: "Try NEXO with no commitment",
    features: [
      "NEXO Nexio 1.1 access",
      "NEXO Spadec 3.5 access",
      "50 messages / day",
      "Standard speed",
    ],
    cta: "Start free",
    highlight: false,
  },
  {
    name: "Galex",
    price: "$5",
    period: "/ 3 months",
    subPrice: "~$1.67/mo",
    desc: "Balanced power for daily use",
    features: [
      "NEXO Galex 4.0 access",
      "500 messages / day",
      "Image generation",
      "Priority speed",
    ],
    cta: "Get Galex",
    highlight: false,
  },
  {
    name: "Brainex",
    price: "$11",
    period: "/ month",
    desc: "Deep research, unlimited use",
    features: [
      "NEXO Brainex 10.8 access",
      "Unlimited messages",
      "Deep research mode",
      "File upload and analysis",
      "176 words/sec ultra speed",
      "Birthday wishes feature",
    ],
    cta: "Get Brainex",
    highlight: true,
  },
  {
    name: "Craft",
    price: "$23",
    period: "/ month",
    subPrice: "or $300/yr - save 35%",
    desc: "Maximum power for builders",
    features: [
      "NEXO Craft V3 access",
      "Everything in Brainex",
      "Ultra coding mode",
      "Advanced image creation",
      "API access",
      "Priority support",
    ],
    cta: "Get Craft",
    highlight: false,
  },
];

export default function PricingPage() {
  const [comingSoonPlan, setComingSoonPlan] = useState<string | null>(null);

  return (
    <main className="min-h-screen bg-void">
      <Nav />

      <section className="mx-auto max-w-7xl px-6 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <span className="font-mono text-xs uppercase tracking-widest text-cyan">
            Pricing
          </span>
          <h1 className="mt-3 font-display text-4xl font-bold text-ink md:text-5xl">
            Priced for Sri Lanka
          </h1>
          <p className="mt-4 text-ink-muted">
            Start free. Upgrade only when a model actually earns it. Cancel anytime.
          </p>
        </div>

        <div className="mt-14 grid gap-5 lg:grid-cols-4">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative flex flex-col rounded-2xl border p-6 ${
                plan.highlight
                  ? "border-cyan/50 bg-panel shadow-md"
                  : "border-edge bg-panel shadow-sm"
              }`}
            >
              {plan.highlight && (
                <div className="absolute -top-3 left-6 flex items-center gap-1 rounded-full bg-cyan px-3 py-1 font-mono text-[10px] font-semibold text-white">
                  <Sparkles className="h-3 w-3" />
                  MOST POPULAR
                </div>
              )}

              <h3 className="font-display text-lg font-semibold text-ink">
                {plan.name}
              </h3>
              <p className="mt-1 text-xs text-ink-muted">{plan.desc}</p>

              <div className="mt-5 flex items-baseline gap-1.5">
                <span className="font-display text-3xl font-bold text-ink">
                  {plan.price}
                </span>
                <span className="text-sm text-ink-muted">{plan.period}</span>
              </div>
              {plan.subPrice && (
                <p className="mt-1 font-mono text-xs text-cyan">
                  {plan.subPrice}
                </p>
              )}

              <ul className="mt-6 flex-1 space-y-3">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-ink-muted">
                    <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-cyan" />
                    {f}
                  </li>
                ))}
              </ul>

              <button
                onClick={() =>
                  plan.name === "Free"
                    ? (window.location.href = "/chat")
                    : setComingSoonPlan(plan.name)
                }
                className={`mt-8 w-full rounded-full py-2.5 text-sm font-semibold transition ${
                  plan.highlight
                    ? "bg-cyan text-white hover:bg-cyan-dim"
                    : "border border-edge text-ink hover:border-cyan/40"
                }`}
              >
                {plan.cta}
              </button>

              {comingSoonPlan === plan.name && (
                <p className="mt-3 text-center font-mono text-[11px] text-ink-faint">
                  Payments launching soon - PayHere integration in progress
                </p>
              )}
            </div>
          ))}
        </div>

        <div className="mx-auto mt-16 max-w-2xl rounded-2xl border border-edge bg-panel p-6 text-center shadow-sm">
          <p className="text-sm text-ink-muted">
            Paid plans are launching shortly with local PayHere support. Join
            free today and we will notify you the moment upgrades open.
          </p>
        </div>
      </section>

      <Footer />
    </main>
  );
}
