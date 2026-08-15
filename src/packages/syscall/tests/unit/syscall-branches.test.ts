import { describe, it, expect } from "vitest";
import { operationTypeId } from "@cantilune/core";
import { createMemoryContentStore } from "@cantilune/content/memory";
import { createSyscall, createStaticSchemaProvider, toolArgumentsDigest } from "../../src/index.js";
import type {
  SyscallRuntime,
  SyscallPrincipal,
  ToolExecutor,
  ProposeResult,
} from "../../src/syscall.js";

type MockHead = NonNullable<ReturnType<SyscallRuntime["getHead"]>>;

function createPrincipal(): SyscallPrincipal {
  return { actorId: "agent-1", kind: "agent" };
}

function richMockRuntime(): SyscallRuntime {
  const manyObs = Array.from({ length: 15 }, (_, i) => ({
    sequenceNo: i + 1,
    source: { actorId: `actor-${i}` },
    payloadRef: `sha256:obs${i}`,
    receivedAt: `2026-01-01T00:0${i}:00Z`,
  }));

  const snap = {
    snapshotRef: "snap-rich",
    epochId: "epoch-2",
    participants: new Map<unknown, unknown>([
      ["agent-1", { kind: "agent", status: "active" }],
      ["agent-2", { kind: "human", status: "idle" }],
    ]),
    artifacts: new Map<unknown, unknown>([
      [
        "task-1",
        {
          kind: "task",
          lifecycle: "active",
          owner: { actorId: "agent-1" },
          contentRef: "sha256:c1",
        },
      ],
    ]),
    links: new Map<unknown, unknown>([
      [
        "link-1",
        {
          kind: "delegation",
          from: { kind: "participant", actorId: "agent-1" },
          to: { kind: "participant", actorId: "agent-2" },
        },
      ],
      [
        "link-2",
        {
          kind: "dependency",
          from: { kind: "artifact", artifactId: "task-1" },
          to: { kind: "artifact", artifactId: "task-2" },
        },
      ],
    ]),
    sessions: new Map<unknown, unknown>([
      ["sess-1", { controller: "agent-1", participants: ["agent-1", "agent-2"] }],
    ]),
    capabilities: new Map<unknown, unknown>([["cap-1", { holder: "agent-1", scope: "write" }]]),
    auditTail: manyObs,
  };

  return {
    getHead: () => snap as MockHead,
    observe: () => ({ ok: true }),
    changes: () => [],
    proposeAndCommit: () => ({ ok: true, newHeadRef: "snapshot-committed" }),
  };
}

