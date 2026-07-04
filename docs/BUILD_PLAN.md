# Squeeze — 48-Hour Build Plan

Principle: **one workflow that works flawlessly beats three that half-work.** Build the Credit Controller deep; gesture at the finance department. Protect the two things no one else will have: the **decision layer** and the **healing Safe-to-Spend number**.

## Hour budget (~28 focused hours + buffer)

### Phase 0 — Foundation (~4h) — do not skip
- [ ] Xero demo org + custom connection + granular scopes verified (`XERO_SCOPES` set).
- [ ] `.env` wired; MCP server connecting; one live `GET /Invoices` returning data.
- [ ] **Seed script** (`scripts/seed.ts`): ~15 contacts, 6–12 months backdated invoices + payments, plus payroll/bill/VAT in next 14 days so a real gap exists. (See `XERO_INTEGRATION.md` §6.)
- [ ] ngrok tunnel + webhook endpoint returning 200 with HMAC verify.

### Phase 1 — The engine (~10h)
- [ ] Forecast: pull invoices/bills/balance → **behavioural expected dates** → 14‑day curve → Safe‑to‑Spend + `low_day`/`gap` (deterministic).
- [ ] Diagnose: rank invoices causing the gap.
- [ ] Decision: `customer_risk_score`, action eligibility gates, 3‑axis ranking, `recommend()`.
- [ ] Unit‑sanity on seeded data: the gap and the recommendation must match the demo narrative.

### Phase 2 — Actions (~8h)
- [ ] **AI phone call first** (highest risk): Twilio Voice + TTS, disclose AI, capture reply (promise/dispute), summarise, log to Xero. **Record backup video the instant it works.**
- [ ] AI‑drafted nudge/firm reminder via WhatsApp/SMS (Twilio) + email fallback.
- [ ] Financing comparison card (illustrative quotes; label; name Satago/FundTap as prod).
- [ ] Letter Before Action generator: pull evidence, auto‑compute statutory interest (8% over base) + fixed comp (£40/£70/£100), output PDF; attach via Files API.
- [ ] Write‑backs: notes, expected dates, logged call, action log.

### Phase 3 — UI + heal (~6h)
- [ ] Safe‑to‑Spend timeline (14‑day curve, gap highlighted below buffer line).
- [ ] Action cards with speed/cost/relationship‑risk + the plain‑English recommendation.
- [ ] "Don't squeeze" card for the loyal customer (the trust beat).
- [ ] Monday briefing screen + 30‑sec TTS audio + Treasury & Procurement cards + one revenue insight card.
- [ ] **Heal animation**: payment webhook (real or simulated) → recompute → SSE → number climbs.

### Phase 4 — Polish + rehearse (buffer)
- [ ] Compliance/trust slide.
- [ ] "Demo mode" using seeded data (no network dependence on stage).
- [ ] Rehearse ×3; full backup screen recording; measurable numbers ready (£ gap closed, DSO −N).

## Fallback tiers (decide by Saturday evening)

1. **Live AI call flaky** → play recorded call, or swap climax to AI‑drafted final notice + LBA pack.
2. **Webhooks unavailable** → poll `/Payments`; heal via a manual "mark paid" button firing a simulated event.
3. **Way behind** → cut Treasury/Procurement to static cards; ship Credit Controller + healing forecast only — still wins the narrative wrapped in the department story.
4. **Financing API** → always mocked; never a blocker.

## Cut order (if time is short)
Cut in this order, never earlier items first:
1. Procurement deep logic → static card.
2. Treasury deep logic → static card.
3. Invoice financing → single illustrative card.
4. Letter Before Action → template only (no Files attach).
5. AI phone call → drafted firm notice.
**Never cut:** forecast with behavioural dates, gap diagnosis, decision/recommendation, healing number.

## Definition of done (demo)
A judge watches: healthy‑looking balance → Squeeze warns of Thursday's £1,180 gap → names the 3 invoices → declines to squeeze the loyal one → places a live AI call on the ghoster → payment lands → Safe‑to‑Spend visibly heals → briefing shows Treasury/Procurement upside. All Xero‑driven, all with approval.

## Team split (if 3–4 people)
- **A:** Xero client, seed script, webhooks, write‑backs.
- **B:** forecast + decision engine.
- **C:** Twilio call + messaging + TTS + LBA generator.
- **D:** UI, timeline, cards, heal animation, deck + rehearsal.
