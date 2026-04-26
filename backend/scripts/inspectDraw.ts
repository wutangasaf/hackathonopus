/**
 * Diagnose: dump the latest Draw + lines for the only remaining project,
 * to see what PhotoGuidance is being asked to plan against.
 */
import mongoose from "mongoose";
import { config } from "../src/config.js";
import { Project } from "../src/models/project.js";
import { Draw } from "../src/models/draw.js";
import { FinancePlan } from "../src/models/financePlan.js";
import { PlanFormat } from "../src/models/planFormat.js";

async function main() {
  await mongoose.connect(config.mongoUrl);
  const projects = await Project.find().sort({ createdAt: -1 });
  if (projects.length === 0) {
    console.log("no projects");
    process.exit(0);
  }
  const p = projects[0];
  console.log(`project: ${p.name} (${p._id})`);

  const draws = await Draw.find({ projectId: p._id }).sort({ createdAt: -1 });
  console.log(`\n${draws.length} draw(s):`);
  for (const d of draws) {
    console.log(
      `  drawNumber=${d.drawNumber} status=${d.status} lines=${d.lines.length}`,
    );
  }
  const draw = draws.find((d) => d.status === "approved") ?? draws[0];
  if (!draw) {
    console.log("no draw found");
    process.exit(0);
  }
  console.log(`\n=== inspecting draw ${draw._id} (status=${draw.status}) ===`);
  console.log(`lines (showing first 30):`);
  for (const l of draw.lines.slice(0, 30)) {
    console.log(
      `  line=${l.lineNumber} pctThis=${l.pctThisPeriod} pctCum=${l.pctCumulative} amtThis=${l.amountThisPeriod} approval=${l.approvalStatus} milestoneId=${l.confirmedMilestoneId ?? "-"} disc=${l.aiSuggestedDiscipline ?? "-"} desc="${(l.description ?? "").slice(0, 50)}"`,
    );
  }
  const reviewed = draw.lines.filter(
    (l) =>
      l.approvalStatus !== "pending" &&
      !!l.confirmedMilestoneId &&
      l.pctThisPeriod > 0,
  );
  console.log(
    `\n=== passes PhotoGuidance filter (approved + has milestone + pctThis>0): ${reviewed.length} of ${draw.lines.length}`,
  );

  const plans = await PlanFormat.find({ projectId: p._id });
  console.log(
    `\nplanFormats: ${plans.length} — disciplines: ${plans.map((pf) => pf.discipline).join(", ")}`,
  );
  for (const pf of plans) {
    console.log(`  ${pf.discipline} v${pf.version}: ${pf.elements.length} elements`);
  }

  const fp = await FinancePlan.findOne({ projectId: p._id }).sort({
    uploadedAt: -1,
  });
  console.log(`\nfinancePlan: ${fp ? `${fp.milestones.length} milestones` : "MISSING"}`);

  await mongoose.disconnect();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
