import { describe, it, expect } from "vitest";
import { contentRef, operationTypeId } from "@cantilune/core";
import { createMemoryContentStore } from "@cantilune/content/memory";
import { createSyscall } from "../../src/createSyscall.js";
import { toolArgumentsDigest } from "../../src/act.js";
import { createStaticSchemaProvider, schemasFromTemplates } from "../../src/toolSchema.js";
import type {
  SyscallRuntime,
  SyscallPrincipal,
  ToolExecutor,
  AvailableTemplate,
  OperationSchemaProvider,
} from "../../src/syscall.js";

type MockHead = NonNullable<ReturnType<SyscallRuntime["getHead"]>>;
type JsonSchemaObject = {
  readonly required?: readonly string[];
  readonly properties?: Record<
    string,
    { readonly type?: string; readonly pattern?: string; readonly description?: string }
  >;
};

const ARTIFACT_CONTENT_REF =
  "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const OBSERVATION_PAYLOAD_REF =
  "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

const TEST_TEMPLATES: AvailableTemplate[] = [
  {
    operationTypeId: operationTypeId("introduce_artifact"),
    description: "Introduce artifact",
    requiredRoles: ["task", "from"],
    contentRefInputs: [
      { name: "contentRef", description: "Stored task body ContentRef", required: true },
    ],
  },
  {
    operationTypeId: operationTypeId("delegate"),
    description: "Delegate task",
    requiredRoles: ["task", "from", "to", "capability"],
  },
  {
    operationTypeId: operationTypeId("create_session"),
    description: "Create session",
    requiredRoles: ["from"],
  },
  {
    operationTypeId: operationTypeId("fork_branch"),
    description: "Fork branch",
    requiredRoles: ["from"],
  },
  {
    operationTypeId: operationTypeId("emit_heartbeat"),
    description: "Emit heartbeat",
    requiredRoles: ["from"],
    scalarInputs: [
      { name: "turnCount", type: "nonNegativeInteger", required: true },
      { name: "lastAction", type: "string", required: true },
    ],
  },
];

function createSchemaProvider(): OperationSchemaProvider {
  return createStaticSchemaProvider(TEST_TEMPLATES);
}

function createPrincipal(): SyscallPrincipal {
  return { actorId: "planner", kind: "agent" };
}

function mockRuntime(opts?: {
  head?: object;
  proposeResult?: { ok: false; message?: string };
  observeResult?: { ok: boolean; message?: string };
}): SyscallRuntime {
  const snap = opts?.head ?? {
    snapshotRef: "snap-001",
    epochId: "epoch-1",
    participants: new Map([["planner", { kind: "agent", status: "active" }]]),
    artifacts: new Map([
      [
        "task-1",
        {
          kind: "task",
          lifecycle: "active",
          owner: { actorId: "planner" },
          contentRef: ARTIFACT_CONTENT_REF,
        },
      ],
    ]),
    links: new Map(),
    sessions: new Map([["sess-1", { controller: "planner", participants: ["planner", "coder"] }]]),
    capabilities: new Map([["cap-1", { holder: "planner", scope: "write" }]]),
    auditTail: [
      {
        sequenceNo: 1,
        source: { actorId: "user" },
        payloadRef: OBSERVATION_PAYLOAD_REF,
        receivedAt: "2026-01-01T00:00:00Z",
      },
    ],
  };

  return {
    getHead: () => snap as MockHead,
    observe: () => opts?.observeResult ?? { ok: true },
    changes: () => [],
    proposeAndCommit: () =>
      opts?.proposeResult?.ok === false
        ? opts.proposeResult
        : { ok: true, newHeadRef: "snapshot-committed" },
  };
}

