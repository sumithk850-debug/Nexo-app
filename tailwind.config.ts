import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        void: "rgb(var(--color-void) / <alpha-value>)",
        panel: "rgb(var(--color-panel) / <alpha-value>)",
        "panel-raised": "rgb(var(--color-panel-raised) / <alpha-value>)",
        edge: "rgb(var(--color-edge) / <alpha-value>)",
        cyan: {
          DEFAULT: "rgb(var(--color-cyan) / <alpha-value>)",
          dim: "rgb(var(--color-cyan-dim) / <alpha-value>)",
          glow: "rgb(var(--color-cyan-glow) / <alpha-value>)",
        },
        indigo: {
          DEFAULT: "rgb(var(--color-indigo) / <alpha-value>)",
          dim: "rgb(var(--color-indigo-dim) / <alpha-value>)",
        },
        ink: {
          DEFAULT: "rgb(var(--color-ink) / <alpha-value>)",
          muted: "rgb(var(--color-ink-muted) / <alpha-value>)",
          faint: "rgb(var(--color-ink-faint) / <alpha-value>)",
        },
      },
      fontFamily: {
        display: ["var(--font-space-grotesk)", "sans-serif"],
        body: ["var(--font-inter)", "sans-serif"],
        mono: ["var(--font-jetbrains)", "monospace"],
      },
      backgroundImage: {
        "signal-gradient":
          "linear-gradient(90deg, transparent 0%, rgb(var(--color-cyan)) 50%, transparent 100%)",
        "grid-fade":
          "radial-gradient(ellipse 80% 50% at 50% -20%, rgb(var(--color-cyan) / 0.12), transparent)",
      },
      keyframes: {
        pulse_signal: {
          "0%, 100%": { opacity: "0.3", transform: "scaleY(0.4)" },
          "50%": { opacity: "1", transform: "scaleY(1)" },
        },
        drift: {
          "0%": { backgroundPosition: "0% 0%" },
          "100%": { backgroundPosition: "200% 0%" },
        },
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        signal: "pulse_signal 1.2s ease-in-out infinite",
        drift: "drift 8s linear infinite",
        "fade-up": "fade-up 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        "spin-slow": "spin 8s linear infinite",
      },
    },
  },
  plugins: [],
};
export default config;
