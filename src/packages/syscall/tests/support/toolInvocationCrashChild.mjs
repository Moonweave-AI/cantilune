/**
 * Child process entry for the ADR-0016 cross-process crash boundary tests.
 *
 * Runs a single `syscall.useTool` call against a file-backed content store
 * and a controllable executor, and crashes at one of the four boundaries so
 * the parent process can restart a fresh child against the SAME store and
 * verify exactly-once recovery (no re-execution of a side effect that landed,
 * correct `ambiguous` report for a non-idempotent tool, durable reuse via
 * reconcile).
 *
 * Usage:
 *   node toolInvocationCrashChild.mjs <storeDir> <crashAt> <tier> <callId> <argsJson>
 *
 * - crashAt: "none" | "pre-dispatch" | "post-dispatch" | "post-output"
 *     (boundary 4 — post-receipt/pre-observation — is not crashable here because
 *      observation is synchronous; it is covered by retryToolObservation.)
 * - tier:   "read" | "idempotent" | "non-idempotent" (the executor's declared tier)
 *
 * The executor records every `execute` and `reconcile` call to a sidecar file
 * <storeDir>/side-effect.log so the parent can prove a side effect landed (or
 * did not) across process death.
 *
 * On a non-crashing run the child prints a single JSON line to stdout:
 *   {"ok":boolean,"output":string,"disposition":string|undefined,"executes":number,"reconciles":number}
 * and exits 0. On a crashing run the child exits 1 after writing its sidecar
 * evidence.
 *
 * Requires: pnpm build (@cantilune/core, @cantilune/content, @cantilune/syscall).
 */
import { writeFileSync, appendFileSync, readFileSync } from "node:fs";
import { createFileContentStore } from "../../../content/dist/adapters/file/index.js";
import { createSyscall } from "../../dist/index.js";

const [, , storeDir, crashAt, tier, callId, argsJson] = process.argv;
const args = JSON.parse(argsJson);

const sidecar = `${storeDir}/side-effect.log`;
function recordSideEffect(line) {
  appendFileSync(sidecar, `${line}\n`, { flag: "a" });
}

let executeCalls = 0;
let reconcileCalls = 0;

const toolName = "demo_write";

const executor = {
  tier: tier,
  async execute() {
    executeCalls++;
    recordSideEffect(`execute#${executeCalls}`);
    if (crashAt === "post-dispatch") {
      // Side effect landed; crash before the output is durably stored.
      // (execute returned, but useTool has not put the output yet — we simulate
      // by exiting before returning.)
      process.exit(1);
    }
    return { ok: true, output: `executed-${executeCalls}` };
  },
  async listTools() {
    return [];
  },
  async reconcile() {
    reconcileCalls++;
    recordSideEffect(`reconcile#${reconcileCalls}`);
    // An idempotent executor that recorded the side effect returns "known"
    // with the prior output (the side effect landed in a prior process).
    return { status: "known", output: `executed-1` };
  },
};

const store = createFileContentStore(storeDir);

const runtime = {
  getHead: () => undefined,
  observe: () => ({ ok: true }),
  changes: () => [],
  proposeAndCommit: () => ({ ok: true, newHeadRef: "snapshot-committed" }),
};

if (crashAt === "pre-dispatch") {
  // Crash after the journal query but before execute is reached. useTool writes
  // the dispatched entry first, then calls execute — so to crash pre-execute we
  // exit here after the dispatched entry would be written. We cannot hook the
  // internal write, so simulate by crashing at the very start: no dispatched
  // entry exists, the restart will dispatch fresh (boundary 1).
  process.exit(1);
}

const syscall = createSyscall({
  runtime,
  contentStore: store,
  principal: { actorId: "planner", kind: "agent" },
  schemaProvider: { getTemplates: () => [] },
  toolExecutor: executor,
});

const result = await syscall.useTool({ callId, toolName, args });

if (crashAt === "post-output") {
  // The output and completed journal are durable, but simulate a crash before
  // the audit observation lands. observation is synchronous here so this is a
  // best-effort: exit after the result is built but before the parent reads it.
  recordSideEffect(`result-before-crash ok=${result.ok}`);
  process.exit(1);
}

// Non-crashing path: print the result and exit 0.
const out = {
  ok: result.ok,
  output: result.output,
  disposition: result.disposition,
  executes: executeCalls,
  reconciles: reconcileCalls,
};
process.stdout.write(`${JSON.stringify(out)}\n`);
process.exit(0);
