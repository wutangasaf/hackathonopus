# Contractor draw-request page — frontend brief

A new page where the (hardcoded) general contractor uploads a monthly AIA G702 + G703 package, reviews the AI's milestone mapping row-by-row, and approves the draw. **Preview / mock** — mark the flow as such until the backend wiring is end-to-end verified (same rule `GANTT-INSTRUCTIONS.md` uses).

This brief gives you the surface to build. The backend is already in place: see `backend/README.md` § Draws. The business context is in `docs/CONSTRUCTION_DRAW_PROCESS.md` — read that first if "G702", "G703", or "draw" is unfamiliar.

## Scope — what to build

1. Route: `/contractor/draw-request/:projectId`.
2. Hardcoded contractor identity (no auth, no role system).
3. Upload zone: G703 (required, PDF) + optional G702 (PDF).
4. Poll the backend until the draw is parsed, then render a line-item review table with the AI's milestone suggestion + confidence per row.
5. Per-row confirm or override; bulk "Approve All" action once every row is resolved.
6. Post-approval confirmation screen.

## Scope — what NOT to build

- Do **not** touch the existing `/projects/:id/gantt` finance-plan editor or the SOV upload flow. The master SOV is the project-setup artefact; the Draw is the monthly event. They are separate entities on the backend.
- No role selector, no login, no profile page. The contractor is a constant.
- No multi-draw history UI. The demo supports one visible draw per project. The data model allows many; the UI ships one.
- No Excel G703 parsing on this pass — PDF only.

## Hardcoded contractor

Create `frontend/src/lib/hardcoded.ts`:

```ts
export const CONTRACTOR_USER = {
  name: "John Smith",
  companyName: "Smith General Contracting",
  licenseNumber: "GC-2024-1001",
  role: "contractor" as const,
};
```

The backend already snapshots this same identity onto every Draw it creates (see `backend/src/lib/defaultContractor.ts`). Do not diverge the values.

## Route wiring

Add to `frontend/src/App.tsx` Routes block:

```tsx
<Route
  path="/contractor/draw-request/:projectId"
  element={<ContractorDrawRequest />}
/>
```

Add a low-profile entry point on the existing project detail page (ghost button, right-aligned, labelled `Request a draw`). Do not clutter the landing page.

## API surface (already live on the backend)

| Call | Endpoint | Payload |
|---|---|---|
| Upload | `POST /api/projects/:projectId/draws` | `multipart/form-data` with `g703` (file, required), optional `g702` (file), optional `periodStart` / `periodEnd` text fields |
| Poll | `GET /api/projects/:projectId/draws/:drawId` | — |
| Per-row action | `PATCH /api/projects/:projectId/draws/:drawId/lines/:lineIndex` | `{ approvalStatus: "pending" \| "confirmed" \| "overridden", confirmedMilestoneId? }` — `overridden` requires `confirmedMilestoneId` |
| Finalise | `POST /api/projects/:projectId/draws/:drawId/approve` | — |
| Milestones for dropdowns | `useFinancePlan(projectId)` (already exists at `src/services/financePlan.ts:18`) | returns `milestones[]` with `_id` + `name` + `sequence` |

Extend `frontend/src/lib/api.ts` with `uploadDraw`, `getDraw`, `patchDrawLine`, `approveDraw`. Reuse the existing `upload<T>` helper at `src/lib/api.ts:54-64` for multipart — the field name is `g703` (and `g702` if the user also attached it).

## Page structure

1. **Header strip** (mono, uppercase, hairline border-bottom):
   `CONTRACTOR · SMITH GENERAL CONTRACTING · LIC GC-2024-1001` on the left, the project name + `DRAW #N` on the right.

2. **Upload zone** — clone the structure of `frontend/src/components/uploads/PlansDropzone.tsx` into a new `src/components/uploads/G703Dropzone.tsx`. Accepts one G703 PDF (required) and one optional G702 PDF. Show the same hairline progress bar (`plumbline-progress` keyframe) during upload + parse. Labels walk: `UPLOADING…` → `PARSING…` → `READY TO REVIEW` (polling until `draw.status === "ready_for_review"`; treat `"failed"` as an error state with the `extractorError` surfaced).

