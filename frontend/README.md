# Plumbline — frontend

React 19 + Vite + Tailwind + shadcn/ui UI for the Plumbline draw-inspection co-pilot. See the [root README](../README.md) for the product pitch and backend setup.

## Run

```bash
npm install
npm run dev         # http://localhost:5173
npm run typecheck
npm run build
npm run lint
```

The dev server talks to the backend at `http://localhost:4000` via the `services/` layer (see `src/services/`). Start the backend first (see [`backend/README.md`](../backend/README.md)).

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
