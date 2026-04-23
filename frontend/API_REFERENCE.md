# Plumbline backend — API reference

Base URL: `http://localhost:4000` in dev (Vite proxies `/api` and `/health`). Set `VITE_API_BASE_URL` for deployed builds.

No auth middleware. CORS not registered (fine for same-origin via Vite proxy; add an allowlist before deploying cross-origin).

All request/response bodies are `application/json` unless noted. Multipart routes use standard `multipart/form-data` with a `file` field. Dates come back as ISO 8601 strings; the backend accepts ISO strings or timestamps on input.

## Enums

```ts
type Discipline = "ARCHITECTURE" | "STRUCTURAL" | "ELECTRICAL" | "PLUMBING";
type SheetRole = "PLAN_VIEW" | "ELEVATION" | "SECTION" | "DETAIL" | "SCHEDULE" | "OTHER";
type LoanType = "residential" | "commercial_poc" | "hud_221d4" | "hybrid";
type MilestoneStatus = "pending" | "in_progress" | "claimed" | "verified" | "rejected";
type DocumentKind = "PLAN" | "FINANCE_PLAN" | "SCHEDULE" | "PHOTO";
type PhotoQuality = "GOOD" | "NEEDS_RETAKE";
type ObservedState = "PRESENT" | "ABSENT" | "PARTIAL" | "DEVIATED";
type PerElementStatus = "VERIFIED" | "PARTIAL" | "MISSING" | "DEVIATED" | "UNVERIFIED";
type SovFlag = "ok" | "minor" | "material" | "unapproved_scope";
type OverallStatus = "ON_TRACK" | "BEHIND" | "DEVIATION_FOUND" | "TECHNICAL_DEFAULT_RISK";
type DrawVerdictValue = "APPROVE" | "APPROVE_WITH_CONDITIONS" | "HOLD" | "REJECT";
type AgentRunStatus = "running" | "succeeded" | "failed";
```

`src/lib/types.ts` is the frontend's source of truth; keep it aligned with the backend enums above.

---

## Health

### `GET /health`
- **Purpose**: liveness probe. Gate the landing page on this.
- **200** → `{ "ok": true }`

---

## Projects

### `POST /api/projects`
- **Purpose**: create a new project. Engineer entry point.
- **Body**: `{ "name": string, "address"?: string }`
- **201** → `Project`
- **400** → `{ "error": <zod flatten> }` for missing `name`

### `GET /api/projects`
- **200** → `Project[]` (newest first).

### `GET /api/projects/:id`
- **200** → `Project`
- **400** → `{ "error": "invalid id" }`
- **404** → `{ "error": "project not found" }`

---

## Plans (approved construction PDFs)

### `POST /api/projects/:id/plans`
- **Purpose**: upload approved plans. Kicks off Agent 1 (PlanClassifier) → Agent 2 (PlanFormatExtractor) fire-and-forget.
- **Body**: `multipart/form-data` with one or more `file` parts.
- **201** → `{ documents: Document[], pendingAgents: ["PlanClassifier","PlanFormatExtractor"], pipelineKickedOff: boolean }`. `pipelineKickedOff=false` when every file was a duplicate (idempotent on `(projectId, sha256)`).
- **400** → no file parts.

### `GET /api/projects/:id/plans`
- **200** → `Document[]` where `kind === "PLAN"`, newest first.

### `GET /api/projects/:id/plan-classification`
- **Purpose**: Agent 1 output. Per-page classification — feeds the Gantt doc-chip palette.
- **200** → `PlanClassification` with `sheets: [{ documentId, pageNumber, discipline, sheetRole, titleblock, notes? }]`.
- **404** → pipeline still running or failed.
- **Polling hint**: watch `/runs` for `PlanClassifier=succeeded` before calling.

### `GET /api/projects/:id/plan-format?discipline=PLUMBING`
- **Purpose**: Agent 2 output. Structured element list per discipline — what should exist on site.
- **Query**: `discipline?` — one of the 4 disciplines; omit for an aggregate.
- **200 (discipline present)** → `PlanFormat` with `elements`, `inspectorChecklist`, `scaleNotes?`, `sourceSheets`.
- **200 (no discipline)** → `{ formats: PlanFormat[] }` — one entry per discipline that has elements.
- **400** → unknown discipline.
- **404** → no plan format for that discipline yet.

---

## Finance plan (JSON-first)

