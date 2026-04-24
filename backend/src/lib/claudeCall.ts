import Anthropic from "@anthropic-ai/sdk";
import type { z } from "zod";
import { config } from "../config.js";

export type UsageMeta = {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  model: string;
};

export type ClaudeTool<T> = {
  name: string;
  description: string;
  inputSchema: object;
  outputSchema: z.ZodType<T>;
};

export type ClaudeMessage = Anthropic.MessageParam;

export type ClaudeCallParams<T> = {
  system: string;
  messages: ClaudeMessage[];
  tool: ClaudeTool<T>;
  model?: string;
  maxTokens?: number;
  maxRetries?: number;
};

export type ClaudeCallResult<T> = {
  data: T;
  usage: UsageMeta;
  raw: Anthropic.Message;
};

const ENGLISH_ONLY_DIRECTIVE = `All output you emit MUST be in English. If any source material (PDF text, image captions, user-provided fields, form labels, etc.) is in a non-English language such as Hebrew, translate it into natural English before placing it into any tool-call field. Do not echo non-English characters in your output under any circumstances.`;

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) {
    if (!config.anthropicApiKey) {
      throw new Error("ANTHROPIC_API_KEY not set");
    }
    client = new Anthropic({ apiKey: config.anthropicApiKey });
  }
  return client;
}

function accumulateUsage(model: string, u: Anthropic.Usage): UsageMeta {
  return {
    inputTokens: u.input_tokens ?? 0,
    outputTokens: u.output_tokens ?? 0,
    cacheReadTokens: u.cache_read_input_tokens ?? 0,
    cacheCreationTokens: u.cache_creation_input_tokens ?? 0,
    model,
  };
}

export async function claudeCall<T>(
  params: ClaudeCallParams<T>,
): Promise<ClaudeCallResult<T>> {
  const model = params.model ?? config.anthropicModel;
  const maxRetries = params.maxRetries ?? 2;
  const maxTokens = params.maxTokens ?? 4096;
  const { tool } = params;

  const anthropic = getClient();
  const messages: ClaudeMessage[] = [...params.messages];

  const systemText = `${ENGLISH_ONLY_DIRECTIVE}\n\n${params.system}`;

  let lastError: Error | undefined;
  let totalUsage: UsageMeta = {
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheCreationTokens: 0,
    model,
  };

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await anthropic.messages.create({
      model,
      max_tokens: maxTokens,
      system: [
        {
          type: "text",
          text: systemText,
          cache_control: { type: "ephemeral" },
        },
      ],
      tools: [
        {
          name: tool.name,
          description: tool.description,
          input_schema: tool.inputSchema as Anthropic.Tool.InputSchema,
        },
      ],
      tool_choice: { type: "tool", name: tool.name },
      messages,
    });

    const u = accumulateUsage(model, response.usage);
    totalUsage = {
      inputTokens: totalUsage.inputTokens + u.inputTokens,
      outputTokens: totalUsage.outputTokens + u.outputTokens,
      cacheReadTokens: totalUsage.cacheReadTokens + u.cacheReadTokens,
      cacheCreationTokens:
        totalUsage.cacheCreationTokens + u.cacheCreationTokens,
      model,
    };

    const toolUse = response.content.find(
      (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
    );
    if (!toolUse) {
      lastError = new Error("Claude returned no tool_use block");
      messages.push({ role: "assistant", content: response.content });
      messages.push({
        role: "user",
        content: `You must call the \`${tool.name}\` tool. Do not respond with text.`,
      });
      continue;
    }

    const parsed = tool.outputSchema.safeParse(toolUse.input);
    if (parsed.success) {
      return { data: parsed.data, usage: totalUsage, raw: response };
    }

    lastError = new Error(
      `Tool input failed schema validation: ${parsed.error.message}`,
    );
    messages.push({ role: "assistant", content: response.content });
    messages.push({
      role: "user",
      content: [
        {
          type: "tool_result",
          tool_use_id: toolUse.id,
          is_error: true,
          content: `Your input to \`${tool.name}\` failed validation: ${parsed.error.message}. Please call the tool again with valid input.`,
        },
      ],
    });
  }

  throw lastError ?? new Error("claudeCall failed without a specific error");
}
