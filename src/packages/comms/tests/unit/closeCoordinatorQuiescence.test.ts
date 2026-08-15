import { describe, expect, it } from "vitest";
import { CloseCoordinator } from "../../src/close/closeCoordinator.js";
import { MemoryCommsStore } from "../../src/memory/memoryCommsStore.js";
import { channelGeneration, channelId, closeRecordId } from "../../src/foundation/messageId.js";
import { sessionId } from "@cantilune/core";

function buildClosePlan(overrides: Record<string, unknown> = {}) {
  return {
    planId: closeRecordId("close-plan-001"),
    sessionId: sessionId("session-close-001"),
    channelId: channelId("ch-close-001"),
    channelGeneration: channelGeneration(1),
    sendBarrierApplied: true,
    pendingOutbox: 0,
    pendingInbox: 0,
    pendingInflight: 0,
    peerShutdownAckRef: "ack-ref",
    authorizationRef: "auth-ref",
    expiresAt: "2099-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("CloseCoordinator quiescence", () => {
  it("emits QuiescenceBlocked when resources not clear", async () => {
    const store = new MemoryCommsStore();
    const events: unknown[] = [];
    const coordinator = new CloseCoordinator({
      store,
      quiescence: {
        resourcesClear: async () => false,
        sessionsQuiescent: async () => true,
      },
      eStop: { isFrozen: () => false, setFrozen: () => undefined },
      events: { emit: (e) => events.push(e) },
      clock: { now: () => "2026-08-11T16:00:00Z" },
    });
    const result = await coordinator.complete(buildClosePlan());
    expect(result.ok).toBe(false);
    expect(events.some((e) => (e as { kind: string }).kind === "QuiescenceBlocked")).toBe(true);
  });

  it("rejects complete when send barrier not applied", async () => {
    const coordinator = new CloseCoordinator({
      store: new MemoryCommsStore(),
      quiescence: { resourcesClear: async () => true, sessionsQuiescent: async () => true },
      eStop: { isFrozen: () => false, setFrozen: () => undefined },
      events: { emit: () => undefined },
      clock: { now: () => "2026-08-11T16:00:00Z" },
    });
    const result = await coordinator.complete(buildClosePlan({ sendBarrierApplied: false }));
    expect(result.ok).toBe(false);
  });

  it("forceClose requires breakGlass authority", () => {
    const coordinator = new CloseCoordinator({
      store: new MemoryCommsStore(),
      quiescence: { resourcesClear: async () => true, sessionsQuiescent: async () => true },
      eStop: { isFrozen: () => false, setFrozen: () => undefined },
      events: { emit: () => undefined },
      clock: { now: () => "2026-08-11T16:00:00Z" },
    });
    const result = coordinator.forceClose({
      sessionId: sessionId("session-force"),
      operatorRef: "op-1",
      reason: "emergency",
    });
    expect(result.ok).toBe(false);
  });
});
