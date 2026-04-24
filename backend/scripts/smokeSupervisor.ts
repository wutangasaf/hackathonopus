/**
 * Smoke-test the Managed Agents bootstrap end-to-end without touching
 * Mongo beyond the ManagedAgentsConfig singleton. Verifies:
 *   1. agent + environment creation (or cache hit)
 *   2. session create
 *   3. user.message send
 *   4. stream reaches session.status_idle with stop_reason == end_turn
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-... npx tsx backend/scripts/smokeSupervisor.ts
 *
 * Does NOT require a real project or draw — it sends a throwaway prompt
 * that exercises the transport only.
 */
import mongoose from "mongoose";
import { config } from "../src/config.js";
import {
  ensureSupervisorBootstrap,
  getManagedAgentsClient,
} from "../src/lib/managedAgents.js";

async function main() {
  if (!config.anthropicApiKey) {
    throw new Error("ANTHROPIC_API_KEY is required");
  }
  await mongoose.connect(config.mongoUrl);
  process.stdout.write(`[smoke] mongo connected\n`);

  const bootstrap = await ensureSupervisorBootstrap();
  process.stdout.write(
    `[smoke] agent=${bootstrap.agentId} env=${bootstrap.environmentId} model=${bootstrap.model}\n`,
  );

  const client = getManagedAgentsClient();
  const session = await client.beta.sessions.create({
    agent: bootstrap.agentId,
    environment_id: bootstrap.environmentId,
    title: "supervisor-smoke",
  });
  process.stdout.write(`[smoke] session=${session.id}\n`);

  const stream = await client.beta.sessions.events.stream(session.id);

  await client.beta.sessions.events.send(session.id, {
    events: [
      {
        type: "user.message",
        content: [
          {
            type: "text",
            text: "Smoke test. Reply with the single word 'ready' and stop.",
          },
        ],
      },
    ],
  });

  let finished = false;
  for await (const ev of stream as AsyncIterable<{
    type: string;
    [k: string]: unknown;
  }>) {
    if (ev.type === "agent.message") {
      process.stdout.write(`[smoke] agent.message\n`);
    } else if (ev.type === "session.status_idle") {
      const stopReason = (ev as { stop_reason?: { type?: string } })
        .stop_reason?.type;
      process.stdout.write(`[smoke] idle · stop_reason=${stopReason}\n`);
      if (stopReason === "end_turn") finished = true;
      break;
    } else if (ev.type === "session.error") {
      process.stdout.write(
        `[smoke] session.error · ${JSON.stringify(ev)}\n`,
      );
      break;
    }
  }

  await mongoose.disconnect();
  process.stdout.write(
    finished ? `[smoke] OK\n` : `[smoke] FINISHED WITHOUT end_turn\n`,
  );
  process.exit(finished ? 0 : 1);
}

main().catch((err) => {
  process.stderr.write(`[smoke] ERROR · ${String(err)}\n`);
  process.exit(1);
});
