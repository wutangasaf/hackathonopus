# Frontend task: mock "Use a template" button

Add a non-functional demo button next to the plan uploader that previews the future **template service** (see root `README.md` → *Productisation: template service*). Nothing behind it is real — it's a demo surface only.

## Where

`frontend/src/components/uploads/PlansDropzone.tsx`, rendered above the existing dropzone area. Mounted inside `ProjectDetail.tsx` at `frontend/src/routes/ProjectDetail.tsx:349`, so no routing changes are needed.

## What to build

1. **Button** — shadcn `<Button variant="outline" size="sm">` with label `Use a template` and a small `Preview` badge (shadcn `<Badge variant="secondary">`) to make clear it's not a shipped feature.
2. **Dialog** on click — shadcn `<Dialog>` with:
   - **Title:** `Template service — preview`
   - **Body:**
     > For recurring counterparty formats (same GC's SOV, same architect's titleblock, same bank's draw schedule), Plumbline can skip the LLM extraction step and parse deterministically against a saved template.
     >
     > **Mapped templates on file (mock):**
     > - `BigGC Inc. · SOV · v3` — 42 line items, last used 14 days ago
     > - `Smith & Partners · Titleblock · v1` — 6 projects
     >
     > **Match detected in your upload (mock):** `Smith & Partners · Titleblock · v1` — confidence 94%
   - **Footer:** a primary button `Apply template (mock)` that does nothing but close the dialog, and a secondary `Cancel`.

3. **No backend call.** No new service file. No new store. Pure local state.

## States

- **idle** — button visible, dropzone unchanged underneath.
- **dialog open** — Dialog over backdrop, button stays visible behind.
- **close / apply** — Dialog closes, nothing else changes. User continues with the normal upload flow.

## Copy rules

- Do not claim anything is functional. The words `Preview`, `mock`, or `coming soon` should appear at least once in user-visible text.
- Do not add similar buttons to `PhotosDropzone.tsx` — templates are for plans / BOQ-like documents, not site photos.

## Why this exists

Captured in `README.md` under *Productisation: template service*. The button is a demo surface for the video: shows the product's intended scaling direction without committing any real template-editor work during the hackathon.
