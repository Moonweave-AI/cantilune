import { describe, expect, it } from "vitest";
import { CommsMessagingService } from "../../src/engine/commsMessagingService.js";
import { MessagingSagaCoordinator } from "../../src/recovery/messagingSagaCoordinator.js";
import { MemoryCommsStore } from "../../src/memory/memoryCommsStore.js";
import { LoopbackTransport } from "../../src/memory/loopbackTransport.js";
import { buildTestAuthContext, buildTestEnvelope } from "../support/envelopeFixtures.js";
import { idempotencyKey } from "@cantilune/core";
import { err } from "@cantilune/core";
import { commsViolation } from "../../src/foundation/commsViolation.js";

describe("CommsMessagingService branches", () => {
  it("returns saga phase and runtime receipt ref", async () => {
    const [local] = LoopbackTransport.connectPair();
    const store = new MemoryCommsStore();
    const saga = new MessagingSagaCoordinator({
      store,
      transport: local,
      observation: {
        observe: async () => ({ ok: true, value: { snapshotRef: "snap-1" as never } }),
      },
      runtimeCommit: {
        commitMessage: async () => ({ ok: true, value: { receiptRef: "receipt-saga-001" } }),
        commitReconnect: async () => ({ ok: true, value: { receiptRef: "r" } }),
      },
      events: { emit: () => undefined },
      eStop: { isFrozen: () => false, setFrozen: () => undefined },
      clock: { now: () => "2026-08-11T16:00:00Z" },
    });
    const service = new CommsMessagingService({
      store,
      transport: local,
      sessionAuthority: { isController: () => true, isMember: () => true },
      eStop: { isFrozen: () => false, setFrozen: () => undefined },
      events: { emit: () => undefined },
      clock: { now: () => "2026-08-11T16:00:00Z" },
      saga,
    });
    const envelope = buildTestEnvelope({ messageId: "msg-saga-send" as never });
    const sent = await service.send(
      buildTestAuthContext(),
      envelope,
      idempotencyKey("idem-saga-send"),
    );
    expect(sent.ok).toBe(true);
    if (!sent.ok) {
      return;
    }
    expect(sent.value.sagaPhase).toBe("dispatched");
    expect(sent.value.runtimeReceiptRef).toBe("receipt-saga-001");
  });

  it("returns idempotent replay delivery id on direct path", async () => {
    const [local] = LoopbackTransport.connectPair();
    const store = new MemoryCommsStore();
    const service = new CommsMessagingService({
      store,
      transport: local,
      sessionAuthority: { isController: () => true, isMember: () => true },
      eStop: { isFrozen: () => false, setFrozen: () => undefined },
      events: { emit: () => undefined },
      clock: { now: () => "2026-08-11T16:00:00Z" },
    });
    const envelope = buildTestEnvelope({ messageId: "msg-idem-send" as never });
    const idem = idempotencyKey("idem-replay-send");
    const first = await service.send(buildTestAuthContext(), envelope, idem);
    const second = await service.send(buildTestAuthContext(), envelope, idem);
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
  });

  it("rejects transport failure on direct path", async () => {
    const store = new MemoryCommsStore();
    const service = new CommsMessagingService({
      store,
      transport: {
        transportId: "fail",
        dispatch: async () => err(commsViolation("transport_failed", "send", "down")),
        receive: async () => err(commsViolation("transport_failed", "receive", "empty")),
        handshake: async () => err(commsViolation("transport_failed", "session", "fail")),
      },
      sessionAuthority: { isController: () => true, isMember: () => true },
      eStop: { isFrozen: () => false, setFrozen: () => undefined },
      events: { emit: () => undefined },
      clock: { now: () => "2026-08-11T16:00:00Z" },
    });
    const result = await service.send(
      buildTestAuthContext(),
      buildTestEnvelope({ messageId: "msg-transport-fail" as never }),
      idempotencyKey("idem-transport-fail"),
    );
    expect(result.ok).toBe(false);
  });

  it("rejects idempotency conflict on direct path", async () => {
    const baseStore = new MemoryCommsStore();
    const store = Object.assign(baseStore, {
      appendOutbox: () => "conflict" as const,
    });
    const service = new CommsMessagingService({
      store,
      transport: new LoopbackTransport(),
      sessionAuthority: { isController: () => true, isMember: () => true },
      eStop: { isFrozen: () => false, setFrozen: () => undefined },
      events: { emit: () => undefined },
      clock: { now: () => "2026-08-11T16:00:00Z" },
    });
    const result = await service.send(
      buildTestAuthContext(),
      buildTestEnvelope({ messageId: "msg-conflict" as never }),
      idempotencyKey("idem-conflict"),
    );
    expect(result.ok).toBe(false);
  });
});
