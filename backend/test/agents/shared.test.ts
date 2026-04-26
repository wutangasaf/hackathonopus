// Unit tests for `withAgentRun` — the CAS observability wrapper every agent
// passes through. Failure here silently corrupts the AgentRun ledger and
// the Supervisor's view of the pipeline.

import { afterEach, describe, expect, it, vi } from "vitest";
import { Types } from "mongoose";
import { AgentRun } from "../../src/models/agentRun.js";
import { withAgentRun } from "../../src/agents/shared.js";

const PROJECT_ID = new Types.ObjectId();
const RUN_ID = new Types.ObjectId();

afterEach(() => {
  vi.restoreAllMocks();
});

function stubCreateAndUpdate() {
  const createdRun = { _id: RUN_ID } as unknown as Awaited<
    ReturnType<typeof AgentRun.create>
  >;
  const createSpy = vi
    .spyOn(AgentRun, "create")
    // mongoose `.create()` is overloaded; bypass the union with `as never`.
    .mockResolvedValue(createdRun as never);
  const updateSpy = vi
    .spyOn(AgentRun, "updateOne")
    .mockReturnValue({ exec: () => Promise.resolve({}) } as never);
  return { createSpy, updateSpy };
}

describe("withAgentRun", () => {
  it("creates a running AgentRun, runs the body, CAS-flips to succeeded", async () => {
    const { createSpy, updateSpy } = stubCreateAndUpdate();

    const out = await withAgentRun(
      { projectId: PROJECT_ID, agentName: "TestAgent", input: { a: 1 } },
      async (ctx) => {
        ctx.recordUsage({
          inputTokens: 10,
          outputTokens: 20,
          cacheReadTokens: 0,
          cacheCreationTokens: 0,
          model: "claude-opus-4-7",
        });
        return { ok: true } as const;
      },
    );

    expect(out.result).toEqual({ ok: true });
    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: PROJECT_ID,
        agentName: "TestAgent",
        status: "running",
        input: { a: 1 },
      }),
    );
    expect(updateSpy).toHaveBeenCalledTimes(1);
    const [filter, update] = updateSpy.mock.calls[0]!;
    expect(filter).toEqual({ _id: RUN_ID, status: "running" });
    expect(update).toEqual(
      expect.objectContaining({
        $set: expect.objectContaining({
          status: "succeeded",
          result: { ok: true },
          usage: expect.objectContaining({ inputTokens: 10, outputTokens: 20 }),
        }),
      }),
    );
  });

  it("CAS-flips to failed when the body throws and rethrows the error", async () => {
    const { updateSpy } = stubCreateAndUpdate();

    await expect(
      withAgentRun(
        { projectId: PROJECT_ID, agentName: "TestAgent" },
        async () => {
          throw new Error("model said no");
        },
      ),
    ).rejects.toThrow("model said no");

    expect(updateSpy).toHaveBeenCalledTimes(1);
    const [filter, update] = updateSpy.mock.calls[0]!;
    expect(filter).toEqual({ _id: RUN_ID, status: "running" });
    expect(update).toEqual(
      expect.objectContaining({
        $set: expect.objectContaining({
          status: "failed",
          error: "model said no",
        }),
      }),
    );
  });

  it("accumulates usage across multiple recordUsage calls", async () => {
    const { updateSpy } = stubCreateAndUpdate();

    await withAgentRun(
      { projectId: PROJECT_ID, agentName: "TestAgent" },
      async (ctx) => {
        ctx.recordUsage({
          inputTokens: 100,
          outputTokens: 50,
          cacheReadTokens: 5,
          cacheCreationTokens: 1,
          model: "claude-opus-4-7",
        });
        ctx.recordUsage({
          inputTokens: 200,
          outputTokens: 75,
          cacheReadTokens: 10,
          cacheCreationTokens: 2,
          model: "claude-opus-4-7",
        });
        return null;
      },
    );

    const [, update] = updateSpy.mock.calls[0]!;
    const usage = (update as { $set: { usage: Record<string, number> } }).$set
      .usage;
    expect(usage).toEqual(
      expect.objectContaining({
        inputTokens: 300,
        outputTokens: 125,
        cacheReadTokens: 15,
        cacheCreationTokens: 3,
        model: "claude-opus-4-7",
      }),
    );
  });

  it("uses CAS filter so a cancelled run is not overwritten by the success path", async () => {
    const { updateSpy } = stubCreateAndUpdate();

    await withAgentRun(
      { projectId: PROJECT_ID, agentName: "TestAgent" },
      async () => "done",
    );

    // The whole point of the CAS is that the filter must match status=running;
    // any external write (DELETE handler flipping to "failed") therefore wins.
    const [filter] = updateSpy.mock.calls[0]!;
    expect(filter).toEqual({ _id: RUN_ID, status: "running" });
  });
});
