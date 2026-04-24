# Plumbline

An AI co-pilot for construction draw inspections. Plumbline ingests the approved construction drawings and specifications (structured and unstructured — sealed PDF drawings, BoQ, AIA G703 Schedule of Values, CSI Masterformat specs), the loan's finance plan with milestone tranches, and authenticated site evidence (phone photos in the hackathon slice; drone, 360°, fixed-camera and IoT telemetry in the full product), then produces a Gap Report with a concrete draw verdict — `APPROVE`, `APPROVE_WITH_CONDITIONS`, `HOLD`, or `REJECT` — citing G703 SOV line items and flagging any unapproved scope deviations.

Built for Anthropic's *Built with Opus 4.7* hackathon (Apr 21–26 2026). MIT licensed.

## Why this exists

Construction lenders release loan tranches against milestone completion, but verification today is manual: an inspector drives to site, eyeballs progress, and writes a narrative. Regulators (OCC, FDIC) have repeatedly flagged inadequate Change Order tracking as a safety-and-soundness issue. Plumbline is modelled on 50 years of civil-engineering and Construction Risk Management Consultant (CRMC) practice and turns an inspector's workflow into a structured pipeline that cites evidence back to the approved documents.

## Product premise

Plumbline is built around three principles drawn straight from CRMC practice.

**1. Multi-source, chain-of-custody evidence.** A draw decision is only as defensible as the evidence behind it. The platform is designed to accept any sealed, time-stamped, geo-bound capture — not just phones. Site imagery from **phone**, **drone** (aerial survey, orthomosaic, BVLOS flights for large pours and roof progress), **360° walkthrough rigs**, **fixed-position construction cameras**, and telemetry from **on-site IoT** (concrete maturity sensors, moisture probes, strain gauges, load cells, tilt/temperature on structural members, rebar corrosion probes). Each source is paired with *per-modality capture instructions* — "shoot the north-elevation rebar mat from 2 m, full mat in frame, before pour" / "fly the slab pre-backfill at 40 m AGL, 80 % overlap" / "log maturity at pour + 24 h and pour + 72 h" — and every artefact carries authenticated provenance (EXIF, C2PA/Content Credentials, device attestation, signed timestamp, GPS fence) so the chain of custody is intact from device to report. *Hackathon cut: phone photos only; the other modalities are schema-ready but not wired into the demo pipeline.*

**2. Full-fidelity plan ingestion, structured and unstructured.** Approved construction documents arrive in every format the industry uses. Plumbline's intake is designed for both:

- **Unstructured**: sealed PDF construction drawings (Architectural, Structural, MEP — Mechanical/Electrical/Plumbing), titleblock sheets, redlined markup PDFs, scanned CSI Masterformat specifications, RFIs, Change Order narratives.
- **Structured**: Bill of Quantities (BoQ) in Excel/CSV, AIA G703 Schedule of Values continuation sheets, structured specs keyed to CSI divisions, project schedules, and (roadmap) CAD/BIM/IFC models and shop drawings.

Agent 1 classifies each document by discipline and sheet role against its titleblock; Agent 2 normalises every format into a single discipline-keyed `PlanFormat` that downstream agents cite line-by-line.

**3. Finance modelled on lender and AIA best practice.** The `FinancePlan` mirrors conventions a construction-loan administrator already recognises: AIA **G702/G703** application-and-certificate-for-payment structure, SOV line items keyed to **CSI codes**, **retainage** with step-down (default 10 % → 5 % at 50 % completion), **Change Order thresholds** (single-item and cumulative percent of loan) tuned to OCC/FDIC expectations, **cure periods** for monetary vs non-monetary defaults, and milestone tranches whose `plannedReleasePct` values are monotonic and sum to 100. Cross-field Zod validation at ingestion catches the findings that CRMCs most often raise at the draw meeting — SOV sum mismatch, tranche over-allocation, retainage drift — before the first photo is uploaded.

## Repo layout

