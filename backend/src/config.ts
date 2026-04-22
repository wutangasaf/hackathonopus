import "dotenv/config";
import { z } from "zod";
import path from "node:path";

const schema = z.object({
  PORT: z.coerce.number().int().positive().default(4000),
  MONGO_URL: z.string().url().default("mongodb://localhost:27017/plumbline"),
  UPLOADS_DIR: z.string().default("./uploads"),
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().default("claude-opus-4-7"),
  LOG_LEVEL: z.string().default("info"),
});

const parsed = schema.parse(process.env);

export const config = {
  port: parsed.PORT,
  mongoUrl: parsed.MONGO_URL,
  uploadsDir: path.resolve(parsed.UPLOADS_DIR),
  anthropicApiKey: parsed.ANTHROPIC_API_KEY,
  anthropicModel: parsed.ANTHROPIC_MODEL,
  logLevel: parsed.LOG_LEVEL,
} as const;

export type Config = typeof config;
