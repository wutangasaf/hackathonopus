import { isValidObjectId } from "mongoose";
import type { FastifyReply } from "fastify";

export function notImplemented(reply: FastifyReply, method: string, route: string) {
  return reply.code(501).send({ not_implemented: `${method} ${route}` });
}

export function parseObjectId(
  id: string | undefined,
  reply: FastifyReply,
): string | null {
  if (!id || !isValidObjectId(id)) {
    reply.code(400).send({ error: "invalid id" });
    return null;
  }
  return id;
}

export function sanitizeFilename(name: string): string {
  return name.replace(/[/\\\0]/g, "_").slice(0, 200);
}
