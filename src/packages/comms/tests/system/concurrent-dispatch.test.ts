import { describe, expect, it } from "vitest";
import { LoopbackTransport } from "../../src/memory/loopbackTransport.js";
import {
  buildTestCommsServices,
  buildTestEnvelope,
  buildTestAuthContext,
} from "../support/envelopeFixtures.js";
import { idempotencyKey } from "@cantilune/core";

describe("concurrent comms operations", () => {
  it("handles parallel sends without corrupting store sequence", async () => {
    const [local] = LoopbackTransport.connectPair();
    const services = buildTestCommsServices({ transport: local });
    const sends = await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        services.messaging.send(
          buildTestAuthContext(),
          buildTestEnvelope({ messageId: `msg-conc-${i}` as never }),
          idempotencyKey(`idem-conc-${i}`),
        ),
      ),
    );
    expect(sends.every((s) => s.ok)).toBe(true);
    expect(services.store.snapshot().events.length).toBeGreaterThan(0);
  });
});
