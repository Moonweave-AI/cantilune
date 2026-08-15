import { describe, it, expect } from "vitest";
import { operationTypeId, contentRef } from "@cantilune/core";
import { createMemoryContentStore } from "@cantilune/content/memory";
import { createSyscall, createStaticSchemaProvider } from "../../src/index.js";
import type { SyscallRuntime } from "../../src/syscall.js";

describe("syscall contract — rejection scenarios", () => {
  it("rejects unknown operation with listing of available operations", async () => {
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
        operationTypeId: operationTypeId("introduce_artifact"),
        description: "Introduce",
        requiredRoles: ["task", "from"],
        contentRefInputs: [{ name: "contentRef", required: true }],
      },
    ]);
    const syscall = createSyscall({
      runtime,
      contentStore: store,
      principal: { actorId: "t", kind: "agent" },
      schemaProvider: provider,
    });

    const result = await syscall.act({ operation: "nonexistent", args: {} });
    expect(result.ok).toBe(false);
    expect(result.message).toContain("Unknown operation");
    expect(result.message).toContain("introduce_artifact");
  });

  it("rejects operation with missing required role parameters", async () => {
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
      principal: { actorId: "t", kind: "agent" },
      schemaProvider: provider,
    });

    const result = await syscall.act({ operation: "delegate", args: { task: "t1", from: "a" } });
    expect(result.ok).toBe(false);
    expect(result.message).toContain("requires parameters");
    expect(result.message).toContain("to");
    expect(result.message).toContain("capability");
  });

  it("rejects malformed or unavailable contentRef inputs before runtime admission", async () => {
    let proposed = false;
    const runtime: SyscallRuntime = {
      getHead: () => undefined,
      observe: () => ({ ok: true }),
      changes: () => [],
      proposeAndCommit: () => {
        proposed = true;
        return { ok: true, newHeadRef: "snapshot-committed" };
      },
    };
    const store = createMemoryContentStore();
    const syscall = createSyscall({
      runtime,
      contentStore: store,
      principal: { actorId: "t", kind: "agent" },
      schemaProvider: createStaticSchemaProvider([
        {
          operationTypeId: operationTypeId("introduce_artifact"),
          description: "Introduce",
          requiredRoles: ["task", "from"],
          contentRefInputs: [{ name: "contentRef", required: true }],
        },
      ]),
    });

    const malformed = await syscall.act({
      operation: "introduce_artifact",
      args: { task: "t1", from: "t", contentRef: "financial-ecosystem-overview" },
    });
    expect(malformed.ok).toBe(false);
    expect(malformed.message).toContain("valid sha256 ContentRef");

    const missing = await syscall.act({
      operation: "introduce_artifact",
      args: {
        task: "t1",
        from: "t",
        contentRef: "sha256:0000000000000000000000000000000000000000000000000000000000000000",
      },
    });
    expect(missing.ok).toBe(false);
    expect(missing.message).toContain("unavailable content");
    expect(missing.message).toContain("write_content");
    expect(proposed).toBe(false);
  });

  it("rejects operation with empty-string required parameters", async () => {
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
        operationTypeId: operationTypeId("fork_branch"),
        description: "Fork",
        requiredRoles: ["from"],
      },
    ]);
    const syscall = createSyscall({
      runtime,
      contentStore: store,
      principal: { actorId: "t", kind: "agent" },
      schemaProvider: provider,
    });

    const result = await syscall.act({ operation: "fork_branch", args: { from: "" } });
    expect(result.ok).toBe(false);
    expect(result.message).toContain("requires parameters");
  });

  it("reports non-found for reading non-existent content ref", async () => {
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
      principal: { actorId: "t", kind: "agent" },
      schemaProvider: createStaticSchemaProvider([]),
    });

    const result = await syscall.readContent(
      contentRef("sha256:0000000000000000000000000000000000000000000000000000000000000000"),
    );
    expect(result.found).toBe(false);
    expect(result.text).toBeUndefined();
    expect(result.mimeType).toBeUndefined();
  });

  it("returns error when calling useTool with no executor", async () => {
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
      principal: { actorId: "t", kind: "agent" },
      schemaProvider: createStaticSchemaProvider([]),
    });

    const result = await syscall.useTool({ callId: "anything-1", toolName: "anything", args: {} });
    expect(result.ok).toBe(false);
    expect(result.output).toContain("No tool executor");
  });
});
