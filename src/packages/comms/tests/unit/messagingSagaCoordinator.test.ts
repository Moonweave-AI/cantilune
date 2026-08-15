import { describe, expect, it } from "vitest";
import { MessagingSagaCoordinator } from "../../src/recovery/messagingSagaCoordinator.js";
import { MemoryCommsStore } from "../../src/memory/memoryCommsStore.js";
import { LoopbackTransport } from "../../src/memory/loopbackTransport.js";
import { buildTestAuthContext, buildTestEnvelope } from "../support/envelopeFixtures.js";
import { idempotencyKey } from "@cantilune/core";
import { err } from "@cantilune/core";
import { commsViolation } from "../../src/foundation/commsViolation.js";

describe("MessagingSagaCoordinator", () => {
  it("fails when observation rejects", async () => {
    const saga = new MessagingSagaCoordinator({
      store: new MemoryCommsStore(),
      transport: new LoopbackTransport(),
      observation: {
        observe: async () => err(commsViolation("invalid_input", "receive", "observe failed")),
      },
      runtimeCommit: {
        commitMessage: async () => ({ ok: true, value: { receiptRef: "r" } }),
        commitReconnect: async () => ({ ok: true, value: { receiptRef: "r" } }),
      },
      events: { emit: () => undefined },
      eStop: { isFrozen: () => false, setFrozen: () => undefined },
      clock: { now: () => "2026-08-11T16:00:00Z" },
    });
    const result = await saga.executeSend({
      context: buildTestAuthContext(),
      envelope: buildTestEnvelope({ messageId: "msg-saga-fail" as never }),
      idempotencyKey: idempotencyKey("idem-saga-fail"),
    });
    expect(result.ok).toBe(false);
  });

  it("recovers in-memory saga record", async () => {
    const [local] = LoopbackTransport.connectPair();
    const saga = new MessagingSagaCoordinator({
      store: new MemoryCommsStore(),
      transport: local,
      observation: {
        observe: async () => ({ ok: true, value: { snapshotRef: "snap-1" as never } }),
      },
      runtimeCommit: {
        commitMessage: async () => ({ ok: true, value: { receiptRef: "receipt-1" } }),
        commitReconnect: async () => ({ ok: true, value: { receiptRef: "receipt-1" } }),
      },
      events: { emit: () => undefined },
      eStop: { isFrozen: () => false, setFrozen: () => undefined },
      clock: { now: () => "2026-08-11T16:00:00Z" },
    });
    const envelope = buildTestEnvelope({ messageId: "msg-saga-recover" as never });
    await saga.executeSend({
      context: buildTestAuthContext(),
      envelope,
      idempotencyKey: idempotencyKey("idem-saga-recover"),
    });
    expect(saga.recover(envelope.messageId as string)?.phase).toBe("dispatched");
  });
});
