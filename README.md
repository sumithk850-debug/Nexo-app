# NEXO AI 🇱🇰

Sri Lanka's AI platform — one signal, multiple intelligence engines.

NEXO is a modern AI workspace built with Next.js, combining everyday chat, advanced reasoning, coding assistance, repository intelligence, and connected development workflows in one interface.

---

## ✨ What NEXO includes

- 💬 **Nexio 1.1** — fast everyday AI conversations
- 🧠 **Spadec 3.5** — reasoning, creativity, and structured thinking
- ⚡ **Galex 4.0** — premium balanced intelligence
- 🔬 **Brainex 10.8** — deep analysis and research-oriented tasks
- 💻 **Nexo Coder** — Craft V3 Lite, Craft V3, and Craft V4 coding profiles
- 🐙 **GitHub integration** — repository-aware development assistance
- 🗄️ **Supabase integration** — project, schema, and data workflows
- ▲ **Vercel integration** — project and deployment workflows
- 🔗 **URL understanding** — webpage reading and visual context support
- 📄 **File/PDF support** and developer-focused tools
- 🛡️ **Authentication, rate limiting, security hardening, and protected integrations**
- 📊 **Analytics and product monitoring support**

---

## 📁 Project structure

```text
nexo-ai/
├── app/
│   ├── page.tsx                 → Landing page
│   ├── chat/page.tsx            → Main chat UI
│   ├── pricing/page.tsx         → Pricing page
│   ├── api/chat/route.ts        → Streaming AI API and orchestration
│   ├── layout.tsx               → Root layout + metadata/fonts
│   └── globals.css              → Global styles / design system
├── components/                  → UI components
├── lib/                         → Models, providers, auth, integrations,
│                                  rate limits, repository intelligence, etc.
├── migrations/                  → Database migrations
├── docs/                        → Project documentation
├── notes/                       → Development notes
└── .env.example                 → Environment variable template
```

---

## 🔑 Local development

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Copy the environment template:

```bash
cp .env.example .env.local
```

Add the required credentials to your local environment. **Never commit API keys, passwords, access tokens, or other secrets to GitHub.**

### 3. Start the development server

```bash
npm run dev
```

Then open:

```text
http://localhost:3000
```

### 4. Production build

```bash
npm run build
npm start
```

---

## 🚀 Deployment

NEXO is designed for deployment on **Vercel** with its Next.js application and server-side API routes.

Typical deployment flow:

1. Connect the GitHub repository to Vercel.
2. Configure the required environment variables in Vercel.
3. Deploy the project.
4. Verify the production build and runtime logs.

Keep all provider credentials and integration secrets in protected environment settings rather than source code.

---

## 🤖 Model architecture

NEXO separates its public model identities from the underlying provider configuration.

The model routing configuration is maintained server-side in:

```text
lib/providers.server.ts
```

This keeps provider-specific implementation details out of client components and allows NEXO to maintain fallback routes and model-specific system instructions independently.

The available NEXO intelligence profiles currently include:

| NEXO profile | Purpose |
|---|---|
| Nexio 1.1 | Fast everyday assistance |
| Spadec 3.5 | Reasoning and creativity |
| Galex 4.0 | Premium general intelligence |
| Brainex 10.8 | Deep analysis and research |
| Craft V3 Lite | Accessible coding assistance |
| Craft V3 | Advanced coding / architecture |
| Craft V4 | Next-generation system-wide coding |

> Provider/model routing is an internal implementation detail and may change as NEXO evolves.

---

## 🧑‍💻 Nexo Coder

Nexo Coder is the development-focused side of NEXO. It is designed for repository-aware engineering tasks such as:

- Understanding an existing codebase
- Planning multi-file changes
- Creating and editing repository files
- Reviewing architecture and implementation choices
- Working with GitHub repositories
- Connecting application changes with Supabase schemas
- Diagnosing deployment-related problems
- Producing minimal, reviewable changes rather than blindly rewriting files

Repository write operations follow an approval-oriented workflow so proposed changes can be reviewed before they are committed.

---

## 🔗 Connected development workflows

### GitHub

NEXO can work with a connected repository to inspect project structure and files and assist with repository changes.

### Supabase

NEXO can assist with connected Supabase projects, including schema inspection, safe data reads, and approved database changes.

### Vercel

NEXO can assist with connected Vercel projects and deployment inspection, including diagnosing build/deployment problems.

These integrations are permission-bound and should never be treated as permission to perform destructive actions automatically.

---

## 🛡️ Security principles

NEXO is designed around several security principles:

- Secrets are treated as protected credentials.
- Credentials should never be pasted into chat or committed to source control.
- Server-side provider configuration is kept separate from client code.
- Authenticated requests are validated before protected integration operations.
- Rate limiting and token-usage controls help protect AI endpoints.
- Database and deployment mutations require explicit approval through the appropriate workflow.
- Destructive database operations should be planned with verification and rollback considerations.

---

## 🧪 Verification and tests

The repository contains dedicated verification scripts for important subsystems, including security hardening, Supabase dispatching, clarification cards, OpenRouter routing, response completion, GitHub commit fallback, recent features, creator credits, and the NEXO live panel.

Run the relevant test command from `package.json` for the subsystem you are changing.

---

## 🎨 Design

NEXO uses a futuristic, signal-inspired interface with reusable design tokens and shared UI components.

The main visual language is defined through the project's Tailwind configuration and global styles. The signal visual is used throughout the interface to create a consistent NEXO identity.

---

## 📌 Project status

NEXO is an actively evolving project. Features, model routes, integrations, and infrastructure may change as development continues.

For the most accurate implementation details, treat the source code and server-side configuration as the source of truth.

---

## 🇱🇰 Built with ambition from Sri Lanka

**NEXO AI** — one platform for conversation, reasoning, coding, and connected development.