describe("perceive — branch coverage", () => {
  it("renders observations with truncation note when > 10", async () => {
    const runtime = richMockRuntime();
    const store = createMemoryContentStore();
    const provider = createStaticSchemaProvider([]);
    const syscall = createSyscall({
      runtime,
      contentStore: store,
      principal: createPrincipal(),
      schemaProvider: provider,
    });

    const result = await syscall.perceive();
    expect(result.recentObservations).toContain("showing last 10 of 15");
  });

  it("renders links with participant and artifact kinds", async () => {
    const runtime = richMockRuntime();
    const store = createMemoryContentStore();
    const provider = createStaticSchemaProvider([]);
    const syscall = createSyscall({
      runtime,
      contentStore: store,
      principal: createPrincipal(),
      schemaProvider: provider,
    });

    const result = await syscall.perceive();
    expect(result.worldSummary).toContain("Links (2)");
    expect(result.worldSummary).toContain("agent-1");
    expect(result.worldSummary).toContain("agent-2");
    expect(result.worldSummary).toContain("delegation");
  });

  it("renders participant with missing kind/status using fallbacks", async () => {
    const snap = {
      snapshotRef: "snap-partial",
      epochId: "epoch-partial",
      participants: new Map<unknown, unknown>([["p-no-kind", {}]]),
      artifacts: new Map<unknown, unknown>([["a-no-fields", {}]]),
      links: new Map(),
      sessions: new Map(),
      capabilities: new Map(),
      auditTail: [{ source: {} }],
    };
    const runtime: SyscallRuntime = {
      getHead: () => snap as MockHead,
      observe: () => ({ ok: true }),
      changes: () => [],
      proposeAndCommit: () => ({ ok: true, newHeadRef: "snapshot-committed" }),
    };
    const store = createMemoryContentStore();
    const provider = createStaticSchemaProvider([]);
    const syscall = createSyscall({
      runtime,
      contentStore: store,
      principal: createPrincipal(),
      schemaProvider: provider,
    });

    const result = await syscall.perceive();
    expect(result.worldSummary).toContain("unknown");
    expect(result.worldSummary).toContain("?");
  });

  it("renders empty observations message", async () => {
    const snap = {
      snapshotRef: "snap-empty",
      epochId: "epoch-1",
      participants: new Map(),
      artifacts: new Map(),
      links: new Map(),
      sessions: new Map(),
      capabilities: new Map(),
      auditTail: [],
    };
    const runtime: SyscallRuntime = {
      getHead: () => snap as MockHead,
      observe: () => ({ ok: true }),
      changes: () => [],
      proposeAndCommit: () => ({ ok: true, newHeadRef: "snapshot-committed" }),
    };
    const store = createMemoryContentStore();
    const provider = createStaticSchemaProvider([]);
    const syscall = createSyscall({
      runtime,
      contentStore: store,
      principal: createPrincipal(),
      schemaProvider: provider,
    });

    const result = await syscall.perceive();
    expect(result.recentObservations).toContain("No observations");
  });

  it("skips sessions/capabilities/links sections when empty", async () => {
    const snap = {
      snapshotRef: "snap-minimal",
      epochId: "epoch-1",
      participants: new Map([["a", { kind: "agent" }]]),
      artifacts: new Map(),
      links: new Map(),
      sessions: new Map(),
      capabilities: new Map(),
      auditTail: [],
    };
    const runtime: SyscallRuntime = {
      getHead: () => snap as MockHead,
      observe: () => ({ ok: true }),
      changes: () => [],
      proposeAndCommit: () => ({ ok: true, newHeadRef: "snapshot-committed" }),
    };
    const store = createMemoryContentStore();
    const provider = createStaticSchemaProvider([]);
    const syscall = createSyscall({
      runtime,
      contentStore: store,
      principal: createPrincipal(),
      schemaProvider: provider,
    });

    const result = await syscall.perceive();
    expect(result.worldSummary).not.toContain("Sessions");
    expect(result.worldSummary).not.toContain("Capabilities");
    expect(result.worldSummary).not.toContain("Links");
  });
});

