import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as runtimeMemory from "@cantilune/runtime/memory";
import * as contentFile from "@cantilune/content/file";
import type { LlmAdapter } from "@cantilune/boot";
import {
  actorId,
  artifactId,
  capabilityId,
  changeId,
  collaborationLink,
  collaborationSnapshot,
  communicationSession,
  coordinationChange,
  entityTombstone,
  epochId,
  linkId,
  observationEntry,
  participant,
  contentRef,
  scopedCapability,
  sessionId,
  snapshotRef,
  actorRef,
  timestamp,
  workArtifact,
} from "@cantilune/core";
import {
  NO_RUNTIME_MESSAGE,
  INSPECT_ONLY_ADAPTER,
  INSPECT_ONLY_LLM_CONFIG,
  envKeyForProvider,
  buildLlmConfig,
  createEmptyRuntimeState,
  buildRuntimeState,
  hasRuntimeData,
  DEFAULT_SCHEMA_ID,
  epochFromSnapshot,
  createCliRuntimeBoot,
} from "../../src/runtimeSync.js";

describe("runtimeSync", () => {
  beforeEach(() => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("exposes inspect-only constants", async () => {
    expect(INSPECT_ONLY_LLM_CONFIG.provider).toBe("inspect");
    await expect(INSPECT_ONLY_ADAPTER.chat({ messages: [] } as never)).rejects.toThrow(
      "Inspect mode is read-only",
    );
  });

  it("resolves provider env keys and builds llm config branches", () => {
    expect(envKeyForProvider("openai")).toBe("OPENAI_API_KEY");
    expect(envKeyForProvider("unknown-provider")).toBe("");

    const withKey = buildLlmConfig("openai", "gpt-4o");
    expect(withKey.apiKey?.()).toBe("test-key");

    const noKey = buildLlmConfig("unknown-provider", "m");
    expect(noKey.apiKey).toBeUndefined();

    const withBase = buildLlmConfig("openai", "gpt-4o", "http://localhost:8080");
    expect(withBase.baseUrl).toBe("http://localhost:8080");

    const emptyBase = buildLlmConfig("openai", "gpt-4o", "");
    expect(emptyBase.baseUrl).toBeUndefined();
  });

  it("creates empty runtime state and detects presence", () => {
    const empty = createEmptyRuntimeState();
    expect(empty.snapshot).toBeNull();
    expect(hasRuntimeData(empty)).toBe(false);

    const withLog = {
      ...empty,
      changeLog: [
        {
          changeId: "c",
          operationTypeId: "x",
          initiator: "a",
          beforeRef: "b",
          afterRef: "c",
          timestamp: "t",
        },
      ],
    };
    expect(hasRuntimeData(withLog)).toBe(true);

    const withEpoch = { ...empty, epoch: { epochId: "e1", ordinal: 1, schemaId: "s" } };
    expect(hasRuntimeData(withEpoch)).toBe(true);
  });

  it("builds runtime state from snapshot and changes", () => {
    expect(buildRuntimeState(undefined, [])).toEqual(createEmptyRuntimeState());

    const aid = actorId("actor:a");
    const art = artifactId("art:1");
    const sid = sessionId("sess:1");
    const capId = capabilityId("cap:1");
    const snapshot = collaborationSnapshot({
      snapshotRef: snapshotRef("snap:1"),
      epochId: epochId("epoch:1"),
      participants: new Map([[aid, participant(aid, "agent")]]),
      artifacts: new Map([
        [
          art,
          workArtifact(art, "task", contentRef("sha256:art"), actorRef(aid, "agent"), "active"),
        ],
      ]),
      sessions: new Map([[sid, communicationSession(sid, aid, [aid], "private")]]),
      capabilities: new Map([
        [capId, scopedCapability(capId, "write_lock", aid, { kind: "artifact", artifactId: art })],
      ]),
      links: new Map([
        [
          linkId("lnk:1"),
          collaborationLink(
            linkId("lnk:1"),
            "delegates_to",
            { kind: "participant", actorId: aid },
            { kind: "artifact", artifactId: art },
          ),
        ],
      ]),
      auditTail: [
        observationEntry(
          1 as never,
          actorRef(aid, "agent"),
          contentRef("sha256:payload"),
          timestamp("2026-08-12T00:00:00.000Z" as never),
        ),
      ],
      retiredEntities: [
        entityTombstone("actor:old" as never, "participant", "2026-08-01T00:00:00.000Z" as never),
      ],
    });

    const change = coordinationChange({
      changeId: changeId("chg:1"),
      recordedAt: "2026-08-12T00:00:00.000Z" as never,
      epochId: epochId("epoch:1"),
      operationTypeId: "observe" as never,
      beforeRef: snapshotRef("snap:0"),
      afterRef: snapshotRef("snap:1"),
      initiator: actorRef(aid, "agent"),
      visibility: "external",
    });

    const state = buildRuntimeState(snapshot, [change]);
    expect(state.snapshot?.snapshotRef).toBe("snap:1");
    expect(state.snapshot?.links[0]).toEqual({
      from: String(aid),
      to: String(art),
      kind: "delegates_to",
    });
    expect(state.changeLog).toHaveLength(1);
    expect(state.epoch?.epochId).toBe("epoch:1");
    expect(state.epoch?.ordinal).toBe(2);
    expect(state.epoch?.schemaId).toBe(DEFAULT_SCHEMA_ID);
    expect(state.snapshot?.sessions[0]?.id).toBe(String(sid));
    expect(state.snapshot?.artifacts[0]?.kind).toBe("task");
    expect(state.snapshot?.capabilities[0]?.kind).toBe("write_lock");
    expect(state.snapshot?.auditTail[0]?.payloadRef).toBe("sha256:payload");
    expect(state.snapshot?.retired[0]?.id).toBe("actor:old");
  });

  it("derives epoch ordinal from change count", () => {
    const aid = actorId("actor:a");
    const snapshot = collaborationSnapshot({
      snapshotRef: snapshotRef("snap:1"),
      epochId: epochId("epoch:1"),
      participants: new Map([[aid, participant(aid, "agent")]]),
    });
    expect(epochFromSnapshot(snapshot, 0).ordinal).toBe(1);
    expect(epochFromSnapshot(snapshot, 3).ordinal).toBe(4);
    expect(epochFromSnapshot(snapshot, 3).schemaId).toBe(DEFAULT_SCHEMA_ID);
  });

  it("requires llm configuration for createCliRuntimeBoot", () => {
    expect(() => createCliRuntimeBoot(INSPECT_ONLY_ADAPTER)).toThrow("LLM configuration required");
  });

  it("boots cli runtime and syncs head state", async () => {
    const handle = createCliRuntimeBoot(INSPECT_ONLY_ADAPTER, {
      principalId: "test-agent",
      llm: INSPECT_ONLY_LLM_CONFIG,
      maxTurns: 1,
    });
    const synced = handle.syncRuntime();
    expect(synced.snapshot).not.toBeNull();
    expect(synced.epoch).not.toBeNull();
    await handle.shutdown();
  });

  it("passes optional boot config through createCliRuntimeBoot", async () => {
    const handle = createCliRuntimeBoot(INSPECT_ONLY_ADAPTER, {
      principalId: "cfg-agent",
      principalKind: "human",
      llm: INSPECT_ONLY_LLM_CONFIG,
      tools: [],
      maxTurns: 2,
      maxTimeMs: 1000,
      maxContextMessages: 4,
      systemPrompt: "test",
      storagePath: "/tmp/cantilune",
    });
    expect(handle.os).toBeDefined();
    await handle.shutdown();
  });

  it("passes restored private conversation into the first resumed run", async () => {
    const requests: Parameters<LlmAdapter["chat"]>[0][] = [];
    const scripted: LlmAdapter = {
      async chat(request) {
        requests.push(request);
        return {
          text: undefined,
          toolCalls: [{ id: "done-1", name: "done", arguments: { summary: "continued" } }],
          finishReason: "tool_calls",
        };
      },
    };
    const handle = createCliRuntimeBoot(scripted, {
      principalId: "history-agent",
      llm: INSPECT_ONLY_LLM_CONFIG,
      initialMessages: [
        { role: "user", content: "earlier request" },
        { role: "assistant", content: "earlier result" },
      ],
    });

    const result = await handle.os.run("summarize the conversation");

    expect(result.ok).toBe(true);
    expect(requests).toHaveLength(1);
    expect(requests[0]?.messages).toEqual(
      expect.arrayContaining([
        { role: "user", content: "earlier request" },
        { role: "assistant", content: "earlier result" },
        { role: "user", content: "summarize the conversation" },
      ]),
    );
    expect(
      requests[0]?.messages.filter(
        (message) => message.role === "user" && message.content === "summarize the conversation",
      ),
    ).toHaveLength(1);
    await handle.shutdown();
  });

  it("reopens a file world with the exact ContentRef from Boot-owned history", async () => {
    const storagePath = mkdtempSync(join(tmpdir(), "cantilune-private-history-"));
    let firstTurn = 0;
    const firstAdapter: LlmAdapter = {
      async chat() {
        firstTurn++;
        return firstTurn === 1
          ? {
              text: undefined,
              toolCalls: [
                { id: "write-report", name: "write_content", arguments: { content: "report" } },
              ],
              finishReason: "tool_calls",
            }
          : {
              text: undefined,
              toolCalls: [{ id: "done-write", name: "done", arguments: { summary: "written" } }],
              finishReason: "tool_calls",
            };
      },
    };

    try {
      const first = createCliRuntimeBoot(firstAdapter, {
        durable: "file",
        storagePath,
        principalId: "history-agent",
        llm: INSPECT_ONLY_LLM_CONFIG,
      });
      expect((await first.os.run("write report")).ok).toBe(true);
      const restored = first.privateHistory();
      const written = restored?.messages.find(
        (message) => message.role === "tool" && message.toolCallId === "write-report",
      );
      expect(written?.content).toMatch(/^Written\. ref=sha256:[0-9a-f]{64}$/u);
      await first.shutdown();

      let resumedRequest: Parameters<LlmAdapter["chat"]>[0] | undefined;
      const second = createCliRuntimeBoot(
        {
          async chat(request) {
            resumedRequest = request;
            return {
              text: undefined,
              toolCalls: [{ id: "done-reopen", name: "done", arguments: { summary: "reopened" } }],
              finishReason: "tool_calls",
            };
          },
        },
        {
          durable: "file",
          storagePath,
          principalId: "history-agent",
          llm: INSPECT_ONLY_LLM_CONFIG,
          history: restored!,
        },
      );
      expect((await second.os.run("what was written?")).ok).toBe(true);
      expect(resumedRequest?.messages).toContainEqual(written);
      await second.shutdown();
    } finally {
      rmSync(storagePath, { recursive: true, force: true });
    }
  });

  it("uses file persistence when durable is file and storagePath is set", async () => {
    const storagePath = mkdtempSync(join(tmpdir(), "cantilune-cli-"));
    const filePersistenceSpy = vi.spyOn(runtimeMemory, "createFileRuntimePersistence");
    const contentStoreSpy = vi.spyOn(contentFile, "createFileContentStore");

    try {
      const handle = createCliRuntimeBoot(INSPECT_ONLY_ADAPTER, {
        llm: INSPECT_ONLY_LLM_CONFIG,
        durable: "file",
        storagePath,
      });
      expect(filePersistenceSpy).toHaveBeenCalledWith(
        expect.objectContaining({ dir: join(storagePath, "runtime") }),
      );
      expect(contentStoreSpy).toHaveBeenCalledWith(join(storagePath, "content"));
      expect(handle.syncRuntime().snapshot).not.toBeNull();
      await handle.shutdown();
    } finally {
      filePersistenceSpy.mockRestore();
      contentStoreSpy.mockRestore();
      rmSync(storagePath, { recursive: true, force: true });
    }
  });

  it("uses memory persistence when storagePath is set without durable file", async () => {
    const fileSpy = vi.spyOn(runtimeMemory, "createFileRuntimePersistence");
    const handle = createCliRuntimeBoot(INSPECT_ONLY_ADAPTER, {
      llm: INSPECT_ONLY_LLM_CONFIG,
      storagePath: "/tmp/memory-only",
    });
    expect(fileSpy).not.toHaveBeenCalled();
    await handle.shutdown();
    fileSpy.mockRestore();
  });

  /**
   * The reported failure: a TUI session against a file-backed world created by
   * an earlier build had every coordination operation rejected as
   * `epoch_mismatch`, while content reads and writes still worked. The world's
   * epoch is whatever is on disk, so the runtime has to admit against that
   * rather than against a value this build picked.
   */
  it("admits operations against a stored world on a foreign epoch", async () => {
    const storagePath = mkdtempSync(join(tmpdir(), "cantilune-epoch-"));
    const foreign = epochId("boot-epoch-3dd1b913");
    const aid = actorId("resumed-agent");
    const stored = collaborationSnapshot({
      snapshotRef: snapshotRef("snap-resumed"),
      epochId: foreign,
      participants: new Map([[aid, participant(aid, "agent")]]),
    });

    // Stand in for a world already on disk under an epoch this build never chose.
    const persistence = runtimeMemory.createMemoryRuntimePersistence({ initial: stored });
    const fileSpy = vi.spyOn(runtimeMemory, "createFileRuntimePersistence").mockReturnValue({
      ...persistence,
      locks: new runtimeMemory.MemoryResourceLockTable(),
    } as never);

    let turn = 0;
    const scripted: LlmAdapter = {
      async chat() {
        turn++;
        if (turn === 1) {
          return {
            text: undefined,
            toolCalls: [{ id: "s", name: "create_session", arguments: { from: "resumed-agent" } }],
            finishReason: "tool_calls",
          };
        }
        return {
          text: undefined,
          toolCalls: [{ id: "d", name: "done", arguments: { summary: "ok" } }],
          finishReason: "tool_calls",
        };
      },
    };

    try {
      const handle = createCliRuntimeBoot(scripted, {
        principalId: "resumed-agent",
        llm: INSPECT_ONLY_LLM_CONFIG,
        durable: "file",
        storagePath,
        compatibleEpochIds: ["boot-epoch-3dd1b913"],
        maxTurns: 3,
      });

      expect(handle.syncRuntime().epoch?.epochId).toBe(foreign);

      const rejections: string[] = [];
      const result = await handle.os.run("Open a session", {
        onEvent: (event) => {
          if (event.kind === "tool_end" && !event.ok) rejections.push(event.output);
        },
      });

      expect(result.ok).toBe(true);
      expect(result.turns).toBe(2);
      expect(result.operations).toEqual({ committed: 1, rejected: 0 });
      expect(result.toolCalls?.failed).toBe(0);
      expect(rejections).toEqual([]);
      await handle.shutdown();
    } finally {
      fileSpy.mockRestore();
      rmSync(storagePath, { recursive: true, force: true });
    }
  });

  it("exports no-runtime message constant", () => {
    expect(NO_RUNTIME_MESSAGE).toContain("No runtime connected");
  });
});