```
backend/    Fastify + Mongoose API, seven-agent Claude pipeline
frontend/   React 19 + Vite + Tailwind + shadcn UI
design/     Mockups and sample finance plan
research/   Source material and reference datasets
```

## Quick start

Requires **Node 20+**, **MongoDB** (local or Docker), and an **Anthropic API key**.

```bash
# 1. clone
git clone https://github.com/wutangasaf/hackathonopus.git
cd hackathonopus

# 2. mongo (skip if you already run one on :27017)
docker run -d --name plumbline-mongo -p 27017:27017 mongo:7

# 3. backend
cd backend
cp .env.example .env
echo "ANTHROPIC_API_KEY=sk-ant-..." >> .env
npm install
npm run dev                        # serves http://localhost:4000

# 4. frontend (new terminal)
cd ../frontend
npm install
npm run dev                        # serves http://localhost:5173
```

Open `http://localhost:5173` and create a project.

## The seven-agent pipeline

Six steps are Claude tool-use calls through `backend/src/lib/claudeCall.ts` (enforced tool use, Zod-validated output schema). Agent 3 is a form-driven ingester with Zod cross-field validation — no model call. Every step writes an `AgentRun` row so the UI can stream status.

```
                       ┌────────────────────────────────────────────┐
 Upload plan PDFs  ──▶ │ Agent 1  PlanClassifier           (Claude) │
                       │   discipline + sheet role + title-block    │
                       └─────────────────┬──────────────────────────┘
                                         ▼
                       ┌────────────────────────────────────────────┐
                       │ Agent 2  PlanFormatExtractor      (Claude) │
                       │   per-discipline structured "format" doc   │
                       └─────────────────┬──────────────────────────┘
                                         ▼
 Upload finance   ──▶  ┌────────────────────────────────────────────┐
 plan (JSON form)      │ Agent 3  FinancePlan ingestion             │
                       │   form + Zod cross-field validation        │
                       │   (no model call — hackathon cut)          │
                       └─────────────────┬──────────────────────────┘
                                         ▼
                       ┌────────────────────────────────────────────┐
                       │ Agent 4  PhotoGuidance            (Claude) │
                       │   tells the inspector what photos to take  │
                       │   to verify the approved draw's claims     │
                       └─────────────────┬──────────────────────────┘
                                         ▼
 Upload site      ──▶  ┌────────────────────────────────────────────┐
 photos                │ Agent 5  PhotoQuality             (Claude) │
                       │   blur / exposure / framing gate           │
                       └─────────────────┬──────────────────────────┘
                                         ▼
                       ┌────────────────────────────────────────────┐
                       │ Agent 6  PhotoToPlanFormat        (Claude) │
                       │   structured observation per photo, bound  │
                       │   to plan element kinds                    │
                       └─────────────────┬──────────────────────────┘
                                         ▼
 Request draw     ──▶  ┌────────────────────────────────────────────┐
 report                │ Agent 7  ComparisonAndGap         (Claude) │
                       │   SOV line-by-line comparison → verdict    │
                       │   APPROVE / APPROVE_WITH_CONDITIONS /      │
                       │   HOLD / REJECT                            │
                       └────────────────────────────────────────────┘
```

Agents 1 and 2 run as a chained background pipeline triggered by a plan upload. Agents 5 and 6 run as a per-photo background pipeline triggered by a photo upload (Agent 6 only fires if Agent 5 returns `quality: "GOOD"`). Agent 4 runs on demand once a Draw is approved and caches per draw (see the monthly-draw cycle below). Agent 7 runs synchronously on `POST /reports`.

## The monthly draw cycle

The 7-agent pipeline above is the project-setup machinery. Once a project is set up (plans + master SOV + Gantt), Plumbline's recurring value sits in the **monthly draw cycle** — the payment-application loop that the whole construction-lending industry runs on.

On every monthly draw the contractor submits an AIA **G702** (cover sheet) and **G703** (line-item continuation sheet). The G703 is the financial document that drives everything Plumbline does that month: it tells the system exactly which SOV line items are being billed, what percentage complete each claim is, and therefore what evidence the site inspector needs to produce.