3. **Line-item review table** — only rendered once `status === "ready_for_review"`.

   Columns (every numeric column renders in mono per DESIGN-KIT §3):

   | # | Description | CSI | Scheduled | % This Period | Amount | AI Suggested Milestone | Confidence | Your Choice | Action |
   |---|---|---|---|---|---|---|---|---|---|

   - `#` is the sheet line number as extracted (`lineNumber`).
   - `CSI` shows `csiCode` when present, em-dash otherwise.
   - `AI Suggested Milestone` is a read-only chip showing the milestone name. Hover reveals `aiReasoning`.
   - `Confidence` is a hairline bar with the numeric value underneath (e.g. `0.92`).
   - `Your Choice` is a native `<select>` styled with DESIGN-KIT tokens, options from `useFinancePlan(projectId).milestones` (sorted by `sequence`). Pre-selected to `aiSuggestedMilestoneId`.
   - `Action` is two mono buttons: `CONFIRM` and `OVERRIDE`. `CONFIRM` sends `approvalStatus=confirmed` and leaves `confirmedMilestoneId` unset (server backfills from the AI suggestion). `OVERRIDE` sends `approvalStatus=overridden` with the value from the select.
   - Row visual rules:
     - `aiConfidence >= 0.85` → render with default border, `CONFIRM` state pre-highlighted.
     - `aiConfidence < 0.85` → add a `2px` left border in `--warn`; the row requires an explicit click before it becomes confirmable.
     - Once `approvalStatus !== "pending"`, dim the action buttons and show a tick.

4. **Action bar** (sticky bottom, hairline border-top):
   - Left: running counter — `CONFIRMED 14 / 32 · LOW CONFIDENCE 3 PENDING`.
   - Right: `SAVE DRAFT` (ghost) and `APPROVE ALL` (primary accent). `APPROVE ALL` disabled until no row is `pending`. Clicking it calls the approve endpoint.

5. **Post-approval confirmation** — replace the table with a single-column layout: `DRAW #N SUBMITTED` uppercase, summary of totalAmountRequested, timestamp, a mono micro-label `AWAITING INSPECTION`. No nav into the inspector pipeline.

## States

- `UPLOADING…` — upload POST in flight
- `PARSING…` — backend status `parsing`, frontend polling
- `READY TO REVIEW` — table rendered, rows pending
- `REVIEWING` — at least one row actioned, not all
- `SUBMITTING…` — approve POST in flight
- `SUBMITTED` — post-approval confirmation
- `ERROR · <message>` — surface `extractorError` from the backend (mono, in `--danger`)

No skeletons. No spinners. Hairline progress bar + mono state labels only — DESIGN-KIT §7.

## State management

Local component state only. No new Zustand store. One `useQuery` for the draw poll, a handful of `useMutation`s for upload / patch / approve. The page is the only consumer of any of this data.

## Design-kit guardrails (non-negotiable)

Every one of these is called out in `frontend/DESIGN-KIT.md`:

1. Only the defined CSS custom properties for colour (`--bg`, `--bg-1`, `--bg-2`, `--line`, `--line-strong`, `--accent`, `--fg`, `--fg-dim`, `--fg-muted`, `--success`, `--warn`, `--danger`). No invented greys, no second accent.
2. Mono uppercase for data labels and numeric columns (11px, weight 500–600, tracking 0.12–0.16em). Sans for prose.
3. 4px spacing grid.
4. Zero radius on all corners. Hairlines only (`1px solid var(--line)` or `--line-strong`). No shadows except the hero verdict card (not used on this page).
5. Accent restraint: at most two orange moments per viewport. On this page the accent is reserved for `APPROVE ALL`.
6. Motion patterns: `pulse`, `bob`, `glow` only. Respect `prefers-reduced-motion`.

## Copy rules (mock marker)

Until the backend wiring is verified end-to-end in a browser, the word **Preview** or **Mock** must appear at least once per page viewport. Options:
- Header chip: `PREVIEW · CONTRACTOR VIEW`.
- Footer micro: `Mock draw — not yet wired into the inspection pipeline`.

Remove once the flow is verified.

## Files to create

| Path | Purpose |
|---|---|
| `src/routes/contractor/DrawRequest.tsx` | The page. |
| `src/components/uploads/G703Dropzone.tsx` | Dropzone clone of `PlansDropzone.tsx`. |
| `src/lib/hardcoded.ts` | `CONTRACTOR_USER` constant. |
| *(edit)* `src/App.tsx` | Route registration. |
| *(edit)* `src/lib/api.ts` | `uploadDraw` / `getDraw` / `patchDrawLine` / `approveDraw` helpers. |
| *(edit)* project detail route | `Request a draw` ghost button linking here. |

## Verification

1. `npm run dev`, create a project, upload plans, upload a finance plan (existing flow).
2. Navigate to `/contractor/draw-request/<projectId>`.
3. Drop a G703 PDF (a fixture lives under `design/` — otherwise any valid G703 works). Watch the state walk `UPLOADING… → PARSING… → READY TO REVIEW`.
4. Table should render with every extracted row. Confirm high-confidence rows with one click, override a low-confidence row by picking a different milestone.
5. `APPROVE ALL` should stay disabled until no row is `pending`, then fire the approve call and show the submitted state.
6. Visual check against `DESIGN-KIT.md` §2–5: no rounded corners, mono numerics, hairlines only, accent used at most twice.
7. Toggle macOS Reduce Motion → the progress bar and any `pulse`/`glow` animations should stop or reduce.
