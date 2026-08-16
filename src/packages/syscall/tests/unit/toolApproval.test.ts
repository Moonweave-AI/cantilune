/**
 * Human authorization gate for external-tool dispatch.
 *
 * The gate's whole value is what it does NOT do: a denied tool must leave no
 * side effect and no `dispatched` journal entry, or a later run would recover
 * an invocation the human refused. These cases pin that, plus the fail-closed
 * behaviour when the gate itself is unavailable.
 */
import { describe, expect, it } from "vitest";
import { createMemoryContentStore } from "@cantilune/content/memory";
import { createSyscall } from "../../src/createSyscall.js";
import { intentRef, readIntent } from "../../src/act.js";
import type {
  SyscallRuntime,
  SyscallPrincipal,
  ToolApprovalRequest,
  ToolApprover,
  ToolExecutionTier,
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
  } as unknown as SyscallRuntime;
}

interface Recorder {
  readonly executor: ToolExecutor;
  readonly executed: string[];
}

function recordingExecutor(tier: ToolExecutionTier): Recorder {
  const executed: string[] = [];
  return {
    executed,
    executor: {
      tier,
      async execute(toolName) {
        executed.push(toolName);
        return { ok: true, output: "done" };
      },
      async listTools() {
        return [];
      },
      async reconcile() {
        return { status: "unknown" } as const;
      },
    },
  };
}

function approver(
  decide: (request: ToolApprovalRequest) => Promise<{ allowed: boolean; reason?: string }>,
  tiers?: readonly ToolExecutionTier[],
): { readonly approver: ToolApprover; readonly seen: ToolApprovalRequest[] } {
  const seen: ToolApprovalRequest[] = [];
  return {
    seen,
    approver: {
      ...(tiers !== undefined ? { requiresApprovalFor: tiers } : {}),
      async requestApproval(request) {
        seen.push(request);
        const decision = await decide(request);
        return decision.allowed
          ? { allowed: true }
          : { allowed: false, reason: decision.reason ?? "denied" };
      },
    },
  };
}

function keyFor(toolName: string, argumentsDigest: string, callId: string): ToolInvocationKey {
  return { principal: principal(), toolName, argumentsDigest, originalToolCallId: callId };
}

describe("approval gating by tier", () => {
  it("dispatches a read-tier tool without asking", async () => {
    const store = createMemoryContentStore();
    const recorder = recordingExecutor("read");
    const gate = approver(async () => ({ allowed: false, reason: "should not be asked" }));
    const syscall = createSyscall({
      runtime: runtime(),
      contentStore: store,
      principal: principal(),
      schemaProvider: { getTemplates: () => [] },
      toolExecutor: recorder.executor,
      toolApprover: gate.approver,
    });

    const result = await syscall.useTool({ callId: "c1", toolName: "read_file", args: { p: 1 } });
    expect(result.ok).toBe(true);
    expect(gate.seen).toHaveLength(0);
    expect(recorder.executed).toEqual(["read_file"]);
  });

  it("asks before a side-effecting tool and dispatches on approval", async () => {
    const store = createMemoryContentStore();
    const recorder = recordingExecutor("non-idempotent");
    const gate = approver(async () => ({ allowed: true }));
    const syscall = createSyscall({
      runtime: runtime(),
      contentStore: store,
      principal: principal(),
      schemaProvider: { getTemplates: () => [] },
      toolExecutor: recorder.executor,
      toolApprover: gate.approver,
    });

    const result = await syscall.useTool({ callId: "c2", toolName: "shell", args: { cmd: "ls" } });
    expect(result.ok).toBe(true);
    expect(gate.seen).toHaveLength(1);
    expect(gate.seen[0]).toMatchObject({ toolName: "shell", tier: "non-idempotent" });
    // The human sees the canonical arguments that will actually be dispatched.
    expect(gate.seen[0]?.args).toEqual({ cmd: "ls" });
    expect(recorder.executed).toEqual(["shell"]);
  });

  it("honours a custom tier set", async () => {
    const store = createMemoryContentStore();
    const recorder = recordingExecutor("read");
    const gate = approver(async () => ({ allowed: true }), ["read"]);
    const syscall = createSyscall({
      runtime: runtime(),
      contentStore: store,
      principal: principal(),
      schemaProvider: { getTemplates: () => [] },
      toolExecutor: recorder.executor,
      toolApprover: gate.approver,
    });

    await syscall.useTool({ callId: "c3", toolName: "read_file", args: {} });
    expect(gate.seen).toHaveLength(1);
  });

  it("dispatches everything when no approver is configured", async () => {
    const store = createMemoryContentStore();
    const recorder = recordingExecutor("non-idempotent");
    const syscall = createSyscall({
      runtime: runtime(),
      contentStore: store,
      principal: principal(),
      schemaProvider: { getTemplates: () => [] },
      toolExecutor: recorder.executor,
    });

    const result = await syscall.useTool({ callId: "c4", toolName: "shell", args: {} });
    expect(result.ok).toBe(true);
    expect(recorder.executed).toEqual(["shell"]);
  });
});