### `POST /api/projects/:id/finance-plan`
- **Purpose**: create the finance plan from the Gantt form. Replaces any existing plan.
- **Body**: `CreateFinancePlanRequest`:
  ```ts
  {
    loanType: LoanType,
    loanAmount: number,
    totalBudget: number,
    currency: "USD",
    retainagePct: number,                 // default 10
    retainageStepDownAt, retainageStepDownTo,
    coThresholdSingle, coThresholdCumulativePct,
    materialDelayDays, cureDaysMonetary, cureDaysNonMonetary,
    kickoffDate: IsoDateString,           // REQUIRED
    requiredCompletionDate: IsoDateString, // REQUIRED
    sov: SovLine[],                       // optional
    milestones: MilestoneInput[]          // min 1
  }
  ```
  Each `MilestoneInput`:
  ```ts
  {
    sequence: number,
    name: string,
    plannedStartDate, plannedCompletionDate: IsoDateString,
    plannedPercentOfLoan: number,   // 0..100
    trancheAmount: number,
    plannedReleasePct: number,      // % of trancheAmount on pass
    planDocRefs: [{ documentId, sheetLabels?, notes? }],
    requiredCompletion: [{ discipline, elementKindOrId, minPct }],
    requiredDocs: string[],
    status?: MilestoneStatus        // default "pending"
  }
  ```
- **Cross-field validation** (400 on failure):
  - `sum(sov.scheduledValue) === totalBudget`
  - `milestones.plannedPercentOfLoan` strictly monotonic, last === 100
  - `sum(milestones.trancheAmount) === loanAmount` (±$1)
  - each `plannedStartDate <= plannedCompletionDate`
  - every `planDocRefs.documentId` exists in Documents on this project with `kind === "PLAN"`
- **201** → `FinancePlan`

### `PUT /api/projects/:id/finance-plan`
- **Purpose**: idempotent replace. Same body as POST.
- **200** → `FinancePlan`
- **400** same as POST.

### `PATCH /api/projects/:id/finance-plan/milestones/:milestoneId`
- **Purpose**: bank marks actuals after a draw. Partial update.
- **Body** (≥1 key): `{ actualReleasePct?: number, amountReleased?: number, status?: MilestoneStatus }`
- **Side effect**: `actualReleasedAt` is auto-set the first time `actualReleasePct` moves off null.
- **200** → the updated `Milestone` subdocument (not the whole plan).
- **400** → invalid `milestoneId`, empty body, or Zod errors.
- **404** → plan or milestone not found.

### `GET /api/projects/:id/finance-plan`
- **200** → the latest `FinancePlan`.
- **404** → no plan yet.

### `GET /api/projects/:id/finance-plan/current-milestone`
- **Purpose**: first milestone (by `sequence`) whose `status` ≠ `verified` and ≠ `rejected`.
- **200** → `Milestone`.
- **404** → no plan, or all milestones terminal.

---

## Photo guidance (Agent 4, on-demand)

### `GET /api/projects/:id/photo-guidance?milestoneId=...&regenerate=1`
- **Purpose**: structured shot list. Runs Agent 4 on miss, cached by `(projectId, milestoneId)`.
- **Query**:
  - `milestoneId?` — defaults to the current milestone from the finance plan.
  - `regenerate=1` — force a fresh run + overwrite the cache.
- **200** → `PhotoGuidance` with `shotList: [{ shotId, discipline, target, framing, angle, lighting, safety?, referenceElementIds }]`.
- **400** → invalid `milestoneId`.
- **404** → no finance plan, or no active milestone.
- **500** → agent error (`detail` included).

First call ~30–60s; cached calls <200ms. Needs a spinner.

---

## Photos

### `POST /api/projects/:id/photos`
- **Purpose**: upload site photo(s). Each new photo kicks off Agent 5 (PhotoQuality) → if GOOD with discipline, Agent 6 (PhotoToPlanFormat) fire-and-forget.
- **Body**: `multipart/form-data` with `file` parts. HEIC/HEIF auto-decoded to JPEG.
- **201** → `{ documents: Document[], pendingAgents: ["PhotoQuality","PhotoToPlanFormat"], pipelineKickedOffFor: string[] }`.
- **400** → no file parts.

### `GET /api/projects/:id/photos`
- **200** → `Document[]` where `kind === "PHOTO"`, newest first.

### `GET /api/projects/:id/photos/:photoId`
- **Purpose**: single photo plus its analysis. Render this on a photo detail page.
- **200** → `{ document: Document, assessment: PhotoAssessment | null, observation: Observation | null }`.
  - `assessment`: `quality`, `discipline`, `matchedShotId?`, `phaseFit?`, `issues: string[]`, `retakeInstructions?`.
  - `observation`: `matchedElements: [{ elementId, observedState, observedPct?, confidence, evidence }]`, `unexpectedObservations: string[]`, `safetyFlags: string[]`.
  - `observation` is `null` when Agent 5 returned `NEEDS_RETAKE` or no discipline (Agent 6 correctly skipped).
