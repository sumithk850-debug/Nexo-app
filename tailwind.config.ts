import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        void: "#F5F4EF",
        panel: "#FFFFFF",
        "panel-raised": "#FBFAF7",
        edge: "#E5E2D9",
        cyan: {
          DEFAULT: "#D97757",
          dim: "#C15F3C",
          glow: "#E89478",
        },
        indigo: {
          DEFAULT: "#B85C38",
          dim: "#8F4529",
        },
        ink: {
          DEFAULT: "#1F1E1C",
          muted: "#6B6862",
          faint: "#A8A49A",
        },
      },
      fontFamily: {
        display: ["var(--font-space-grotesk)", "sans-serif"],
        body: ["var(--font-inter)", "sans-serif"],
        mono: ["var(--font-jetbrains)", "monospace"],
      },
      backgroundImage: {
        "signal-gradient":
          "linear-gradient(90deg, transparent 0%, #D97757 50%, transparent 100%)",
        "grid-fade":
          "radial-gradient(ellipse 80% 50% at 50% -20%, rgba(217,119,87,0.12), transparent)",
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
      },
    },
  },
  plugins: [],
};
export default config;
