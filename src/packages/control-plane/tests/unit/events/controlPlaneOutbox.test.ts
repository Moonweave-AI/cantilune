import { describe, expect, it, vi } from "vitest";
import { createControlPlaneOutbox } from "../../../src/events/controlPlaneOutbox.js";
import { controlPlaneEventId, storeSequence } from "@cantilune/core";

function sampleEvent(id: string) {
  return {
    eventId: controlPlaneEventId(id),
    storeSequence: storeSequence(1),
    kind: "SchemaAdmissionSubmitted" as const,
    occurredAt: "2026-08-11T00:00:00Z",
    actor: "test",
    payload: { admissionId: "adm-001" },
  };
}

describe("control plane outbox", () => {
  it("enqueues and lists pending entries", () => {
    const outbox = createControlPlaneOutbox();
    outbox.enqueue(sampleEvent("evt-1"));
    outbox.enqueue(sampleEvent("evt-2"));
    const pending = outbox.pending();
    expect(pending).toHaveLength(2);
    expect(pending.every((entry) => !entry.delivered)).toBe(true);
  });

  it("marks a single entry delivered without affecting others", () => {
    const outbox = createControlPlaneOutbox();
    outbox.enqueue(sampleEvent("evt-1"));
    outbox.enqueue(sampleEvent("evt-2"));
    const firstId = outbox.pending()[0]!.id;
    outbox.markDelivered(firstId);
    expect(outbox.pending()).toHaveLength(1);
    expect(outbox.pending()[0]!.id).not.toBe(firstId);
  });

  it("ignores markDelivered for unknown id", () => {
    const outbox = createControlPlaneOutbox();
    outbox.enqueue(sampleEvent("evt-1"));
    outbox.markDelivered("outbox-missing");
    expect(outbox.pending()).toHaveLength(1);
  });

  it("replays pending entries and marks them delivered", async () => {
    const outbox = createControlPlaneOutbox();
    outbox.enqueue(sampleEvent("evt-1"));
    outbox.enqueue(sampleEvent("evt-2"));
    const handler = vi.fn(async () => undefined);
    const delivered = await outbox.replayPending(handler);
    expect(delivered).toBe(2);
    expect(handler).toHaveBeenCalledTimes(2);
    expect(outbox.pending()).toHaveLength(0);
  });

  it("skips already delivered entries on replay", async () => {
    const outbox = createControlPlaneOutbox();
    outbox.enqueue(sampleEvent("evt-1"));
    outbox.enqueue(sampleEvent("evt-2"));
    outbox.markDelivered(outbox.pending()[0]!.id);
    const delivered = await outbox.replayPending(async () => undefined);
    expect(delivered).toBe(1);
    expect(outbox.pending()).toHaveLength(0);
  });
});
