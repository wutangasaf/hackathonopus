# Plumbline

AI co-pilot for construction-draw inspections. Ingests approved plans (PDF), a finance plan with milestones, and phone photos, and produces a Gap Report with a draw verdict (`APPROVE` / `APPROVE_WITH_CONDITIONS` / `HOLD` / `REJECT`) citing G703 SOV line items and flagging unapproved scope deviations.

See `backend/` for the Node.js + TypeScript API. Frontend to follow.

Built for Anthropic's *Built with Opus 4.7* hackathon (Apr 2026).
