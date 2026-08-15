import { describe, it, expect } from "vitest";
import {
  actorId,
  artifactId,
  capabilityId,
  changeId,
  collaborationSnapshot,
  epochId,
  evidenceId,
  linkId,
  operationTypeId,
  participant,
  sessionId,
  snapshotRef,
  timestamp,
  type ActorRef,
  type ContentRef,
  type CoordinationIntent,
} from "@cantilune/core";
import { createMemoryContentStore } from "@cantilune/content/memory";
import {
  createCoordinationRuntime,
  createDefaultHandlers,
  createDefaultSchema,
  runtimeDependenciesWithStaticSchema,
  templateAwarePolicyEvaluator,
} from "@cantilune/runtime";
import { createMemoryRuntimePersistence, MemoryResourceLockTable } from "@cantilune/runtime/memory";
import { createSyscall, createStaticSchemaProvider } from "../../src/index.js";
import type { SyscallRuntime, ToolExecutor } from "../../src/syscall.js";

type MockHead = NonNullable<ReturnType<SyscallRuntime["getHead"]>>;

describe("syscall integration — full perceive→act→content cycle", () => {
  it("complete cycle: perceive state, act to commit, read/write content", async () => {
    const auditTail: unknown[] = [];
    const snap = {
      snapshotRef: "snap-int",
      epochId: "epoch-int",
      participants: new Map([["agent-int", { kind: "agent", status: "active" }]]),
      artifacts: new Map(),
      links: new Map(),
      sessions: new Map(),
      capabilities: new Map(),
      auditTail: auditTail as readonly unknown[],
    };
    let capturedIntent: unknown;
    const runtime: SyscallRuntime = {
      getHead: () => snap as MockHead,
      observe: (input) => {
        auditTail.push({
          sequenceNo: auditTail.length + 1,
          source: input.source,
          payloadRef: input.payloadRef,
          receivedAt: new Date().toISOString(),
        });
        return { ok: true };
      },
      changes: () => [],
      proposeAndCommit: (intent) => {
        capturedIntent = intent;
        return { ok: true, newHeadRef: "snap-int" };
      },
    };

    const store = createMemoryContentStore();
    const provider = createStaticSchemaProvider([
      {
        operationTypeId: operationTypeId("introduce_artifact"),
        description: "Introduce",
        requiredRoles: ["task", "from"],
        contentRefInputs: [
          { name: "contentRef", description: "Stored artifact content", required: true },
        ],
      },
    ]);
    const syscall = createSyscall({
      runtime,
      contentStore: store,
      principal: { actorId: "agent-int", kind: "agent" },
      schemaProvider: provider,
    });

    const perception = await syscall.perceive();
    expect(perception.worldSummary).toContain("agent-int");
    expect(perception.headRef).toBe("snap-int");

    const writeRef = await syscall.writeContent("Task: build login page", {
      mimeType: "text/plain",
    });
    expect(writeRef).toBe(
      "sha256:92bf3ec8b44bf65cff3f1641e87ec23799bb966b1d6f0f6ff959d34e3ee266a1",
    );
    const readResult = await syscall.readContent(writeRef);
    expect(readResult.found).toBe(true);
    expect(readResult.text).toBe("Task: build login page");

    const actResult = await syscall.act({
      operation: "introduce_artifact",
      args: { task: "task-1", from: "agent-int", contentRef: writeRef as string },
    });
    expect(actResult.ok).toBe(true);
    expect(actResult.newHeadRef).toBe("snap-int");
    expect(capturedIntent).toMatchObject({ inputContentRefs: [writeRef] });

    snap.artifacts.set("task-1", {
      kind: "Task",
      lifecycle: "active",
      owner: { actorId: "agent-int" },
      contentRef: writeRef,
    });
    const afterPerception = await syscall.perceive();
    expect(afterPerception.worldSummary).toContain(`contentRef=${writeRef as string}`);
    const artifactRead = await syscall.readContent(writeRef);
    expect(artifactRead.text).toBe("Task: build login page");

    const actions = await syscall.availableActions();
    expect(actions.find((a) => a.name === "introduce_artifact")).toBeDefined();
  });

  it("binds a real stored SHA-256 ref into an artifact and replays it", async () => {
    const principalId = actorId("agent-int");
    const initial = collaborationSnapshot({
      snapshotRef: snapshotRef("snap-content-0"),
      epochId: epochId("epoch-content"),
      participants: new Map([[principalId, participant(principalId, "agent")]]),
    });
    const persistence = createMemoryRuntimePersistence({ initial });
    const store = createMemoryContentStore();
    const coordinationRuntime = createCoordinationRuntime(
      runtimeDependenciesWithStaticSchema({
        durable: persistence.durable,
        clock: { now: () => timestamp("2026-08-13T10:00:00Z") },
        idGen: {
          snapshotRef: () => snapshotRef("snap-content-1"),
          changeId: () => changeId("chg-content-1"),
          sessionId: () => sessionId("session-content-1"),
          linkId: () => linkId("link-content-1"),
          artifactId: () => artifactId("generated-content-1"),
          capabilityId: () => capabilityId("cap-content-1"),
          evidenceId: () => evidenceId("ev-content-1"),
        },
        schema: createDefaultSchema(),
        activeEpochId: initial.epochId,
        policy: templateAwarePolicyEvaluator(),
        handlers: createDefaultHandlers(),
        locks: new MemoryResourceLockTable(),
        contentRefAuthority: store,
      }),
    );
    const runtime: SyscallRuntime = {
      getHead: () => coordinationRuntime.getHead(),
      observe: (input, options) => {
        const result = coordinationRuntime.observe(
          input as { source: ActorRef; payloadRef: ContentRef },
          options as { principal?: ActorRef } | undefined,
        );
        return "snapshot" in result ? { ok: true } : { ok: false, message: result.message };
      },
      changes: () => [],
      proposeAndCommit: (intent) => {
        const result = coordinationRuntime.proposeAndCommit(intent as CoordinationIntent);
        if ("change" in result) return { ok: true, newHeadRef: result.after.snapshotRef };
        if ("ok" in result) {
          return {
            ok: false,
            message: result.ok ? "unexpected uncommitted admission ticket" : result.reason.kind,
          };
        }
        return { ok: false, message: result.message };
      },
    };
    const syscall = createSyscall({
      runtime,
      contentStore: store,
      principal: { actorId: principalId, kind: "agent" },
      schemaProvider: createStaticSchemaProvider([
        {
          operationTypeId: operationTypeId("introduce_artifact"),
          description: "Introduce",
          requiredRoles: ["task", "from"],
          contentRefInputs: [{ name: "contentRef", required: true }],
        },
      ]),
    });

    const ref = await syscall.writeContent("Financial industry chain overview");
    const committed = await syscall.act({
      operation: "introduce_artifact",
      args: { task: "financial-ecosystem-overview", from: principalId, contentRef: ref },
    });

    expect(committed.ok).toBe(true);
    expect(
      coordinationRuntime.getHead()?.artifacts.get(artifactId("financial-ecosystem-overview"))
        ?.contentRef,
    ).toBe(ref);
    expect((await syscall.readContent(ref)).text).toBe("Financial industry chain overview");
    const replay = coordinationRuntime.replay({ fromRef: initial.snapshotRef });
    expect(replay.ok).toBe(true);
    if (replay.ok) {
      expect(
        replay.terminal.artifacts.get(artifactId("financial-ecosystem-overview"))?.contentRef,
      ).toBe(ref);
    }
  });

  it("cycle with external tool: discover, execute, observe", async () => {
    const toolExecutor: ToolExecutor = {
      execute: async (name, args) => ({
        ok: true,
        output: `Tool ${name} executed with ${JSON.stringify(args)}`,
      }),
      listTools: async () => [
        {
          name: "file_read",
          description: "Read file contents",
          parameters: { type: "object", properties: { path: { type: "string" } } },
        },
        {
          name: "terminal",
          description: "Run command",
          parameters: { type: "object", properties: { cmd: { type: "string" } } },
        },
      ],
    };

    const auditTail: unknown[] = [];
    const snap = {
      snapshotRef: "snap-tool",
      epochId: "epoch-tool",
      participants: new Map(),
      artifacts: new Map(),
      links: new Map(),
      sessions: new Map(),
      capabilities: new Map(),
      auditTail: auditTail as readonly unknown[],
    };
    const runtime: SyscallRuntime = {
      getHead: () => snap as MockHead,
      observe: (input) => {
        auditTail.push({
          sequenceNo: auditTail.length + 1,
          source: input.source,
          payloadRef: input.payloadRef,
          receivedAt: new Date().toISOString(),
        });
        return { ok: true };
      },
      changes: () => [],
      proposeAndCommit: () => ({ ok: true, newHeadRef: "snapshot-committed" }),
    };
    const store = createMemoryContentStore();
    const syscall = createSyscall({
      runtime,
      contentStore: store,
      principal: { actorId: "tool-user", kind: "agent" },
      schemaProvider: createStaticSchemaProvider([]),
      toolExecutor,
    });

    const actions = await syscall.availableActions();
    expect(actions.find((a) => a.name === "tool:file_read")).toBeDefined();
    expect(actions.find((a) => a.name === "tool:terminal")).toBeDefined();

    const result = await syscall.useTool({
      callId: "file-read-1",
      toolName: "file_read",
      args: { path: "/src/index.ts" },
    });
    expect(result.ok).toBe(true);
    expect(result.contentRef).toBeDefined();
    expect(result.observeWarning).toBeUndefined();

    const stored = await store.get(result.contentRef!);
    expect(stored).toBeDefined();
    expect(new TextDecoder().decode(stored!.bytes)).toContain("file_read");
  });
});
