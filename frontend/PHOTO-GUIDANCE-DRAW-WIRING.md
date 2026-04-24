# Photo Guidance · rewire to the approved Draw

The backend Agent 4 (photo guidance) no longer runs off the active milestone. It now consumes the **approved Draw** — the G703 the contractor has already reviewed row-by-row. One Draw → one shot list covering every line item the contractor is actually claiming this period.

Mark this flow **`preview`** everywhere until the three-step chain (G703 upload → contractor approval → photo guidance fetch) has been verified end-to-end in a browser.

---

## What changed on the backend

`GET /api/projects/:id/photo-guidance` — request shape:

| Before | After |
|---|---|
| `?milestoneId=<id>` (optional, defaults to active milestone) | `?drawId=<id>` (optional, defaults to latest `approved` Draw) |

Response body is unchanged in shape except:

- `photoGuidance.milestoneId` → **`photoGuidance.drawId`**.
- Each `shot` has a new optional `referenceLineNumbers: string[]` — the G703 line numbers the shot is verifying. Surface them; they are the link back to the contractor's claim.
- `modelVersion` bumps from `photo-guidance/v1` to `photo-guidance/v2`.

Failure states the UI must handle:

| Status | Meaning |
|---|---|
| `404 no approved draw…` | No Draw has been approved yet on this project. Render the "upload + approve a G703 first" empty state. |
| `409 draw is not approved (status=…)` | A `drawId` was passed but the Draw is still in `parsing` / `ready_for_review` / `failed`. Render a state that points back to the contractor page. |
| `500 photo guidance generation failed` | Usual agent failure — keep the existing error surface. |

Empty shot list (`shotList: []`) is a **200** response, not an error. It happens when every claimed line's discipline has no uploaded PlanFormat. The current "NO SHOTS REQUIRED" copy is fine — change the suffix to reflect the new trigger (see below).

---

## Files to touch

### `src/lib/api.ts` — `getPhotoGuidance`
Replace the query-arg name:
```ts
getPhotoGuidance: (
  id: string,
  opts: { drawId?: string; regenerate?: boolean } = {},
) =>
  json<PhotoGuidance>(
    `/api/projects/${id}/photo-guidance${qs({
      drawId: opts.drawId,
      regenerate: opts.regenerate ? 1 : undefined,
    })}`,
  ),
```

### `src/lib/types.ts` — `PhotoGuidance` + `PhotoGuidanceShot`
```ts
export type PhotoGuidanceShot = {
  shotId: string;
  discipline: Discipline;
  target: string;
  framing?: string;
  angle?: string;
  lighting?: string;
  safety?: string;
  referenceElementIds: string[];
  referenceLineNumbers: string[]; // NEW — G703 line numbers this shot verifies
};

export type PhotoGuidance = {
  _id: ObjectIdString;
  projectId: ObjectIdString;
  drawId: ObjectIdString; // was: milestoneId
  shotList: PhotoGuidanceShot[];
  modelVersion: string;
  generatedAt: IsoDateString;
};
```

### `src/services/photos.ts` — `usePhotoGuidance`
```ts
export function usePhotoGuidance(
  projectId: string | undefined,
  opts: { drawId?: string; regenerate?: boolean } = {},
  options?: …,
) {
  return useQuery<PhotoGuidance | null, ApiError>({
    queryKey: queryKeys.photos.guidance(projectId ?? "__none__", opts.drawId),
    queryFn: async () => {
      try {
        return await api.getPhotoGuidance(projectId as string, opts);
      } catch (err) {
        if (isNotFoundOrConflict(err)) return null; // 404 = no approved draw; 409 = draw not ready
        throw err;
      }
    },
    …
  });
}

function isNotFoundOrConflict(err: unknown): boolean {
  const s = (err as { status?: number } | null | undefined)?.status;
  return s === 404 || s === 409;
}
```

Also widen `queryKeys.photos.guidance` to take a `drawId` (or rename the arg; it is opaque).

