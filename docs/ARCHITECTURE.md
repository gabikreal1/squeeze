# Squeeze — Architecture

A single Next.js application with a deterministic forecast core and an AI-assisted action layer. The arithmetic is pure code; the LLM handles language, explanation, and dialogue.

## System diagram

```
┌────────────────────────────┐        ┌───────────────────────────────┐
│  Web UI (Next.js/React)    │ ─────► │  API layer (Next.js routes)    │
│  • Safe-to-Spend timeline  │  REST  │  • forecast engine (det.)      │
│  • gap-cause invoice list  │        │  • decision/scoring logic      │
│  • action cards            │ ◄───── │  • copilot + tool-calling      │
│  • Monday briefing         │  SSE   │  • message/letter drafting     │
└────────────────────────────┘        └───────┬───────────────┬───────┘
                                               │               │
                        ┌──────────────────────┘               └──────────────────┐
                        ▼                                                          ▼
             ┌────────────────────┐                                   ┌──────────────────────┐
             │ Xero API           │                                   │ Twilio               │
             │ • REST + webhooks  │                                   │ • WhatsApp / SMS     │
             │ • OAuth 2.0        │                                   │ • Voice (AI call)    │
             └──────────────┼─────┘                                   └──────────────────────┘
                            │
                   invoice/payment events → forecast heals
```

## Stack

| Layer | Choice | Notes |
|---|---|---|
| Frontend | Next.js 15 + React 19 + TypeScript, Tailwind | Responsive web dashboard |
| Backend | Node.js via Next.js API routes + custom server (`server.ts`) | Single deployable service |
| AI | OpenAI GPT-4o | Copilot, message drafting, call dialogue |
| Xero | `xero-node` SDK + direct REST | OAuth 2.0, webhooks, payment recording |
| Voice/messaging | Twilio (WhatsApp, SMS, Voice) | Outbound collections outreach |
| TTS/STT | Twilio Gather + Polly | Speech-to-text on calls, text-to-speech replies |
| Database | SQLite (`better-sqlite3`) | OAuth tokens, call sessions, action log |
| Real-time | Server-Sent Events | Push forecast updates to the dashboard |

## Key components

- **Forecast engine** (`lib/forecast`) — behavioural payment dates, 14-day cash curve, Safe-to-Spend, gap detection. No LLM.
- **Decision engine** (`lib/decision`) — customer risk score, action eligibility, speed/cost/risk ranking.
- **Xero client** (`lib/xero`) — OAuth, invoice/contact/bill ingestion, payment recording, webhook verification (HMAC).
- **Agent** (`lib/agent`) — copilot with tool-calling: explains forecasts, drafts messages, summarises calls.
- **Comms** (`lib/comms`) — Twilio WhatsApp/SMS/voice, call state management, audit logging.
- **Seed** (`scripts/seed.ts`) — populate a Xero org with realistic test data.

## Data flow

1. On connect, backend pulls Xero data and builds the 14-day forecast.
2. Dashboard shows Safe-to-Spend, the gap, and ranked action cards.
3. Owner approves an action; backend executes via Twilio or Xero write.
4. Payment lands in Xero; webhook fires; forecast re-runs; SSE pushes the healed number to the UI.

## Repo layout

```
squeeze/
├── app/                    # Next.js pages and API routes
│   ├── dashboard/          # Main dashboard
│   └── api/                # Forecast, Xero, calls, webhooks, copilot
├── components/             # UI components
├── lib/
│   ├── forecast/           # Deterministic forecast engine
│   ├── decision/           # Scoring and escalation ladder
│   ├── xero/               # Xero client, OAuth, webhooks
│   ├── agent/              # Copilot and tool-calling
│   ├── comms/              # Twilio voice, WhatsApp, SMS
│   └── db/                 # SQLite schema and migrations
├── scripts/                # Seed, auth, and smoke-test utilities
├── docs/                   # Product and technical documentation
└── .env.example
```

## Environment variables

See `.env.example` for the full list. Key variables:

| Variable | Purpose |
|---|---|
| `XERO_CLIENT_ID` / `XERO_CLIENT_SECRET` | Xero app credentials |
| `XERO_SCOPES` | Granular accounting scopes |
| `XERO_WEBHOOK_KEY` | HMAC verification for webhooks |
| `OPENAI_API_KEY` | Copilot and call dialogue |
| `TWILIO_*` | WhatsApp, SMS, and voice |
| `PUBLIC_BASE_URL` | HTTPS URL for webhooks (tunnel in dev) |
| `SAFETY_BUFFER` | Default Safe-to-Spend floor (£) |

## Development

```bash
npm install
cp .env.example .env
npm run db:migrate
npm run dev
```

For local webhook testing, expose the app via an HTTPS tunnel and set `PUBLIC_BASE_URL`.
