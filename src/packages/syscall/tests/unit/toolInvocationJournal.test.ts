/**
 * ADR-0016 exactly-once boundary coverage.
 *
 * The pre-invocation journal makes each of the four crash boundaries
 * recoverable. These tests drive `useTool` against a real memory content store
 * and a controllable executor to assert the journal contract at each
 * boundary without spawning a child process (the cross-process variant lives
 * in tests/system). Each test names the boundary it closes.
 */
import { describe, it, expect } from "vitest";
import { createMemoryContentStore } from "@cantilune/content/memory";
import { createSyscall } from "../../src/createSyscall.js";
import type {
  SyscallRuntime,
  SyscallPrincipal,
  ToolExecutor,
  ToolInvocationKey,
} from "../../src/syscall.js";

function principal(): SyscallPrincipal {
  return { actorId: "planner", kind: "agent" };
}

function runtime(): SyscallRuntime {
  return {
    getHead: () => undefined,
    observe: () => ({ ok: true }),
    changes: () => [],
    proposeAndCommit: () => ({ ok: true, newHeadRef: "s" }),
  };
}

/** A controllable executor that records every execute / reconcile call. */
function makeExecutor(opts?: {
  tier?: "read" | "idempotent" | "non-idempotent";
  output?: string;
  fail?: boolean;
  reconcileOutcome?: "known" | "unknown";
}): ToolExecutor & {
  executeCalls: number;
  reconcileCalls: number;
  reconcileKeys: ToolInvocationKey[];
} {
  const exec = {
    executeCalls: 0,
    reconcileCalls: 0,
    reconcileKeys: [] as ToolInvocationKey[],
    tier: opts?.tier,
    async execute() {
      exec.executeCalls++;
      if (opts?.fail) return { ok: false, output: "executor failed" };
      return { ok: true, output: opts?.output ?? "tool-output" };
    },
    async listTools() {
      return [];
    },
    async reconcile(key: ToolInvocationKey) {
      exec.reconcileCalls++;
      exec.reconcileKeys.push(key);
      if (opts?.reconcileOutcome === "unknown") return { status: "unknown" };
      return { status: "known", output: opts?.output ?? "reconciled-output" };
    },
  };
  return exec as unknown as ToolExecutor & {
    executeCalls: number;
    reconcileCalls: number;
    reconcileKeys: ToolInvocationKey[];
  };
}

