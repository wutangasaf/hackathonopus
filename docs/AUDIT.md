# README Correctness Audit

**Date:** 2026-04-26
**Subject:** root [`README.md`](../README.md)
**Method:** three parallel Opus 4.7 sub-agents, each cross-checking a partition of the README's verifiable claims against the actual code under `backend/` and `frontend/`. One Opus 4.7 orchestrator reconciled the findings, applied the fixes, and wrote this report.
**Result:** **3 factual errors fixed, 2 over-promises tightened, 1 clarity gap resolved.** ~90% of the original README's claims were already accurate.

This file is the receipt. It exists so a reader can confirm the README's claims were checked against the code, not just written.

---

## Method

Three `Explore` sub-agents run in parallel from a single orchestrator turn — each returned TRUE / FALSE / PARTIAL with a `file:line` citation per claim.

| Sub-agent | Scope | Claims checked |
|---|---|---|
| A | The 7-agent pipeline | Agent names + order; which use Claude vs. form ingest; trigger model (background / on-demand / sync); cache behaviour; verdict enum; discipline enum |
| B | Monthly draw cycle + Supervisor | `G703Extractor` separation; `aiConfidence` per row; Draw status state machine; photo-guidance endpoint contract; Supervisor harness, custom tools, read/write contract, endpoints, smoke test |
| C | Tests + tech-stack + paths | Test counts; specific test-file coverage; package versions; `.env.example`; ports; `commercial_poc` schema option; retainage defaults; OCC/FDIC framing |

Total claims checked: **~50.** Of these, **40+ verified TRUE** with code citation; the rest are listed below.

---

## Findings

### A. Factual errors — fixed

| ID | README claim | Reality | Fix |
|---|---|---|---|
| A1 | "live-agent tests gate on `RUN_LIVE_AGENT_TESTS=1`" | env var not referenced anywhere in `backend/test/` or `frontend/test/` | Removed the sentence; replaced with "no live-agent tier is wired in this hackathon cut." |
| A2 | Draw status walks `parsing → ready_for_review → approved` | `backend/src/models/draw.ts:12-18` defines five statuses — adds `rejected` and `failed` | Extended the prose to list all five. |
| A3 | Frontend tech stack lists "shadcn/ui" alongside React, Vite, Tailwind | `frontend/package.json` has no `shadcn` dep — only `@radix-ui/*` primitives (shadcn is copy-in code, not a package) | Reworded to "shadcn/ui patterns over Radix primitives." |

### B. Over-promises — tightened

| ID | README claim | Reality | Fix |
|---|---|---|---|
| B1 | "Every step writes an `AgentRun` row." | Six Claude agents wrap `withAgentRun()`; Agent 3 (form ingester) writes a `FinancePlan` row directly with no `AgentRun`. | "Every **Claude** step writes an `AgentRun` row." |
| B2 | Supervisor diagram caption: `record_finding (exactly once per run)`. | The system prompt instructs once-only; `supervisorTools.ts:133-180` does not enforce uniqueness in the tool handler. | "(prompt-bound, 1 call)" — accurate, same width, diagram alignment preserved. |

### C. Clarity — improved

| ID | Issue | Fix |
|---|---|---|
| C1 | The monthly-draw-cycle section reads as if it sits beside the 7-agent pipeline, but it's actually driven by an 8th Claude agent (`G703Extractor`) — easy for a reader to miss. | Added one sentence to the section intro making the 8th-agent role explicit. |

### Editorial framing — left as-is (B3)

The README says CO thresholds are "tuned to OCC/FDIC expectations." No OCC/FDIC reference appears in actual schema constants — it's a true statement about the **design philosophy** of the schema, not a code-level alignment. Left as written.

### Brand consistency — left as-is (B4)

Title is `Plumbline.ai`, but body prose still uses "Plumbline" in places. Reads more naturally as narrative; the brand is unambiguous after the title. Left as a deliberate choice.

---

## What was verified TRUE (no change needed)

These claims were re-verified against code with file:line citations and are correct as written:

- All 7 agent names, order, and Claude vs. form-ingest classification.
- The 4 disciplines (`ARCHITECTURE`, `STRUCTURAL`, `ELECTRICAL`, `PLUMBING`).
- The verdict enum (`APPROVE / APPROVE_WITH_CONDITIONS / HOLD / REJECT`).
- Agent-trigger cadence: 1+2 background-on-plan-upload, 5+6 background-on-photo-upload (6 only on `quality: "GOOD"`), 4 on-demand-cached per Draw, 7 synchronous on `POST /reports`.
- `G703Extractor` parses + maps milestones to Gantt in a single Claude tool call with `aiConfidence` per row; fires in background on upload.
- Photo-guidance endpoint signature: `GET /api/projects/:id/photo-guidance?drawId=<id>` (auto-picks latest approved if omitted).
- Every Agent 4 shot carries `referenceLineNumbers` linking it to the claimed G703 row.
- Supervisor: Managed Agents harness (`agent_toolset_20260401`), exact 5 custom tool names, read-only over existing collections, write-only to `SupervisorSession` / `SupervisorFinding` / `ReinspectionRequest`.
- All 3 Supervisor endpoints (`POST .../investigate` SSE, `GET .../sessions/:sessionId`, `GET .../sessions`).
- Smoke test exists at `backend/scripts/smokeSupervisor.ts`.
- Test counts: backend **26** (12 smoke + 10 financePlan + 4 shared), frontend **19** (12 ganttStore + 7 time).
- Tech-stack versions: Node 20+, Fastify 4, Mongoose 8, React 19, Vite 8, Tailwind 3, MongoDB 7, Vitest 3.
- Default model `claude-opus-4-7`, env-overridable via `ANTHROPIC_MODEL`.
- File/dir existence: `docs/CONSTRUCTION_DRAW_PROCESS.md`, `ROADMAP.md`, `backend/.env.example`.
- Default ports: backend 4000, frontend 5173.
- Retainage default 10% → 5% at 50% completion (`financePlan.ts:102-104`).
- `commercial_poc` is in the `LOAN_TYPES` enum (`financePlan.ts:6`).

---

## Re-verify

```bash
# A1 — env var should still have zero hits
grep -rn "RUN_LIVE_AGENT_TESTS" backend/ frontend/

# A2 — Draw statuses should match the README's prose
grep -A 6 "DRAW_STATUSES\|status.*enum" backend/src/models/draw.ts

# A3 — confirm shadcn is NOT a package dep
grep '"shadcn' frontend/package.json   # expect: empty
grep '@radix-ui' frontend/package.json # expect: hits

# Test counts
cd backend && npm test 2>&1 | tail -3
cd frontend && npm test 2>&1 | tail -3
```

All four should match the README's claims after the audit.
