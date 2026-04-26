import mongoose from "mongoose";
import { config } from "../src/config.js";
import { AgentRun } from "../src/models/agentRun.js";

async function main() {
  await mongoose.connect(config.mongoUrl);
  const runs = await AgentRun.find({ agentName: "PhotoGuidance" })
    .sort({ createdAt: -1 })
    .limit(5);
  for (const r of runs) {
    const u: any = (r as any).usage ?? {};
    console.log(
      `run=${r._id} status=${r.status} outTok=${u.outputTokens ?? "-"} inTok=${u.inputTokens ?? "-"} err=${(r.error ?? "").slice(0, 100)}`,
    );
  }
  await mongoose.disconnect();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
