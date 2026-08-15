import { describe, expect, it } from "vitest";
import { MessagingSagaCoordinator } from "../../src/recovery/messagingSagaCoordinator.js";
import { MemoryCommsStore } from "../../src/memory/memoryCommsStore.js";
import { LoopbackTransport } from "../../src/memory/loopbackTransport.js";
import { buildTestAuthContext, buildTestEnvelope } from "../support/envelopeFixtures.js";
import { idempotencyKey, snapshotRef } from "@cantilune/core";
import { err } from "@cantilune/core";
import { commsViolation } from "../../src/foundation/commsViolation.js";

describe("MessagingSagaCoordinator failures", () => {
  const baseDeps = (overrides: Record<string, unknown> = {}) => ({
    store: new MemoryCommsStore(),
    transport: new LoopbackTransport(),
    observation: {
      observe: async () => ({ ok: true as const, value: { snapshotRef: snapshotRef("snap-1") } }),
    },
    runtimeCommit: {
      commitMessage: async () => ({ ok: true as const, value: { receiptRef: "r" } }),
      commitReconnect: async () => ({ ok: true as const, value: { receiptRef: "r" } }),
    },
    events: { emit: () => undefined },
    eStop: { isFrozen: () => false, setFrozen: () => undefined },
    clock: { now: () => "2026-08-11T16:00:00Z" },
    ...overrides,
  });

  it("rejects when E-Stop active", async () => {
    const saga = new MessagingSagaCoordinator(
      baseDeps({ eStop: { isFrozen: () => true, setFrozen: () => undefined } }),
    );
    const result = await saga.executeSend({
      context: buildTestAuthContext(),
      envelope: buildTestEnvelope({ messageId: "msg-saga-estop" as never }),
      idempotencyKey: idempotencyKey("idem-estop"),
    });
    expect(result.ok).toBe(false);
  });

  it("fails when runtime commit rejects", async () => {
    const saga = new MessagingSagaCoordinator(
      baseDeps({
        runtimeCommit: {
          commitMessage: async () =>
            err(commsViolation("runtime_commit_failed", "send", "commit fail")),
          commitReconnect: async () => ({ ok: true as const, value: { receiptRef: "r" } }),
        },
      }),
    );
    const result = await saga.executeSend({
      context: buildTestAuthContext(),
      envelope: buildTestEnvelope({ messageId: "msg-saga-commit-fail" as never }),
      idempotencyKey: idempotencyKey("idem-commit-fail"),
    });
    expect(result.ok).toBe(false);
  });

  it("fails when transport dispatch rejects", async () => {
    const saga = new MessagingSagaCoordinator(
      baseDeps({
        transport: {
          transportId: "fail",
          dispatch: async () => err(commsViolation("transport_failed", "send", "dispatch fail")),
          receive: async () => err(commsViolation("transport_failed", "receive", "empty")),
          handshake: async () => err(commsViolation("transport_failed", "session", "fail")),
        },
      }),
    );
    const result = await saga.executeSend({
      context: buildTestAuthContext(),
      envelope: buildTestEnvelope({ messageId: "msg-saga-dispatch-fail" as never }),
      idempotencyKey: idempotencyKey("idem-dispatch-fail"),
    });
    expect(result.ok).toBe(false);
  });

  it("returns idempotent replay record", async () => {
    const store = new MemoryCommsStore();
    const envelope = buildTestEnvelope({ messageId: "msg-saga-idem" as never });
    const idem = idempotencyKey("idem-replay-saga");
    const saga = new MessagingSagaCoordinator(
      baseDeps({ store, transport: LoopbackTransport.connectPair()[0] }),
    );
    const first = await saga.executeSend({
      context: buildTestAuthContext(),
      envelope,
      idempotencyKey: idem,
    });
    expect(first.ok).toBe(true);
    const second = await saga.executeSend({
      context: buildTestAuthContext(),
      envelope,
      idempotencyKey: idem,
    });
    expect(second.ok).toBe(true);
  });
});
