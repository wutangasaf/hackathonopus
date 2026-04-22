import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";

export function sha256OfFile(path: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(path);
    stream.on("error", reject);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
  });
}

export function sha256OfBuffer(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}
