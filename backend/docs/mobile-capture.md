# Mobile capture mode — backend plan

## What we're building

A phone-first capture flow for the CRMC inspector on-site.

Today the inspector uploads a batch of photos after the visit; agents then have to guess which photo matches which line item. We want to flip it: the **report agent tells the inspector what to shoot**, the phone **walks them through the shot list**, and each capture **arrives at the server already tagged** with its shot id, GPS, and timestamp. The reviewer back in the office opens the same project and sees evidence bound to the right milestone — not a dumping ground.

The frontend will add a `/m/capture/:projectId` route built for mobile Safari / Chrome. This doc is about the backend changes that flow needs.

---

## What already works (don't rebuild it)

- `POST /api/projects/:id/photos` — multipart upload, handles HEIC, dedups by sha256, writes to `config.uploadsDir`, kicks off the photo pipeline. See `src/routes/photos.ts:47`.
- `src/routes/upload.ts:26` (`extractPhotoExif`) — pulls GPS lat/lon/altitude, `DateTimeOriginal`, camera, orientation from EXIF on every photo. Already stored on `Document.exifMeta`.
- `GET /api/projects/:id/photo-guidance?milestoneId=...` — returns a cached shot list per milestone (shotId, target, framing, angle, lighting, safety, referenceElementIds). See `src/routes/photoGuidance.ts` and the `PhotoGuidance` model.
- Files live on **disk**, not in Mongo. `DocumentModel` stores the metadata + path. Good — nothing to migrate.

---

## What's missing

