# Prompt — generate a Plumbline-compatible construction-loan finance plan (XLSX)

Paste this into Claude, ChatGPT, or an XLSX-capable model to produce a realistic sample finance plan that Plumbline's Agent 3 (FinancePlanIngester) can ingest. The schema is deliberately aligned with `backend/src/models/financePlan.ts` so the output parses cleanly.

---

You are a commercial-banking analyst at a mid-size community bank. Produce a single Excel workbook (.xlsx) for a **residential construction loan** called "Plumbline Sample — Potwine Passive House." The borrower is a small-builder LLC; the property is a new-construction single-family passive house in Western Massachusetts. The loan is being underwritten under standard residential construction-loan conventions (retainage, monthly draws on verified progress, change-order thresholds, material-delay trigger, cure periods). The construction side involves four disciplines only: **ARCHITECTURE, STRUCTURAL, ELECTRICAL, PLUMBING**. Assume a 12-month construction term.

Produce **four sheets**, in this order, with these exact tab names:

### Sheet 1 — `Loan_Terms`

A two-column key/value sheet (column A = field name, column B = value). Include:

- `projectName` — "Potwine Passive House"
- `borrowerName` — "Potwine Builders LLC"
- `loanType` — one of: `residential`, `commercial_poc`, `hud_221d4`, `hybrid`. Use `residential`.
- `loanAmount` — in USD, e.g. 850000
- `totalBudget` — loanAmount + borrower equity; e.g. 1050000
- `currency` — "USD"
- `retainagePct` — 10
- `retainageStepDownAt` — 50 (percent complete at which retainage steps down)
- `retainageStepDownTo` — 5
- `coThresholdSingle` — 50000 (single-change-order dollar threshold that triggers bank approval)
- `coThresholdCumulativePct` — 5 (cumulative CO threshold as percent of loanAmount that triggers re-underwriting)
- `materialDelayDays` — 60
- `cureDaysMonetary` — 10
- `cureDaysNonMonetary` — 30
- `loanClosingDate` — a realistic date; ISO format YYYY-MM-DD
- `requiredCompletionDate` — ~12 months after closing; ISO

### Sheet 2 — `SOV` (schedule of values, G703-style)

One row per line item. Columns, in order:

| lineNumber | description | csiCode | scheduledValue | disciplineHint | zoneHint |
|---|---|---|---|---|---|

Produce **18–24 line items** covering the full scope. Use real CSI MasterFormat division prefixes where plausible (e.g. 02 Site Preparation, 03 Concrete, 06 Wood, Rough Carpentry, 07 Thermal & Moisture, 08 Openings, 09 Finishes, 15/22 Plumbing, 16/26 Electrical). Include at minimum:

- Site prep & excavation
- Foundation (concrete)
- Rough framing
- Roof sheathing + membrane
- Windows + exterior doors
- Exterior cladding
- Insulation + air sealing (passive-house relevant)
- Rough plumbing
- Plumbing fixtures
- Rough electrical
- Electrical fixtures + trim
- HVAC (ERV/heat-pump)
- Interior drywall
- Interior finishes (paint, trim, flooring)
- Cabinets + countertops
- Final cleanup
- Builder's GC / overhead (~10% of trade subtotal)
- Contingency (5–8% of trade subtotal)

For each row:
- `lineNumber` — "001", "002", ... zero-padded
- `csiCode` — real-ish CSI code string (e.g. "03 30 00" for cast-in-place concrete), leave blank for GC/overhead/contingency
- `scheduledValue` — USD amount; the sum of all scheduledValue rows MUST equal `totalBudget` from Sheet 1 exactly.
- `disciplineHint` — one of ARCHITECTURE | STRUCTURAL | ELECTRICAL | PLUMBING. Items that span multiple disciplines (e.g. rough framing) get the dominant one (STRUCTURAL). Site prep, finishes, GC, and contingency → ARCHITECTURE.
- `zoneHint` — short free-text location ("foundation", "main floor", "site-wide", "MEP chase"), or blank.

### Sheet 3 — `Milestones`

One row per milestone. Columns, in order:

| sequence | name | plannedCompletionDate | plannedPercentOfLoan | status |
|---|---|---|---|---|

Produce **6–8 milestones** tied to real residential construction phases. Each milestone represents a draw event:

1. Site prep & foundation (~10–15% of loan)
2. Rough framing + roof dried-in (~25–30%)
3. Exterior envelope closed (~45–50%) — this is the retainage step-down trigger
4. Rough MEP inspections passed (~60–65%)
5. Insulation + drywall (~75%)
6. Interior finishes + fixtures (~90%)
7. Certificate of occupancy (~98%)
8. Final retainage release (100%)

For each row:
- `sequence` — 1, 2, 3, ...
- `name` — short human label ("Foundation complete", "Dried-in", "CO")
- `plannedCompletionDate` — ISO, spaced across the 12-month term
- `plannedPercentOfLoan` — 0–100, monotonically increasing, ending at 100
- `status` — all `pending` for a brand-new loan

The final milestone's `plannedPercentOfLoan` MUST be 100.

### Sheet 4 — `Milestone_Requirements`

Flat join table tying each milestone to the discipline/element progress required to claim its draw. Columns:

| milestoneSequence | discipline | elementKindOrId | minPct | requiredDocs |
|---|---|---|---|---|

One row per (milestone, required-completion-item). Examples of rows for milestone 2 (Dried-in):

- 2 | STRUCTURAL | rough_framing | 100 | (blank)
- 2 | ARCHITECTURE | roof_sheathing | 100 | "roof inspection sign-off"
- 2 | ARCHITECTURE | windows | 90 | "window schedule w/ installer invoice"

For each milestone include **2–5 required-completion rows** and **1–3 requiredDocs strings** distributed across those rows. Use `elementKindOrId` values a field inspector would recognize (`foundation`, `rough_framing`, `roof_sheathing`, `exterior_cladding`, `rough_plumbing`, `rough_electrical`, `insulation_air_sealing`, `drywall`, `plumbing_fixtures`, `electrical_trim`, `cabinets`, `final_finish`). `minPct` is the % completion of that element/discipline the inspector must verify to unlock the draw.

Include `requiredDocs` strings like "executed lien waiver from <sub>", "building-dept inspection record", "change-order log delta", "insurance COI current through <date>".

---

### Hard constraints

1. All dollar amounts are integers (no cents). Sum of `SOV.scheduledValue` rows equals `Loan_Terms.totalBudget` exactly — validate before returning.
2. Milestones' `plannedPercentOfLoan` values are strictly monotonic and the final row is 100.
3. Dates are ISO format YYYY-MM-DD, no timestamps.
4. Enum fields use the exact strings listed above — no synonyms.
5. No merged cells, no colors, no formulas — plain values only. First row of each sheet is the header row.
6. Every row in `Milestone_Requirements` references a `milestoneSequence` that exists in `Milestones`.

Return the workbook as a downloadable `.xlsx` file. No narrative in the response — just the file.
