import { existsSync } from "node:fs";
import { createFileContentStore } from "../../dist/adapters/file/index.js";

const [rootDir, body, candidate, mimeType, barrierPath] = process.argv.slice(2);
if (
  rootDir === undefined ||
  body === undefined ||
  candidate === undefined ||
  mimeType === undefined ||
  barrierPath === undefined
) {
  throw new Error("expected rootDir, body, candidate, mimeType, and barrierPath");
}

process.stdout.write(`READY ${candidate}\n`);
const deadline = Date.now() + 10_000;
while (!existsSync(barrierPath)) {
  if (Date.now() >= deadline) throw new Error("timed out waiting for parent barrier");
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 5);
}

const store = createFileContentStore(rootDir);
const ref = await store.put(body, { createdBy: candidate, mimeType });
const metadata = await store.metadata(ref);
process.stdout.write(`${JSON.stringify({ candidate, ref: String(ref), metadata })}\n`);
