import { afterEach, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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
  COMMS_HMAC_KEY_ENV,
  computeEnvelopeIntegrityDigest,
  createHmacBindingMaterial,
  encodeCommunicationWireFrame,
  messageId,
  channelId,
} from "@cantilune/comms";
import { createLoopbackMeshRouter } from "../../../src/cluster/commsIntegration.js";
import { createAgentCommsServices } from "../../../src/cluster/commsRuntimeBridge.js";
import { commsStorePath, createSharedResources } from "../../../src/cluster/sharedResources.js";

const dirs: string[] = [];

afterEach(() => {
  for (const dir of dirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function shared(
  dir: string,
  sessions: ReadonlyMap<
    string,
    { controller: string; participants: readonly string[] }
  > = new Map(),
) {
  const router = createLoopbackMeshRouter();
  return {
    router,
    resources: createSharedResources({
      runtime: {
        getHead: () => ({ sessions, participants: new Map(), snapshotRef: "snap:t0" }),
        observe: () => ({
          snapshot: { snapshotRef: "snap:obs", auditTail: [{ payloadRef: "p" }] },
        }),
        changes: () => [],
        proposeAndCommit: () => ({ ok: true }),
      } as never,
      contentStore: {} as never,
      storagePath: dir,
      meshTransport: router,
    }),
  };
}

function unsignedFrame() {
  const base = {
    wireVersion: 1 as never,
    registryVersion: 1 as never,
    messageId: messageId("msg-boot-id"),
    operationCode: "send" as const,
    metadata: {
      epochId: epochId("42"),
      epochOrdinal: epochOrdinal(1),
      operationTemplateRef: operationTemplateRef("send", "1"),
      sessionId: sessionId("session-boot-id"),
      correlationId: correlationId("corr-boot-id"),
      occurrenceId: occurrenceId("occ-boot-id"),
      idempotencyKey: idempotencyKey("idem-boot-id"),
    },
    sender: actorRef(actorId("human-1"), "human"),
    recipient: actorRef(actorId("agent-a"), "agent"),
    channelId: channelId("ch-boot-id"),
    channelGeneration: 1 as never,
    sequence: 1,
    payload: {
      contentRef: "content://boot" as never,
      contentDigest: "digest-boot" as never,
      mediaType: "application/json",
      byteLength: 4,
      classification: "internal" as const,
    },
    ackMode: "durablyAccepted" as const,
    issuedAt: "2026-08-11T16:00:00Z",
    expiresAt: "2099-01-01T00:00:00Z",
  };
  return encodeCommunicationWireFrame({
    ...base,
    integrityDigest: computeEnvelopeIntegrityDigest(base),
  });
}

const descriptor = {
  descriptorRef: "desc-boot" as never,
  digest: "digest-desc" as never,
  runtimeInstanceId: "rt-boot" as never,
  activationDomainId: "default" as never,
  actors: [actorRef(actorId("human-1"), "human")],
  endpoints: [],
  supportedWireVersions: [1 as never],
  supportedTransports: ["loopback"],
  supportedFeatures: [],
  supportedOperations: ["send" as const],
  schemaBinding: { schemaId: "default-v1", revisionId: "rev-001", digest: "abc" as never } as never,
  issuedAt: "2026-08-11T16:00:00Z",
  expiresAt: "2099-01-01T00:00:00Z",
  evidenceRefs: [],
  provenance: "test",
};

function ingressContext(channelBindingMaterial: string) {
  return {
    transport: "loopback",
    tlsVerified: true,
    peerDescriptor: descriptor,
    credentialRef: "cred",
    channelBindingMaterial,
  } as never;
}

const previousHmac = process.env[COMMS_HMAC_KEY_ENV];
afterEach(() => {
  if (previousHmac === undefined) {
    delete process.env[COMMS_HMAC_KEY_ENV];
  } else {
    process.env[COMMS_HMAC_KEY_ENV] = previousHmac;
  }
});

describe("createAgentCommsServices identity composition", () => {
  it("keeps ActorId pinning when no HMAC key is present", async () => {
    delete process.env[COMMS_HMAC_KEY_ENV];
    const dir = mkdtempSync(join(tmpdir(), "boot-comms-actor-"));
    dirs.push(dir);
    const { router, resources } = shared(dir);
    const handle = createAgentCommsServices({
      shared: resources,
      agentId: actorId("agent-a"),
      transport: router.allocate(actorId("agent-a")),
    });
    const result = await handle.services.ingress.acceptInboundFrame(
      unsignedFrame(),
      ingressContext("unsigned"),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).not.toBe("identity_unverified");
    }
    handle.stop();
  });

  it("requires HMAC when hmac.key is present under the agent store", async () => {
    delete process.env[COMMS_HMAC_KEY_ENV];
    const dir = mkdtempSync(join(tmpdir(), "boot-comms-hmac-"));
    dirs.push(dir);
    const { router, resources } = shared(dir);
    const agent = actorId("agent-hmac");
    const storeDir = commsStorePath(resources, agent);
    mkdirSync(storeDir, { recursive: true });
    writeFileSync(join(storeDir, "hmac.key"), "boot-hmac-secret", "utf8");

    const handle = createAgentCommsServices({
      shared: resources,
      agentId: agent,
      transport: router.allocate(agent),
    });
    const bytes = unsignedFrame();
    const unsigned = await handle.services.ingress.acceptInboundFrame(
      bytes,
      ingressContext("unsigned"),
    );
    expect(unsigned.ok).toBe(false);
    if (!unsigned.ok) {
      expect(unsigned.error.code).toBe("identity_unverified");
    }

    const issuedAt = new Date().toISOString();
    const signed = await handle.services.ingress.acceptInboundFrame(
      bytes,
      ingressContext(
        createHmacBindingMaterial(
          "boot-hmac-secret",
          descriptor.descriptorRef as string,
          "nonce",
          issuedAt,
        ),
      ),
    );
    expect(signed.ok).toBe(false);
    if (!signed.ok) {
      expect(signed.error.code).not.toBe("identity_unverified");
    }
    handle.stop();
  });

  it("evaluates session membership and quiescence on the production handle", async () => {
    delete process.env[COMMS_HMAC_KEY_ENV];
    const dir = mkdtempSync(join(tmpdir(), "boot-comms-session-"));
    dirs.push(dir);
    const sessions = new Map([
      ["session-boot-id", { controller: "agent-ctrl", participants: ["human-1", "agent-a"] }],
    ]);
    const { router, resources } = shared(dir, sessions);
    const handle = createAgentCommsServices({
      shared: resources,
      agentId: actorId("agent-a"),
      transport: router.allocate(actorId("agent-a")),
    });
    const accepted = await handle.services.ingress.acceptInboundFrame(
      unsignedFrame(),
      ingressContext("unsigned"),
    );
    expect(accepted.ok).toBe(true);

    const closed = await handle.services.close.complete({
      planId: "close-boot" as never,
      sessionId: sessionId("session-boot-id"),
      channelId: channelId("ch-boot-id"),
      channelGeneration: 1 as never,
      sendBarrierApplied: true,
      pendingOutbox: 0,
      pendingInbox: 0,
      pendingInflight: 0,
      peerShutdownAckRef: "ack",
      authorizationRef: "auth",
      expiresAt: "2099-01-01T00:00:00Z",
    });
    expect(closed.ok).toBe(true);
    handle.stop();
  });
});
