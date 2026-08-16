/**
 * L6: two agents on the mesh hub exchange a sealed envelope end-to-end.
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  actorId,
  actorRef,
  correlationId,
  epochId,
  epochOrdinal,
  idempotencyKey,
  occurrenceId,
  operationTemplateRef,
  sessionId,
} from "@cantilune/core";
import {
  computeEnvelopeIntegrityDigest,
  messageId,
  channelId,
  parseCommunicationWireFrame,
  sealVerifiedEnvelope,
  type CommunicationEnvelope,
} from "@cantilune/comms";
import { createLoopbackMeshRouter } from "../../../src/cluster/commsIntegration.js";
import { createAgentCommsServices } from "../../../src/cluster/commsRuntimeBridge.js";
import { createSharedResources } from "../../../src/cluster/sharedResources.js";

const dirs: string[] = [];

afterEach(() => {
  for (const dir of dirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function buildEnvelope(from: string, to: string): CommunicationEnvelope {
  const base: Omit<CommunicationEnvelope, "integrityDigest"> = {
    wireVersion: 1 as never,
    registryVersion: 1 as never,
    messageId: messageId(`msg-${from}-${to}`),
    operationCode: "send",
    metadata: {
      epochId: epochId("42"),
      epochOrdinal: epochOrdinal(1),
      operationTemplateRef: operationTemplateRef("send", "1"),
      sessionId: sessionId("session-hub-001"),
      correlationId: correlationId("corr-hub-001"),
      occurrenceId: occurrenceId("occ-hub-001"),
      idempotencyKey: idempotencyKey("idem-hub-001"),
    },
    sender: actorRef(actorId(from), "agent"),
    recipient: actorRef(actorId(to), "agent"),
    channelId: channelId("ch-hub"),
    channelGeneration: 1 as never,
    sequence: 1,
    payload: {
      contentRef: "content://hub" as never,
      contentDigest: "digest-hub" as never,
      mediaType: "application/json",
      byteLength: 4,
      classification: "internal",
    },
    ackMode: "durablyAccepted",
    issuedAt: "2026-08-11T16:00:00Z",
    expiresAt: "2099-01-01T00:00:00Z",
  };
  return { ...base, integrityDigest: computeEnvelopeIntegrityDigest(base) };
}

describe("mesh hub + CommsServices L6", () => {
  it("two agents exchange an envelope through the hub and production services", async () => {
    const dir = mkdtempSync(join(tmpdir(), "hub-comms-"));
    dirs.push(dir);

    const router = createLoopbackMeshRouter();
    const shared = createSharedResources({
      runtime: {
        getHead: () => ({
          sessions: new Map(),
          participants: new Map(),
          snapshotRef: "snap:t0",
        }),
        observe: () => ({
          snapshot: { snapshotRef: "snap:obs", auditTail: [{ payloadRef: "p" }] },
        }),
        changes: () => [],
        proposeAndCommit: () => ({ ok: true }),
      } as never,
      contentStore: {} as never,
      storagePath: dir,
      meshTransport: router,
    });

    const transportA = router.allocate(actorId("agent-a"));
    const transportB = router.allocate(actorId("agent-b"));
    const servicesA = createAgentCommsServices({
      shared,
      agentId: actorId("agent-a"),
      transport: transportA,
    });
    const servicesB = createAgentCommsServices({
      shared,
      agentId: actorId("agent-b"),
      transport: transportB,
    });

    expect(servicesA.services.transport.transportId).toBe("mesh-hub");
    expect(servicesB.services.transport.transportId).toBe("mesh-hub");

    const verified = sealVerifiedEnvelope({
      envelope: buildEnvelope("agent-a", "agent-b"),
      verifiedAt: "2026-08-11T16:00:00Z",
    });
    const sent = await servicesA.services.transport.dispatch(verified);
    expect(sent.ok).toBe(true);

    const received = await servicesB.services.transport.receive();
    expect(received.ok).toBe(true);
    if (!received.ok) return;
    const parsed = parseCommunicationWireFrame(received.value);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.sender.actorId).toBe("agent-a");
    expect(parsed.value.recipient.actorId).toBe("agent-b");

    servicesA.stop();
    servicesB.stop();
    router.deallocate(actorId("agent-a"));
    router.deallocate(actorId("agent-b"));
  });
});