1. **Shot binding.** When a photo is uploaded there's no way to say "this photo is shot `A3` for milestone `M1`". The upload is anonymous within the project, so the report agent can't answer "is shot A3 covered?".
2. **Browser-captured GPS.** iOS strips EXIF GPS unless the user explicitly shared location in the Photos app. The mobile page should send browser `navigator.geolocation` coords as form fields — belt and suspenders.
3. **Project site location.** `Project` has no `site: { lat, lng }`, so we can't geofence-check a photo.
4. **Geofence flag.** Flag (don't reject) photos whose GPS is more than ~300m from the project site.
5. **Coverage status per shot.** The shot-list endpoint returns the list; it doesn't say which shots already have at least one photo. The mobile UI and the gap report both want this.

---

## Implementation — backend-first, one PR per step

### Step 1 — Extend the photo upload metadata

**File:** `src/models/document.ts`

Add three optional fields at the document level (keep `exifMeta` as-is — it's the raw EXIF and stays untouched):

```ts
captureMeta: {
  shotId:     { type: String },               // e.g. "A3" — matches PhotoGuidance.shotList[].shotId
  milestoneId:{ type: Schema.Types.ObjectId }, // which milestone this shot belongs to
  gps: {
    lat:       { type: Number },
    lon:       { type: Number },
    accuracyM: { type: Number },               // from navigator.geolocation
    source:    { type: String, enum: ["exif", "browser", "manual"] },
  },
  capturedAt: { type: Date },                  // device clock at capture
  deviceHint: { type: String },                // UA fragment, for debugging only
},
geofence: {
  withinSite:  { type: Boolean },              // filled in by the upload handler
  distanceM:   { type: Number },
  checkedAt:   { type: Date },
},
```

Nothing here is required — the existing web upload path keeps working with these empty.

### Step 2 — Accept capture metadata on upload

**File:** `src/routes/photos.ts:47` (and `src/routes/upload.ts`)

Currently `ingestMultipartFile` only looks at the file part. Multipart can carry text fields alongside files — accept these on the mobile path:

- `shotId` (string)
- `milestoneId` (ObjectId)
- `lat`, `lon`, `accuracyM` (numbers)
- `capturedAt` (ISO timestamp)

Extend `ingestMultipartFile` to take an optional `captureMeta` argument, and in `photos.ts` collect the text parts in the same `for await (const part of req.parts())` loop before/after the file part. Precedence rule for GPS: if the browser sent lat/lon **and** EXIF has lat/lon, prefer browser (fresher, less likely stripped by iOS share-sheet) but store both — `captureMeta.gps.source` records which one we used.

### Step 3 — Add site coords to Project + geofence check

**File:** `src/models/project.ts`

```ts
site: {
  lat: { type: Number },
  lon: { type: Number },
  radiusM: { type: Number, default: 300 },  // soft geofence radius
},
```

**File:** `src/lib/geofence.ts` (new) — 20 lines, haversine distance. Export `checkGeofence(projectSite, photoGps): { withinSite, distanceM }`.

In `ingestMultipartFile`, after resolving the chosen GPS, call `checkGeofence` and write the result into `document.geofence`. Do **not** reject — we flag, the reviewer decides.

### Step 4 — Coverage endpoint

**File:** `src/routes/photoGuidance.ts`

Add a sibling endpoint:

```
GET /api/projects/:id/shot-list?milestoneId=...
```

Returns the existing shot list **plus** coverage:

```jsonc
{
  "milestoneId": "...",
  "shots": [
    {
      "shotId": "A3",
      "target": "...",
      "framing": "...",
      "covered": true,               // at least one PHOTO document has captureMeta.shotId == "A3"
      "photoCount": 2,
      "lastPhotoId": "..."
    }
  ]
}
```

One aggregation against `DocumentModel`:

```ts
DocumentModel.aggregate([
  { $match: { projectId, kind: "PHOTO", "captureMeta.milestoneId": milestoneId } },
  { $group: { _id: "$captureMeta.shotId", count: { $sum: 1 }, last: { $last: "$_id" } } },
]);
```

The mobile UI uses this to strike shots off the list in real time; Agent 7 uses it to emit "shot A3 not covered" findings.

### Step 5 — Videos (OPTIONAL, skip for demo)

Only if time permits:
- Accept `video/quicktime`, `video/mp4` in `POST /:id/photos` (rename the endpoint? or add `/:id/media`). Probably keep one endpoint and fan out.
- Video clips are 30–80MB. Raise `@fastify/multipart` `fileSize` limit, but cap at e.g. 150MB so we don't DoS ourselves.
- Do **not** transcode server-side in the hackathon window. Stream the raw mp4 back to the reviewer; desktop browsers play it natively.

---

## Storage — disk now, S3 later

**Don't migrate to S3 for the demo.** Reasons:

- Current flow already works: disk + `DocumentModel` metadata. Mobile upload is the same HTTP POST.
- S3's real wins (presigned direct upload, no Node memory pressure, CDN) matter under load or on flaky cellular. For a demo over home wifi they're invisible.
- GridFS was never in play — the user's earlier assumption was wrong. We're writing files via `fs.writeFile(config.uploadsDir, ...)`.

**When to revisit:**
- If we add video. A 50MB multipart through Fastify is fine once; ten at a time isn't.
- Post-hackathon, before any real user touches it.

The migration when it comes is small: swap `writeFile` in `ingestMultipartFile` for an S3 `PutObject`, change `storagePath` to hold the key, and serve `/raw` via a presigned GET (or proxy through the server if we want auth). A day of work.

---

## Out of scope for this pass

- Auth / inspector identity. We'll keep `uploaderRef` as a free-text field and fill it in from the mobile URL (e.g. `?u=asaf`) for now. Real auth is a separate arc.
- Offline-first capture (queue photos on the phone when signal drops). Nice for real field use; the demo will have wifi.
- Signed capture receipts / tamper-evident timestamps. Useful for audit, not for the judges.
- Native app. PWA on mobile Safari / Chrome is enough.

---

## Suggested build order

1. Model changes (`Document.captureMeta`, `Document.geofence`, `Project.site`) — 30 min, no endpoint changes yet.
2. Extend `ingestMultipartFile` to read text fields + write `captureMeta` — 30 min.
3. Geofence lib + wire into upload — 20 min.
4. `GET /shot-list` with coverage aggregation — 30 min.
5. Frontend mobile capture page consumes `/shot-list`, posts to `/photos` with the fields from Step 2.
6. Wire coverage into the gap report agent (`Agent 7 · Comparison & Gap`) so "shot not covered" becomes a real finding.

Total backend work: ~2–3 hours. The mobile UI is the bigger piece.
