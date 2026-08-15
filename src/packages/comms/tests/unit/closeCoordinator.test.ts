import { describe, expect, it } from "vitest";
import {
  CloseCoordinator,
  CommsAdministrationService,
  CommsQueryService,
} from "../../src/close/closeCoordinator.js";
import { MemoryCommsStore } from "../../src/memory/memoryCommsStore.js";
import { closeRecordId, channelGeneration, channelId } from "../../src/foundation/messageId.js";
import { sessionId } from "@cantilune/core";

describe("CloseCoordinator", () => {
  const clock = { now: () => "2026-08-11T16:00:00Z" };
  const eStop = { isFrozen: () => false, setFrozen: () => undefined };
  const events = { emit: () => undefined };

  it("proposes close plan", async () => {
    const store = new MemoryCommsStore();
    const coordinator = new CloseCoordinator({
      store,
      quiescence: { resourcesClear: async () => true, sessionsQuiescent: async () => true },
      eStop,
      events,
      clock,
    });
    const plan = {
      planId: closeRecordId("close-plan-001"),
      sessionId: sessionId("session-close-001"),
      channelId: channelId("ch-close"),
      channelGeneration: channelGeneration(1),
      sendBarrierApplied: true,
      pendingOutbox: 0,
      pendingInbox: 0,
      pendingInflight: 0,
      peerShutdownAckRef: "ack-ref",
      authorizationRef: "auth-ref",
      expiresAt: "2099-01-01T00:00:00Z",
    };
    const proposed = await coordinator.propose(plan);
    expect(proposed.ok).toBe(true);
  });

  it("completes close when quiescent", async () => {
    const store = new MemoryCommsStore();
    const emitted: unknown[] = [];
    const coordinator = new CloseCoordinator({
      store,
      quiescence: { resourcesClear: async () => true, sessionsQuiescent: async () => true },
      eStop,
      events: { emit: (e) => emitted.push(e) },
      clock,
    });
    const plan = {
      planId: closeRecordId("close-plan-002"),
      sessionId: sessionId("session-close-002"),
      channelId: channelId("ch-close-2"),
      channelGeneration: channelGeneration(1),
      sendBarrierApplied: true,
      pendingOutbox: 0,
      pendingInbox: 0,
      pendingInflight: 0,
      peerShutdownAckRef: "ack-ref",
      authorizationRef: "auth-ref",
      expiresAt: "2099-01-01T00:00:00Z",
    };
    await coordinator.propose(plan);
    const completed = await coordinator.complete(plan);
    expect(completed.ok).toBe(true);
    expect(emitted.some((e) => (e as { kind: string }).kind === "SessionClosed")).toBe(true);
  });

  it("forceClose requires break-glass authority", () => {
    const store = new MemoryCommsStore();
    const coordinator = new CloseCoordinator({
      store,
      quiescence: { resourcesClear: async () => true, sessionsQuiescent: async () => true },
      eStop,
      events,
      clock,
      breakGlassAuthority: { canForceClose: (op) => op === "operator-1" },
    });
    const denied = coordinator.forceClose({
      sessionId: sessionId("session-force-001"),
      operatorRef: "other",
      reason: "emergency",
    });
    expect(denied.ok).toBe(false);
    const allowed = coordinator.forceClose({
      sessionId: sessionId("session-force-001"),
      operatorRef: "operator-1",
      reason: "emergency",
    });
    expect(allowed.ok).toBe(true);
  });

  it("CommsQueryService lists events", () => {
    const store = new MemoryCommsStore();
    store.appendEvent({
      eventId: "evt-1" as never,
      storeSequence: 1 as never,
      kind: "MessageEnqueued",
      occurredAt: clock.now(),
      payload: { messageId: "msg-1" },
    });
    const query = new CommsQueryService(store);
    expect(query.listEvents()).toHaveLength(1);
  });

  it("CommsAdministrationService toggles freeze", () => {
    let frozen = false;
    const admin = new CommsAdministrationService({
      isFrozen: () => frozen,
      setFrozen: (v) => {
        frozen = v;
      },
    });
    admin.setFrozen(true);
    expect(admin.isFrozen()).toBe(true);
  });
});
