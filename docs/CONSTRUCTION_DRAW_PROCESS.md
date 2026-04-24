# The construction draw process — a primer

Plumbline lives inside a specific industry workflow: the monthly construction-loan **draw**. This doc explains that workflow in plain language, names the paperwork, and maps each step to where Plumbline fits. Read this before touching the finance-plan code or the contractor page — most of the product's decisions are downstream of these definitions.

## Why this exists

A construction lender (a bank or a HUD-backed credit line) does not hand the full loan to the developer on day one. That would mean the lender is carrying 100% of the project risk before a single shovel hits the dirt. Instead, money is released in installments — called **draws** — as work gets completed. Each draw requires proof that the claimed work is actually done.

A **draw** is a cash event. It happens roughly once a month (sometimes bi-weekly on fast-track commercial projects) and it carries a specific paper trail. The paper trail is what Plumbline parses, verifies, and adjudicates.

## The two forms: G702 and G703

Almost every commercial project in the US (and most sophisticated residential ones) use a pair of forms published by the American Institute of Architects: **AIA G702** and **AIA G703**. They have been industry standard since 1992. A construction-loan administrator expects to see them.

**G702 — "Application and Certificate for Payment"** is the cover sheet. One page. It is the top-line summary of this draw:
- Original contract sum
- Change orders to date
- Total completed and stored to date
- Retainage held back (typically 5–10%)
- **Current payment due** — the dollar amount the contractor is requesting this period
- Signature block for the architect/engineer certifying that the work described is, in fact, done

**G703 — "Continuation Sheet"** is the line-item backup. This is the dense tabular sheet you've seen — a table with one row per SOV line item. Typical columns:

| A | B | C | D | E | F | G | H | I | J |
|---|---|---|---|---|---|---|---|---|---|
| Item No | Description of Work | Scheduled Value | Completed from Previous Application | Work This Period | Materials Stored | Total Completed and Stored | % (G÷C) | Balance to Finish | Retainage |

A residential G703 might have 20–40 rows. A commercial G703 might have 80–200. Every row corresponds to a line in the approved **Schedule of Values** (SOV) that the contractor agreed to with the bank at loan closing.

**The relationship is simple:**
- The G702 says _"give me $847,500 this month"_.
- The G703 says _"here is exactly which line items that $847,500 covers, and how far along each of those line items now is"_.

## The construction-loan lifecycle

```
┌─────────────────────┐
│ Pre-construction    │ Loan approved · SOV agreed · contracts signed · permits pulled
└──────────┬──────────┘
           ▼
┌─────────────────────┐
│ Project setup       │ Plumbline ingests plans, finance plan (master SOV), Gantt
└──────────┬──────────┘
           ▼
 ┌─────────────────────────────────────────────┐
 │ ┌─────────────────────────────────────────┐ │
 │ │ Monthly draw cycle (repeats N times)    │ │
 │ │  1. Contractor submits G702 + G703      │ │
 │ │  2. Agent extracts + maps to milestones │ │
 │ │  3. Contractor confirms row mapping     │ │
 │ │  4. Draw ready for inspection           │ │
 │ │  5. Inspector uploads site photos       │ │
 │ │  6. Pipeline verifies claim vs evidence │ │
 │ │  7. Bank releases tranche (or HOLDs)    │ │
 │ └─────────────────────────────────────────┘ │
 └─────────────────┬───────────────────────────┘
                   ▼
┌─────────────────────┐
│ Closeout / retainage │ Final draw · punch list · C of O · retainage release
└─────────────────────┘
```

The interesting loop is the middle box. It happens 6–24 times on a typical project.

## What triggers a draw

Three things, together:

1. **The calendar.** The draw schedule is defined in the loan agreement. Monthly is typical; fast-track commercial may be bi-weekly.
2. **Work actually completed.** Contractors do not submit draws for $200 — they accumulate a meaningful amount of work first.
3. **Cash-flow pressure.** The contractor has to pay subs and suppliers. Every day the lender sits on a draw, the contractor is fronting payroll. Draw delays compound quickly. **This is why inspection latency is a real product problem**, not a nice-to-have.

## Where Plumbline fits

