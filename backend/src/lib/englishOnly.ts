import { z } from "zod";
import { claudeCall } from "./claudeCall.js";
import { config } from "../config.js";

const NON_ENGLISH_RE =
  /[֐-׿؀-ۿЀ-ӿ぀-ゟ゠-ヿ一-鿿]/;

export function hasNonEnglish(s: string | undefined | null): boolean {
  if (!s) return false;
  return NON_ENGLISH_RE.test(s);
}

const translationSchema = z.object({
  translations: z.record(z.string(), z.string()),
});

export async function ensureEnglishFields<
  T extends Record<string, string | undefined>,
>(fields: T): Promise<T> {
  const entries = Object.entries(fields).filter(
    (e): e is [string, string] =>
      typeof e[1] === "string" && hasNonEnglish(e[1]),
  );
  if (entries.length === 0) return fields;

  const payload = Object.fromEntries(entries);

  const { data } = await claudeCall({
    system: `You translate short non-English strings (Hebrew, Arabic, Russian, CJK) into natural, idiomatic English suitable for a US construction-loan SaaS UI. Preserve proper nouns. Keep output concise.`,
    messages: [
      {
        role: "user",
        content: `Translate every value in this object to English. Return the translations keyed by the same keys.\n\n${JSON.stringify(payload)}`,
      },
    ],
    tool: {
      name: "translate_to_english",
      description:
        "Emit an English translation for every key in the provided object.",
      inputSchema: {
        type: "object",
        required: ["translations"],
        properties: {
          translations: {
            type: "object",
            additionalProperties: { type: "string" },
          },
        },
      },
      outputSchema: translationSchema,
    },
    model: config.anthropicModel,
    maxTokens: 512,
  });

  return { ...fields, ...data.translations };
}
