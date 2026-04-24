import type Anthropic from "@anthropic-ai/sdk";
import { Types } from "mongoose";
import {
  ensureSupervisorBootstrap,
  getManagedAgentsClient,
} from "../lib/managedAgents.js";
import { dispatchSupervisorTool } from "../lib/supervisorTools.js";
import { Draw } from "../models/draw.js";
import { SupervisorSession } from "../models/supervisorSession.js";
import { SupervisorFinding } from "../models/supervisorFinding.js";
import { ReinspectionRequest } from "../models/reinspectionRequest.js";

type StreamEvent =
  Anthropic.Beta.Sessions.Events.BetaManagedAgentsStreamSessionEvents;

export type SupervisorStreamEvent =
  | { kind: "session_started"; managedSessionId: string; sessionId: string }
  | { kind: "agent_message"; text: string }
  | { kind: "agent_thinking" }
  | {
      kind: "tool_use";
      id: string;
      name: string;
      input: Record<string, unknown>;
    }
  | {
      kind: "tool_result";
      toolUseId: string;
      name: string;
      isError: boolean;
      resultPreview: string;
    }
  | {
      kind: "builtin_tool_use";
      id: string;
      name: string;
      input: Record<string, unknown>;
    }
  | {
      kind: "builtin_tool_result";
      toolUseId: string;
      isError: boolean;
      resultPreview: string;
    }
  | { kind: "session_error"; message: string }
  | {
      kind: "session_finished";
      stopReason: "end_turn" | "retries_exhausted" | "requires_action";
    };

export type SupervisorEventHandler = (
  event: SupervisorStreamEvent,
) => void | Promise<void>;

const INITIAL_USER_PROMPT = (drawId: string, projectId: string) =>
  `Investigate draw ${drawId} in project ${projectId}. Follow the workflow in your system prompt: read_draw_state first, then read_photo_evidence, then read_plan_scope as needed, then (if warranted) generate_reinspection_request, then record_finding exactly once, then go idle.`;

function previewContent(content: string, max = 600): string {
  return content.length <= max ? content : `${content.slice(0, max)}…`;
}

