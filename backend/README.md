# Plumbline — backend

Fastify + Mongoose API and the seven-agent Claude pipeline. See the [root README](../README.md) for the product pitch and the end-to-end use case.

## Environment

Copy `.env.example` to `.env`:

```
PORT=4000
MONGO_URL=mongodb://localhost:27017/plumbline
UPLOADS_DIR=./uploads
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-opus-4-7         # optional, defaults to claude-opus-4-7
LOG_LEVEL=info                          # optional
```

## Run

```bash
npm install
npm run dev        # tsx watch
npm run typecheck  # tsc --noEmit
npm run build      # tsc → dist/
npm start          # node --import tsx src/server.ts
```

## Endpoints

All routes are mounted under `/api/projects`.

### Projects

| Method | Path     | Notes                                         |
|--------|----------|-----------------------------------------------|
| POST   | `/`      | Body `{ name, address? }`. Returns 201.       |
| GET    | `/`      | List all projects, newest first.              |
| GET    | `/:id`   | Get one.                                      |

### Plans (PDF)

| Method | Path                           | Notes                                                         |
|--------|--------------------------------|---------------------------------------------------------------|
| POST   | `/:id/plans`                   | Multipart, N files. Dedupes by SHA-256. Kicks off Agents 1+2. |
| GET    | `/:id/plans`                   | List plan documents.                                          |
| DELETE | `/:id/plans/:docId`            | 409 if referenced by a milestone.                             |
| GET    | `/:id/plan-classification`     | Latest Agent 1 output.                                        |
| GET    | `/:id/plan-format?discipline=` | Discipline ∈ {ARCHITECTURE, STRUCTURAL, ELECTRICAL, PLUMBING}. Omit to get all. |

### Finance plan

| Method | Path                                              | Notes                                                         |
|--------|---------------------------------------------------|---------------------------------------------------------------|
| POST   | `/:id/finance-plan`                               | Create (201).                                                 |
| PUT    | `/:id/finance-plan`                               | Replace (200).                                                |
| GET    | `/:id/finance-plan`                               | Latest.                                                       |
| GET    | `/:id/finance-plan/current-milestone`             | First non-terminal milestone by `sequence`.                   |
| PATCH  | `/:id/finance-plan/milestones/:milestoneId`       | Body `{ actualReleasePct?, amountReleased?, status? }`.       |

Create/replace enforces: SOV `scheduledValue` sum equals `totalBudget`; milestone `plannedPercentOfLoan` strictly monotonic and ends at 100; `sum(trancheAmount) == loanAmount ± $1`; `planDocRefs` reference existing `PLAN` documents on this project.

### Draws (monthly G702/G703 cycle)

A `Draw` is one monthly payment application: the contractor uploads a G703 (required, parsed) and an optional G702 cover sheet, the `G703Extractor` agent parses line items and suggests a milestone per row, the contractor confirms or overrides each row, and the draw is approved. See [`docs/CONSTRUCTION_DRAW_PROCESS.md`](../docs/CONSTRUCTION_DRAW_PROCESS.md) for the business process.

| Method | Path                                                     | Notes                                                                                       |
|--------|----------------------------------------------------------|---------------------------------------------------------------------------------------------|
| POST   | `/:id/draws`                                             | Multipart: `g703` file (required, PDF), `g702` file (optional), optional `periodStart`/`periodEnd` text fields. Creates Draw (`status=parsing`), kicks off `G703Extractor`. Returns 201 immediately with the Draw row. |
| GET    | `/:id/draws`                                             | List draws for this project, newest `drawNumber` first.                                     |
| GET    | `/:id/draws/:drawId`                                     | Full detail including `lines[]` with AI suggestions + contractor approval state.            |
| PATCH  | `/:id/draws/:drawId/lines/:lineIndex`                    | Body `{ approvalStatus: "pending"\|"confirmed"\|"overridden", confirmedMilestoneId? }`. `overridden` requires `confirmedMilestoneId`. |
| POST   | `/:id/draws/:drawId/approve`                             | Finalise. 409 if any row still `pending` or status ≠ `ready_for_review`. Sets `status="approved"`, `approvedAt=now`, backfills `confirmedMilestoneId` from the AI suggestion for confirmed rows. |
| GET    | `/:id/draws/:drawId/verification`                        | Read-only join: each draw line + its matching `sovLineFinding` (per-G703-line verdict from the latest GapReport) + photo evidence + per-line and aggregate `claimed` / `verified` totals. No agent run. Used by the inspector / report UI to render the draw verdict. |

`Draw.status` progresses `parsing → ready_for_review → approved` (or `failed` if the extractor throws). The frontend polls `GET /:id/draws/:drawId` until `status="ready_for_review"` before rendering the review table. Each `lines[].aiConfidence` is `0–1`; surface rows `<0.85` as requiring an explicit action.