describe("act — branch coverage for extractErrorMessage", () => {
  it("handles runtime returning rejection with message", async () => {
    const runtime: SyscallRuntime = {
      getHead: () => ({
        snapshotRef: "s",
        epochId: "e",
        participants: new Map(),
        artifacts: new Map(),
        links: new Map(),
        sessions: new Map(),
        capabilities: new Map(),
        auditTail: [],
      }),
      observe: () => ({ ok: true }),
      changes: () => [],
      proposeAndCommit: () => ({ ok: false, message: "ERR_ONLY_CODE; unknown" }),
    };
    const store = createMemoryContentStore();
    const provider = createStaticSchemaProvider([
      {
        operationTypeId: operationTypeId("fork_branch"),
        description: "Fork",
        requiredRoles: ["from"],
      },
    ]);
    const syscall = createSyscall({
      runtime,
      contentStore: store,
      principal: createPrincipal(),
      schemaProvider: provider,
    });

    const result = await syscall.act({ operation: "fork_branch", args: { from: "agent-1" } });
    expect(result.ok).toBe(false);
    expect(result.message).toContain("ERR_ONLY_CODE");
    expect(result.message).toContain("unknown");
  });

  it("handles runtime returning null/undefined result", async () => {
    const runtime: SyscallRuntime = {
      getHead: () => ({
        snapshotRef: "s",
        epochId: "e",
        participants: new Map(),
        artifacts: new Map(),
        links: new Map(),
        sessions: new Map(),
        capabilities: new Map(),
        auditTail: [],
      }),
      observe: () => ({ ok: true }),
      changes: () => [],
      proposeAndCommit: () => null as unknown as ProposeResult,
    };
    const store = createMemoryContentStore();
    const provider = createStaticSchemaProvider([
      {
        operationTypeId: operationTypeId("fork_branch"),
        description: "Fork",
        requiredRoles: ["from"],
      },
    ]);
    const syscall = createSyscall({
      runtime,
      contentStore: store,
      principal: createPrincipal(),
      schemaProvider: provider,
    });

    const result = await syscall.act({ operation: "fork_branch", args: { from: "agent-1" } });
    expect(result.ok).toBe(false);
    expect(result.message).toContain("unknown error");
  });

  it("fails closed when runtime returns a truthy non-boolean ok field", async () => {
    const runtime = richMockRuntime();
    runtime.proposeAndCommit = () =>
      ({ ok: "false", message: "must not commit" }) as unknown as ProposeResult;
    const syscall = createSyscall({
      runtime,
      contentStore: createMemoryContentStore(),
      principal: createPrincipal(),
      schemaProvider: createStaticSchemaProvider([
        {
          operationTypeId: operationTypeId("fork_branch"),
          description: "Fork",
          requiredRoles: ["from"],
        },
      ]),
    });

    const result = await syscall.act({ operation: "fork_branch", args: { from: "agent-1" } });
    expect(result.ok).toBe(false);
    expect(result.message).toContain("invalid runtime result");
    expect(result.newHeadRef).toBeUndefined();
  });

  it("handles runtime returning rejection with detail message", async () => {
    const runtime: SyscallRuntime = {
      getHead: () => ({
        snapshotRef: "s",
        epochId: "e",
        participants: new Map(),
        artifacts: new Map(),
        links: new Map(),
        sessions: new Map(),
        capabilities: new Map(),
        auditTail: [],
      }),
      observe: () => ({ ok: true }),
      changes: () => [],
      proposeAndCommit: () => ({ ok: false, message: "something wrong" }),
    };
    const store = createMemoryContentStore();
    const provider = createStaticSchemaProvider([
      {
        operationTypeId: operationTypeId("fork_branch"),
        description: "Fork",
        requiredRoles: ["from"],
      },
    ]);
    const syscall = createSyscall({
      runtime,
      contentStore: store,
      principal: createPrincipal(),
      schemaProvider: provider,
    });

    const result = await syscall.act({ operation: "fork_branch", args: { from: "agent-1" } });
    expect(result.ok).toBe(false);
    expect(result.message).toContain("something wrong");
  });

  it("handles args with empty values that get filtered", async () => {
    const runtime: SyscallRuntime = {
      getHead: () => ({
        snapshotRef: "s",
        epochId: "e",
        participants: new Map(),
        artifacts: new Map(),
        links: new Map(),
        sessions: new Map(),
        capabilities: new Map(),
        auditTail: [],
      }),
      observe: () => ({ ok: true }),
      changes: () => [],
      proposeAndCommit: () => ({ ok: true, newHeadRef: "snapshot-committed" }),
    };
    const store = createMemoryContentStore();
    const provider = createStaticSchemaProvider([
      {
        operationTypeId: operationTypeId("delegate"),
        description: "Delegate",
        requiredRoles: ["task", "from", "to", "capability"],
      },
    ]);
    const syscall = createSyscall({
      runtime,
      contentStore: store,
      principal: createPrincipal(),
      schemaProvider: provider,
    });

    const result = await syscall.act({
      operation: "delegate",
      args: { task: "t1", from: "agent-1", to: "agent-2", capability: "write", extra_field: "" },
    });
    expect(result.ok).toBe(true);
  });

  it("uses the authoritative commit receipt without a post-commit head read", async () => {
    let committed = 0;
    const runtime: SyscallRuntime = {
      getHead: () => {
        throw new Error("post-commit read is unavailable");
      },
      observe: () => ({ ok: true }),
      changes: () => [],
      proposeAndCommit: () => {
        committed++;
        return { ok: true, newHeadRef: "snapshot-authoritative" };
      },
    };
    const syscall = createSyscall({
      runtime,
      contentStore: createMemoryContentStore(),
      principal: createPrincipal(),
      schemaProvider: createStaticSchemaProvider([
        {
          operationTypeId: operationTypeId("fork_branch"),
          description: "Fork",
          requiredRoles: ["from"],
        },
      ]),
    });

    const result = await syscall.act({ operation: "fork_branch", args: { from: "agent-1" } });

    expect(result).toMatchObject({ ok: true, newHeadRef: "snapshot-authoritative" });
    expect(committed).toBe(1);
  });

  it("rejects when no recognized binding roles in args", async () => {
    const runtime: SyscallRuntime = {
      getHead: () => ({
        snapshotRef: "s",
        epochId: "e",
        participants: new Map(),
        artifacts: new Map(),
        links: new Map(),
        sessions: new Map(),
        capabilities: new Map(),
        auditTail: [],
      }),
      observe: () => ({ ok: true }),
      changes: () => [],
      proposeAndCommit: () => ({ ok: true, newHeadRef: "snapshot-committed" }),
    };
    const store = createMemoryContentStore();
    const provider = createStaticSchemaProvider([
      {
        operationTypeId: operationTypeId("custom_op"),
        description: "Custom",
        requiredRoles: ["xyz"],
      },
    ]);
    const syscall = createSyscall({
      runtime,
      contentStore: store,
      principal: createPrincipal(),
      schemaProvider: provider,
    });

    const result = await syscall.act({ operation: "custom_op", args: { xyz: "val" } });
    expect(result.ok).toBe(false);
    expect(result.message).toContain("none of the provided args");
  });

  it("handles runtime getHead returning undefined in perceive path", async () => {
    const runtime: SyscallRuntime = {
      getHead: () => undefined,
      observe: () => ({ ok: true }),
      changes: () => [],
      proposeAndCommit: () => ({ ok: true, newHeadRef: "snapshot-committed" }),
    };
    const store = createMemoryContentStore();
    const provider = createStaticSchemaProvider([
      {
        operationTypeId: operationTypeId("fork_branch"),
        description: "Fork",
        requiredRoles: ["from"],
      },
    ]);
    const syscall = createSyscall({
      runtime,
      contentStore: store,
      principal: createPrincipal(),
      schemaProvider: provider,
    });

    const perception = await syscall.perceive();
    expect(perception.headRef).toBeUndefined();
    expect(perception.worldSummary).toContain("empty");
  });
});

