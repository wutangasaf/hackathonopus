/**
 * Keep only the most-recent Project (by createdAt) — delete every other
 * project and all of its cascaded data so the Projects screen shows one row.
 *
 *   npx tsx backend/scripts/keepLastProject.ts
 *
 * Does NOT touch on-disk storage (photo/PDF files); only Mongo rows.
 */
import mongoose from "mongoose";
import { config } from "../src/config.js";
import { Project } from "../src/models/project.js";
import { AgentRun } from "../src/models/agentRun.js";
import { DocumentModel } from "../src/models/document.js";
import { Draw } from "../src/models/draw.js";
import { FinancePlan } from "../src/models/financePlan.js";
import { Observation } from "../src/models/observation.js";
import { GapReport } from "../src/models/gapReport.js";
import { PlanFormat } from "../src/models/planFormat.js";
import { PlanClassification } from "../src/models/planClassification.js";
import { PhotoGuidance } from "../src/models/photoGuidance.js";
import { SupervisorSession } from "../src/models/supervisorSession.js";
import { SupervisorFinding } from "../src/models/supervisorFinding.js";
import { PhotoAssessment } from "../src/models/photoAssessment.js";
import { ReinspectionRequest } from "../src/models/reinspectionRequest.js";

async function main() {
  await mongoose.connect(config.mongoUrl);
  process.stdout.write("[keepLast] mongo connected\n");

  const projects = await Project.find().sort({ createdAt: -1 });
  if (projects.length === 0) {
    process.stdout.write("[keepLast] no projects in DB\n");
    await mongoose.disconnect();
    return;
  }

  const [keep, ...toDelete] = projects;
  process.stdout.write(
    `[keepLast] KEEPING: ${keep.name} (${keep._id}) createdAt=${(keep as any).createdAt?.toISOString?.()}\n`,
  );
  if (toDelete.length === 0) {
    process.stdout.write("[keepLast] only one project exists — nothing to delete\n");
    await mongoose.disconnect();
    return;
  }
  process.stdout.write(`[keepLast] DELETING ${toDelete.length} other project(s):\n`);
  for (const p of toDelete) {
    process.stdout.write(`  - ${p.name} (${p._id})\n`);
  }

  const ids = toDelete.map((p) => p._id);
  const filter = { projectId: { $in: ids } };

  const cascades: Array<[string, mongoose.Model<any>]> = [
    ["agentRuns", AgentRun],
    ["documents", DocumentModel],
    ["draws", Draw],
    ["financePlans", FinancePlan],
    ["observations", Observation],
    ["gapReports", GapReport],
    ["planFormats", PlanFormat],
    ["planClassifications", PlanClassification],
    ["photoGuidances", PhotoGuidance],
    ["supervisorSessions", SupervisorSession],
    ["supervisorFindings", SupervisorFinding],
    ["photoAssessments", PhotoAssessment],
    ["reinspectionRequests", ReinspectionRequest],
  ];
  for (const [label, M] of cascades) {
    const r = await M.deleteMany(filter);
    process.stdout.write(`  ${label}: ${r.deletedCount} deleted\n`);
  }

  const r = await Project.deleteMany({ _id: { $in: ids } });
  process.stdout.write(`  projects: ${r.deletedCount} deleted\n`);

  const remaining = await Project.countDocuments();
  process.stdout.write(`[keepLast] remaining projects: ${remaining}\n`);

  await mongoose.disconnect();
}

main().catch((err) => {
  process.stderr.write(`[keepLast] FAILED: ${err}\n`);
  process.exit(1);
});
