import { describe, expect, it } from "vitest";
import { CommsMessagingService } from "../../src/engine/commsMessagingService.js";
import { MemoryCommsStore } from "../../src/memory/memoryCommsStore.js";
import { LoopbackTransport } from "../../src/memory/loopbackTransport.js";
import { buildTestAuthContext, buildTestEnvelope } from "../support/envelopeFixtures.js";
import { idempotencyKey } from "@cantilune/core";

describe("CommsMessagingService direct path", () => {
  it("sends without saga coordinator", async () => {
    const [local] = LoopbackTransport.connectPair();
    const store = new MemoryCommsStore();
    const events: unknown[] = [];
    const service = new CommsMessagingService({
      store,
      transport: local,
      sessionAuthority: { isController: () => true, isMember: () => true },
      eStop: { isFrozen: () => false, setFrozen: () => undefined },
      events: { emit: (e) => events.push(e) },
      clock: { now: () => "2026-08-11T16:00:00Z" },
    });
    const envelope = buildTestEnvelope({ messageId: "msg-direct-001" as never });
    const sent = await service.send(
      buildTestAuthContext(),
      envelope,
      idempotencyKey("idem-direct-001"),
    );
    expect(sent.ok).toBe(true);
    expect(events.some((e) => (e as { kind: string }).kind === "MessageEnqueued")).toBe(true);
  });
});
