import { describe, expect, it } from "vitest";
import { validateOutboundEnvelope } from "../../src/security/envelopePolicy.js";
import { MemoryCommsStore } from "../../src/memory/memoryCommsStore.js";
import { buildTestAuthContext, buildTestEnvelope } from "../support/envelopeFixtures.js";
import { epochId, epochOrdinal, sessionId } from "@cantilune/core";
import { channelGeneration, channelId } from "../../src/foundation/messageId.js";

const baseDeps = (store: MemoryCommsStore, overrides: Record<string, unknown> = {}) => ({
  context: buildTestAuthContext(),
  envelope: buildTestEnvelope(),
  sessionAuthority: { isController: () => true, isMember: () => true },
  bindingResolver: { getActiveBinding: () => undefined },
  store,
  clock: { now: () => "2026-08-11T16:00:00Z" },
  ...overrides,
});

describe("envelopePolicy branches", () => {
  it("rejects recipient not session member", () => {
    const store = new MemoryCommsStore();
    const result = validateOutboundEnvelope(
      baseDeps(store, {
        sessionAuthority: {
          isController: () => true,
          isMember: (_sid: unknown, actor: { actorId: string }) => actor.actorId !== "agent-1",
        },
      }),
    );
    expect(result.ok).toBe(false);
  });

  it("rejects sender not session member", () => {
    const store = new MemoryCommsStore();
    const result = validateOutboundEnvelope(
      baseDeps(store, {
        sessionAuthority: {
          isController: () => true,
          isMember: (_sid: unknown, actor: { actorId: string }) => actor.actorId === "agent-1",
        },
      }),
    );
    expect(result.ok).toBe(false);
  });

  it("rejects stale epochId from active binding", () => {
    const store = new MemoryCommsStore();
    const envelope = buildTestEnvelope({
      metadata: { ...buildTestEnvelope().metadata, epochId: epochId("99") },
    });
    const result = validateOutboundEnvelope(
      baseDeps(store, {
        envelope,
        bindingResolver: {
          getActiveBinding: () => ({
            epochId: epochId("42"),
            epochOrdinal: epochOrdinal(1),
          }),
        },
      }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error.code).toBe("stale_binding");
  });

  it("rejects channelId mismatch", () => {
    const store = new MemoryCommsStore();
    const sid = sessionId("session-ch-mismatch");
    store.casSessionBinding({
      sessionId: sid,
      expectedGeneration: channelGeneration(0),
      next: {
        sessionId: sid,
        authoritativeSnapshotRef: "snap" as never,
        localRuntimeInstanceId: "rt-local" as never,
        remoteRuntimeInstanceId: "rt-remote" as never,
        channelId: channelId("ch-other"),
        channelGeneration: channelGeneration(1),
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
      metadata: { ...buildTestEnvelope().metadata, sessionId: sid },
      channelId: channelId("ch-bound"),
    });
    const result = validateOutboundEnvelope(baseDeps(store, { envelope }));
    expect(result.ok).toBe(false);
  });

  it("rejects expired envelope", () => {
    const store = new MemoryCommsStore();
    const envelope = buildTestEnvelope({
      issuedAt: "2020-01-01T00:00:00Z",
      expiresAt: "2020-01-02T00:00:00Z",
    });
    const result = validateOutboundEnvelope(
      baseDeps(store, {
        envelope,
        clock: { now: () => "2026-08-11T16:00:00Z" },
      }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error.code).toBe("wire_expired");
  });

  it("rejects invalid TTL window", () => {
    const store = new MemoryCommsStore();
    const envelope = buildTestEnvelope({
      issuedAt: "2099-01-02T00:00:00Z",
      expiresAt: "2099-01-01T00:00:00Z",
    });
    const result = validateOutboundEnvelope(baseDeps(store, { envelope }));
    expect(result.ok).toBe(false);
  });

  it("rejects non-positive sequence", () => {
    const store = new MemoryCommsStore();
    const envelope = buildTestEnvelope({ sequence: 0 });
    const result = validateOutboundEnvelope(baseDeps(store, { envelope }));
    expect(result.ok).toBe(false);
  });

  it("rejects stale epochOrdinal from active binding", () => {
    const store = new MemoryCommsStore();
    const envelope = buildTestEnvelope();
    const result = validateOutboundEnvelope(
      baseDeps(store, {
        envelope,
        bindingResolver: {
          getActiveBinding: () => ({
            epochId: envelope.metadata.epochId,
            epochOrdinal: epochOrdinal(99),
          }),
        },
      }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error.code).toBe("stale_binding");
  });
});