The hardcoded demo contractor lives in `src/lib/defaultContractor.ts` and is snapshotted onto every new Draw. No auth.

### Photo guidance

| Method | Path                                                                  | Notes                                                                                 |
|--------|-----------------------------------------------------------------------|---------------------------------------------------------------------------------------|
| GET    | `/:id/photo-guidance?drawId=…&regenerate=1`                           | Agent 4. Reads the approved `Draw.lines[]` to build a shot list that verifies each claimed G703 row against uploaded PlanFormat elements. Auto-selects the latest `approved` Draw if `drawId` is omitted. 404 if no approved Draw exists; 409 if the passed `drawId` is not yet approved. Each shot carries `referenceLineNumbers: string[]` back-linking to the G703 rows. Cached per draw; pass `regenerate=1` to force.  |

### Photos

| Method | Path                                  | Notes                                                                 |
|--------|---------------------------------------|-----------------------------------------------------------------------|
| POST   | `/:id/photos`                         | Multipart, N files. Dedupes by SHA-256. HEIC accepted. Kicks off Agents 5 (+6). |
| GET    | `/:id/photos`                         | List photos.                                                          |
| GET    | `/:id/photos/:photoId`                | Document + latest `PhotoAssessment` + latest `Observation`.           |
| GET    | `/:id/photos/:photoId/raw`            | Bytes. HEIC is transcoded to JPEG on the fly.                         |
| DELETE | `/:id/photos/:photoId`                | Cancels running Agent 5/6 runs for this photo; removes assessment + observation. |

### Reports

| Method | Path                                                        | Notes                                                   |
|--------|-------------------------------------------------------------|---------------------------------------------------------|
| POST   | `/:id/reports?milestoneId=…` *or* `?drawId=…`              | Synchronous — runs Agent 7. Returns the GapReport (201). When `drawId` is passed, the agent picks the most-claimed milestone among that draw's confirmed lines (Σ `amountThisPeriod`, tie-broken by lowest `sequence`) and the resulting report is tagged with `drawId`. Pass nothing to default to the first non-terminal milestone. |
| GET    | `/:id/reports`                                              | List reports, newest first.                             |
| GET    | `/:id/reports/:reportId`                                    | One report.                                             |

**Per-G703-line verdict** lives on `GapReport.sovLineFindings[]` — each entry has `sovLineNumber` (the join key), `claimedPct`, `observedPct`, `variance`, `flag` ∈ `{ok, minor, material, unapproved_scope}`, and `evidencePhotoIds[]` (Document refs).

**Join key.** `Draw.lines[].lineNumber` (string, set by `G703Extractor`) === `FinancePlan.sov[].lineNumber` (string, set at plan upload) === `GapReport.sovLineFindings[].sovLineNumber` (string, set by Agent 7). The G703 extractor is fed the master SOV's line numbers in its system prompt and required to match each row's `scheduledValue` within 1%, so the join is stable by construction.

**Milestone progress rollup (formula, not yet endpoint-backed).** Each `Draw.lines[i]` carries `confirmedMilestoneId`. To compute a milestone's observed % completion, gather every confirmed/overridden line where `confirmedMilestoneId === milestone._id` across approved draws, look up each line's matching `sovLineFinding.observedPct` from the latest report, then `Σ(observedPct × scheduledValue) / Σ(scheduledValue)`. The dedicated rollup endpoint and the Gantt overlay that consumes it are tracked as Phase 2 work.

### Runs (observability)

| Method | Path                    | Notes                                                 |
|--------|-------------------------|-------------------------------------------------------|
| GET    | `/:id/runs`             | All `AgentRun` rows for this project, newest first.   |
| GET    | `/:id/runs/:runId`      | One run, including usage tokens and error if failed.  |

### Supervisor (Claude Managed Agents, bolt-on)

The Supervisor is an autonomous Managed-Agents draw inspector that runs *after* a draw is submitted. It reads existing pipeline state (Draw + GapReport + Observation + PhotoAssessment + PlanFormat + AgentRun) via custom tools, optionally drafts a targeted re-inspection packet, and records a single finding with severity + recommendation. It **never mutates any existing collection** — it writes only to three new collections (`SupervisorSession`, `SupervisorFinding`, `ReinspectionRequest`) and never re-runs the seven pipeline agents.

| Method | Path                                            | Notes                                                                                                             |
|--------|-------------------------------------------------|-------------------------------------------------------------------------------------------------------------------|
| POST   | `/:id/supervisor/investigate`                   | Body `{ drawId }`. Response is `text/event-stream` — frames of `{ type: "connected" \| "event" \| "complete" \| "error" }`. Closes after the session goes idle. |
| GET    | `/:id/supervisor/sessions`                      | List recent Supervisor sessions for this project (up to 50).                                                      |
| GET    | `/:id/supervisor/sessions/:sessionId`           | Snapshot: `{ session, findings, reinspections }` for replay after reload.                                         |

