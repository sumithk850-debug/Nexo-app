import type { Metadata } from "next";
import { Space_Grotesk, Inter, JetBrains_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import "@/styles/prism-nexo.css";

const spaceGrotesk = { variable: "--font-space-grotesk", className: "font-sans" };
const inter = { variable: "--font-inter", className: "font-sans" };
const jetbrains = { variable: "--font-jetbrains", className: "font-mono" };

export const metadata: Metadata = {
  title: "NEXO AI — Think Beyond. Create Faster.",
  description:
    "Sri Lanka's first world-class AI chat platform. Five models, one signal — ultra fast, ultra affordable, built for Sri Lanka.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${inter.variable} ${jetbrains.variable}`} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const theme = localStorage.getItem('nexo_theme');
                if (theme === 'dark') document.documentElement.classList.add('dark');
              } catch (e) {}
            `,
          }}
        />
      </head>
      <body className="font-body antialiased">
        {children}
        <Analytics />
      </body>
    </html>
  );
        }
