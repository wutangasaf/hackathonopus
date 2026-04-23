# Plumbline

An AI co-pilot for construction draw inspections. Plumbline ingests the approved construction plans (PDFs), the loan's finance plan with milestone tranches, and phone photos from the site, then produces a Gap Report with a concrete draw verdict — `APPROVE`, `APPROVE_WITH_CONDITIONS`, `HOLD`, or `REJECT` — citing G703 SOV line items and flagging any unapproved scope deviations.

Built for Anthropic's *Built with Opus 4.7* hackathon (Apr 21–26 2026). MIT licensed.

## Why this exists

Construction lenders release loan tranches against milestone completion, but verification today is manual: an inspector drives to site, eyeballs progress, and writes a narrative. Regulators (OCC, FDIC) have repeatedly flagged inadequate Change Order tracking as a safety-and-soundness issue. Plumbline is modelled on 50 years of civil-engineering and Construction Risk Management Consultant (CRMC) practice and turns an inspector's workflow into a structured pipeline that cites evidence back to the approved documents.

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
                       │   for the active milestone                 │
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

Agents 1 and 2 run as a chained background pipeline triggered by a plan upload. Agents 5 and 6 run as a per-photo background pipeline triggered by a photo upload (Agent 6 only fires if Agent 5 returns `quality: "GOOD"`). Agent 4 runs on demand and caches per milestone. Agent 7 runs synchronously on `POST /reports`.

## End-to-end use case

The full happy path, driven by `curl` against a local backend. Replace `$PROJECT` with the id returned from step 1.

**1. Create a project**

```bash
curl -sX POST http://localhost:4000/api/projects \
  -H 'content-type: application/json' \
  -d '{"name":"101 Main","address":"101 Main St"}'
# → { "_id": "<PROJECT>", ... }
```

**2. Upload approved plan PDFs** (multipart, multiple files ok — kicks off Agents 1 + 2)

```bash
curl -sX POST http://localhost:4000/api/projects/$PROJECT/plans \
  -F 'file=@architectural.pdf' \
  -F 'file=@structural.pdf'
# → { "documents": [...], "pendingAgents": ["PlanClassifier","PlanFormatExtractor"],
#     "pipelineKickedOff": true }

curl -s http://localhost:4000/api/projects/$PROJECT/plan-classification    # poll until present
curl -s http://localhost:4000/api/projects/$PROJECT/plan-format?discipline=ARCHITECTURE
```

**3. Post the finance plan** (form-first — Zod cross-field validation: SOV sum, tranche sum, monotonic milestone percentages ending at 100)

```bash
# design/sample_finance_plan.json has PLAN_DOC_PLACEHOLDER refs — strip or swap
# them for real documentIds returned in step 2 before POSTing.
jq '.milestones[].planDocRefs=[]' design/sample_finance_plan.json \
  | curl -sX POST http://localhost:4000/api/projects/$PROJECT/finance-plan \
      -H 'content-type: application/json' --data-binary @-
```

Supported `loanType`: `residential`, `commercial_poc`, `hud_221d4`, `hybrid`. `milestones[].status` progresses `pending → in_progress → claimed → verified | rejected`.

**4. Get photo guidance for the active milestone** (Agent 4 — cached; pass `regenerate=1` to force a re-run)

```bash
curl -s "http://localhost:4000/api/projects/$PROJECT/photo-guidance"
```

**5. Upload site photos** (HEIC ok — server transcodes to JPEG on `GET /photos/:id/raw`; kicks off Agents 5 + 6 per photo)

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

| In scope                                                             | Out                                          |
|----------------------------------------------------------------------|----------------------------------------------|
| Four disciplines: `ARCHITECTURE`, `STRUCTURAL`, `ELECTRICAL`, `PLUMBING` | Mechanical/Civil/Landscape as separate lanes |
| PDF plans                                                            | CAD / BIM / IFC                              |
| Phone photos                                                         | 360°, drone, fixed-camera                    |
| Residential loans as the demo path; `commercial_poc` schema-ready    | Full commercial/hud productization           |
| Form-first finance-plan ingestion                                    | Excel/PDF G703 OCR (Agent 3b, not in demo)   |

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

## Sub-READMEs

- [`backend/README.md`](backend/README.md) — endpoint reference, env vars, agent internals
- [`frontend/README.md`](frontend/README.md) — UI routes and dev commands

## License

[MIT](LICENSE).
