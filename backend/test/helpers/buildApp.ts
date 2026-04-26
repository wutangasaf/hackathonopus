import { buildServer } from "../../src/server.js";

/**
 * Build a Fastify instance for `app.inject()` tests. No port is opened, no
 * Mongo connection is made (callers mock Mongoose model statics per test).
 */
export async function buildApp() {
  return buildServer();
}
