import { describe, expect, it } from "vitest";
import { validateOutboundEnvelope } from "../../src/security/envelopePolicy.js";
import { MemoryCommsStore } from "../../src/memory/memoryCommsStore.js";
import { buildTestAuthContext, buildTestEnvelope } from "../support/envelopeFixtures.js";
import { actorRef } from "@cantilune/core";

describe("envelopePolicy contract rejections", () => {
  it("rejects non-member recipient", () => {
    const store = new MemoryCommsStore();
    const envelope = buildTestEnvelope({
      recipient: actorRef("outsider" as never, "agent"),
    });
    const result = validateOutboundEnvelope({
      context: buildTestAuthContext(),
      envelope,
      sessionAuthority: {
        isController: () => true,
        isMember: (_session, actor) => actor.actorId === "human-1",
      },
      bindingResolver: { getActiveBinding: () => undefined },
      store,
      clock: { now: () => "2026-08-11T16:00:00Z" },
    });
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error.code).toBe("session_not_authorized");
  });

  it("rejects expired envelope TTL window", () => {
    const store = new MemoryCommsStore();
    const envelope = buildTestEnvelope({
      issuedAt: "2026-08-11T17:00:00Z",
      expiresAt: "2026-08-11T16:00:00Z",
    });
    const result = validateOutboundEnvelope({
      context: buildTestAuthContext(),
      envelope,
      sessionAuthority: { isController: () => true, isMember: () => true },
      bindingResolver: { getActiveBinding: () => undefined },
      store,
      clock: { now: () => "2026-08-11T16:00:00Z" },
    });
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error.code).toBe("wire_expired");
  });
});
