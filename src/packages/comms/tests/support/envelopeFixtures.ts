import {
  actorRef,
  correlationId,
  epochId,
  epochOrdinal,
  idempotencyKey,
  occurrenceId,
  operationTemplateRef,
  sessionId,
} from "@cantilune/core";
import type { CommunicationEnvelope } from "../../src/envelope/communicationEnvelope.js";
import {
  channelGeneration,
  channelId,
  messageId,
  type DescriptorRef,
} from "../../src/foundation/messageId.js";
import type { PeerDirectory } from "../../src/ports/communicationTransport.js";
import { computeEnvelopeIntegrityDigest } from "../../src/codec/strictWireCodec.js";
import type { AuthenticatedCommsContext } from "../../src/peer/authenticatedPeerContext.js";
import { sealTestAuthContext } from "./commsTestHelpers.js";
import type { PeerDescriptor } from "../../src/peer/peerDescriptor.js";
import { createCommsServices, type CommsServices } from "../../src/engine/createCommsServices.js";

export function buildTestEnvelope(
  overrides: Partial<Omit<CommunicationEnvelope, "integrityDigest">> = {},
): CommunicationEnvelope {
  const actor = actorRef("human-1" as never, "human");
  const base: Omit<CommunicationEnvelope, "integrityDigest"> = {
    wireVersion: 1 as never,
    registryVersion: 1 as never,
    messageId: messageId("msg-test-001"),
    operationCode: "send",
    metadata: {
      epochId: epochId("42"),
      epochOrdinal: epochOrdinal(1),
      operationTemplateRef: operationTemplateRef("send", "1"),
      sessionId: sessionId("session-test-001"),
      correlationId: correlationId("corr-test-001"),
      occurrenceId: occurrenceId("occ-test-001"),
      idempotencyKey: idempotencyKey("idem-test-001"),
    },
    sender: actor,
    recipient: actorRef("agent-1" as never, "agent"),
    channelId: channelId("ch-test-001"),
    channelGeneration: channelGeneration(1),
    sequence: 1,
    payload: {
      contentRef: "content://test" as never,
      contentDigest: "digest-abc" as never,
      mediaType: "application/json",
      byteLength: 10,
      classification: "internal",
    },
    ackMode: "durablyAccepted",
    issuedAt: "2026-08-11T16:00:00Z",
    expiresAt: "2099-01-01T00:00:00Z",
    ...overrides,
  };
  return { ...base, integrityDigest: computeEnvelopeIntegrityDigest(base) };
}

export function buildTestAuthContext(
  principal = actorRef("human-1" as never, "human"),
): AuthenticatedCommsContext {
  return sealTestAuthContext({
    peer: {
      runtimeInstanceId: "rt-test-001" as never,
      principal,
      descriptorRef: "desc-test-001" as never,
      descriptorDigest: "digest-desc",
      authenticationMethod: "test",
      channelBindingDigest: "binding-digest",
      evidenceRef: "evidence-001",
      authenticatedAt: "2026-08-11T16:00:00Z",
      expiresAt: "2099-01-01T00:00:00Z",
    },
    roles: ["session-member"],
  });
}

export function buildTestPeerDescriptor(overrides: Partial<PeerDescriptor> = {}): PeerDescriptor {
  return {
    descriptorRef: "desc-test-001" as never,
    digest: "digest-desc" as never,
    runtimeInstanceId: "rt-test-001" as never,
    activationDomainId: "default" as never,
    actors: [actorRef("human-1" as never, "human")],
    endpoints: [
      {
        endpointRef: "endpoint-001" as never,
        transport: "loopback",
        uri: "loopback://local",
        wireVersions: [1 as never],
        maxFrameBytes: 65536,
      },
    ],
    supportedWireVersions: [1 as never],
    supportedTransports: ["loopback"],
    supportedFeatures: [],
    supportedOperations: ["send"],
    schemaBinding: {
      schemaId: "default-v1",
      revisionId: "rev-001",
      digest: "abc" as never,
    } as never,
    issuedAt: "2026-08-11T16:00:00Z",
    expiresAt: "2099-01-01T00:00:00Z",
    evidenceRefs: [],
    provenance: "test",
    ...overrides,
  };
}

export const defaultTestQuiescence = {
  resourcesClear: async () => true,
  sessionsQuiescent: async () => true,
};

export const defaultTestSessionAuthority = {
  isController: () => true,
  isMember: () => true,
};

export function stubPeerDirectory(
  resolveImpl?: (ref: DescriptorRef) => Promise<PeerDescriptor | undefined>,
): PeerDirectory {
  return {
    resolve: resolveImpl ?? (async () => undefined),
    register: () => undefined,
    getPinnedFingerprints: () => [],
    setPinnedFingerprints: () => undefined,
  };
}

export function buildTestCommsServices(options?: {
  readonly transport?: CommsServices["transport"];
  readonly clock?: { now(): string };
}): CommsServices {
  return createCommsServices({
    mode: "test",
    bindingResolver: { getActiveBinding: () => undefined },
    sessionAuthority: defaultTestSessionAuthority,
    quiescence: defaultTestQuiescence,
    clock: options?.clock ?? { now: () => "2026-08-11T16:00:00Z" },
    ...(options?.transport !== undefined ? { transport: options.transport } : {}),
  });
}