export async function runSupervisorInvestigation(params: {
  projectId: string | Types.ObjectId;
  drawId: string | Types.ObjectId;
  onEvent: SupervisorEventHandler;
  signal?: AbortSignal;
}): Promise<{ sessionId: Types.ObjectId }> {
  const projectId = new Types.ObjectId(String(params.projectId));
  const drawId = new Types.ObjectId(String(params.drawId));

  const draw = await Draw.findOne({ _id: drawId, projectId }).lean();
  if (!draw) {
    throw new Error("draw not found for project");
  }

  const { agentId, environmentId } = await ensureSupervisorBootstrap();
  const client = getManagedAgentsClient();

  const title = `Supervisor · draw #${draw.drawNumber}`;
  const session = await client.beta.sessions.create({
    agent: agentId,
    environment_id: environmentId,
    title,
  });

  const localSession = await SupervisorSession.create({
    projectId,
    drawId,
    managedSessionId: session.id,
    agentId,
    environmentId,
    title,
    status: "running",
    startedAt: new Date(),
  });

  await params.onEvent({
    kind: "session_started",
    managedSessionId: session.id,
    sessionId: String(localSession._id),
  });

  const stream = await client.beta.sessions.events.stream(session.id);

  // Send the opening user turn after the stream is attached.
  await client.beta.sessions.events.send(session.id, {
    events: [
      {
        type: "user.message",
        content: [
          {
            type: "text",
            text: INITIAL_USER_PROMPT(String(drawId), String(projectId)),
          },
        ],
      },
    ],
  });

  const pendingToolResults = new Map<
    string,
    { name: string; result: { isError: boolean; content: string } }
  >();

  const toolCtx = {
    projectId,
    drawId,
    sessionId: localSession._id,
  };

  let finalStopReason:
    | "end_turn"
    | "retries_exhausted"
    | "requires_action"
    | null = null;

  const builtinToolNames = new Map<string, string>();

  try {
    for await (const event of stream as AsyncIterable<StreamEvent>) {
      if (params.signal?.aborted) break;

      if (event.type === "agent.message") {
        const text = event.content
          .map((block) => ("text" in block ? block.text : ""))
          .join("");
        await params.onEvent({ kind: "agent_message", text });
        continue;
      }

      if (event.type === "agent.thinking") {
        await params.onEvent({ kind: "agent_thinking" });
        continue;
      }

      if (event.type === "agent.custom_tool_use") {
        const result = await dispatchSupervisorTool(
          event.name,
          event.input as Record<string, unknown>,
          toolCtx,
        );
        pendingToolResults.set(event.id, { name: event.name, result });
        await params.onEvent({
          kind: "tool_use",
          id: event.id,
          name: event.name,
          input: event.input as Record<string, unknown>,
        });
        await params.onEvent({
          kind: "tool_result",
          toolUseId: event.id,
          name: event.name,
          isError: result.isError,
          resultPreview: previewContent(result.content),
        });
        continue;
      }

      if (event.type === "agent.tool_use") {
        builtinToolNames.set(event.id, event.name);
        await params.onEvent({
          kind: "builtin_tool_use",
          id: event.id,
          name: event.name,
          input: event.input as Record<string, unknown>,
        });
        continue;
      }

      if (event.type === "agent.tool_result") {
        const preview = (event.content ?? [])
          .map((block) => ("text" in block ? block.text : ""))
          .join("")
          .slice(0, 600);
        await params.onEvent({
          kind: "builtin_tool_result",
          toolUseId: event.tool_use_id,
          isError: Boolean(event.is_error),
          resultPreview: preview,
        });
        continue;
      }

      if (event.type === "session.error") {
        await params.onEvent({
          kind: "session_error",
          message:
            "message" in event.error && typeof event.error.message === "string"
              ? event.error.message
              : "session error",
        });
        continue;
      }

      if (event.type === "session.status_idle") {
        const reason = event.stop_reason;
        if (reason.type === "requires_action") {
          const toSend: Anthropic.Beta.Sessions.Events.BetaManagedAgentsEventParams[] =
            [];
          for (const evId of reason.event_ids) {
            const pending = pendingToolResults.get(evId);
            if (!pending) continue;
            toSend.push({
              type: "user.custom_tool_result",
              custom_tool_use_id: evId,
              is_error: pending.result.isError,
              content: [
                {
                  type: "text",
                  text: pending.result.content,
                },
              ],
            });
            pendingToolResults.delete(evId);
          }
          if (toSend.length > 0) {
            await client.beta.sessions.events.send(session.id, {
              events: toSend,
            });
          }
          continue;
        }
        finalStopReason = reason.type;
        await params.onEvent({
          kind: "session_finished",
          stopReason: reason.type,
        });
        break;
      }
    }
  } catch (err) {
    await SupervisorSession.updateOne(
      { _id: localSession._id, status: "running" },
      {
        $set: {
          status: "failed",
          error: err instanceof Error ? err.message : String(err),
          completedAt: new Date(),
        },
      },
    );
    throw err;
  }

  const finalStatus =
    finalStopReason === "end_turn"
      ? "idle"
      : finalStopReason === "retries_exhausted"
        ? "failed"
        : "terminated";

  await SupervisorSession.updateOne(
    { _id: localSession._id, status: "running" },
    {
      $set: {
        status: finalStatus,
        completedAt: new Date(),
      },
    },
  );

  return { sessionId: localSession._id };
}

export async function loadSupervisorSession(
  sessionId: string | Types.ObjectId,
) {
  const id = new Types.ObjectId(String(sessionId));
  const [session, findings, reinspections] = await Promise.all([
    SupervisorSession.findById(id).lean(),
    SupervisorFinding.find({ sessionId: id }).lean(),
    ReinspectionRequest.find({ sessionId: id }).lean(),
  ]);
  if (!session) return null;
  return { session, findings, reinspections };
}

export async function fetchManagedEventLog(managedSessionId: string) {
  const client = getManagedAgentsClient();
  const events: StreamEvent[] = [];
  for await (const event of client.beta.sessions.events.list(
    managedSessionId,
  )) {
    events.push(event as StreamEvent);
  }
  return events;
}
