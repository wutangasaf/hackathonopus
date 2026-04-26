# Plumbline — frontend

React 19 + Vite + Tailwind + shadcn/ui UI for the Plumbline draw-inspection co-pilot. See the [root README](../README.md) for the product pitch and backend setup.

## Run

```bash
npm install
npm run dev         # http://localhost:5173
npm run typecheck
npm run build
npm run lint
npm test            # vitest run · ~1.5s in jsdom
npm run test:watch  # vitest watch
```

The dev server talks to the backend at `http://localhost:4000` via the `services/` layer (see `src/services/`). Start the backend first (see [`backend/README.md`](../backend/README.md)).

## Testing

Vitest 3 + jsdom + React Testing Library. The suite is a **regression net** focused on the Gantt store's financial math (which the draw verdict ultimately rests on) and a few user-facing utilities — not a coverage drive. 19 tests, ~1.5s. All tests live under `test/` so they're outside `tsconfig.app.json`'s `include: ["src"]` and don't affect `npm run build`.

| File | What it covers |
|---|---|
| `test/stores/ganttStore.test.ts` | The Gantt editor store. Drives the public actions: `seedScaffold` (8-phase template with monotonic % and exact tranche sum), `setField('loanAmount', …)` (recomputes non-overridden tranches; preserves user-overridden rows; absorbs rounding drift on the last row), `toCreateRequest` (emits SOV summing exactly to `totalBudget`), `validate` (mirrors backend cross-field rules — golden case + 5 violations including unknown `planDocRefs.documentId`), and `hydrateFromPlan` (round-trips a saved plan; marks every hydrated tranche as a user override so a later loan-amount edit can't silently rewrite bank-edited values). 12 cases. |
| `test/lib/time.test.ts` | `relativeTime` — `just now` / `Ns ago` / `Nm ago` / `Nh ago` / `Nd ago` / UTC `YYYY-MM-DD` fallback past 7d, plus unparseable-input passthrough. 7 cases. |
| `test/setup.ts` | `IntersectionObserver` polyfill (framer-motion `whileInView` is silent without it) + `matchMedia` shim. `@testing-library/jest-dom` matchers wired in. |

**Mocking philosophy.** The store is reset between tests via `useGanttStore.getState().resetAll()`. No MSW, no react-query setup, no mocked routes — every test exercises the store's public API directly because that's where the actual bug class (validation drift, overrides being clobbered, project-id binding leaks) would surface. The frontend smoke for `GanttBuilder` rendering is deferred to Tier B; the store-level `hydrateFromPlan` test covers the same regression class without dnd-kit / framer-motion / four mocked react-query hooks under jsdom.

## UI flow → backend endpoints

| Route                              | Page                   | Backend endpoints used                                           |
|------------------------------------|------------------------|-------------------------------------------------------------------|
| `/`                                | Landing                | —                                                                 |
| `/projects`                        | Projects list          | `GET/POST /api/projects`                                          |
| `/projects/:id`                    | Project detail         | Plans upload/list/delete, photos upload/list, finance-plan read, runs, report generation |
| `/projects/:id/gantt`              | Finance-plan builder   | `GET/POST/PUT /api/projects/:id/finance-plan`                     |
| `/projects/:id/contractor`         | Contractor draw portal | `POST /:id/draws`, `PATCH /:id/draws/:drawId/lines/:i`, `POST /:id/draws/:drawId/approve` — and the **Supervisor investigation side-sheet** on the submitted-draw screen (`POST /:id/supervisor/investigate` SSE) |
| `/projects/:id/inspector`          | Site-inspector capture | `GET /:id/photo-guidance`, `POST /:id/photos`, `GET /:id/photos/:pid/raw` |
| `/projects/:id/photos/:photoId`    | Photo detail           | `GET /photos/:id`, `GET /photos/:id/raw`, `DELETE /photos/:id`    |
| `/projects/:id/reports/:reportId`  | Gap report             | `GET /reports/:id`                                                |
| `/projects/:id/runs`               | Agent runs             | `GET /runs`                                                       |

## Source layout

```
src/
  App.tsx              react-router routes
  routes/              one page per route
    gantt/             finance-plan builder subcomponents
    contractor/        monthly G703 draw flow + supervisor investigation side-sheet
    inspector/         site-inspector capture flow
  components/
    blocks/            feature-level compositions
    layout/            app shell
    ui/                shadcn primitives
    uploads/           multipart upload UI (G703Dropzone, PlansDropzone, photos)
    supervisor/        InvestigationPanel — live SSE trace of the Supervisor's agent messages, tool calls, verdict, and re-inspection packet
  services/            TanStack-Query hooks + fetch wrappers, one file per backend resource (supervisor.ts streams SSE via fetch + ReadableStream)
  stores/              Zustand store for the gantt builder
  lib/                 utils
  styles/              Tailwind + global CSS
```

## State management

- **Server state**: TanStack Query (`services/queryKeys.ts` centralises keys).
- **Local UI state**: component `useState` + a single Zustand store (`stores/ganttStore.ts`) for the multi-step finance-plan builder.
- **HEIC photos**: the backend transcodes HEIC → JPEG on `GET /photos/:id/raw`, so `<img src={rawUrl}>` works in every browser.
