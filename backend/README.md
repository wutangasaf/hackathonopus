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

### Photo guidance

| Method | Path                                                                  | Notes                                                                                 |
|--------|-----------------------------------------------------------------------|---------------------------------------------------------------------------------------|
| GET    | `/:id/photo-guidance?milestoneId=…&regenerate=1`                      | Falls back to the active milestone if `milestoneId` omitted. Cached per milestone.    |

### Photos

| Method | Path                                  | Notes                                                                 |
|--------|---------------------------------------|-----------------------------------------------------------------------|
| POST   | `/:id/photos`                         | Multipart, N files. Dedupes by SHA-256. HEIC accepted. Kicks off Agents 5 (+6). |
| GET    | `/:id/photos`                         | List photos.                                                          |
| GET    | `/:id/photos/:photoId`                | Document + latest `PhotoAssessment` + latest `Observation`.           |
| GET    | `/:id/photos/:photoId/raw`            | Bytes. HEIC is transcoded to JPEG on the fly.                         |
| DELETE | `/:id/photos/:photoId`                | Cancels running Agent 5/6 runs for this photo; removes assessment + observation. |

### Reports

| Method | Path                                  | Notes                                                   |
|--------|---------------------------------------|---------------------------------------------------------|
| POST   | `/:id/reports?milestoneId=…`          | Synchronous — runs Agent 7. Returns the GapReport (201). |
| GET    | `/:id/reports`                        | List reports, newest first.                             |
| GET    | `/:id/reports/:reportId`              | One report.                                             |

### Runs (observability)

| Method | Path                    | Notes                                                 |
|--------|-------------------------|-------------------------------------------------------|
| GET    | `/:id/runs`             | All `AgentRun` rows for this project, newest first.   |
| GET    | `/:id/runs/:runId`      | One run, including usage tokens and error if failed.  |

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

`Project`, `Document` (PLAN | PHOTO | FINANCE_PLAN), `PlanClassification`, `PlanFormat`, `FinancePlan`, `PhotoGuidance`, `PhotoAssessment`, `Observation`, `GapReport`, `AgentRun`. Every mutation-producing agent writes a versioned row; readers always fetch the highest version.