describe("createSyscall", () => {
  it("snapshots static templates and returns detached views", () => {
    const source: AvailableTemplate[] = [
      {
        operationTypeId: operationTypeId("custom"),
        description: "original",
        requiredRoles: ["from"],
        contentRefInputs: [{ name: "contentRef", required: true }],
        scalarInputs: [{ name: "turnCount", type: "nonNegativeInteger", required: true }],
      },
    ];
    const provider = createStaticSchemaProvider(source);

    (source[0] as unknown as { description: string }).description = "mutated source";
    (source[0]!.requiredRoles as string[]).push("to");
    const first = provider.getTemplates();
    (first[0] as unknown as { description: string }).description = "mutated result";
    (first[0]!.contentRefInputs as { name: string; required?: boolean }[])[0]!.required = false;
    (first[0]!.scalarInputs as unknown as { name: string }[])[0]!.name = "mutated";

    expect(provider.getTemplates()).toEqual([
      {
        operationTypeId: operationTypeId("custom"),
        description: "original",
        requiredRoles: ["from"],
        contentRefInputs: [{ name: "contentRef", required: true }],
        scalarInputs: [{ name: "turnCount", type: "nonNegativeInteger", required: true }],
      },
    ]);
  });

  describe("perceive", () => {
    it("returns empty world for undefined head", async () => {
      const runtime = {
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
        schemaProvider: createSchemaProvider(),
      });

      const result = await syscall.perceive();
      expect(result.worldSummary).toContain("empty");
      expect(result.headRef).toBeUndefined();
      expect(result.availableOperations).toHaveLength(TEST_TEMPLATES.length);
    });

    it("renders participants, artifacts, sessions, capabilities", async () => {
      const runtime = mockRuntime();
      const store = createMemoryContentStore();
      const syscall = createSyscall({
        runtime,
        contentStore: store,
        principal: createPrincipal(),
        schemaProvider: createSchemaProvider(),
      });

      const result = await syscall.perceive();
      expect(result.worldSummary).toContain("Participants (1)");
      expect(result.worldSummary).toContain("planner");
      expect(result.worldSummary).toContain("Artifacts (1)");
      expect(result.worldSummary).toContain("task-1");
      expect(result.worldSummary).toContain("Sessions (1)");
      expect(result.worldSummary).toContain("sess-1");
      expect(result.worldSummary).toContain("Capabilities (1)");
      expect(result.worldSummary).toContain("cap-1");
      expect(result.headRef).toBe("snap-001");
    });

    it("does not expose raw contentRef hash — suggests readContent", async () => {
      const runtime = mockRuntime();
      const store = createMemoryContentStore();
      const syscall = createSyscall({
        runtime,
        contentStore: store,
        principal: createPrincipal(),
        schemaProvider: createSchemaProvider(),
      });

      const result = await syscall.perceive();
      expect(result.worldSummary).toContain(`contentRef=${ARTIFACT_CONTENT_REF}`);
      expect(result.worldSummary).toContain(`read_content ref=${ARTIFACT_CONTENT_REF}`);
    });

    it("renders observations without raw payloadRef", async () => {
      const runtime = mockRuntime();
      const store = createMemoryContentStore();
      const syscall = createSyscall({
        runtime,
        contentStore: store,
        principal: createPrincipal(),
        schemaProvider: createSchemaProvider(),
      });

      const result = await syscall.perceive();
      expect(result.recentObservations).toContain(`payloadRef=${OBSERVATION_PAYLOAD_REF}`);
      expect(result.recentObservations).toContain(`read_content ref=${OBSERVATION_PAYLOAD_REF}`);
    });

    it("dynamically reflects available ops from schemaProvider", async () => {
      const provider = createStaticSchemaProvider([
        {
          operationTypeId: operationTypeId("custom_op"),
          description: "Custom",
          requiredRoles: ["x"],
        },
      ]);
      const runtime = mockRuntime();
      const store = createMemoryContentStore();
      const syscall = createSyscall({
        runtime,
        contentStore: store,
        principal: createPrincipal(),
        schemaProvider: provider,
      });

      const result = await syscall.perceive();
      expect(result.availableOperations.map((o) => o as string)).toEqual(["custom_op"]);
    });
  });

  describe("act", () => {
    it("commits valid operation with required args", async () => {
      const runtime = mockRuntime();
      const store = createMemoryContentStore();
      const syscall = createSyscall({
        runtime,
        contentStore: store,
        principal: createPrincipal(),
        schemaProvider: createSchemaProvider(),
      });

      const ref = await syscall.writeContent("task body");
      const result = await syscall.act({
        operation: "introduce_artifact",
        args: { task: "task-2", from: "planner", contentRef: ref as string },
      });
      expect(result.ok).toBe(true);
      expect(result.message).toContain("committed");
    });

    it("rejects unknown operation with helpful message", async () => {
      const runtime = mockRuntime();
      const store = createMemoryContentStore();
      const syscall = createSyscall({
        runtime,
        contentStore: store,
        principal: createPrincipal(),
        schemaProvider: createSchemaProvider(),
      });

      const result = await syscall.act({ operation: "nonexistent_op", args: {} });
      expect(result.ok).toBe(false);
      expect(result.message).toContain("Unknown operation");
      expect(result.message).toContain("introduce_artifact");
    });

    it("rejects operation with missing required parameters", async () => {
      const runtime = mockRuntime();
      const store = createMemoryContentStore();
      const syscall = createSyscall({
        runtime,
        contentStore: store,
        principal: createPrincipal(),
        schemaProvider: createSchemaProvider(),
      });

      const result = await syscall.act({
        operation: "introduce_artifact",
        args: { task: "task-2" },
      });
      expect(result.ok).toBe(false);
      expect(result.message).toContain("requires parameters");
      expect(result.message).toContain("from");
    });

    it("handles admission rejection with reason", async () => {
      const runtime = mockRuntime({ proposeResult: { ok: false, message: "precondition_failed" } });
      const store = createMemoryContentStore();
      const syscall = createSyscall({
        runtime,
        contentStore: store,
        principal: createPrincipal(),
        schemaProvider: createSchemaProvider(),
      });

      const ref = await syscall.writeContent("task body");
      const result = await syscall.act({
        operation: "introduce_artifact",
        args: { task: "t", from: "p", contentRef: ref as string },
      });
      expect(result.ok).toBe(false);
      expect(result.message).toContain("precondition_failed");
    });

    it("handles RuntimeViolation with message", async () => {
      const runtime = mockRuntime({
        proposeResult: { ok: false, message: "principal not registered" },
      });
      const store = createMemoryContentStore();
      const syscall = createSyscall({
        runtime,
        contentStore: store,
        principal: createPrincipal(),
        schemaProvider: createSchemaProvider(),
      });

      const result = await syscall.act({ operation: "create_session", args: { from: "x" } });
      expect(result.ok).toBe(false);
      expect(result.message).toContain("principal not registered");
    });

    it("rejects tool: through act because the original LLM call id is unavailable", async () => {
      let executions = 0;
      const toolExecutor: ToolExecutor = {
        execute: async (name, _args) => {
          executions++;
          return { ok: true, output: `executed ${name}` };
        },
        listTools: async () => [],
      };
      const runtime = mockRuntime();
      const store = createMemoryContentStore();
      const syscall = createSyscall({
        runtime,
        contentStore: store,
        principal: createPrincipal(),
        schemaProvider: createSchemaProvider(),
        toolExecutor,
      });

      const result = await syscall.act({ operation: "tool:read_file", args: { path: "/x" } });
      expect(result.ok).toBe(false);
      expect(result.message).toContain("original LLM tool-call id");
      expect(executions).toBe(0);
    });

    it("passes dynamic binding keys from LLM args", async () => {
      let capturedIntent: unknown;
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
        proposeAndCommit: (intent) => {
          capturedIntent = intent;
          return { ok: true, newHeadRef: "snapshot-committed" };
        },
      };
      const provider = createStaticSchemaProvider([
        {
          operationTypeId: operationTypeId("custom"),
          description: "Custom op",
          requiredRoles: ["participant", "artifact"],
        },
      ]);
      const store = createMemoryContentStore();
      const syscall = createSyscall({
        runtime,
        contentStore: store,
        principal: createPrincipal(),
        schemaProvider: provider,
      });

      await syscall.act({ operation: "custom", args: { participant: "alice", artifact: "doc-1" } });
      expect(capturedIntent).toMatchObject({ matchBindings: expect.any(Array) });
      expect((capturedIntent as { matchBindings: unknown[] }).matchBindings).toHaveLength(2);
    });

    it("forwards a stored ContentRef as inputContentRefs instead of a binding", async () => {
      let capturedIntent: unknown;
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
        proposeAndCommit: (intent) => {
          capturedIntent = intent;
          return { ok: true, newHeadRef: "snapshot-committed" };
        },
      };
      const store = createMemoryContentStore();
      const syscall = createSyscall({
        runtime,
        contentStore: store,
        principal: createPrincipal(),
        schemaProvider: createSchemaProvider(),
      });
      const ref = await syscall.writeContent("financial industry chain");

      const result = await syscall.act({
        operation: "introduce_artifact",
        args: { task: "finance", from: "planner", contentRef: ref as string },
      });

      expect(result.ok).toBe(true);
      expect(capturedIntent).toMatchObject({
        inputContentRefs: [ref],
        matchBindings: [
          { role: "task", artifactId: "finance" },
          { role: "from", actorId: "planner" },
        ],
      });
      expect(
        (capturedIntent as { matchBindings: { role: string }[] }).matchBindings.some(
          (binding) => binding.role === "contentRef",
        ),
      ).toBe(false);
    });

    it("validates and forwards typed scalar inputs separately from ContentRefs", async () => {
      let capturedIntent: unknown;
      const runtime: SyscallRuntime = {
        ...mockRuntime(),
        proposeAndCommit: (intent) => {
          capturedIntent = intent;
          return { ok: true, newHeadRef: "snapshot-heartbeat" };
        },
      };
      const syscall = createSyscall({
        runtime,
        contentStore: createMemoryContentStore(),
        principal: createPrincipal(),
        schemaProvider: createSchemaProvider(),
      });

      const result = await syscall.act({
        operation: "emit_heartbeat",
        args: { from: "planner", turnCount: "37", lastAction: "write_content" },
      });

      expect(result.ok).toBe(true);
      expect(capturedIntent).toMatchObject({
        scalarInputs: { turnCount: 37, lastAction: "write_content" },
        matchBindings: [{ role: "from", actorId: "planner" }],
      });
      expect(capturedIntent).not.toHaveProperty("inputContentRefs");
    });

    it.each(["-1", "01", "1.5", "9007199254740992"])(
      "rejects invalid non-negative integer scalar %s before runtime",
      async (turnCount) => {
        let commits = 0;
        const runtime: SyscallRuntime = {
          ...mockRuntime(),
          proposeAndCommit: () => {
            commits++;
            return { ok: true, newHeadRef: "must-not-commit" };
          },
        };
        const syscall = createSyscall({
          runtime,
          contentStore: createMemoryContentStore(),
          principal: createPrincipal(),
          schemaProvider: createSchemaProvider(),
        });

        const result = await syscall.act({
          operation: "emit_heartbeat",
          args: { from: "planner", turnCount, lastAction: "act" },
        });

        expect(result.ok).toBe(false);
        expect(commits).toBe(0);
      },
    );
  });

  describe("readContent / writeContent", () => {
    it("round-trips text content", async () => {
      const runtime = mockRuntime();
      const store = createMemoryContentStore();
      const syscall = createSyscall({
        runtime,
        contentStore: store,
        principal: createPrincipal(),
        schemaProvider: createSchemaProvider(),
      });

      const ref = await syscall.writeContent("function login() {}", {
        mimeType: "text/typescript",
      });
      const result = await syscall.readContent(ref);
      expect(result.found).toBe(true);
      expect(result.text).toBe("function login() {}");
      expect(result.mimeType).toBe("text/typescript");
    });

    it("returns not found for unknown ref", async () => {
      const runtime = mockRuntime();
      const store = createMemoryContentStore();
      const syscall = createSyscall({
        runtime,
        contentStore: store,
        principal: createPrincipal(),
        schemaProvider: createSchemaProvider(),
      });

      const result = await syscall.readContent(
        contentRef("sha256:0000000000000000000000000000000000000000000000000000000000000000"),
      );
      expect(result.found).toBe(false);
    });
  });

  describe("useTool", () => {
    it("executes tool, stores result, observes", async () => {
      const toolExecutor: ToolExecutor = {
        execute: async (name) => ({ ok: true, output: `result of ${name}` }),
        listTools: async () => [],
      };
      const runtime = mockRuntime();
      const store = createMemoryContentStore();
      const syscall = createSyscall({
        runtime,
        contentStore: store,
        principal: createPrincipal(),
        schemaProvider: createSchemaProvider(),
        toolExecutor,
      });

      const result = await syscall.useTool({
        callId: "search-1",
        toolName: "search",
        args: { q: "test" },
      });
      expect(result.ok).toBe(true);
      expect(result.output).toBe("result of search");
      expect(result.contentRef).toBeDefined();
      expect(result.observeWarning).toBeUndefined();
    });

    it("returns error when no executor configured", async () => {
      const runtime = mockRuntime();
      const store = createMemoryContentStore();
      const syscall = createSyscall({
        runtime,
        contentStore: store,
        principal: createPrincipal(),
        schemaProvider: createSchemaProvider(),
      });

      const result = await syscall.useTool({
        callId: "anything-1",
        toolName: "anything",
        args: {},
      });
      expect(result.ok).toBe(false);
      expect(result.output).toContain("No tool executor");
    });

    it("rejects missing call identity and non-canonical arguments before execution", async () => {
      let executions = 0;
      const syscall = createSyscall({
        runtime: mockRuntime(),
        contentStore: createMemoryContentStore(),
        principal: createPrincipal(),
        schemaProvider: createSchemaProvider(),
        toolExecutor: {
          execute: async () => {
            executions++;
            return { ok: true, output: "must not run" };
          },
          listTools: async () => [],
        },
      });

      const emptyId = await syscall.useTool({ callId: "", toolName: "shell", args: {} });
      const cyclic: Record<string, unknown> = {};
      cyclic["self"] = cyclic;
      const invalidArgs = await syscall.useTool({
        callId: "cyclic",
        toolName: "shell",
        args: cyclic,
      });

      expect(emptyId.ok).toBe(false);
      expect(invalidArgs.ok).toBe(false);
      expect(executions).toBe(0);
    });

    it("reports a failed postcondition while retaining stored output when observe fails", async () => {
      const toolExecutor: ToolExecutor = {
        execute: async () => ({ ok: true, output: "ok" }),
        listTools: async () => [],
      };
      const runtime = mockRuntime({
        observeResult: { ok: false, message: "principal not registered" },
      });
      const store = createMemoryContentStore();
      const syscall = createSyscall({
        runtime,
        contentStore: store,
        principal: createPrincipal(),
        schemaProvider: createSchemaProvider(),
        toolExecutor,
      });

      const result = await syscall.useTool({ callId: "tool-call-x", toolName: "x", args: {} });
      expect(result.ok).toBe(false);
      expect(result.output).toBe("ok");
      expect(result.contentRef).toBeDefined();
      expect(result.observationRecovery).toMatchObject({
        toolName: "x",
        originalToolCallId: "tool-call-x",
        outputRef: result.contentRef,
        receiptRef: expect.stringMatching(/^sha256:[0-9a-f]{64}$/u),
      });
      expect(result.observeWarning).toContain("Observation rejected");
      expect(result.observeWarning).toContain("principal not registered");
      const stored = await store.get(result.contentRef!);
      expect(new TextDecoder().decode(stored!.bytes)).toBe("ok");
    });

    it("retries only the stored observation and never invokes the executor twice", async () => {
      let executeCount = 0;
      let observeCount = 0;
      const toolExecutor: ToolExecutor = {
        execute: async () => {
          executeCount++;
          return { ok: true, output: "side effect already happened" };
        },
        listTools: async () => [],
      };
      const runtime = mockRuntime();
      runtime.observe = () => {
        observeCount++;
        return observeCount === 1
          ? { ok: false, message: "audit temporarily unavailable" }
          : { ok: true };
      };
      const store = createMemoryContentStore();
      const syscall = createSyscall({
        runtime,
        contentStore: store,
        principal: createPrincipal(),
        schemaProvider: createSchemaProvider(),
        toolExecutor,
      });

      const first = await syscall.useTool({
        callId: "external-1",
        toolName: "shell",
        args: { cmd: "create-once" },
      });
      expect(first.ok).toBe(false);
      expect(first.observationRecovery).toBeDefined();

      const retry = await syscall.retryToolObservation(first.observationRecovery!);

      expect(retry.ok).toBe(true);
      expect(retry.outputRef).toBe(first.contentRef);
      expect(executeCount).toBe(1);
      expect(observeCount).toBe(2);
    });

    it("binds recovery to the pre-execution argument snapshot when an executor mutates input", async () => {
      const originalArgs = { nested: { value: 1 }, order: ["a", "b"] };
      const expectedDigest = toolArgumentsDigest(originalArgs);
      let executorArgs: Record<string, unknown> | undefined;
      let observeCount = 0;
      const runtime = mockRuntime();
      runtime.observe = () => {
        observeCount++;
        return observeCount === 1 ? { ok: false, message: "offline" } : { ok: true };
      };
      const store = createMemoryContentStore();
      const syscall = createSyscall({
        runtime,
        contentStore: store,
        principal: createPrincipal(),
        schemaProvider: createSchemaProvider(),
        toolExecutor: {
          execute: async (_toolName, args) => {
            executorArgs = args;
            (args["nested"] as { value: number }).value = 99;
            return { ok: true, output: "mutated executor input" };
          },
          listTools: async () => [],
        },
      });

      const failed = await syscall.useTool({
        callId: "mutating-executor",
        toolName: "mcp-write",
        args: originalArgs,
      });

      expect(executorArgs).not.toBe(originalArgs);
      expect(originalArgs.nested.value).toBe(1);
      expect(failed.observationRecovery?.argumentsDigest).toBe(expectedDigest);
      const retry = await syscall.retryToolObservation(failed.observationRecovery!);
      expect(retry.ok).toBe(true);
      expect(observeCount).toBe(2);
    });

    it("rejects mismatched call/ref/receipt identities before observation", async () => {
      let observeCount = 0;
      const runtime = mockRuntime();
      runtime.observe = () => {
        observeCount++;
        return { ok: false, message: "offline" };
      };
      const store = createMemoryContentStore();
      const syscall = createSyscall({
        runtime,
        contentStore: store,
        principal: createPrincipal(),
        schemaProvider: createSchemaProvider(),
        toolExecutor: {
          execute: async () => ({ ok: true, output: "stored result" }),
          listTools: async () => [],
        },
      });
      const failed = await syscall.useTool({
        callId: "original-call",
        toolName: "filesystem",
        args: { path: "/one" },
      });
      const recovery = failed.observationRecovery!;
      const otherOutputRef = await syscall.writeContent("different output");
      const otherReceiptRef = await syscall.writeContent("not a receipt");
      expect(observeCount).toBe(1);

      for (const candidate of [
        { ...recovery, originalToolCallId: "another-call" },
        { ...recovery, outputRef: otherOutputRef },
        { ...recovery, receiptRef: otherReceiptRef },
      ]) {
        const result = await syscall.retryToolObservation(candidate);
        expect(result.ok).toBe(false);
      }
      expect(observeCount).toBe(1);
      const retryRejected = await syscall.retryToolObservation(recovery);
      expect(retryRejected.ok).toBe(false);
      expect(retryRejected.observeWarning).toContain("Observation retry rejected");
      expect(observeCount).toBe(2);
    });

    it("recovers from the durable receipt after recreating the syscall", async () => {
      let observeCount = 0;
      const runtime = mockRuntime();
      runtime.observe = () => {
        observeCount++;
        return observeCount === 1 ? { ok: false, message: "offline" } : { ok: true };
      };
      const store = createMemoryContentStore();
      const toolExecutor: ToolExecutor = {
        execute: async () => ({ ok: true, output: "persisted output" }),
        listTools: async () => [],
      };
      const firstSyscall = createSyscall({
        runtime,
        contentStore: store,
        principal: createPrincipal(),
        schemaProvider: createSchemaProvider(),
        toolExecutor,
      });
      const failed = await firstSyscall.useTool({
        callId: "restart-call",
        toolName: "mcp-write",
        args: { value: 1 },
      });
      const recreated = createSyscall({
        runtime,
        contentStore: store,
        principal: createPrincipal(),
        schemaProvider: createSchemaProvider(),
      });

      const retry = await recreated.retryToolObservation(failed.observationRecovery!);

      expect(retry.ok).toBe(true);
      expect(retry.outputRef).toBe(failed.contentRef);
      expect(observeCount).toBe(2);
    });
  });

  describe("availableActions", () => {
    it("generates schemas from templates dynamically", async () => {
      const runtime = mockRuntime();
      const store = createMemoryContentStore();
      const syscall = createSyscall({
        runtime,
        contentStore: store,
        principal: createPrincipal(),
        schemaProvider: createSchemaProvider(),
      });

      const actions = await syscall.availableActions();
      const names = actions.map((a) => a.name);
      expect(names).toContain("introduce_artifact");
      expect(names).toContain("delegate");
      expect(names).toContain("emit_heartbeat");

      const intro = actions.find((a) => a.name === "introduce_artifact")!;
      expect((intro.parameters as JsonSchemaObject).required).toEqual([
        "task",
        "from",
        "contentRef",
      ]);
      expect((intro.parameters as JsonSchemaObject).properties?.contentRef?.pattern).toBe(
        "^sha256:[0-9a-f]{64}$",
      );
      const heartbeat = actions.find((a) => a.name === "emit_heartbeat")!;
      expect((heartbeat.parameters as JsonSchemaObject).required).toEqual([
        "from",
        "turnCount",
        "lastAction",
      ]);
      expect((heartbeat.parameters as JsonSchemaObject).properties?.turnCount?.pattern).toBe(
        "^(?:0|[1-9][0-9]*)$",
      );
    });

    it("merges external tool schemas with tool: prefix", async () => {
      const toolExecutor: ToolExecutor = {
        execute: async () => ({ ok: true, output: "" }),
        listTools: async () => [
          { name: "run_cmd", description: "Run command", parameters: { type: "object" } },
        ],
      };
      const runtime = mockRuntime();
      const store = createMemoryContentStore();
      const syscall = createSyscall({
        runtime,
        contentStore: store,
        principal: createPrincipal(),
        schemaProvider: createSchemaProvider(),
        toolExecutor,
      });

      const actions = await syscall.availableActions();
      expect(actions.find((a) => a.name === "tool:run_cmd")).toBeDefined();
    });
  });
});

describe("schemasFromTemplates", () => {
  it("generates JSON Schema properties from requiredRoles", () => {
    const schemas = schemasFromTemplates(TEST_TEMPLATES);
    const delegate = schemas.find((s) => s.name === "delegate")!;
    expect(delegate.description).toBe("Delegate task");
    expect((delegate.parameters as JsonSchemaObject).required).toEqual([
      "task",
      "from",
      "to",
      "capability",
    ]);
    expect((delegate.parameters as JsonSchemaObject).properties?.task?.type).toBe("string");
  });
});