describe("useTool — branch coverage", () => {
  it("canonicalizes nested arguments independent of object key order", () => {
    expect(toolArgumentsDigest({ z: [true, null, 3], a: { y: "v", x: 1 } })).toBe(
      toolArgumentsDigest({ a: { x: 1, y: "v" }, z: [true, null, 3] }),
    );
    expect(toolArgumentsDigest({ bad: Number.POSITIVE_INFINITY })).toBeUndefined();
    expect(toolArgumentsDigest({ bad: new Date() })).toBeUndefined();
  });
  it("handles tool execution failure", async () => {
    const toolExecutor: ToolExecutor = {
      execute: async () => ({ ok: false, output: "Tool crashed: ENOENT" }),
      listTools: async () => [],
    };
    const runtime: SyscallRuntime = {
      getHead: () => ({
        snapshotRef: "s",
        epochId: "e",
        participants: new Map(),
        artifacts: new Map(),
        links: new Map(),
        sessions: new Map(),
        capabilities: new Map(),
        auditTail: [],
      }),
      observe: () => ({ ok: true }),
      changes: () => [],
      proposeAndCommit: () => ({ ok: true, newHeadRef: "snapshot-committed" }),
    };
    const store = createMemoryContentStore();
    const syscall = createSyscall({
      runtime,
      contentStore: store,
      principal: createPrincipal(),
      schemaProvider: createStaticSchemaProvider([]),
      toolExecutor,
    });

    const result = await syscall.useTool({
      callId: "read-1",
      toolName: "read_file",
      args: { path: "/missing" },
    });
    expect(result.ok).toBe(false);
    expect(result.output).toContain("ENOENT");
    expect(result.contentRef).toBeUndefined();
  });

  it("retains stored output and fails when audit observation throws", async () => {
    const toolExecutor: ToolExecutor = {
      execute: async () => ({ ok: true, output: "durable tool output" }),
      listTools: async () => [],
    };
    const runtime: SyscallRuntime = {
      getHead: () => undefined,
      observe: () => {
        throw new Error("audit store offline");
      },
      changes: () => [],
      proposeAndCommit: () => ({ ok: true, newHeadRef: "snapshot-committed" }),
    };
    const store = createMemoryContentStore();
    const syscall = createSyscall({
      runtime,
      contentStore: store,
      principal: createPrincipal(),
      schemaProvider: createStaticSchemaProvider([]),
      toolExecutor,
    });

    const result = await syscall.useTool({ callId: "read-2", toolName: "read_file", args: {} });

    expect(result).toMatchObject({
      ok: false,
      output: "durable tool output",
      observeWarning: expect.stringContaining("Observation error: audit store offline"),
    });
    expect(result.contentRef).toBeDefined();
    expect(await store.exists(result.contentRef!)).toBe(true);
  });

  it("fails closed when audit observation returns an invalid result", async () => {
    const toolExecutor: ToolExecutor = {
      execute: async () => ({ ok: true, output: "durable tool output" }),
      listTools: async () => [],
    };
    const runtime: SyscallRuntime = {
      getHead: () => undefined,
      observe: (() => undefined) as unknown as SyscallRuntime["observe"],
      changes: () => [],
      proposeAndCommit: () => ({ ok: true, newHeadRef: "snapshot-committed" }),
    };
    const store = createMemoryContentStore();
    const syscall = createSyscall({
      runtime,
      contentStore: store,
      principal: createPrincipal(),
      schemaProvider: createStaticSchemaProvider([]),
      toolExecutor,
    });

    const result = await syscall.useTool({ callId: "read-3", toolName: "read_file", args: {} });

    expect(result).toMatchObject({
      ok: false,
      output: "durable tool output",
      observeWarning: expect.stringContaining("Observation error: runtime returned an invalid"),
    });
    expect(result.contentRef).toBeDefined();
    expect(await store.exists(result.contentRef!)).toBe(true);
  });

  it("fails closed (no output observed) when an executor returns an invalid shape, but leaves the pre-dispatch journal (ADR-0016)", async () => {
    let observations = 0;
    const toolExecutor = {
      execute: async () => ({ ok: "yes", output: { unsafe: true } }),
      listTools: async () => [],
    } as unknown as ToolExecutor;
    const runtime: SyscallRuntime = {
      getHead: () => undefined,
      observe: () => {
        observations++;
        return { ok: true };
      },
      changes: () => [],
      proposeAndCommit: () => ({ ok: true, newHeadRef: "snapshot-committed" }),
    };
    const store = createMemoryContentStore();
    const syscall = createSyscall({
      runtime,
      contentStore: store,
      principal: createPrincipal(),
      schemaProvider: createStaticSchemaProvider([]),
      toolExecutor,
    });

    const result = await syscall.useTool({ callId: "invalid-1", toolName: "unsafe", args: {} });

    expect(result).toMatchObject({
      ok: false,
      output: "Tool executor returned an invalid result.",
      contentRef: undefined,
      observationRecovery: undefined,
    });
    // No observation was made (the executor never produced a usable output).
    expect(observations).toBe(0);
    // ADR-0016: the pre-dispatch `dispatched` journal entry is written before
    // execute, so an invalid executor result still leaves exactly one durable
    // record (the dispatched intent). A retry sees `dispatched` with no
    // `completed` and routes to the reconcile/ambiguous branch by tier.
    expect(await store.count()).toBe(1);
  });

  it("materializes an executor result once before linking output to its ContentRef", async () => {
    let outputReads = 0;
    const toolExecutor = {
      execute: async () => ({
        ok: true,
        get output() {
          outputReads++;
          return outputReads === 1 ? "stable output" : "mutated output";
        },
      }),
      listTools: async () => [],
    } as unknown as ToolExecutor;
    const store = createMemoryContentStore();
    const syscall = createSyscall({
      runtime: {
        getHead: () => undefined,
        observe: () => ({ ok: true }),
        changes: () => [],
        proposeAndCommit: () => ({ ok: true, newHeadRef: "snapshot-committed" }),
      },
      contentStore: store,
      principal: createPrincipal(),
      schemaProvider: createStaticSchemaProvider([]),
      toolExecutor,
    });

    const result = await syscall.useTool({ callId: "getter-1", toolName: "unsafe", args: {} });

    expect(result).toMatchObject({ ok: true, output: "stable output" });
    expect(outputReads).toBe(1);
    expect(new TextDecoder().decode((await store.get(result.contentRef!))?.bytes)).toBe(
      "stable output",
    );
  });

  it("preserves a recovery receipt when an observation result accessor throws", async () => {
    let retry = false;
    const store = createMemoryContentStore();
    const syscall = createSyscall({
      runtime: {
        getHead: () => undefined,
        observe: () =>
          retry
            ? { ok: true }
            : {
                get ok(): boolean {
                  throw new Error("hostile observation accessor");
                },
              },
        changes: () => [],
        proposeAndCommit: () => ({ ok: true, newHeadRef: "snapshot-committed" }),
      } as SyscallRuntime,
      contentStore: store,
      principal: createPrincipal(),
      schemaProvider: createStaticSchemaProvider([]),
      toolExecutor: {
        execute: async () => ({ ok: true, output: "durable output" }),
        listTools: async () => [],
      },
    });

    const failed = await syscall.useTool({
      callId: "observe-getter",
      toolName: "unsafe",
      args: {},
    });
    expect(failed).toMatchObject({
      ok: false,
      contentRef: expect.any(String),
      observationRecovery: expect.any(Object),
      observeWarning: expect.stringContaining("Observation error"),
    });

    retry = true;
    const recovered = await syscall.retryToolObservation(failed.observationRecovery!);
    expect(recovered).toMatchObject({ ok: true, outputRef: failed.contentRef });
  });
});

