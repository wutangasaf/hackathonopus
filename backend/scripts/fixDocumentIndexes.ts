import mongoose from "mongoose";
import { config } from "../src/config.js";

async function main() {
  await mongoose.connect(config.mongoUrl);
  const db = mongoose.connection.db;
  if (!db) throw new Error("no db handle after connect");
  const coll = db.collection("documents");
  const before = await coll.indexes();
  process.stdout.write(`BEFORE:\n${JSON.stringify(before, null, 2)}\n`);

  const staleNames = ["sha256_1"];
  for (const name of staleNames) {
    const hit = before.find((ix) => ix.name === name);
    if (!hit) continue;
    await coll.dropIndex(name);
    process.stdout.write(`dropped ${name}\n`);
  }

  const after = await coll.indexes();
  process.stdout.write(`AFTER:\n${JSON.stringify(after, null, 2)}\n`);
  await mongoose.disconnect();
}

main().catch((err) => {
  process.stderr.write(`${String(err)}\n`);
  process.exit(1);
});
