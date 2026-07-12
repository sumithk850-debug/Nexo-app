# NEXO AI 🇱🇰

Sri Lanka's fastest AI chat platform — five models, one signal.

---

## 📁 Project structure

```
nexo-ai/
├── app/
│   ├── page.tsx              → Landing page
│   ├── chat/page.tsx         → Chat UI
│   ├── pricing/page.tsx      → Pricing page
│   ├── api/chat/route.ts     → Streaming API (GitHub Models + Groq)
│   ├── layout.tsx            → Root layout + fonts
│   └── globals.css           → Design tokens / signature styles
├── components/                → All UI components
├── lib/
│   ├── models.ts              → Client-safe model metadata
│   ├── providers.server.ts    → ⚠️ Server-only: real model names + system prompts
│   └── types.ts
└── .env.example                → Copy to .env.local
```

## 🔑 Setup (local)

1. Install dependencies:
   ```bash
   npm install
   ```

2. Copy the env template and fill in your keys:
   ```bash
   cp .env.example .env.local
   ```
   - `GITHUB_MODELS_TOKEN` — get from [GitHub Marketplace Models](https://github.com/marketplace/models) ("Get API key")
   - `GROQ_API_KEY` — get from [Groq Console](https://console.groq.com/keys)

3. Run locally:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000)

## 🚀 Deploy to Vercel

1. Push this folder to a **new GitHub repo**.
2. Go to [vercel.com/new](https://vercel.com/new) → Import the repo.
3. In **Environment Variables**, add:
   - `GITHUB_MODELS_TOKEN`
   - `GROQ_API_KEY`
4. Click **Deploy**. That's it — Next.js API routes work natively on Vercel, no extra config needed.

## 🤖 Model routing (internal)

| NEXO Name | Real Model | Provider |
|---|---|---|
| Nexio 1.1 | Llama 4 Scout | GitHub Marketplace Models |
| Spadec 3.5 | Llama 4 Maverick | GitHub Marketplace Models |
| Galex 4.0 | GPT-OSS 120B | Groq API |
| Brainex 10.8 | Llama 4 Maverick (deep-research system prompt) | GitHub Marketplace Models |
| Craft V3 | GPT-4o | GitHub Marketplace Models |

This mapping lives only in `lib/providers.server.ts`, which is never imported by
any client component — so the underlying model names never reach the browser
bundle or network tab.

⚠️ **Rate limits:** GitHub Marketplace Models free tier has daily request caps.
Monitor usage as traffic grows — if you hit limits, either upgrade your GitHub
plan or add a fallback provider in `providers.server.ts`.

## 🔜 Not yet built (next phases)

- **Auth** (login/signup) — currently everyone is treated as Free tier
  (see `UNLOCKED_TIERS` in `app/chat/page.tsx`)
- **Payments** — pricing page has "Coming Soon" messaging, PayHere/Stripe not wired up yet
- **Rate limiting / abuse protection** on the API route
- **Chat history persistence** — currently in-memory only, resets on refresh

## 🎨 Design tokens

Colors, fonts, and the signature "signal" animation are defined in
`tailwind.config.ts` and `app/globals.css`. The signal-bar waveform
(`components/Signal.tsx`) is the platform's signature visual element — reused
in the nav, hero, chat avatar, and typing indicator for consistency.