### `src/services/queryKeys.ts`
Rename the second arg of `photos.guidance(projectId, drawId?)`. One-word swap.

### `src/components/uploads/PhotoGuidance.tsx`
Replace the milestone dependency with a draw dependency. Drop `useCurrentMilestone`.

Add a thin service helper that returns the latest approved draw for the project — you already have `draws.ts` service; add something like:

```ts
// src/services/draws.ts
export function useLatestApprovedDraw(projectId: string | undefined) {
  return useQuery<Draw | null, ApiError>({
    queryKey: queryKeys.draws.latestApproved(projectId ?? "__none__"),
    queryFn: async () => {
      const all = await api.listDraws(projectId as string);
      return all.find((d) => d.status === "approved") ?? null;
    },
    enabled: Boolean(projectId),
  });
}
```

Then in the component:

```tsx
const draw = useLatestApprovedDraw(projectId);
const drawId = draw.data?._id;
const guidance = usePhotoGuidance(projectId, { drawId });
```

Empty / not-ready states to render (use the same hairline + mono pattern as today):

1. `!draw.data` (no approved draw yet) → "AWAITING CONTRACTOR DRAW APPROVAL" with a `Request a draw` link into `/contractor/draw-request/:projectId`.
2. `drawId` present but `guidance.data === null` (401/409 → null via the hook) → same "awaiting" state, slightly different copy if you want.
3. `guidance.data.shotList.length === 0` → existing `NO SHOTS REQUIRED` state, but change the second clause to `NO CLAIMED LINES MATCH UPLOADED PLANS` (the old `BACK WITH THE NEXT MILESTONE` is no longer accurate — the trigger is now the Draw, not the milestone).

### `ShotRow` — render the new reference
Below the existing `referenceElementIds` chips, add a second row for `referenceLineNumbers`. Copy the same chip style; label it `Claimed lines this shot verifies`:

```tsx
{shot.referenceLineNumbers.length > 0 && (
  <div className="mt-3">
    <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-fg-dim">
      Claimed lines this shot verifies
    </div>
    <div className="mt-2 flex flex-wrap gap-1.5">
      {shot.referenceLineNumbers.map((ln) => (
        <span key={ln} className="border border-line-strong bg-bg px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-fg-dim">
          {ln}
        </span>
      ))}
    </div>
  </div>
)}
```

### `DeviceBanner` header copy
`Shooting for · {milestoneName}` → `Shooting for · DRAW #{draw.drawNumber} · {draw.contractor.companyName}`. The draw is the unit of work now.

---

## DESIGN-KIT guardrails (recap)

Five-line recap per `DESIGN-KIT.md`:
- Hairlines only (`border-line`, `border-line-strong`). No rounded corners beyond what the kit allows.
- Mono labels (tabular-nums) for all numerics, line numbers, chip strings.
- Max two accent moments per viewport.
- Reduced motion: progress bar degrades to a flat hairline.
- All copy UPPERCASE in mono rails; sentence case elsewhere.

---

## Verification

1. Upload a G703 at `/contractor/draw-request/:projectId`. Wait for `ready_for_review`. Confirm or override every line. Click `APPROVE ALL`.
2. Navigate to the project detail page's Photo Guidance section (Agent 4 panel).
3. First render should show "Agent 4 building shot list · 30–60s first call" (existing progress bar). After the call returns, shots appear.
4. Each shot should carry at least one chip in the new `Claimed lines this shot verifies` row.
5. `Regenerate` should still work (forces `regenerate=1` in the backend call).
6. Delete the approval on the Draw (or create a new Draw) → the cached guidance stays attached to the old `drawId`; the panel falls back to the `AWAITING CONTRACTOR DRAW APPROVAL` state if there is no other approved draw.

---

## Out of scope for this brief

- Multi-draw history. The panel surfaces the latest approved draw only.
- Wiring Agent 7 (gap report) to the draw — still reads milestones for now. Separate task.
- A per-shot "which line did this photo hit" back-reference in the photo detail page. Agent 6 will be rewired later to match evidence against `referenceLineNumbers`.
