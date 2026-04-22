import Fastify from "fastify";
import multipart from "@fastify/multipart";
import { mkdir } from "node:fs/promises";
import { config } from "./config.js";
import { connectDb } from "./db.js";

export async function buildServer() {
  const app = Fastify({
    logger: { level: config.logLevel },
    bodyLimit: 50 * 1024 * 1024,
  });

  await app.register(multipart, {
    limits: {
      fileSize: 50 * 1024 * 1024,
      files: 50,
    },
  });

  app.get("/health", async () => ({ ok: true }));

  return app;
}

export async function start(): Promise<void> {
  await mkdir(config.uploadsDir, { recursive: true });
  await connectDb();
  const app = await buildServer();
  await app.listen({ port: config.port, host: "0.0.0.0" });
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  start().catch((err) => {
    // eslint-disable-next-line no-console
    process.stderr.write(`server boot failed: ${String(err)}\n`);
    process.exit(1);
  });
}
