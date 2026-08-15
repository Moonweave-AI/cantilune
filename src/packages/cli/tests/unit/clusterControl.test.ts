/**
 * Integration-style test for the CLI cluster controller (ADR-0015).
 *
 * Verifies that createClusterController builds a real ClusterSupervisor from
 * the handle backends and that activate() stores a manifest and commits a
 * valid activate_participant intent through the runtime. The runtime is a
 * controllable mock (real CollaborationSnapshot), the content store is a mock,
 * and the LLM adapter is a no-op stub — we are testing the controller wiring,
 * not the agent loop.
 */
import { describe, it, expect, vi } from "vitest";
import {
  actorId,
  collaborationSnapshot,
  snapshotRef,
  epochId,
  participant,
  contentRef,
  deserializeManifest,
} from "@cantilune/core";
import type {
  ActorId,
  CollaborationSnapshot,
  ContentRef,
  SnapshotRef,
  CoordinationChange,
  Participant,
} from "@cantilune/core";
import type { SyscallRuntime, ProposeResult } from "@cantilune/syscall";
import type { ContentStore } from "@cantilune/content";
import { createClusterController } from "../../src/wiring/clusterControl.js";
import type { LlmAdapter } from "@cantilune/boot";

/* ────────── Mock content store ────────── */
function createMockContentStore(): ContentStore & {
  readonly storage: Map<string, Uint8Array>;
} {
  const storage = new Map<string, Uint8Array>();
  const metadataMap = new Map<
    string,
    { size: number; mimeType: string; createdAt: string; createdBy: string | undefined }
  >();
  let counter = 0;
  return {
    storage,
    isAvailable: (ref: ContentRef) => storage.has(ref as string),
    async put(content: string | Uint8Array, opts?: { mimeType?: string; createdBy?: string }) {
      counter++;
      const ref = contentRef(`sha256:test${counter.toString(36).padStart(6, "0")}`);
      const bytes = typeof content === "string" ? new TextEncoder().encode(content) : content;
      storage.set(ref as string, bytes);
      metadataMap.set(ref as string, {
        size: bytes.length,
        mimeType: opts?.mimeType ?? "application/octet-stream",
        createdAt: "2026-08-14T00:00:00.000Z",
        createdBy: opts?.createdBy,
      });
      return ref;
    },
    async get(ref: ContentRef) {
      const bytes = storage.get(ref as string);
      if (bytes === undefined) return undefined;
      return { ref, bytes, metadata: metadataMap.get(ref as string)! };
    },
    async exists(ref: ContentRef) {
      return storage.has(ref as string);
    },
    async metadata(ref: ContentRef) {
      return metadataMap.get(ref as string);
    },
    async count() {
      return storage.size;
    },
    async list() {
      return [...storage.keys()].map((ref) => ({
        ref: ref as ContentRef,
        metadata: metadataMap.get(ref)!,
      }));
    },
    async remove(ref: ContentRef) {
      const had = storage.delete(ref as string);
      metadataMap.delete(ref as string);
      return had;
    },
  } as unknown as ContentStore & { readonly storage: Map<string, Uint8Array> };
}

/* ────────── Mock runtime ────────── */
interface MockRuntimeState {
  snapshot: CollaborationSnapshot;
  feed: CoordinationChange[];
  lastIntent: unknown;
  lastOptions: unknown;
  commitResult: ProposeResult;
}

function createMockRuntime(state: MockRuntimeState): SyscallRuntime {
  return {
    getHead() {
      return state.snapshot;
    },
    observe() {
      return { ok: true };
    },
    changes(since?: SnapshotRef): readonly CoordinationChange[] {
      if (since === undefined) return state.feed;
      const idx = state.feed.findIndex((c) => c.afterRef === since);
      if (idx === -1) return state.feed;
      return state.feed.slice(idx + 1);
    },
    proposeAndCommit(intent: unknown, options?: unknown): ProposeResult {
      state.lastIntent = intent;
      state.lastOptions = options;
      return state.commitResult;
    },
  } as unknown as SyscallRuntime;
}

/* ────────── Stub LLM adapter ────────── */
function stubLlmAdapter(): LlmAdapter {
  return { chat: vi.fn(async () => ({ content: "ok" })) } as unknown as LlmAdapter;
}

