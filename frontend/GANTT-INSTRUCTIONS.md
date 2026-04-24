# Gantt editability — reference

The 8-phase M01–M08 scaffold seeded by `ganttStore.seedScaffold()` is a **best-practice default**, not a fixed structure. Every part of the Gantt is user-editable before the first save and re-editable after. This file documents where that editability lives so future changes don't re-invent it.

## Where editing happens

| Surface | File | What the user edits |
|---|---|---|
| **SidePanel** (right rail, opens on row click) | `src/routes/gantt/SidePanel.tsx` | `name`, `plannedStartDate`, `plannedCompletionDate`, `trancheAmount`, `plannedPercentOfLoan`, `plannedReleasePct`, `requiredCompletion[]`, `requiredDocs[]`, remove pinned `planDocRefs[]` |
| **Timeline row ×** | `src/routes/gantt/MilestoneRow.tsx` | Remove milestone (`removeMilestone(localId)`) |
| **Timeline `+ Add milestone`** | `src/routes/gantt/Timeline.tsx` | Append a new row (`addMilestone()`) |
| **ActionBar → Reset to template** | `src/routes/gantt/ActionBar.tsx` | Two-click confirm, then `seedScaffold(loanAmount)` — clears edits and pinned chips |
| **Palette drag-and-drop** | `src/routes/gantt/Palette.tsx` + `GanttBuilder.onDragEnd` | Pin classified plan sheets onto a milestone (`addDocRef`) |

All edits go through `useGanttStore` actions — never mutate milestone objects directly.

## Persistence

- First save: `POST /api/projects/:id/finance-plan`.
- Any subsequent edit saved from the Gantt: `PUT /api/projects/:id/finance-plan` (idempotent replace, same body). Triggered from `ActionBar` Save.
- After a successful save, invalidate `useFinancePlan(projectId)` so the next mount re-hydrates from the canonical server copy via `hydrateFromPlan`.
- `PATCH /api/projects/:id/finance-plan/milestones/:id` is **only** for the bank marking actuals post-draw (`actualReleasePct`, `amountReleased`, `status`). Do not use it for structural edits.

## Validation (must match the backend)

Surface these inline and disable Save until they pass — the backend will 400 otherwise (see `API_REFERENCE.md` § Finance plan):

1. `plannedPercentOfLoan` strictly monotonic across milestones, last row === 100.
2. `sum(trancheAmount)` within $1 of `loanAmount`. Show the running delta.
3. Every row: `plannedStartDate <= plannedCompletionDate`.
4. Every `planDocRefs.documentId` must exist in the current project's `kind === "PLAN"` documents.

Store-side checks already live in `ganttStore` — surface them, don't duplicate them.

## UX copy

The seed is advice, not doctrine. The Gantt builder header should read:

> "Starter 8-phase residential template. Rename phases, adjust percentages, or add/remove milestones to match this project."

Keep `Reset to template` quiet (ghost button, right-aligned) so destructive intent is clear but not inviting.