- **404** → photo not found.

---

## Draw reports (Agent 7)

### `POST /api/projects/:id/reports?milestoneId=...`
- **Purpose**: the headline call. Aggregates plan + observations + finance rules into a `GapReport` with a `drawVerdict`. Synchronous.
- **Query**: `milestoneId?` — defaults to current milestone.
- **Timing**: 30–60s. Show "CRMC drafting…" copy.
- **201** → `GapReport` with:
  - `perElement: [{ discipline, elementId, plannedState, observedState, status, citations }]`
  - `sovLineFindings: [{ sovLineNumber, claimedPct, observedPct, variance, flag, evidencePhotoIds }]`
  - `overallStatus`, `daysOffset?`, `loanInBalance`, `remainingBudget?`, `remainingCost?`
  - `unapprovedDeviations: string[]` ← headline change-order list
  - `narrative: string` ← CRMC-voice prose
  - `drawVerdict: { verdict, reasoning, conditions?, missingRequirements? }`
- **400** → invalid `milestoneId`.
- **500** → agent error (`detail` included).

### `GET /api/projects/:id/reports`
- **200** → `GapReport[]`, newest first.

### `GET /api/projects/:id/reports/:reportId`
- **200** → one `GapReport`.
- **400** → invalid id.
- **404** → not found.

---

## Agent runs (observability)

### `GET /api/projects/:id/runs`
- **Purpose**: audit/progress trail. Poll after `/plans` or `/photos` to show agent progress.
- **200** → `AgentRun[]` sorted `startedAt` desc:
  ```ts
  {
    _id, projectId, agentName, status,
    input?, result?, error?, usage?: UsageMeta,
    modelVersion, startedAt, completedAt?, createdAt, updatedAt
  }
  ```
  `agentName` ∈ `PlanClassifier | PlanFormatExtractor | PhotoGuidance | PhotoQuality | PhotoToPlanFormat | ComparisonAndGap`. (`FinancePlanIngester` may appear on legacy projects.)

### `GET /api/projects/:id/runs/:runId`
- **200** → single `AgentRun` with full `result` and `error`.
- **404** → not found.

---

## Document shape

```ts
type Document = {
  _id: ObjectIdString;
  projectId: ObjectIdString;
  kind: DocumentKind;
  originalFilename: string;
  storagePath: string;     // backend-internal; do NOT expose in UI
  mimeType: string;
  sha256: string;          // 64-hex FRE 901 hash
  serverReceivedAt: IsoDateString;
  exifMeta?: Record<string, unknown>;
  uploaderRef?: string;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
};
```

Ingest is idempotent on `(projectId, sha256)` — re-uploading the same file returns the existing Document.

---

## Recommended user flow

1. **Projects list** → `GET /api/projects` + `POST /api/projects`.
2. **Upload plans** → `POST /api/projects/:id/plans`.
3. **"Labelling pages…" progress** → poll `GET /api/projects/:id/runs` every ~5s until `PlanClassifier` and `PlanFormatExtractor` both `succeeded`.
4. **Gantt Builder** → `GET /plan-classification` + `GET /plan-format` populate palette + sidebar. Drag chips onto milestones. Save → `POST /finance-plan`.
5. **Photo session** → `GET /photo-guidance` shows shot list. Engineer uploads → `POST /photos`. Poll `/runs`. Render `/photos/:photoId`.
6. **Draw verdict** → `POST /reports`. Render narrative + verdict + perElement. Bank fills actuals via `PATCH /finance-plan/milestones/:id`.

## Timings

| Call | Time | Notes |
|---|---|---|
| `POST /plans` | <1s to return; pipeline ~60s | Agent 1 ~5s, Agent 2 ~50s per 1-page PDF |
| `POST /finance-plan` / `PUT` | <200ms | Pure JSON + DB write |
| `PATCH /milestones/:id` | <100ms | |
| `GET /photo-guidance` | 30–60s first, <200ms cached | |
| `POST /photos` | <1s to return; pipeline ~30s | Agent 5 ~10s, Agent 6 ~20s |
| `POST /reports` | 30–60s synchronous | Skeleton UI |

## Error conventions

- **400** → user input. Body: `{ "error": "<msg>" }` or `{ "error": <zod flatten> }` or `{ "error": string[] }`. Surface the strings.
- **404** → resource not found / "not yet". Show empty-state copy, don't throw.
- **500** → backend/agent failure. `detail` included for agent routes. Surface in dev only.

## Keep in sync

Route source of truth: `../backend/src/routes/`. When a backend route changes, update this file in the same commit.
