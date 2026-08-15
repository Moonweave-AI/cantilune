/**
 * Child process entry: durable session binding CAS on shared comms snapshot.
 * Usage: node casSessionChild.mjs <dir> <workerLabel> <sessionId> <expectedGeneration>
 */
import { channelGeneration } from "../../dist/foundation/messageId.js";
import { MemoryCommsStore } from "../../dist/memory/memoryCommsStore.js";
import { createFileCommsStore } from "../../dist/file/fileCommsStore.js";

const dir = process.argv[2];
const workerLabel = process.argv[3];
const sessionId = process.argv[4];
const expectedGeneration = Number(process.argv[5]);

if (
  dir === undefined ||
  workerLabel === undefined ||
  sessionId === undefined ||
  Number.isNaN(expectedGeneration)
) {
  console.error("usage: casSessionChild.mjs <dir> <workerLabel> <sessionId> <expectedGeneration>");
  process.exit(2);
}

const memory = new MemoryCommsStore();
const fileStore = createFileCommsStore(dir, memory);
const current = fileStore.getSessionBinding(sessionId);
if (current === undefined) {
  console.error("session binding missing");
  process.exit(3);
}

const nextBinding = {
  ...current,
  channelGeneration: channelGeneration(expectedGeneration + 1),
  updatedAt: new Date().toISOString(),
  status: "active",
};

const ok = fileStore.casSessionBindingDurable({
  sessionId,
  expectedGeneration: channelGeneration(expectedGeneration),
  next: nextBinding,
});

process.stdout.write(ok ? "won" : "lost");
process.exit(ok ? 0 : 2);
