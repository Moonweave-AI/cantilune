import { describe, expect, it } from "vitest";
import { CommsSessionService } from "../../src/engine/commsSessionService.js";
import { MemoryCommsStore } from "../../src/memory/memoryCommsStore.js";
import { buildTestAuthContext } from "../support/envelopeFixtures.js";
import {
  sessionId,
  operationTemplateRef,
  correlationId,
  occurrenceId,
  epochId,
  epochOrdinal,
} from "@cantilune/core";
import { channelGeneration, channelId } from "../../src/foundation/messageId.js";

describe("CommsSessionService", () => {
  const sessionAuthority = { isController: () => true, isMember: () => true };
  const clock = { now: () => "2026-08-11T16:00:00Z" };

  it("stores handshake when authorized", () => {
    const store = new MemoryCommsStore();
    const service = new CommsSessionService({
      store,
      sessionAuthority,
      eStop: { isFrozen: () => false, setFrozen: () => undefined },
      clock,
    });
    const sid = sessionId("session-svc-001");
    const result = service.requestSession(buildTestAuthContext(), {
      sessionId: sid,
      authoritativeSnapshotRef: "snap-1" as never,
      requester: "rt-req" as never,
      acceptor: "rt-acc" as never,
      offeredProtocols: [],
      endpointRef: "ep-1" as never,
      transcriptDigest: "digest",
      authEvidenceRef: "auth",
      metadata: {
        epochId: epochId("42"),
        epochOrdinal: epochOrdinal(1),
        operationTemplateRef: operationTemplateRef("introduce", "1"),
        sessionId: sid,
        correlationId: correlationId("corr-1"),
        occurrenceId: occurrenceId("occ-1"),
      },
      expiresAt: "2099-01-01T00:00:00Z",
    });
    expect(result.ok).toBe(true);
  });

  it("accepts session binding via CAS", () => {
    const store = new MemoryCommsStore();
    const service = new CommsSessionService({
      store,
      sessionAuthority,
      eStop: { isFrozen: () => false, setFrozen: () => undefined },
      clock,
    });
    const sid = sessionId("session-bind-001");
    const binding = {
      sessionId: sid,
      authoritativeSnapshotRef: "snap-1" as never,
      localRuntimeInstanceId: "rt-local" as never,
      remoteRuntimeInstanceId: "rt-remote" as never,
      channelId: channelId("ch-bind"),
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
      status: "active" as const,
      outboundSequence: 0,
      inboundSequence: 0,
      establishedAt: clock.now(),
      updatedAt: clock.now(),
    };
    const accepted = service.acceptSession(binding);
    expect(accepted.ok).toBe(true);
    expect(service.getBinding(sid)?.channelId).toBe(binding.channelId);
  });

  it("rejects duplicate session binding", () => {
    const store = new MemoryCommsStore();
    const service = new CommsSessionService({
      store,
      sessionAuthority,
      eStop: { isFrozen: () => false, setFrozen: () => undefined },
      clock,
    });
    const sid = sessionId("session-dup-001");
    const binding = {
      sessionId: sid,
      authoritativeSnapshotRef: "snap-1" as never,
      localRuntimeInstanceId: "rt-local" as never,
      remoteRuntimeInstanceId: "rt-remote" as never,
      channelId: channelId("ch-dup"),
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
      status: "active" as const,
      outboundSequence: 0,
      inboundSequence: 0,
      establishedAt: clock.now(),
      updatedAt: clock.now(),
    };
    service.acceptSession(binding);
    const second = service.acceptSession(binding);
    expect(second.ok).toBe(false);
  });
});