**Custom tools exposed to the agent** (handlers in `src/lib/supervisorTools.ts`):

| Tool                             | Purpose                                                                                               |
|----------------------------------|-------------------------------------------------------------------------------------------------------|
| `read_draw_state`                | Draw header + G703 lines + latest GapReport + last 10 AgentRuns for this project.                     |
| `read_photo_evidence`            | Photo documents + per-photo PhotoAssessment + Observations (matched elements, confidence, safety).    |
| `read_plan_scope`                | Approved PlanFormat elements + inspector checklist, optionally filtered by discipline.                |
| `generate_reinspection_request`  | Writes a new `ReinspectionRequest` with a targeted 3–6-shot list, narrative, and optional `dueBy`.    |
| `record_finding`                 | Writes exactly one `SupervisorFinding` per session with severity, category, narrative, evidence, recommendation. |

Built-in toolset (`agent_toolset_20260401`) is enabled with defaults — `bash`, `read`, `write`, `edit`, `glob`, `grep`, `web_fetch`, `web_search` — so the agent can also look things up or script in the managed container if its reasoning calls for it.

**Bootstrap.** `src/lib/managedAgents.ts` owns `ensureSupervisorBootstrap()` — the first call ever creates the Agent + Environment via `client.beta.agents.create` / `client.beta.environments.create` and caches the IDs in the `ManagedAgentsConfig` singleton collection (keyed `plumbline_supervisor_v1`). Every subsequent call is a cache hit. The cache is invalidated automatically if the system prompt or model changes (hash-keyed).

**SSE transport.** The investigate route uses `reply.hijack()` + manual `reply.raw.write("data: ...\\n\\n")` with a 15-second keep-alive and an `AbortController` wired to socket-close so that disconnecting the client stops the event loop and prevents session-orphan cost. No new dependency.

**Smoke test.** `backend/scripts/smokeSupervisor.ts` verifies the full transport — bootstrap → session create → user message → stream to idle — without requiring a real project. Run with `ANTHROPIC_API_KEY=sk-... npx tsx backend/scripts/smokeSupervisor.ts`.

## Source layout

```
src/
  agents/        one file per agent + pipeline.ts (plan) + photoPipeline.ts (photo) + shared.ts (AgentRun wrapper)
  lib/           claudeCall.ts (tool-use + Zod), pdfRender.ts, photoLoad.ts, sha256.ts
  models/        Mongoose schemas for every domain object
  routes/        one file per resource, mounted in routes/index.ts
  config.ts      zod-validated env
  server.ts      Fastify bootstrap
```

### Agent contract

`withAgentRun` (in `agents/shared.ts`) wraps every agent: creates an `AgentRun` row in `status: "running"`, calls the agent body, then does a compare-and-swap update to `completed` / `failed` — the CAS predicate is `status: "running"`, so a DELETE route that flips a run to `failed` during cancellation wins the race without the agent clobbering it on completion.

`claudeCall` (in `lib/claudeCall.ts`) wraps `@anthropic-ai/sdk` with forced tool use and a Zod output schema. The agent never sees free-form Claude text — it only sees the parsed tool payload.

## Data models

`Project`, `Document` (PLAN | PHOTO | FINANCE_PLAN | DRAW_G703 | DRAW_G702), `PlanClassification`, `PlanFormat`, `FinancePlan`, `PhotoGuidance`, `PhotoAssessment`, `Observation`, `GapReport`, `AgentRun`, `Draw`. Every mutation-producing agent writes a versioned row; readers always fetch the highest version.

Supervisor-only collections (bolt-on, never read by the pipeline): `SupervisorSession`, `SupervisorFinding`, `ReinspectionRequest`, `ManagedAgentsConfig` (singleton cache for the Agent + Environment IDs).

A `Draw` is the monthly draw request: one per `{projectId, drawNumber}`, owns embedded `lines[]` (the parsed G703 rows + AI milestone suggestion + contractor approval), references the underlying `Document` rows for the uploaded G703/G702, and links to the `AgentRun` row that produced the extraction.

A `GapReport` is the verdict surface for a draw. Schema-wise it carries an optional `drawId` (the draw it was generated for) and a `milestoneId` (the milestone the agent compared photos against). The per-G703-line judgments — claimed % vs observed %, flag, photo citations — live on `sovLineFindings[]`. See **§Reports** above for the join keys and the milestone-progress rollup formula.

### Agent: G703Extractor

Parses an uploaded G703 PDF and, in the same Claude call, suggests which project milestone each row belongs to. Loads the project's master `FinancePlan.sov` + `FinancePlan.milestones` and injects both into the system prompt — the agent never guesses a milestone id that isn't on the project. Output is validated against a Zod array with `aiConfidence: 0–1` on every row so the contractor UI can surface low-confidence rows for explicit override. Model: `config.anthropicModel`.
