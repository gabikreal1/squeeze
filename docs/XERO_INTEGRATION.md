# Squeeze — Xero Integration

Everything needed to make Xero the engine (and to answer the Checkpoint submission form).

## 1. App setup

1. Sign in at `developer.xero.com` as an admin of the demo org.
2. Create a **Custom Connection** (server‑to‑server, client credentials) — simplest for a hackathon and works with the MCP server. (Or a standard OAuth 2.0 app if you want the full auth‑code flow.)
3. Select the granular scopes (see §3).
4. Copy Client ID + Secret (secret shown once). Approve the connection from the email Xero sends.

## 2. Access method

Primary: official **Xero MCP server** for agent tool access.

```json
{
  "mcpServers": {
    "xero": {
      "command": "npx",
      "args": ["-y", "@xeroapi/xero-mcp-server@latest"],
      "env": {
        "XERO_CLIENT_ID": "…",
        "XERO_CLIENT_SECRET": "…",
        "XERO_SCOPES": "accounting.invoices accounting.payments accounting.contacts accounting.settings accounting.reports.aged.read accounting.attachments"
      }
    }
  }
}
```

Supplement with **direct REST** (`api.xero.com/api.xro/2.0/…`) for anything the MCP tools don't expose (reports, Files, webhooks).

> ⚠️ **Scopes gotcha:** custom connections created **after 29 Apr 2026** must use *granular* scopes. The broad `accounting.transactions` bundle fails with "Client credentials scope validation failed." Always set `XERO_SCOPES` explicitly with the granular names below.

## 3. OAuth 2.0 scopes required

```
accounting.invoices              # read/write invoices (receivables)
accounting.payments              # detect + record payments
accounting.contacts              # customers + payment behaviour
accounting.settings              # org, accounts, tax rates
accounting.reports.aged.read     # aged receivables report
accounting.banktransactions      # bank lines / cash position
accounting.attachments           # attach evidence to LBA pack (Files)
offline_access                   # refresh token (OAuth mode only)
```

Minimum viable (core loop only): `accounting.invoices accounting.payments accounting.contacts accounting.settings`.

## 4. Endpoints used (for the "which endpoints" question)

| Endpoint | Method(s) | Purpose |
|---|---|---|
| `/Invoices` | GET, POST, PUT | Pull overdue receivables; set expected dates / notes; record actions |
| `/Payments` | GET, POST | Detect settled invoices; record payments |
| `/Contacts` | GET | Customer details + history for behavioural dates |
| `/Reports/AgedReceivablesByContact` | GET | Overdue exposure per customer |
| `/BankTransactions` (+ `/Accounts`) | GET | Current cash position for the forecast |
| `/Files` (Files API) | POST | Attach invoice PDF / history to the LBA evidence pack |
| Webhooks | (subscribe) | Real‑time Invoice + Payment events → forecast heals |

## 5. Webhooks

- Subscribe to **Invoice** and **Payment** events in the developer portal; point to `PUBLIC_BASE_URL/webhooks/xero` (ngrok in dev).
- Verify the `x-xero-signature` HMAC‑SHA256 against `XERO_WEBHOOK_KEY`; respond 200 fast, process async.
- Say "webhook‑driven" on stage — the Xero pitch playbook explicitly rewards it.
- **Fallback:** if the payment webhook is unavailable at the venue, poll `/Payments` and use the invoice‑update webhook; you can still fire a simulated event to trigger the on‑stage heal.

## 6. Seed data (the demo IS the data)

Run `scripts/seed.ts` against the demo org first. Create ~15 contacts with distinct personalities and **6–12 months of backdated invoices + payments** so behavioural averages are real.

| Contact | Personality | Demo role |
|---|---|---|
| Patel Catering | Always pays ~8 days late, 14 clean invoices | LOW risk → "don't squeeze", soft nudge |
| BrightBuild Ltd | First‑time, no history, £2,400, 17d overdue, ignored 2 emails | HIGH risk → AI call → LBA |
| Henderson & Co | Reliable, offers 2%/10 early‑pay | TREASURY discount opportunity |
| Newline Studio | Medium, slow, large balance | FINANCING candidate |
| Riverside Hotel | Big recurring client, slightly slow | High‑value → protect relationship (revenue card) |
| + ~10 others | Mixed timings | Forecast realism |

Also seed: payroll run + a supplier bill + a VAT set‑aside in the next 14 days so a **real gap** exists on `low_day`. Keep one invoice ready to mark paid live (or fire a simulated payment webhook) to heal the forecast on cue.

## 7. Checkpoint submission — paste‑ready answers

**How did your project utilize the Xero API?**
> Squeeze is an AI credit controller built on Xero. It reads receivables, payables and payment history from Xero to forecast the exact day cash runs short, identifies the invoices causing the gap, then takes graduated collection actions (reminder → AI call → discount → financing → Letter Before Action) and writes every action, note and expected‑payment date back into Xero. Xero is both source of truth and system of record; we use webhooks so payments update the forecast in real time.

**Development platform:** Next.js/React (TypeScript), Node.js; LLM tool‑calling via [Claude/GPT]; Xero via the official MCP server + REST; Twilio for WhatsApp/SMS + the live AI voice call; [ElevenLabs/OpenAI] TTS; ngrok for webhooks; hosted on [Vercel/Render].

**Endpoints:** see §4 (list only what you actually ship).

**Scopes:** see §3 — "we used granular v2 scopes since our custom connection was created after 29 Apr 2026."
