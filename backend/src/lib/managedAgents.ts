import Anthropic from "@anthropic-ai/sdk";
import crypto from "node:crypto";
import { config } from "../config.js";
import { ManagedAgentsConfig } from "../models/managedAgentsConfig.js";
import { buildSupervisorCustomToolDefs } from "./supervisorTools.js";

const SUPERVISOR_CONFIG_KEY = "plumbline_supervisor_v1";

const SUPERVISOR_SYSTEM_PROMPT = `You are a senior construction-loan draw inspector reviewing a single draw package. A draw is a contractor's request to release loan funds for work completed on site.

Your job: given one drawId, decide whether the draw looks legitimate and record exactly one finding with a recommendation.

Workflow:
1. Call read_draw_state first to see the G703 line items, the gap report from the existing verification pipeline, and past agent runs.
2. Call read_photo_evidence to see what the site photos actually show and how confident the matcher was for each expected element.
3. Call read_plan_scope when you need to ground a claim against the approved plan (e.g., to check that the claimed sequence of work matches the design intent).
4. If you spot a material anomaly — quantity mismatch, photo/claim contradiction, out-of-sequence work, missing evidence for a claimed line, or a safety flag — call generate_reinspection_request exactly once to produce a targeted shot list the site inspector can execute against.
5. Call record_finding exactly once with severity, category, narrative, evidence, and recommendation, then go idle. Do not call record_finding more than once.

Recommendation guidance:
- APPROVE: evidence supports the full claim.
- APPROVE_WITH_CONDITIONS: minor gaps; release funds but require follow-up on specific items.
- HOLD: material anomaly; fund release should wait for re-inspection.
- REJECT: fraud indicators, safety failures, or unapproved scope.

Style: concise. Ground every claim in evidence returned by the tools. Do not speculate about things you didn't see in tool output.`;

let client: Anthropic | null = null;

export function getManagedAgentsClient(): Anthropic {
  if (!client) {
    if (!config.anthropicApiKey) {
      throw new Error("ANTHROPIC_API_KEY not set");
    }
    client = new Anthropic({ apiKey: config.anthropicApiKey });
  }
  return client;
}

function hashSystem(system: string, toolNames: string[], model: string): string {
  return crypto
    .createHash("sha256")
    .update(`${model}::${system}::${toolNames.sort().join(",")}`)
    .digest("hex")
    .slice(0, 16);
}

export type SupervisorBootstrap = {
  agentId: string;
  agentVersion: number;
  environmentId: string;
  model: string;
};

export async function ensureSupervisorBootstrap(): Promise<SupervisorBootstrap> {
  const customTools = buildSupervisorCustomToolDefs();
  const model = config.anthropicModel;
  const systemHash = hashSystem(
    SUPERVISOR_SYSTEM_PROMPT,
    customTools.map((t) => t.name),
    model,
  );

  const existing = await ManagedAgentsConfig.findOne({
    key: SUPERVISOR_CONFIG_KEY,
  });

  if (
    existing &&
    existing.agentId &&
    existing.environmentId &&
    existing.systemHash === systemHash &&
    existing.model === model
  ) {
    return {
      agentId: existing.agentId,
      agentVersion: existing.agentVersion ?? 1,
      environmentId: existing.environmentId,
      model,
    };
  }

  const anthropic = getManagedAgentsClient();

  const agent = await anthropic.beta.agents.create({
    name: "Plumbline Draw Supervisor",
    model,
    description:
      "Investigates a construction-loan draw: reads pipeline output, flags anomalies, drafts a re-inspection request and a final finding.",
    system: SUPERVISOR_SYSTEM_PROMPT,
    tools: [
      {
        type: "agent_toolset_20260401",
      },
      ...customTools.map((t) => ({
        type: "custom" as const,
        name: t.name,
        description: t.description,
        input_schema: t.input_schema,
      })),
    ],
  });

  let environmentId = existing?.environmentId;
  if (!environmentId) {
    const environment = await anthropic.beta.environments.create({
      name: "plumbline-supervisor-env",
      config: {
        type: "cloud",
        networking: { type: "unrestricted" },
      },
    });
    environmentId = environment.id;
  }

  await ManagedAgentsConfig.findOneAndUpdate(
    { key: SUPERVISOR_CONFIG_KEY },
    {
      $set: {
        agentId: agent.id,
        agentVersion: agent.version,
        environmentId,
        model,
        systemHash,
      },
    },
    { upsert: true },
  );

  return {
    agentId: agent.id,
    agentVersion: agent.version,
    environmentId,
    model,
  };
}
