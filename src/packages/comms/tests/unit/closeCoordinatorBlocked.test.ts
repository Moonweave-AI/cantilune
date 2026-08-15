import { describe, expect, it } from "vitest";
import { CloseCoordinator } from "../../src/close/closeCoordinator.js";
import { MemoryCommsStore } from "../../src/memory/memoryCommsStore.js";
import { closeRecordId, channelGeneration, channelId } from "../../src/foundation/messageId.js";
import { sessionId } from "@cantilune/core";

describe("CloseCoordinator blocked paths", () => {
  it("emits QuiescenceBlocked when runtime not quiescent", async () => {
    const store = new MemoryCommsStore();
    const events: unknown[] = [];
    const coordinator = new CloseCoordinator({
      store,
      quiescence: { resourcesClear: async () => false, sessionsQuiescent: async () => true },
      eStop: { isFrozen: () => false, setFrozen: () => undefined },
      events: { emit: (e) => events.push(e) },
      clock: { now: () => "2026-08-11T16:00:00Z" },
    });
    const plan = {
      planId: closeRecordId("close-blocked"),
      sessionId: sessionId("session-blocked"),
      channelId: channelId("ch-blocked"),
      channelGeneration: channelGeneration(1),
      sendBarrierApplied: true,
      pendingOutbox: 0,
      pendingInbox: 0,
      pendingInflight: 0,
      peerShutdownAckRef: "ack",
      authorizationRef: "auth",
      expiresAt: "2099-01-01T00:00:00Z",
    };
    const result = await coordinator.complete(plan);
    expect(result.ok).toBe(false);
    expect(events.some((e) => (e as { kind: string }).kind === "QuiescenceBlocked")).toBe(true);
  });

  it("rejects incomplete close plan", async () => {
    const coordinator = new CloseCoordinator({
      store: new MemoryCommsStore(),
      quiescence: { resourcesClear: async () => true, sessionsQuiescent: async () => true },
      eStop: { isFrozen: () => false, setFrozen: () => undefined },
      events: { emit: () => undefined },
      clock: { now: () => "2026-08-11T16:00:00Z" },
    });
    const result = await coordinator.complete({
      planId: closeRecordId("close-incomplete"),
      sessionId: sessionId("session-incomplete"),
      channelId: channelId("ch-incomplete"),
      channelGeneration: channelGeneration(1),
      sendBarrierApplied: false,
      pendingOutbox: 1,
      pendingInbox: 0,
      pendingInflight: 0,
      authorizationRef: "",
      expiresAt: "2099-01-01T00:00:00Z",
    });
    expect(result.ok).toBe(false);
  });
});