describe("ADR-0016 external-tool invocation journal", () => {
  it("boundary 0 (happy path): executes once, writes dispatched + completed, observes", async () => {
    const exec = makeExecutor({ tier: "idempotent" });
    const store = createMemoryContentStore();
    const syscall = createSyscall({
      runtime: runtime(),
      contentStore: store,
      principal: principal(),
      schemaProvider: { getTemplates: () => [] },
      toolExecutor: exec,
    });

    const result = await syscall.useTool({
      callId: "call-1",
      toolName: "write_file",
      args: { path: "/x" },
    });

    expect(result.ok).toBe(true);
    expect(exec.executeCalls).toBe(1);
    // dispatched + completed + output + receipt = 4 blobs.
    expect(await store.count()).toBe(4);
  });

  it("boundary 1 (pre-dispatch crash): a fresh call sees no prior journal and executes", async () => {
    // Simulate a crash BEFORE the dispatched entry was written: the store is
    // empty, so the next call is a fresh invocation (no dispatched/completed).
    const exec = makeExecutor({ tier: "read" });
    const store = createMemoryContentStore();
    const syscall = createSyscall({
      runtime: runtime(),
      contentStore: store,
      principal: principal(),
      schemaProvider: { getTemplates: () => [] },
      toolExecutor: exec,
    });

    const result = await syscall.useTool({ callId: "call-pre", toolName: "read", args: {} });

    expect(result.ok).toBe(true);
    expect(exec.executeCalls).toBe(1);
  });

  it("boundary 2 (post-side-effect / pre-output): non-idempotent dispatched with no completed → ambiguous (no re-dispatch)", async () => {
    const exec = makeExecutor({ tier: "non-idempotent" });
    const store = createMemoryContentStore();

    // Simulate the crash state: a `dispatched` journal entry was written but the
    // process died before execute/put. Re-construct that dispatched blob by
    // running the exact same call through a first syscall instance whose
    // executor THROWS (so dispatched is written, execute never completes).
    const crashExec: ToolExecutor = {
      tier: "non-idempotent",
      async execute() {
        // Simulate the crash: throw after dispatch was journaled.
        throw new Error("process killed mid-execute");
      },
      async listTools() {
        return [];
      },
    };
    const crashSyscall = createSyscall({
      runtime: runtime(),
      contentStore: store,
      principal: principal(),
      schemaProvider: { getTemplates: () => [] },
      toolExecutor: crashExec,
    });
    const crashed = await crashSyscall.useTool({ callId: "call-crash", toolName: "shell", args: { cmd: "rmdir" } });
    // The crash surface: executor threw → invalid result.
    expect(crashed.ok).toBe(false);
    expect(crashed.output).toBe("Tool executor returned an invalid result.");
    // The dispatched journal entry survived the "crash".
    expect(await store.count()).toBe(1);

    // Restart: a fresh syscall over the SAME store. The tool is non-idempotent,
    // so the run MUST NOT re-dispatch — it reports `ambiguous`.
    const restartSyscall = createSyscall({
      runtime: runtime(),
      contentStore: store,
      principal: principal(),
      schemaProvider: { getTemplates: () => [] },
      toolExecutor: exec,
    });
    const retried = await restartSyscall.useTool({ callId: "call-crash", toolName: "shell", args: { cmd: "rmdir" } });

    expect(retried.ok).toBe(false);
    expect(retried.disposition).toBe("ambiguous");
    expect(retried.output).toContain("Ambiguous");
    // The executor was NOT called again — no double side effect.
    expect(exec.executeCalls).toBe(0);
  });

  it("boundary 2 (post-side-effect / pre-output): idempotent dispatched with no completed → reconcile(known) reuses output (no re-execute)", async () => {
    const exec = makeExecutor({ tier: "idempotent", output: "prior-output", reconcileOutcome: "known" });
    const store = createMemoryContentStore();

    // Crash state: dispatched written, execute threw before output stored.
    const crashExec: ToolExecutor = {
      tier: "idempotent",
      async execute() {
        throw new Error("killed");
      },
      async listTools() {
        return [];
      },
      async reconcile() {
        return { status: "known", output: "prior-output" };
      },
    };
    const crashSyscall = createSyscall({
      runtime: runtime(),
      contentStore: store,
      principal: principal(),
      schemaProvider: { getTemplates: () => [] },
      toolExecutor: crashExec,
    });
    await crashSyscall.useTool({ callId: "call-recon", toolName: "write_file", args: { path: "/x" } });
    expect(await store.count()).toBe(1); // dispatched only

    // Restart: reconcile-first returns the prior output; execute is NOT called.
    const restartSyscall = createSyscall({
      runtime: runtime(),
      contentStore: store,
      principal: principal(),
      schemaProvider: { getTemplates: () => [] },
      toolExecutor: exec,
    });
    const retried = await restartSyscall.useTool({ callId: "call-recon", toolName: "write_file", args: { path: "/x" } });

    expect(retried.ok).toBe(true);
    expect(retried.output).toBe("prior-output");
    expect(exec.executeCalls).toBe(0);
    expect(exec.reconcileCalls).toBe(1);
    // The reconcile-reused output is stored, journaled completed, observed.
    expect(retried.contentRef).toBeDefined();
  });

  it("boundary 2 (post-side-effect / pre-output): idempotent dispatched, reconcile unknown → safe re-dispatch", async () => {
    const exec = makeExecutor({ tier: "idempotent", output: "retried-output", reconcileOutcome: "unknown" });
    const store = createMemoryContentStore();

    const crashExec: ToolExecutor = {
      tier: "idempotent",
      async execute() {
        throw new Error("killed");
      },
      async listTools() {
        return [];
      },
      async reconcile() {
        return { status: "unknown" };
      },
    };
    const crashSyscall = createSyscall({
      runtime: runtime(),
      contentStore: store,
      principal: principal(),
      schemaProvider: { getTemplates: () => [] },
      toolExecutor: crashExec,
    });
    await crashSyscall.useTool({ callId: "call-unknown", toolName: "write_file", args: { path: "/y" } });

    const restartSyscall = createSyscall({
      runtime: runtime(),
      contentStore: store,
      principal: principal(),
      schemaProvider: { getTemplates: () => [] },
      toolExecutor: exec,
    });
    const retried = await restartSyscall.useTool({ callId: "call-unknown", toolName: "write_file", args: { path: "/y" } });

    // reconcile said unknown → safe re-dispatch.
    expect(retried.ok).toBe(true);
    expect(retried.output).toBe("retried-output");
    expect(exec.reconcileCalls).toBe(1);
    expect(exec.executeCalls).toBe(1);
  });

  it("boundary 3 (post-output / pre-receipt): dispatched entry + reconcile(known) reuses the output without re-executing", async () => {
    const exec = makeExecutor({ tier: "idempotent", output: "first-output" });
    const store = createMemoryContentStore();
    const syscall = createSyscall({
      runtime: runtime(),
      contentStore: store,
      principal: principal(),
      schemaProvider: { getTemplates: () => [] },
      toolExecutor: exec,
    });

    // First call completes (dispatched + output + receipt + completed).
    const first = await syscall.useTool({ callId: "call-done", toolName: "write_file", args: { path: "/z" } });
    expect(first.ok).toBe(true);
    expect(exec.executeCalls).toBe(1);

    // Simulate boundary 3: a crash AFTER the output is durable. On restart the
    // findable `dispatched` journal entry is present; the idempotent executor's
    // reconcile(key) returns the prior output, so the run reuses it WITHOUT
    // re-executing. (The `completed` journal entry carries the outputRef and is
    // NOT findable from the key under a content-addressed store; the findable
    // artifact is the `dispatched` entry, which drives reconcile. See ADR-0016.)
    const restart = await syscall.useTool({ callId: "call-done", toolName: "write_file", args: { path: "/z" } });
    expect(restart.ok).toBe(true);
    expect(restart.output).toBe("first-output");
    // execute was NOT called again — exactly-once.
    expect(exec.executeCalls).toBe(1);
    expect(exec.reconcileCalls).toBe(1);
  });

  it("boundary 4 (post-receipt / pre-observation): retryToolObservation re-observes without re-executing", async () => {
    let observeCount = 0;
    const exec = makeExecutor({ tier: "idempotent", output: "boundary-4" });
    const rt = runtime();
    rt.observe = () => {
      observeCount++;
      return observeCount === 1 ? { ok: false, message: "audit offline" } : { ok: true };
    };
    const store = createMemoryContentStore();
    const syscall = createSyscall({
      runtime: rt,
      contentStore: store,
      principal: principal(),
      schemaProvider: { getTemplates: () => [] },
      toolExecutor: exec,
    });

    const first = await syscall.useTool({ callId: "call-obs", toolName: "write_file", args: { path: "/w" } });
    expect(first.ok).toBe(false);
    expect(first.observationRecovery).toBeDefined();

    const retry = await syscall.retryToolObservation(first.observationRecovery!);
    expect(retry.ok).toBe(true);
    expect(retry.outputRef).toBe(first.contentRef);
    expect(exec.executeCalls).toBe(1);
  });

  it("idempotent tier declared without a reconcile method reports ambiguous (fail safe)", async () => {
    const exec: ToolExecutor = {
      tier: "idempotent",
      async execute() {
        throw new Error("killed");
      },
      async listTools() {
        return [];
      },
      // No reconcile despite tier=idempotent.
    };
    const store = createMemoryContentStore();
    const crashSyscall = createSyscall({
      runtime: runtime(),
      contentStore: store,
      principal: principal(),
      schemaProvider: { getTemplates: () => [] },
      toolExecutor: exec,
    });
    await crashSyscall.useTool({ callId: "bad-idem", toolName: "write_file", args: { path: "/x" } });

    const restart = createSyscall({
      runtime: runtime(),
      contentStore: store,
      principal: principal(),
      schemaProvider: { getTemplates: () => [] },
      toolExecutor: exec,
    });
    const retried = await restart.useTool({ callId: "bad-idem", toolName: "write_file", args: { path: "/x" } });

    expect(retried.ok).toBe(false);
    expect(retried.disposition).toBe("ambiguous");
    expect(retried.output).toContain("no reconcile method");
  });

  it("read tier re-dispatches safely after a dispatched crash (boundary 2, read)", async () => {
    const exec = makeExecutor({ tier: "read", output: "read-output" });
    const store = createMemoryContentStore();

    const crashExec: ToolExecutor = {
      tier: "read",
      async execute() {
        throw new Error("killed");
      },
      async listTools() {
        return [];
      },
    };
    const crashSyscall = createSyscall({
      runtime: runtime(),
      contentStore: store,
      principal: principal(),
      schemaProvider: { getTemplates: () => [] },
      toolExecutor: crashExec,
    });
    await crashSyscall.useTool({ callId: "call-read", toolName: "read_file", args: { path: "/r" } });
    expect(await store.count()).toBe(1);

    const restart = createSyscall({
      runtime: runtime(),
      contentStore: store,
      principal: principal(),
      schemaProvider: { getTemplates: () => [] },
      toolExecutor: exec,
    });
    const retried = await restart.useTool({ callId: "call-read", toolName: "read_file", args: { path: "/r" } });

    // Read tools have no side effect → safe re-dispatch.
    expect(retried.ok).toBe(true);
    expect(retried.output).toBe("read-output");
    expect(exec.executeCalls).toBe(1);
  });
});
