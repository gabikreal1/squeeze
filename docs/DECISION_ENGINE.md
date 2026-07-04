# Squeeze — Decision Engine

This is the intelligence of the product: (A) the cash forecast, (B) what Squeeze weighs, (C) how it scores actions, and (D) reference pseudocode. Keep the **forecast deterministic** (code, not the LLM) so it's accurate and trustworthy; use the LLM for classification, drafting, and explanation.

---

## A. The forecast (deterministic)

**Goal:** a 14-day daily cash curve and the low point ("Safe to Spend").

Inputs from Xero:
- Current bank balance (`GET /Accounts` / bank transactions).
- Receivables: unpaid `AUTHORISED` invoices → each gets a **behavioural expected date** (not due date).
- Payables: `ACCPAY` bills due, repeating bills, payroll runs, tax set‑asides.
- Owner setting: **safety buffer** (default ≈ one payroll).

```
for each day d in [today .. today+14]:
    inflow[d]  = sum(invoice.amount for invoice where expected_date(invoice) == d)
    outflow[d] = sum(bill.amount    for bill    where pay_date(bill) == d)
                 + payroll_due(d) + tax_setaside(d)
balance[today-1] = current_bank_balance
balance[d] = balance[d-1] + inflow[d] - outflow[d]

low_point      = min(balance[d] for d in window)
low_day        = argmin(...)
safe_to_spend  = current_balance - (buffer + max(0, -low_point_relative_shortfall))
gap            = max(0, buffer - low_point)     # >0 means trouble
```

### Behavioural expected date (the bit Xero's native tool ignores)
```
expected_date(invoice):
    hist = past_paid_invoices(invoice.contact)
    if len(hist) >= 3:
        avg_lateness = mean(paid_date - due_date for hist)   # e.g. +8 days
        return invoice.due_date + avg_lateness
    else:
        # no history → conservative default by segment
        return invoice.due_date + DEFAULT_LATENESS[segment(invoice.contact)]
```

This is the headline differentiator: *"Patel pays ~8 days late, every time"* → predict it, don't panic.

---

## B. What Squeeze takes into consideration

### 1. Cash situation (how bad, how soon)
- Size of the gap (£ below safe cash).
- Timing (days until the shortfall).
- Safety‑cash floor (owner setting).
- What's driving the outflow (payroll / VAT / supplier bill / rent / loan).
- **Is this invoice actually a cause?** Only escalate invoices that move the low point.

### 2. The invoice
- Amount (effort scales with £).
- Days overdue and which reminder stages already passed.
- Status: sent / **viewed‑unpaid** / never viewed / part‑paid / disputed / credit‑noted.
- **Documentation strength**: signed quote / PO / proof of delivery attached? (Gates legal viability.)
- Terms + whether late fees/interest were contractually enabled.

### 3. The customer
- Relationship type: first‑time vs repeat; one‑off vs recurring revenue.
- Strategic value (% of revenue; recurring monthly value).
- Concentration risk (protect the relationship harder if they're big).
- Business vs sole trader (changes tone **and** legal window: 14 days co. vs 30 days individual/sole trader).
- Prior disputes/complaints.

### 4. Payment behaviour (learned)
- Average lateness.
- Reliability pattern (late‑but‑pays vs risky).
- Response history (reacts to email? only moves after a call?).
- Trajectory (getting slower recently = early warning).

### 5. Legal & compliance guardrails
- LBA mandatory before UK small claims; correct response window by debtor type.
- Proportionality — ladder must be climbed before formal steps.
- Scope safety — B2B, own debt, AI disclosed, human approval, audit trail.
- Statutory entitlements auto‑computed (8% over base + £40/£70/£100).

---

## C. Scoring the actions

For each candidate rung, estimate three axes, then pick the **cheapest action that closes the gap in time at acceptable relationship risk**.

- **Speed** — will cash land before `low_day`?
- **Cost** — £0 chase; ~£76 for a 2% discount on £3.8k; ~£100–180 finance; court fee + effort to escalate.
- **Relationship risk** — low (nudge to loyal) → high (threaten a strategic client).

```
def recommend(invoice, gap, low_day):
    risk    = customer_risk_score(invoice)      # 0 (safe) .. 1 (risky)
    urgency = days_until(low_day)               # small = urgent
    value   = strategic_value(invoice.contact)  # 0 .. 1

    candidates = eligible_rungs(invoice)         # gated by docs, history, stage
    for rung in candidates:
        rung.speed_ok = expected_cash_date(rung) <= low_day
        rung.cost     = estimate_cost(rung, invoice)
        rung.rel_risk = base_rel_risk(rung) * (1 + value)   # firm moves hurt more w/ valued clients

    # prefer: closes gap in time  →  lowest cost  →  lowest relationship risk
    viable = [r for r in candidates if r.speed_ok] or candidates
    return min(viable, key=lambda r: (r.cost, r.rel_risk))
```

### Customer risk score (drives how firm to be)
```
customer_risk_score(invoice):
    s = 0
    if first_time_customer(invoice.contact):        s += 0.4
    if avg_lateness(invoice.contact) > 21:          s += 0.3
    if ignored_reminders(invoice) >= 2:             s += 0.2
    if not viewed(invoice) and overdue(invoice):    s += 0.1
    if trajectory_slowing(invoice.contact):         s += 0.1
    if has_open_dispute(invoice):                   s -= 0.3   # don't chase, resolve
    if strategic_value(invoice.contact) > 0.6:      s -= 0.2   # be gentle
    return clamp(s, 0, 1)
```

### Worked example (what the card shows)
> **BrightBuild — £2,400, 17 days overdue, first‑time customer, ignored two emails.** Main cause of Thursday's £1,180 gap. Relationship risk **low** (one‑off). Recommend: **AI call today**; if no payment promise → **Letter Before Action**. Financing is faster but costs ~£140 and isn't needed if they commit.

> **Patel Catering — £900, 6 days over.** Always pays ~8 days late, 14 prior invoices, all paid. **Don't squeeze** — soft nudge only.

The engine always **shows its reasoning** — that transparency is the answer to "how do you avoid the AI‑collections horror stories."

---

## D. LLM vs deterministic split

| Deterministic (code) | LLM |
|---|---|
| Forecast / cash curve | Classify replies (promise / dispute / question) |
| Behavioural expected dates | Draft nudges, reminders, call script, LBA text |
| Risk score, cost, ranking | Explain the recommendation in plain English |
| Statutory interest calc | Summarise call transcript |

Keep money math in code; keep language and judgment in the LLM. This is both more accurate and a better trust story for judges.