Plumbline is the **bank-side inspector's tool**. It sits between step 4 ("draw ready for inspection") and step 7 ("bank releases tranche"). Historically this step has been 4–8 hours of a senior Construction Risk Management Consultant's time per project per month, manually cross-referencing photos against plans against the G703.

The pipeline does the cross-referencing:

1. **Project setup (once):** plans + master SOV + Gantt are ingested. Plans are classified by discipline, the finance plan is validated (SOV sum == totalBudget; tranches sum == loanAmount; plannedPercentOfLoan monotonic to 100).
2. **G703 parse + milestone mapping (per draw):** the `G703Extractor` agent reads the contractor's PDF, extracts every row, and suggests which project milestone each row bills against. The contractor confirms or overrides.
3. **Photo guidance (per draw):** Agent 4 turns the approved draw into a targeted shot list — "you're claiming 40% drywall on floor 2; here's what to photograph to prove it".
4. **Photo pipeline (per upload):** Agent 5 gates quality, Agent 6 extracts structured observations bound to plan elements.
5. **Gap report (per draw):** Agent 7 compares the claim (what the G703 says was completed) against the evidence (the structured observations) and emits a verdict: `APPROVE` / `APPROVE_WITH_CONDITIONS` / `HOLD` / `REJECT`.

## The key architectural insight: the G703 drives what gets inspected

Most "construction AI" tools treat photos as the primary input and try to infer everything downstream from them. That inverts the actual workflow.

In real construction-loan administration, **the financial document comes first**. The contractor is claiming _specific_ percentages on _specific_ line items. The inspector's job is to verify _those specific claims_. A photo of the wrong wall is useless; a photo of the wall named in line 14 of the G703 is evidence.

Plumbline's pipeline mirrors this. When a contractor submits a G703 claiming "HVAC Ductwork, 40% this period", that line determines:
- Which milestone the claim rolls up into (`aiSuggestedMilestoneId`).
- Which plan sheets are relevant (via `FinancePlan.milestones[].planDocRefs`).
- Which discipline the photo pipeline filters against (`aiSuggestedDiscipline: PLUMBING` for MEP).
- Which photo-guidance shots are generated for the inspector.
- Which comparison the gap report will make.

The G703 is not just a form to parse — it is the spec for what the rest of the pipeline must prove.

## Retainage and the final draw

At closeout the lender holds back **retainage** — usually 5–10% of every draw to date — until the general contractor finishes the punch list, the Certificate of Occupancy is issued, and lien waivers from all subs are collected. The final G702 then requests the full retainage release. This step is out of scope for the current product but the data model leaves room: `FinancePlan.retainagePct`, `retainageStepDownAt`, `retainageStepDownTo` are already persisted.

## Glossary

- **AIA G702 / G703** — the standard payment-application forms. G702 cover, G703 line items. Published by the American Institute of Architects.
- **CRMC** — Construction Risk Management Consultant. The bank-side inspector. Plumbline's primary user.
- **Draw** — one payment event in the monthly cycle. Each is evidenced by a G702 + G703 pair and results in a tranche release (or a HOLD).
- **CSI MasterFormat** — numeric classification of construction work (03=Concrete, 09=Finishes, 26=Electrical, etc.). Well-formed G703s carry CSI codes per line, which makes milestone mapping deterministic. The `G703Extractor` agent uses CSI when present.
- **Retainage** — the percentage of each draw the lender holds back until closeout. Typical: 10% through 50% completion, stepping down to 5% thereafter.
- **Schedule of Values (SOV)** — the master budget broken into line items. Lives in Plumbline as `FinancePlan.sov[]`. Uploaded once per project at setup. The G703 is a monthly status update against the SOV; the SOV itself does not change mid-project except via a Change Order.
- **Tranche** — the lump of loan proceeds released after a draw is approved. Lives on `FinancePlan.milestones[].trancheAmount`.
- **Change Order** — a mid-project contractual amendment that alters the scope, schedule, or price. Regulators (OCC, FDIC) flag inadequate CO tracking as a safety-and-soundness issue — which is why `FinancePlan.coThresholdSingle` and `coThresholdCumulativePct` exist.