/* ────────── Snapshot builder ────────── */
function snapshotWithParticipants(
  participants: ReadonlyMap<ActorId, Participant>,
): CollaborationSnapshot {
  return collaborationSnapshot({
    snapshotRef: snapshotRef("s1"),
    epochId: epochId("e1"),
    participants,
  });
}

describe("createClusterController", () => {
  it("start() reports not connected when backends are absent", () => {
    const controller = createClusterController(
      () => ({ contentStore: undefined, syscallRuntime: undefined, storagePath: undefined }),
      stubLlmAdapter,
    );
    const result = controller.start();
    expect(result.ok).toBe(false);
    expect(result.message).toContain("no runtime connected");
  });

  it("start() builds a real supervisor and status reports running", () => {
    const store = createMockContentStore();
    const initiator = actorId("initiator");
    const snap = snapshotWithParticipants(
      new Map([[initiator, participant(initiator, "agent", "active")]]),
    );
    const runtime = createMockRuntime({
      snapshot: snap,
      feed: [],
      lastIntent: undefined,
      lastOptions: undefined,
      commitResult: { ok: true, newHeadRef: "s2" },
    });
    const controller = createClusterController(
      () => ({ contentStore: store, syscallRuntime: runtime, storagePath: undefined }),
      stubLlmAdapter,
    );

    const result = controller.start();
    expect(result.ok).toBe(true);
    expect(controller.status().running).toBe(true);

    controller.stop();
    expect(controller.status().running).toBe(false);
  });

  it("activate() rejects when no active initiator is on the head", async () => {
    const store = createMockContentStore();
    const agentA = actorId("agent-a");
    const snap = snapshotWithParticipants(
      new Map([[agentA, participant(agentA, "agent", "registered")]]),
    );
    const runtime = createMockRuntime({
      snapshot: snap,
      feed: [],
      lastIntent: undefined,
      lastOptions: undefined,
      commitResult: { ok: true, newHeadRef: "s2" },
    });
    const controller = createClusterController(
      () => ({ contentStore: store, syscallRuntime: runtime, storagePath: undefined }),
      stubLlmAdapter,
    );

    const result = await controller.activate("agent-a");
    expect(result.ok).toBe(false);
    expect(result.message).toContain("no active initiator");
  });

  it("activate() rejects when the participant is not registered", async () => {
    const store = createMockContentStore();
    const initiator = actorId("initiator");
    const snap = snapshotWithParticipants(
      new Map([[initiator, participant(initiator, "agent", "active")]]),
    );
    const runtime = createMockRuntime({
      snapshot: snap,
      feed: [],
      lastIntent: undefined,
      lastOptions: undefined,
      commitResult: { ok: true, newHeadRef: "s2" },
    });
    const controller = createClusterController(
      () => ({ contentStore: store, syscallRuntime: runtime, storagePath: undefined }),
      stubLlmAdapter,
    );

    const result = await controller.activate("ghost");
    expect(result.ok).toBe(false);
    expect(result.message).toContain("not registered");
  });

  it("activate() rejects an already-active participant", async () => {
    const store = createMockContentStore();
    const initiator = actorId("initiator");
    const agentA = actorId("agent-a");
    const snap = snapshotWithParticipants(
      new Map([
        [initiator, participant(initiator, "agent", "active")],
        [agentA, participant(agentA, "agent", "active")],
      ]),
    );
    const runtime = createMockRuntime({
      snapshot: snap,
      feed: [],
      lastIntent: undefined,
      lastOptions: undefined,
      commitResult: { ok: true, newHeadRef: "s2" },
    });
    const controller = createClusterController(
      () => ({ contentStore: store, syscallRuntime: runtime, storagePath: undefined }),
      stubLlmAdapter,
    );

    const result = await controller.activate("agent-a");
    expect(result.ok).toBe(false);
    expect(result.message).toContain("already active");
  });

  it("activate() stores a manifest and commits activate_participant", async () => {
    const store = createMockContentStore();
    const initiator = actorId("initiator");
    const agentA = actorId("agent-a");
    const snap = snapshotWithParticipants(
      new Map([
        [initiator, participant(initiator, "agent", "active")],
        [agentA, participant(agentA, "agent", "registered")],
      ]),
    );
    const mockState = {
      snapshot: snap,
      feed: [] as CoordinationChange[],
      lastIntent: undefined as unknown,
      lastOptions: undefined as unknown,
      commitResult: { ok: true, newHeadRef: "s2" } as ProposeResult,
    };
    const runtime = createMockRuntime(mockState);
    const controller = createClusterController(
      () => ({ contentStore: store, syscallRuntime: runtime, storagePath: undefined }),
      stubLlmAdapter,
    );

    const result = await controller.activate("agent-a", {
      systemPrompt: "you are a worker",
      assignedTask: "do the thing",
    });

    expect(result.ok).toBe(true);
    expect(mockState.lastIntent).toBeDefined();
    const intent = mockState.lastIntent as {
      operationTypeId: { toString(): string };
      matchBindings: { role: string }[];
    };
    expect(intent.operationTypeId.toString()).toBe("activate_participant");
    const roles = intent.matchBindings.map((b) => b.role);
    expect(roles).toContain("from");
    expect(roles).toContain("participant");

    // A manifest was stored in the content store with the given system prompt.
    expect(store.storage.size).toBe(1);
    const storedBytes = [...store.storage.values()][0]!;
    const manifest = deserializeManifest(new TextDecoder().decode(storedBytes));
    expect(manifest.systemPrompt).toBe("you are a worker");
    expect(manifest.assignedTask).toBe("do the thing");
    expect(manifest.kind).toBe("agent");

    // The principal of the commit was the active initiator.
    const options = mockState.lastOptions as { principal?: { actorId: ActorId } };
    expect(options?.principal?.actorId).toBe(initiator);
  });

  it("activate() reports rejection from the runtime", async () => {
    const store = createMockContentStore();
    const initiator = actorId("initiator");
    const agentA = actorId("agent-a");
    const snap = snapshotWithParticipants(
      new Map([
        [initiator, participant(initiator, "agent", "active")],
        [agentA, participant(agentA, "agent", "registered")],
      ]),
    );
    const runtime = createMockRuntime({
      snapshot: snap,
      feed: [],
      lastIntent: undefined,
      lastOptions: undefined,
      commitResult: { ok: false, message: "admission rejected: not authorized" },
    });
    const controller = createClusterController(
      () => ({ contentStore: store, syscallRuntime: runtime, storagePath: undefined }),
      stubLlmAdapter,
    );

    const result = await controller.activate("agent-a");
    expect(result.ok).toBe(false);
    expect(result.message).toContain("admission rejected");
  });

  it("activate() rejects a non-agent participant", async () => {
    const store = createMockContentStore();
    const initiator = actorId("initiator");
    const tool = actorId("tool-x");
    const snap = snapshotWithParticipants(
      new Map([
        [initiator, participant(initiator, "agent", "active")],
        [tool, participant(tool, "tool", "registered")],
      ]),
    );
    const runtime = createMockRuntime({
      snapshot: snap,
      feed: [],
      lastIntent: undefined,
      lastOptions: undefined,
      commitResult: { ok: true, newHeadRef: "s2" },
    });
    const controller = createClusterController(
      () => ({ contentStore: store, syscallRuntime: runtime, storagePath: undefined }),
      stubLlmAdapter,
    );

    const result = await controller.activate("tool-x");
    expect(result.ok).toBe(false);
    expect(result.message).toContain("not an agent");
  });

  it("activate() reports no runtime connected when backends are absent", async () => {
    const controller = createClusterController(
      () => ({ contentStore: undefined, syscallRuntime: undefined, storagePath: undefined }),
      stubLlmAdapter,
    );
    const result = await controller.activate("agent-a");
    expect(result.ok).toBe(false);
    expect(result.message).toContain("no runtime connected");
  });

  it("activate() reports no snapshot when the runtime head is empty", async () => {
    const store = createMockContentStore();
    const runtime = {
      getHead: () => undefined,
      observe: () => ({ ok: true }),
      changes: () => [],
      proposeAndCommit: () => ({ ok: true, newHeadRef: "s2" }),
    } as unknown as SyscallRuntime;
    const controller = createClusterController(
      () => ({ contentStore: store, syscallRuntime: runtime, storagePath: undefined }),
      stubLlmAdapter,
    );
    const result = await controller.activate("agent-a");
    expect(result.ok).toBe(false);
    expect(result.message).toContain("no snapshot on the runtime head");
  });
});
