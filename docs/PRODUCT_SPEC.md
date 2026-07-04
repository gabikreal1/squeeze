# Squeeze — Product Spec

> Squeeze your receivables before your payables squeeze you.

## 1. Who it's for

Small businesses on Xero that sell on payment terms and feel cash timing pain the hardest: tradespeople (plumbers, electricians, builders), agencies, caterers, cleaners, consultants, small wholesalers. Typically 1–20 people, no finance staff, the owner does the chasing (or avoids it).

**Primary persona:** Maya, owner of *Maya's Catering Co.* Books look busy, but she never knows if she can cover Friday's payroll because two big invoices are "probably coming."

## 2. The core promise

Squeeze is an **AI credit controller**. It answers the question the owner is actually scared of:

> "Will I have enough cash next Friday — and if not, what do I do about it *now*?"

It replaces a role big companies pay for and small ones can't: predicting the gap, then acting on receivables (and timing payables) to close it — proportionately, with the owner in control.

## 3. The loop (the whole product in four steps)

```
        ┌──────────────────────────────────────────────────────┐
        │  1. PREDICT      → 14-day Safe-to-Spend forecast       │
        │  2. DIAGNOSE     → which invoices cause the gap        │
        │  3. DECIDE       → best action per invoice (ranked)    │
        │  4. ACT (approve)→ execute + write back to Xero        │
        └───────────────▲──────────────────────────┬───────────┘
                        │   payment webhook          │
                        └──── forecast HEALS ◄───────┘
```

### 3.1 Predict — "Safe to Spend"
- Pulls receivables, payables, payroll/recurring bills, tax set‑asides, and current bank balance from Xero.
- Projects a **daily cash curve for 14 days** using *behavioural* expected‑payment dates per customer (not naive due dates).
- Defines **Safe to Spend** = projected low point minus the owner's safety buffer (a setting; default ≈ one payroll run).
- Surfaces the shortfall: *"Thursday you'll be £1,180 under safe cash."*

### 3.2 Diagnose — cause of the gap
- Ranks the specific unpaid invoices whose expected arrival is *after* the shortfall and large enough to matter.
- Shows the offsetting outflows driving it (payroll Mon, supplier bill Wed, VAT set‑aside).

### 3.3 Decide — the action ladder
For each gap‑causing invoice, Squeeze recommends the **cheapest effective rung** (see `DECISION_ENGINE.md`):

| Rung | Action | When |
|---|---|---|
| 0 | Do nothing / just watch | Reliable payer, gap not real yet |
| 1 | Polite nudge (email/WhatsApp) | Low risk, early |
| 2 | Firm reminder | Ignored nudge, terms passed |
| 3 | **AI phone call** (B2B, disclosed) | Ignored reminders, cash needed soon |
| 4 | Early‑payment discount offer | Need cash fast, protect relationship |
| 5 | **Invoice financing** comparison | Need cash *now*, chasing too slow |
| 6 | **Letter Before Action + evidence pack** | Genuine non‑payer, documented, proportionate |

### 3.4 Act — with approval, written back to Xero
- Owner approves via the UI (or WhatsApp thumbs‑up).
- Squeeze executes: sends the message, places the call, drafts the letter, records notes/expected dates/logged calls **back into Xero**.
- On payment (webhook), the forecast **heals** on screen — the emotional payoff.

## 4. "Knows when not to squeeze" (the trust moment)

Squeeze is relationship‑aware by design. In the demo it visibly *declines* to escalate a loyal customer:

> *"Patel always pays ~8 days late but always pays — don't squeeze, just nudge."*

…right before it goes firm on a first‑time ghoster. This single contrast turns the name's edge into proof of intelligence and defuses the "aggressive AI collections" optics.

## 5. Scope & compliance (one slide's worth)

- **B2B only.** Chasing business customers, not consumers.
- **Own debts.** The business's own invoices — *not* third‑party collection. This puts it outside FDCPA (US, consumer + third‑party only) and outside UK FCA authorisation (required for consumer / third‑party debt, not own commercial debt).
- **AI disclosed** at the start of every call.
- **Human approves** every escalation (call, financing, legal).
- **Full audit trail** written to Xero.
- **Legal rung = document prep, not filing.** Squeeze prepares a Pre‑Action‑Protocol‑compliant Letter Before Action + evidence bundle and auto‑computes statutory entitlements (8% over base rate + £40/£70/£100 fixed compensation under the Late Payment of Commercial Debts Act). It does **not** file at court (Money Claim Online has no public API; and a 14–30 day LBA window is mandatory first anyway). "Document assembly, not legal advice."

## 6. The "finance department" vision (pitch, not v1 build)

Squeeze (the credit controller) is hire #1. Two colleagues appear as **cards in the Monday briefing** to sell the platform vision without deep build:
- **Treasury** — time payables: *"Pay Henderson early for a 2%/10‑day discount = ~18% annualised on idle cash; delay the software bill to its true due date for £900 float."*
- **Procurement** — *"Your waste supplier raised prices 14% in March — here's the renegotiation email."*

> A 200‑person company runs finance with specialists costing £150k+/yr. We gave the same department to 4.4M small businesses for the price of a subscription.

## 7. Revenue‑track coverage (hits both halves)

The target track says "increase revenue **or** improve cash flow." Squeeze crushes cash flow; add **one insight card** for the revenue half:
- *"BrightBuild is a high‑value repeat customer trending slower — protect this relationship,"* or
- *"These 3 customers are your most reliable payers — win more like them."*

## 8. Measurable outcomes (say these numbers on stage)

- £ gap identified → £ gap closed
- DSO (days sales outstanding) reduced by *N* days
- £ of float captured by re‑timing payables
- £/yr recovered by procurement card

## 9. Out of scope for the hackathon

- Native mobile app (use mobile‑styled web + real WhatsApp/SMS).
- Real financing marketplace integration (quotes are illustrative; name Satago/FundTap as production path).
- Court filing (prep only).
- Deep Treasury/Procurement agents (cards only).
