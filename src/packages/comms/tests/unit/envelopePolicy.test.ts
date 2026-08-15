import { describe, expect, it } from "vitest";
import { validateOutboundEnvelope } from "../../src/security/envelopePolicy.js";
import { MemoryCommsStore } from "../../src/memory/memoryCommsStore.js";
import { buildTestAuthContext, buildTestEnvelope } from "../support/envelopeFixtures.js";
import { actorRef, sessionId } from "@cantilune/core";
import { channelGeneration, channelId } from "../../src/foundation/messageId.js";

describe("envelopePolicy", () => {
  it("accepts valid outbound envelope", () => {
    const store = new MemoryCommsStore();
    const envelope = buildTestEnvelope();
    const result = validateOutboundEnvelope({
      context: buildTestAuthContext(),
      envelope,
      sessionAuthority: { isController: () => true, isMember: () => true },
      bindingResolver: { getActiveBinding: () => undefined },
      store,
      clock: { now: () => "2026-08-11T16:00:00Z" },
    });
    expect(result.ok).toBe(true);
  });

  it("rejects sender mismatch", () => {
    const store = new MemoryCommsStore();
    const envelope = buildTestEnvelope({
      sender: actorRef("other" as never, "human"),
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
  });

  it("rejects stale channel generation when session binding exists", () => {
    const store = new MemoryCommsStore();
    const sid = sessionId("session-bound-001");
    store.casSessionBinding({
      sessionId: sid,
      expectedGeneration: channelGeneration(0),
      next: {
        sessionId: sid,
        authoritativeSnapshotRef: "snap-1" as never,
        localRuntimeInstanceId: "rt-local" as never,
        remoteRuntimeInstanceId: "rt-remote" as never,
        channelId: channelId("ch-bound"),
        channelGeneration: channelGeneration(2),
        localEndpoint: "ep-local" as never,
        remoteEndpoint: "ep-remote" as never,
        negotiated: {
          wireVersion: 1 as never,
          transport: "loopback",
          codecRef: "comms/wire-v1",
          protocolVersion: "comms/1",
          a2aProfile: "a2a/0.1",
          features: [],
        },
        schemaEpochId: "42",
        status: "active",
        outboundSequence: 0,
        inboundSequence: 0,
        establishedAt: "2026-08-11T16:00:00Z",
        updatedAt: "2026-08-11T16:00:00Z",
      },
    });
    const envelope = buildTestEnvelope({
      metadata: {
        ...buildTestEnvelope().metadata,
        sessionId: sid,
      },
      channelId: channelId("ch-bound"),
      channelGeneration: channelGeneration(1),
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
    expect(result.error.code).toBe("stale_binding");
  });
});
