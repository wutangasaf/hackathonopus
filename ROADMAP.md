# Plumbline — post-hackathon roadmap

The hackathon slice (Apr 21–26 2026) proves the seven-agent pipeline + Supervisor end-to-end on the residential-loan happy path. The phases below take it from a working demo to something a CRMC or bank construction-loan administrator can actually run a portfolio against.

## 1. Deeper industry research

- Field interviews with U.S. CRMCs and bank construction-loan administrators.
- Comparative study of regional G702/G703 conventions, retainage step-down norms, and CO threshold practice across residential, commercial, and HUD 221(d)(4).
- Mapping of common fraud patterns (overstated progress, recycled photos, scope substitution) and the audit signals that catch them.
- OCC / FDIC / state-banking examination playbook alignment.

## 2. Better tools for unstructured ingest

- Benchmark dedicated layout-aware tooling (Adobe PDF Services, AWS Textract, PaddleOCR, Bluebeam Studio APIs, IFC.js) against the current `pdf-to-img` + Opus 4.7 vision baseline.
- Hybrid pipelines: layout-aware OCR for tables (G703, BoQ) → LLM for semantic mapping → deterministic templates once a counterparty's format stabilises.
- Redline / change-order reconciliation against the approved baseline.

## 3. Deterministic extraction via a template service

The demo pipeline is LLM-first — Claude reads a plan it has never seen and returns a structured `PlanFormat`. That's the right starting point, but at scale construction lenders work with repeat counterparties: the same GC's SOV format, the same architect's titleblock, the same bank's draw schedule. For those recurring formats, template-based extraction is strictly more deterministic, cheaper per document, and doesn't regress when a prompt changes.

The v2 shape is an **optional side service** offering three surfaces:

- **Mapping** — bind columns, cells or regions of a sample document to `PlanFormat.elements[]` fields (`elementId`, `kind`, `identifier`, `spec`).
- **Parsing templates** — saved and versioned per counterparty (e.g. `BigGC Inc. SOV / v3`, `Smith & Partners titleblock / v1`).
- **Extraction rules** — regex, column ranges, keyword anchors — applied before any LLM fallback.

Agent 1 is the natural routing point: a titleblock match flips the document onto the deterministic template path; no match falls through to the existing LLM extractors (Agent 2 for plans, the future Agent 3b for G703 / BOQ). Template hits preserve accuracy over time with minimal ops overhead; LLM handles the long tail.

**Demo surface (frontend suggestion):** a `Use a template` toggle or a `Mock: apply BigGC SOV template` button on the upload page — signals the routing intent in the video/demo without building the template editor UI for the hackathon.

## 4. IoT and telemetry ingest

- Wire concrete maturity sensors, moisture probes, strain gauges, load cells, tilt/temperature sensors, and rebar corrosion probes into the existing `Observation` schema.
- MQTT / LoRaWAN bridges with signed device attestation for chain-of-custody parity with phone EXIF.
- Time-series joins against G703 line claims (e.g. "pour at line 03-300 must show maturity ≥ X at +72h before the next tranche releases").

## 5. Drone, 360° and fixed-camera capture

- Photogrammetry / orthomosaic ingestion with georeferenced overlays against the approved site plan.
- 360° walkthrough indexing — bind every frame to a room or grid coordinate.
- Fixed-position construction cameras for milestone time-lapse evidence.

## 6. Multi-discipline + multi-loan-type expansion

- Add Mechanical, Civil, Landscape, and Fire-protection as first-class lanes in `PlanClassifier` and `PlanFormatExtractor`.
- Full CSI Masterformat spec ingestion.
- Productisation of commercial and HUD 221(d)(4) flows beyond the residential demo path.

## 7. Supervisor agent evolution

- Cross-draw pattern detection across the full loan lifecycle (recurring overstatement, drift in retainage application, repeat low-quality evidence from a single contractor).
- Multi-supervisor consensus for high-risk loans.
- E-signature integration on findings; signed external memos to the contractor.

## 8. Platform hardening

- Multi-tenant deployment with role-based access (CRMC, bank reviewer, contractor, regulator read-only).
- SOC 2 path; encrypted at rest and in transit; full audit-trail export for regulator inspection.
- Observability — token accounting per draw, agent-run latency budgets, SLOs for the monthly draw cycle.