describe("act via tool: prefix — branch coverage", () => {
  it("rejects tool: actions before execution when the call identity is unavailable", async () => {
    let executions = 0;
    const toolExecutor: ToolExecutor = {
      execute: async () => {
        executions++;
        return { ok: true, output: "tool output" };
      },
      listTools: async () => [],
    };
    const runtime: SyscallRuntime = {
      getHead: () => ({
        snapshotRef: "s",
        epochId: "e",
        participants: new Map(),
        artifacts: new Map(),
        links: new Map(),
        sessions: new Map(),
        capabilities: new Map(),
        auditTail: [],
      }),
      observe: () => ({ ok: false, message: "principal not registered" }),
      changes: () => [],
      proposeAndCommit: () => ({ ok: true, newHeadRef: "snapshot-committed" }),
    };
    const store = createMemoryContentStore();
    const syscall = createSyscall({
      runtime,
      contentStore: store,
      principal: createPrincipal(),
      schemaProvider: createStaticSchemaProvider([]),
      toolExecutor,
    });

    const result = await syscall.act({ operation: "tool:my_tool", args: { key: "val" } });
    expect(result.ok).toBe(false);
    expect(result.newHeadRef).toBeUndefined();
    expect(result.message).toContain("original LLM tool-call id");
    expect(executions).toBe(0);
  });

  it("does not route a failing external executor through act", async () => {
    const toolExecutor: ToolExecutor = {
      execute: async () => ({ ok: false, output: "permission denied" }),
      listTools: async () => [],
    };
    const runtime: SyscallRuntime = {
      getHead: () => ({
        snapshotRef: "s",
        epochId: "e",
        participants: new Map(),
        artifacts: new Map(),
        links: new Map(),
        sessions: new Map(),
        capabilities: new Map(),
        auditTail: [],
      }),
      observe: () => ({ ok: true }),
      changes: () => [],
      proposeAndCommit: () => ({ ok: true, newHeadRef: "snapshot-committed" }),
    };
    const store = createMemoryContentStore();
    const syscall = createSyscall({
      runtime,
      contentStore: store,
      principal: createPrincipal(),
      schemaProvider: createStaticSchemaProvider([]),
      toolExecutor,
    });

    const result = await syscall.act({ operation: "tool:restricted", args: {} });
    expect(result.ok).toBe(false);
    expect(result.message).toContain("syscall.useTool");
  });

  it("never returns a head ref for tool: through act when a runtime head exists", async () => {
    const toolExecutor: ToolExecutor = {
      execute: async () => ({ ok: true, output: "ok" }),
      listTools: async () => [],
    };
    const runtime: SyscallRuntime = {
      getHead: () => ({
        snapshotRef: "snap-new",
        epochId: "e",
        participants: new Map(),
        artifacts: new Map(),
        links: new Map(),
        sessions: new Map(),
        capabilities: new Map(),
        auditTail: [],
      }),
      observe: () => ({ ok: true }),
      changes: () => [],
      proposeAndCommit: () => ({ ok: true, newHeadRef: "snapshot-committed" }),
    };
    const store = createMemoryContentStore();
    const syscall = createSyscall({
      runtime,
      contentStore: store,
      principal: createPrincipal(),
      schemaProvider: createStaticSchemaProvider([]),
      toolExecutor,
    });

    const result = await syscall.act({ operation: "tool:x", args: {} });
    expect(result.ok).toBe(false);
    expect(result.newHeadRef).toBeUndefined();
  });

  it("routes tool: with undefined newHeadRef when runtime head is undefined", async () => {
    const toolExecutor: ToolExecutor = {
      execute: async () => ({ ok: true, output: "ok" }),
      listTools: async () => [],
    };
    const runtime: SyscallRuntime = {
      getHead: () => undefined,
      observe: () => ({ ok: true }),
      changes: () => [],
      proposeAndCommit: () => ({ ok: true, newHeadRef: "snapshot-committed" }),
    };
    const store = createMemoryContentStore();
    const syscall = createSyscall({
      runtime,
      contentStore: store,
      principal: createPrincipal(),
      schemaProvider: createStaticSchemaProvider([]),
      toolExecutor,
    });

    const result = await syscall.act({ operation: "tool:x", args: {} });
    expect(result.ok).toBe(false);
    expect(result.newHeadRef).toBeUndefined();
  });
});