describe("denial leaves no trace", () => {
  it("reports the reason, executes nothing, and writes no journal entry", async () => {
    const store = createMemoryContentStore();
    const recorder = recordingExecutor("non-idempotent");
    const gate = approver(async () => ({ allowed: false, reason: "operator declined" }));
    const syscall = createSyscall({
      runtime: runtime(),
      contentStore: store,
      principal: principal(),
      schemaProvider: { getTemplates: () => [] },
      toolExecutor: recorder.executor,
      toolApprover: gate.approver,
    });

    const result = await syscall.useTool({ callId: "c5", toolName: "shell", args: { cmd: "rm" } });
    expect(result.ok).toBe(false);
    expect(result.output).toContain("operator declined");
    expect(result.output).toContain("No side effect was dispatched");
    expect(recorder.executed).toEqual([]);

    // The absent journal entry is the load-bearing assertion: a `dispatched`
    // record here would let a later run "recover" an invocation the human
    // refused, turning a denial into a delayed execution.
    const digest = gate.seen[0]?.key.argumentsDigest ?? "";
    const journal = await readIntent(store, intentRef(keyFor("shell", digest, "c5"), "dispatched"));
    expect(journal).toBeUndefined();
  });

  it("fails closed when the approval gate throws", async () => {
    const store = createMemoryContentStore();
    const recorder = recordingExecutor("idempotent");
    const syscall = createSyscall({
      runtime: runtime(),
      contentStore: store,
      principal: principal(),
      schemaProvider: { getTemplates: () => [] },
      toolExecutor: recorder.executor,
      toolApprover: {
        async requestApproval(): Promise<never> {
          throw new Error("no TTY attached");
        },
      },
    });

    const result = await syscall.useTool({ callId: "c6", toolName: "write", args: {} });
    expect(result.ok).toBe(false);
    expect(result.output).toContain("approval gate was unavailable");
    expect(recorder.executed).toEqual([]);
  });
});

describe("recovery never re-asks", () => {
  it("resumes a dispatched invocation without a second approval", async () => {
    const store = createMemoryContentStore();
    const first = recordingExecutor("idempotent");
    const gate = approver(async () => ({ allowed: true }));

    // First run: approved, executes, and leaves a `dispatched` entry. The
    // executor then fails to produce durable output by throwing.
    const crashing = createSyscall({
      runtime: runtime(),
      contentStore: store,
      principal: principal(),
      schemaProvider: { getTemplates: () => [] },
      toolExecutor: {
        ...first.executor,
        async execute(toolName: string) {
          first.executed.push(toolName);
          throw new Error("killed mid-execute");
        },
      },
      toolApprover: gate.approver,
    });
    await crashing.useTool({ callId: "c7", toolName: "write", args: {} });
    expect(gate.seen).toHaveLength(1);

    // Restart: the dispatched entry exists, so the tier rules govern. Asking
    // again would be a decision about a side effect that may already have
    // landed, which the human cannot answer.
    const denyAll = approver(async () => ({ allowed: false, reason: "should not be asked" }));
    const restarted = createSyscall({
      runtime: runtime(),
      contentStore: store,
      principal: principal(),
      schemaProvider: { getTemplates: () => [] },
      toolExecutor: recordingExecutor("idempotent").executor,
      toolApprover: denyAll.approver,
    });
    await restarted.useTool({ callId: "c7", toolName: "write", args: {} });
    expect(denyAll.seen).toHaveLength(0);
  });
});