```
 Contractor uploads  ──▶ ┌────────────────────────────────────────────┐
 G703 (+ G702)           │ G703Extractor agent              (Claude)  │
                         │   parse rows + map to Gantt milestones     │
                         │   + aiConfidence per row                   │
                         └─────────────────┬──────────────────────────┘
                                           ▼
                         ┌────────────────────────────────────────────┐
                         │ Contractor review screen                   │
                         │   confirm AI suggestions · override        │
                         │   low-confidence rows                      │
                         └─────────────────┬──────────────────────────┘
                                           ▼
                         ┌────────────────────────────────────────────┐
                         │ Draw approved · becomes canonical "claim"  │
                         │ Agents 4–7 verify against site evidence    │
                         └────────────────────────────────────────────┘
```

A `Draw` is the first-class record of one monthly payment application. It carries the contractor snapshot (hardcoded for the hackathon demo), the uploaded document refs, the extracted `lines[]` with AI milestone suggestions + confidence, and the contractor's per-row confirmation. Draw status walks `parsing → ready_for_review → approved`; the extractor fires in the background on upload and the frontend polls until the review table is ready.

The demo ships the intake + contractor-approval half of this loop plus the Agent 4 rewire: photo guidance now consumes the approved `Draw` directly — `GET /api/projects/:id/photo-guidance?drawId=<id>` (or no arg to auto-pick the latest approved draw). Every shot carries `referenceLineNumbers` so the inspector sees exactly which claimed G703 row it verifies. Rewiring Agents 6 + 7 to key off the approved `Draw` is tracked as the next follow-up.

**See also:** [`docs/CONSTRUCTION_DRAW_PROCESS.md`](docs/CONSTRUCTION_DRAW_PROCESS.md) for the business-process primer (what G702/G703 is, how the draw lifecycle runs, why the G703 drives what Plumbline inspects).

## Supervisor (Claude Managed Agents)

