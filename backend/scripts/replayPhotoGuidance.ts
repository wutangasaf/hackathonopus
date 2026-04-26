/**
 * Reproduce the PhotoGuidance failure for the latest approved draw and
 * print the FULL Zod error path (the route response truncates it).
 */
import mongoose from "mongoose";
import { config } from "../src/config.js";
import { Project } from "../src/models/project.js";
import { Draw } from "../src/models/draw.js";
import { runPhotoGuidance } from "../src/agents/photoGuidance.js";

async function main() {
  await mongoose.connect(config.mongoUrl);
  const p = (await Project.find().sort({ createdAt: -1 }))[0];
  const draw = await Draw.findOne({ projectId: p._id, status: "approved" }).sort(
    { drawNumber: -1 },
  );
  if (!draw) {
    console.log("no approved draw");
    process.exit(0);
  }
  console.log(`replaying photoGuidance for project=${p._id} draw=${draw._id} (${draw.drawNumber})`);
  try {
    const r = await runPhotoGuidance(p._id, draw._id);
    console.log("OK", r);
  } catch (err: any) {
    console.error("FAILED MESSAGE:", err.message ?? err);
    if (err.cause) console.error("CAUSE:", err.cause);
    if (err.stack) console.error("STACK:", err.stack);
  }
  await mongoose.disconnect();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
