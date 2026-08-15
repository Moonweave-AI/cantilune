/**
 * Child process entry: commit one introduce via file-backed durable.
 * Usage: node fileCommitChild.mjs <dir> <taskIndex>
 * Requires: pnpm build (imports from dist).
 */
import {
  actorRef,
  contentRef,
  coordinationIntent,
  epochId,
  matchBinding,
  operationTypeId,
} from "../../../core/dist/index.js";
import {
  createCoordinationRuntime,
  createDefaultHandlers,
  createDefaultSchema,
  runtimeDependenciesWithStaticSchema,
} from "../../dist/index.js";
import { createFileRuntimePersistence } from "../../dist/memory/index.js";

const dir = process.argv[2];
const taskIndex = Number(process.argv[3]);
if (dir === undefined || Number.isNaN(taskIndex)) {
  console.error("usage: fileCommitChild.mjs <dir> <taskIndex>");
  process.exit(2);
}

/** Disjoint holder per task — matches buildRuntimeLargeWorld(8) agent pool (avoid planner-p overlap). */
const holder = `agent-${String(taskIndex % 8)}`;
const digest = taskIndex.toString(16).padStart(64, "0").slice(-64);
const intent = coordinationIntent(
  actorRef(holder, "agent"),
  operationTypeId("introduce_artifact"),
  [
    matchBinding("task", `task-${taskIndex}`),
    matchBinding("from", holder),
    matchBinding("capability", `write-lock-${taskIndex}`),
  ],
  undefined,
  [contentRef(`sha256:${digest}`)],
);

const MAX_ATTEMPTS = 64;

function sleepMs(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function jitterMs(attempt) {
  return 5 + Math.floor(Math.random() * 15) + Math.min(attempt, 32);
}

let lastFailure = "none";

for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
  if (attempt > 0) {
    sleepMs(jitterMs(attempt));
  }

  const persistence = createFileRuntimePersistence({ dir });
  const runtime = createCoordinationRuntime(
    runtimeDependenciesWithStaticSchema({
      durable: persistence.durable,
      clock: { now: () => "2026-08-10T12:00:00Z" },
      idGen: {
        snapshotRef: () => `snap-w-${taskIndex}-a${attempt}`,
        changeId: () => `chg-w-${taskIndex}-a${attempt}`,
        sessionId: () => `session-w-${taskIndex}-a${attempt}`,
        linkId: () => `link-w-${taskIndex}-a${attempt}`,
        artifactId: () => `artifact-w-${taskIndex}`,
        capabilityId: () => `cap-w-${taskIndex}`,
        evidenceId: () => `ev-w-${taskIndex}-a${attempt}`,
      },
      schema: createDefaultSchema(),
      activeEpochId: epochId("42"),
      policy: {
        evaluate: () => ({ kind: "allow", authorization: [] }),
      },
      handlers: createDefaultHandlers(),
      locks: persistence.locks,
      contentRefAuthority: {
        isAvailable: (ref) => ref === intent.inputContentRefs[0],
      },
    }),
  );

  const admitted = runtime.admit(intent);
  if (!admitted.ok) {
    lastFailure = `admit:${admitted.reason.kind}`;
    continue;
  }
  const committed = runtime.commit(admitted.ticket);
  if ("change" in committed) {
    process.stdout.write(String(taskIndex));
    process.exit(0);
  }
  lastFailure = `commit:${committed.code}`;
  if (committed.code !== "commit_atomic_failed" && committed.code !== "admission_rejected") {
    console.error(JSON.stringify(committed));
    process.exit(1);
  }
}

console.error(`exhausted retries for task ${taskIndex} (last=${lastFailure})`);
process.exit(1);