The seven-agent pipeline above is short-running, deterministic structured extraction — each agent is one forced-tool-use Messages-API call. Sitting beside it is a **Supervisor** built on [**Claude Managed Agents**](https://platform.claude.com/docs/en/managed-agents/overview) that runs *after* a draw is submitted and autonomously decides whether the claim is defensible.

```
 Contractor clicks       ┌────────────────────────────────────────────┐
 "Run Supervisor   ──▶   │ Supervisor · Managed Agent · Opus 4.7      │
 investigation"          │   (agent_toolset_20260401 + custom tools)  │
                         └─────────────────┬──────────────────────────┘
                                           ▼
                  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
                  │ read_draw_   │  │ read_photo_  │  │ read_plan_   │
                  │ state        │  │ evidence     │  │ scope        │
                  └──────────────┘  └──────────────┘  └──────────────┘
                                           │ (read-only over existing pipeline state)
                                           ▼
                         ┌────────────────────────────────────────────┐
                         │ generate_reinspection_request              │
                         │   targeted 3–6-shot packet + dueBy         │
                         └─────────────────┬──────────────────────────┘
                                           ▼
                         ┌────────────────────────────────────────────┐
                         │ record_finding    (exactly once per run)   │
                         │   severity · category · narrative ·        │
                         │   evidence[] · recommendation (APPROVE /   │
                         │   APPROVE_WITH_CONDITIONS / HOLD / REJECT) │
                         └────────────────────────────────────────────┘
```

**Why it's a separate agent, not an eighth step in the pipeline.** The pipeline's job is to produce structured facts — line items, per-photo observations, the gap report. The Supervisor's job is to *reason* over those facts the way a senior inspector would: cross-check the G703 claim against the photo evidence, decide whether a re-inspection is warranted, and produce a signable finding. That reasoning loop is open-ended (the agent decides what to look at next, and when to stop), which is exactly what the Managed-Agents harness is optimised for — server-side agent loop, persistent session, built-in `bash` / file / `web_search` / `web_fetch` tools in a managed cloud container for free.

**Strict "do no harm" contract.** The Supervisor never mutates any existing Plumbline collection — it reads from `Draw`, `GapReport`, `Observation`, `PhotoAssessment`, `Document`, `PlanFormat`, `AgentRun`, and writes only to three new collections (`SupervisorSession`, `SupervisorFinding`, `ReinspectionRequest`). It does not re-run any of the seven pipeline agents. If you disable the Supervisor, the rest of Plumbline behaves identically.

**Endpoints.** `POST /api/projects/:id/supervisor/investigate` (SSE stream of live events + final snapshot), `GET /api/projects/:id/supervisor/sessions/:sessionId` (replay), `GET /api/projects/:id/supervisor/sessions` (list). UI: the `▸ Run supervisor investigation` button on the contractor's submitted-draw screen opens a side-sheet with a live trace of agent messages, tool calls, the verdict card, and the re-inspection packet.

**Smoke test** (verify the Managed Agents bootstrap end-to-end without a real project):

```bash
ANTHROPIC_API_KEY=sk-... npx tsx backend/scripts/smokeSupervisor.ts
# → creates/caches agent + environment, opens a session, exchanges one turn, prints [smoke] OK
```

## End-to-end use case

The full happy path, driven by `curl` against a local backend. Replace `$PROJECT` with the id returned from step 1.

**1. Create a project**

```bash
curl -sX POST http://localhost:4000/api/projects \
  -H 'content-type: application/json' \
  -d '{"name":"101 Main","address":"101 Main St"}'
# → { "_id": "<PROJECT>", ... }
```

**2. Upload approved construction drawings** (multipart, multiple files ok — kicks off Agents 1 + 2; the demo accepts sealed PDF drawings, the production intake is designed for BoQ / G703 / CSI-spec structured documents alongside unstructured PDFs)

```bash
curl -sX POST http://localhost:4000/api/projects/$PROJECT/plans \
  -F 'file=@architectural.pdf' \
  -F 'file=@structural.pdf'
# → { "documents": [...], "pendingAgents": ["PlanClassifier","PlanFormatExtractor"],
#     "pipelineKickedOff": true }

curl -s http://localhost:4000/api/projects/$PROJECT/plan-classification    # poll until present
curl -s http://localhost:4000/api/projects/$PROJECT/plan-format?discipline=ARCHITECTURE
```

**3. Post the finance plan** (form-first, AIA G702/G703 shape — Zod cross-field validation: SOV sum vs `totalBudget`, tranche sum vs `loanAmount`, monotonic milestone `plannedReleasePct` ending at 100, retainage step-down consistency, CO threshold sanity)

```bash
# design/sample_finance_plan.json has PLAN_DOC_PLACEHOLDER refs — strip or swap
# them for real documentIds returned in step 2 before POSTing.
jq '.milestones[].planDocRefs=[]' design/sample_finance_plan.json \
  | curl -sX POST http://localhost:4000/api/projects/$PROJECT/finance-plan \
      -H 'content-type: application/json' --data-binary @-
```

Supported `loanType`: `residential`, `commercial_poc`, `hud_221d4`, `hybrid`. `milestones[].status` progresses `pending → in_progress → claimed → verified | rejected`.

**4. Get photo guidance for the approved draw** (Agent 4 — cached per draw; pass `regenerate=1` to force a re-run. Requires an approved `Draw` on the project — upload a G703 at `POST /:id/draws`, walk it through the contractor approval flow, then call this. With no `drawId` the endpoint auto-picks the latest approved draw.)

```bash
curl -s "http://localhost:4000/api/projects/$PROJECT/photo-guidance"
curl -s "http://localhost:4000/api/projects/$PROJECT/photo-guidance?drawId=$DRAW"
```

**5. Upload site evidence** (HEIC/JPEG phone captures for the demo — server transcodes on `GET /photos/:id/raw` and preserves EXIF for provenance; kicks off Agents 5 + 6 per artefact. Drone, 360° and IoT intake share the same `Observation` shape but are not wired in the hackathon build.)

```bash
curl -sX POST http://localhost:4000/api/projects/$PROJECT/photos \
  -F 'file=@site1.heic' -F 'file=@site2.jpg'
```

**6. Generate a gap report** (Agent 7, synchronous)

```bash
curl -sX POST "http://localhost:4000/api/projects/$PROJECT/reports?milestoneId=<MILESTONE>"
# → GapReport with { verdict: "APPROVE" | "APPROVE_WITH_CONDITIONS" | "HOLD" | "REJECT", ... }
```

**7. Watch agent progress** (any time)

```bash
curl -s http://localhost:4000/api/projects/$PROJECT/runs
```

## Scope (hackathon cut)

The premise above is the full product. The table below is the slice wired into the demo pipeline for the Apr 21–26 hackathon. Everything in the *Out* column is schema-ready but not exercised end-to-end.

| In scope                                                                 | Out (roadmap)                                                           |
|--------------------------------------------------------------------------|-------------------------------------------------------------------------|
| Four disciplines: `ARCHITECTURE`, `STRUCTURAL`, `ELECTRICAL`, `PLUMBING` | Mechanical / Civil / Landscape / Fire-protection as separate lanes     |
| Sealed PDF construction drawings                                         | CAD / BIM / IFC, shop drawings, redlined markup reconciliation         |
| Phone photos with EXIF provenance                                        | Drone orthomosaic, 360° walkthrough, fixed-site cameras, IoT telemetry |
| Residential loans as the demo path; `commercial_poc` schema-ready        | Full commercial / HUD 221(d)(4) productisation                          |
| Form-first finance-plan ingestion (AIA G702/G703 conventions)            | Excel/PDF G703 + BoQ OCR ingestion (Agent 3b, not in demo)              |

## Productisation: template service

The demo pipeline is LLM-first — Claude reads a plan it has never seen and returns a structured `PlanFormat`. That's the right starting point, but at scale construction lenders work with repeat counterparties: the same GC's SOV format, the same architect's titleblock, the same bank's draw schedule. For those recurring formats, template-based extraction is strictly more deterministic, cheaper per document, and doesn't regress when a prompt changes.

The v2 shape is an **optional side service** offering three surfaces:

- **Mapping** — bind columns, cells or regions of a sample document to `PlanFormat.elements[]` fields (`elementId`, `kind`, `identifier`, `spec`).
- **Parsing templates** — saved and versioned per counterparty (e.g. `BigGC Inc. SOV / v3`, `Smith & Partners titleblock / v1`).
- **Extraction rules** — regex, column ranges, keyword anchors — applied before any LLM fallback.

Agent 1 is the natural routing point: a titleblock match flips the document onto the deterministic template path; no match falls through to the existing LLM extractors (Agent 2 for plans, the future Agent 3b for G703 / BOQ). Template hits preserve accuracy over time with minimal ops overhead; LLM handles the long tail.

**Demo surface (frontend suggestion):** a `Use a template` toggle or a `Mock: apply BigGC SOV template` button on the upload page — signals the routing intent in the video/demo without building the template editor UI for the hackathon.

## Tech stack

- **Backend**: Node 20+, TypeScript, Fastify 4, Mongoose 8, Zod, Anthropic SDK, `pdf-to-img`, `heic-convert`, `exifr`
- **Frontend**: React 19, Vite 8, Tailwind 3, shadcn/ui, TanStack Query, Zustand, react-router, framer-motion, dnd-kit
- **Database**: MongoDB 7
- **Model**: `claude-opus-4-7` (configurable via `ANTHROPIC_MODEL`)
- **Agent platforms**: Messages API with forced tool use for the 7-agent structured-extraction pipeline; **Claude Managed Agents (beta)** for the autonomous Supervisor

## Sub-READMEs

- [`backend/README.md`](backend/README.md) — endpoint reference, env vars, agent internals
- [`frontend/README.md`](frontend/README.md) — UI routes and dev commands

## License

[MIT](LICENSE).
