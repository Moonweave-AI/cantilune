import { describe, expect, it } from "vitest";
import { SessionReconciler } from "../../src/recovery/sessionReconciler.js";
import { MemoryCommsStore } from "../../src/memory/memoryCommsStore.js";
import { sessionId } from "@cantilune/core";
import { channelGeneration, channelId } from "../../src/foundation/messageId.js";

describe("SessionReconciler branches", () => {
  it("flags orphaned and stale sessions", () => {
    const store = new MemoryCommsStore();
    const activeSid = sessionId("session-recon-active");
    const orphanSid = sessionId("session-recon-orphan");
    const staleSid = sessionId("session-recon-stale");
    const binding = (sid: ReturnType<typeof sessionId>, status: "active" | "draining") => ({
      sessionId: sid,
      authoritativeSnapshotRef: "snap-1" as never,
      localRuntimeInstanceId: "rt-local" as never,
      remoteRuntimeInstanceId: "rt-remote" as never,
      channelId: channelId(`ch-${sid as string}`),
      channelGeneration: channelGeneration(1),
      localEndpoint: "ep-local" as never,
      remoteEndpoint: "ep-remote" as never,
      negotiated: {
        wireVersion: 1 as never,
        transport: "loopback",
        codecRef: "comms/wire-v1",
        protocolVersion: "comms/1",
        a2aProfile: "a2a/0.1",
        features: [],
      },
      schemaEpochId: "42",
      status,
      outboundSequence: 0,
      inboundSequence: 0,
      establishedAt: "2026-08-11T16:00:00Z",
      updatedAt: "2026-08-11T16:00:00Z",
    });
    store.casSessionBinding({
      sessionId: activeSid,
      expectedGeneration: channelGeneration(0),
      next: binding(activeSid, "active"),
    });
    store.casSessionBinding({
      sessionId: orphanSid,
      expectedGeneration: channelGeneration(0),
      next: binding(orphanSid, "active"),
    });
    store.casSessionBinding({
      sessionId: staleSid,
      expectedGeneration: channelGeneration(0),
      next: binding(staleSid, "draining"),
    });
    const reconciler = new SessionReconciler({
      store,
      sessionAuthority: {
        isController: (sid) => sid === activeSid,
        isMember: () => true,
      },
      eStop: { isFrozen: () => false, setFrozen: () => undefined },
    });
    const report = reconciler.reconcile();
    expect(report.ok).toBe(true);
    if (!report.ok) {
      return;
    }
    expect(report.value.active).toBe(1);
    expect(report.value.orphaned).toHaveLength(1);
    expect(report.value.stale).toHaveLength(1);
  });
});
