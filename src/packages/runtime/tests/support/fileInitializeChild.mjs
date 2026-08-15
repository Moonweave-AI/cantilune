import { existsSync } from "node:fs";
import { actorId, collaborationSnapshot, epochId, participant, snapshotRef } from "@cantilune/core";
import { createFileRuntimePersistence } from "../../dist/memory/index.js";

const [dir, candidate, barrierPath] = process.argv.slice(2);
if (dir === undefined || candidate === undefined || barrierPath === undefined) {
  throw new Error("expected dir, candidate, and barrierPath");
}
const aid = actorId(candidate);
const initial = collaborationSnapshot({
  snapshotRef: snapshotRef(`genesis-${candidate}`),
  epochId: epochId("epoch-a"),
  participants: new Map([[aid, participant(aid, "agent")]]),
});
process.stdout.write(`READY ${candidate}\n`);
const deadline = Date.now() + 10_000;
while (!existsSync(barrierPath)) {
  if (Date.now() >= deadline) throw new Error("timed out waiting for parent barrier");
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 5);
}
const persistence = createFileRuntimePersistence({ dir, initial });
const headRef = persistence.durable.head();
const head = headRef === undefined ? undefined : persistence.durable.get(headRef);
const active = [...(head?.participants.values() ?? [])]
  .filter((entry) => entry.kind === "agent" && entry.status === "active")
  .map((entry) => String(entry.actorId));
process.stdout.write(
  `${JSON.stringify({ candidate, genesisRef: String(persistence.t0Ref), active })}\n`,
);
