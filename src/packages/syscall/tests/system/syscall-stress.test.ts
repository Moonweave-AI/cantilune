import { describe, it, expect } from "vitest";
import { operationTypeId } from "@cantilune/core";
import { createMemoryContentStore } from "@cantilune/content/memory";
import { createSyscall, createStaticSchemaProvider } from "../../src/index.js";
import type { SyscallRuntime, ToolExecutor } from "../../src/syscall.js";

describe("syscall system — concurrent tools and large payloads", () => {
  it("handles multiple concurrent tool calls", async () => {
    let callCount = 0;
    const toolExecutor: ToolExecutor = {
      execute: async (name, _args) => {
        callCount++;
        await new Promise((r) => setTimeout(r, 5));
        return { ok: true, output: `${name}#${callCount}` };
      },
      listTools: async () => [
        { name: "tool_a", description: "A", parameters: {} },
        { name: "tool_b", description: "B", parameters: {} },
      ],
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
      principal: { actorId: "t", kind: "agent" },
      schemaProvider: createStaticSchemaProvider([]),
      toolExecutor,
    });

    const results = await Promise.all([
      syscall.useTool({ callId: "a-1", toolName: "tool_a", args: { x: "1" } }),
      syscall.useTool({ callId: "b-1", toolName: "tool_b", args: { y: "2" } }),
      syscall.useTool({ callId: "a-2", toolName: "tool_a", args: { z: "3" } }),
    ]);

    expect(results.every((r) => r.ok)).toBe(true);
    expect(callCount).toBe(3);
  });

  it("handles large content write and read round-trip", async () => {
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
      principal: { actorId: "t", kind: "agent" },
      schemaProvider: createStaticSchemaProvider([]),
    });

    const largeContent = "x".repeat(100_000);
    const ref = await syscall.writeContent(largeContent, { mimeType: "text/plain" });
    const read = await syscall.readContent(ref);
    expect(read.found).toBe(true);
    expect(read.text?.length).toBe(100_000);
  });

  it("handles many sequential act calls without accumulation issues", async () => {
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

    const results = [];
    for (let i = 0; i < 50; i++) {
      results.push(await syscall.act({ operation: "fork_branch", args: { from: `agent-${i}` } }));
    }
    expect(results.every((r) => r.ok)).toBe(true);
  });
});
