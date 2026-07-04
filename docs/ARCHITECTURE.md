# Squeeze — Architecture

Deliberately boring and demo‑safe. Optimised for a 48‑hour build with a flawless live demo, not for scale.

## System diagram

```
┌────────────────────────────┐        ┌───────────────────────────────┐
│  Web UI (Next.js/React, TS) │ ─────► │  API / Orchestrator (Node)     │
│  • Safe-to-Spend timeline   │  REST  │  • forecast engine (det.)      │
│  • gap-cause invoice list   │        │  • decision/scoring logic      │
│  • action cards (3 axes)    │ ◄───── │  • LLM tool-calling agent      │
│  • Monday briefing + audio  │  SSE   │  • message/letter drafting     │
└────────────────────────────┘        └───────┬───────────────┬───────┘
                                               │               │
                        ┌──────────────────────┘               └──────────────────┐
                        ▼                                                          ▼
             ┌────────────────────┐                                   ┌──────────────────────┐
             │ Xero API           │                                   │ Twilio               │
             │ • MCP server / REST│                                   │ • WhatsApp / SMS     │
             │ • Accounting, Files│                                   │ • Voice (AI call)    │
             │ • Webhooks ──┐     │                                   │ + TTS (ElevenLabs/   │
             └──────────────┼─────┘                                   │   OpenAI) for call & │
                            │                                         │   Monday briefing    │
                   ngrok tunnel (dev)                                 └──────────────────────┘
                            │
                   invoice/payment events → forecast heals
```

## Stack

| Layer | Choice | Notes |
|---|---|---|
| Frontend | Next.js + React + TypeScript, Tailwind | Mobile‑styled web; no native app |
| Backend | Node.js (Next API routes or Express) | One service is fine for a hackathon |
| AI orchestration | Claude or GPT with tool‑calling | Agent calls tools: `getForecast`, `rankGap`, `recommend`, `sendMessage`, `placeCall`, `draftLBA` |
| Xero access | Official `@xeroapi/xero-mcp-server` + direct REST | REST for reports/webhooks not covered by MCP tools |
| Voice/messaging | Twilio (WhatsApp sandbox, SMS, Voice) | Sandbox needs no approval for demo |
| TTS | ElevenLabs or OpenAI TTS | AI call voice + 30‑sec Monday audio briefing |
| STT (call replies) | Twilio speech / Whisper | Capture debtor responses |
| Tunnel | ngrok | Xero + Twilio webhooks in dev |
| Store | SQLite / Postgres (or in‑memory JSON) | Persist settings, action log, call transcripts |
| Host | Vercel / Render | Whatever deploys fastest |

## Key components

- **Forecast engine** (`/lib/forecast`) — deterministic cash curve + Safe‑to‑Spend (`DECISION_ENGINE.md` §A). No LLM.
- **Decision engine** (`/lib/decision`) — risk score, action eligibility, 3‑axis ranking (§B/C).
- **Xero client** (`/lib/xero`) — auth, pull invoices/contacts/bills/reports, write notes/expected dates/payments, attach files, verify webhooks (HMAC).
- **Agent** (`/lib/agent`) — LLM tool‑calling: classifies replies, drafts messages/letters, explains recommendations, summarises calls.
- **Comms** (`/lib/comms`) — Twilio send + call flow (TwiML), TTS.
- **Seed** (`/scripts/seed.ts`) — populate demo Xero org (see `XERO_INTEGRATION.md` §Seed).

## Data flow (happy path)

1. On load, backend pulls Xero → builds forecast → returns Safe‑to‑Spend + gap.
2. UI shows gap; user opens an action card; agent explains + recommends.
3. User approves → backend executes (Twilio/Xero write) → logs action.
4. Debtor pays → Xero **payment webhook** → recompute forecast → push heal via SSE → UI animates.

## Suggested repo layout

```
squeeze/
├─ README.md
├─ docs/                      # these specs
├─ app/ (or pages/)           # Next.js UI
│  ├─ dashboard/              # Safe-to-Spend timeline + cards
│  └─ briefing/               # Monday briefing (+ Treasury/Procurement cards)
├─ lib/
│  ├─ forecast/               # deterministic engine
│  ├─ decision/               # scoring + ladder
│  ├─ xero/                   # client + webhooks
│  ├─ agent/                  # LLM tool-calling
│  └─ comms/                  # Twilio + TTS
├─ scripts/
│  └─ seed.ts                 # seed demo Xero org
└─ .env.example
```

## Environment variables (`.env.example`)

```
XERO_CLIENT_ID=
XERO_CLIENT_SECRET=
XERO_SCOPES=accounting.invoices accounting.payments accounting.contacts accounting.settings accounting.reports.aged.read accounting.attachments offline_access
XERO_WEBHOOK_KEY=
LLM_API_KEY=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_WHATSAPP_FROM=
TWILIO_VOICE_FROM=
TTS_API_KEY=
PUBLIC_BASE_URL=            # ngrok url for webhooks
SAFETY_BUFFER=2000          # default Safe-to-Spend floor (£)
```

## Non‑negotiables for demo reliability

- Forecast + heal must work **offline of live payment** (be able to fire a simulated payment webhook on cue).
- Record a **backup video** of the AI call the moment it works.
- Keep a "demo mode" toggle that uses seeded data so nothing depends on network luck on stage.
