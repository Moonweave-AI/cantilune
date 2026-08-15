import { describe, expect, it } from "vitest";
import { CommsMobilityService } from "../../src/engine/commsMobilityService.js";
import { CommsSessionService } from "../../src/engine/commsSessionService.js";
import { MemoryCommsStore } from "../../src/memory/memoryCommsStore.js";
import { buildTestAuthContext } from "../support/envelopeFixtures.js";
import {
  contentRef,
  correlationId,
  epochId,
  epochOrdinal,
  evidenceId,
  evidenceRef,
  occurrenceId,
  operationTemplateRef,
  sessionId,
} from "@cantilune/core";

describe("engine service frozen paths", () => {
  const frozenEStop = { isFrozen: () => true, setFrozen: () => undefined };
  const clock = { now: () => "2026-08-11T16:00:00Z" };

  it("CommsMobilityService rejects when frozen", () => {
    const service = new CommsMobilityService({
      store: new MemoryCommsStore(),
      allocator: { allocate: () => ({ ok: true, value: {} as never }) },
      sessionAuthority: { isController: () => true, isMember: () => true },
      eStop: frozenEStop,
      clock,
    });
    const sid = sessionId("session-mob-frozen");
    const result = service.delegate(buildTestAuthContext(), {
      oldEndpointRef: "ep-old" as never,
      newEndpointRef: "ep-new" as never,
      oldChannelId: "ch-old" as never,
      newChannelId: "ch-new" as never,
      channelGeneration: 1 as never,
      delegator: buildTestAuthContext().peer.principal,
      delegatee: buildTestAuthContext().peer.principal,
      authorizationRef: evidenceRef(evidenceId("auth"), "approval", contentRef("content://auth")),
      oneTimeCapabilityRef: evidenceRef(evidenceId("cap"), "approval", contentRef("content://cap")),
      metadata: {
        epochId: epochId("42"),
        epochOrdinal: epochOrdinal(1),
        operationTemplateRef: operationTemplateRef("delegate", "1"),
        sessionId: sid,
        correlationId: correlationId("corr"),
        occurrenceId: occurrenceId("occ"),
      },
      planDigest: "digest",
      expiresAt: "2099-01-01T00:00:00Z",
    });
    expect(result.ok).toBe(false);
  });

  it("CommsSessionService rejects when frozen", () => {
    const service = new CommsSessionService({
      store: new MemoryCommsStore(),
      sessionAuthority: { isController: () => true, isMember: () => true },
      eStop: frozenEStop,
      clock,
    });
    const result = service.requestSession(buildTestAuthContext(), {
      sessionId: sessionId("session-frozen"),
      authoritativeSnapshotRef: "snap" as never,
      requester: "rt-req" as never,
      acceptor: "rt-acc" as never,
      offeredProtocols: [],
      endpointRef: "ep" as never,
      transcriptDigest: "digest",
      authEvidenceRef: "auth",
      metadata: {
        epochId: epochId("42"),
        epochOrdinal: epochOrdinal(1),
        operationTemplateRef: operationTemplateRef("introduce", "1"),
        sessionId: sessionId("session-frozen"),
        correlationId: correlationId("corr"),
        occurrenceId: occurrenceId("occ"),
      },
      expiresAt: "2099-01-01T00:00:00Z",
    });
    expect(result.ok).toBe(false);
  });
});
