import {
  correlationId,
  epochId,
  epochOrdinal,
  idempotencyKey,
  occurrenceId,
  schemaAdmissionId,
  sessionId,
  type SchemaAdmissionReceipt,
} from "@cantilune/core";
import { channelGeneration, channelId, descriptorRef, wireVersion } from "../../src/foundation/messageId.js";
import type { SessionTransportBinding } from "../../src/session/sessionTransportBinding.js";
import type { A2AAgentCard } from "../../src/index.js";
import type { PeerEndpoint } from "../../src/peer/peerDescriptor.js";

export const A2A_V1_HEADERS = { "A2A-Version": "1.0" } as const;

export function sampleA2AAgentCard(overrides: Partial<A2AAgentCard> = {}): A2AAgentCard {
  return {
    name: "GeoSpatial Route Planner Agent",
    description:
      "Provides advanced route planning, traffic analysis, and custom map generation services.",
    supportedInterfaces: [
      {
        url: "https://georoute-agent.example.com/a2a/v1",
        protocolBinding: "JSONRPC",
        protocolVersion: "1.0",
      },
      {
        url: "https://georoute-agent.example.com/a2a/grpc",
        protocolBinding: "GRPC",
        protocolVersion: "1.0",
      },
      {
        url: "https://georoute-agent.example.com/a2a/json",
        protocolBinding: "HTTP+JSON",
        protocolVersion: "1.0",
      },
    ],
    provider: {
      organization: "Example Geo Services Inc.",
      url: "https://www.examplegeoservices.com",
    },
    iconUrl: "https://georoute-agent.example.com/icon.png",
    version: "1.2.0",
    documentationUrl: "https://docs.examplegeoservices.com/georoute-agent/api",
    capabilities: {
      streaming: true,
      pushNotifications: true,
      extendedAgentCard: true,
    },
    securitySchemes: {
      google: {
        openIdConnectSecurityScheme: {
          openIdConnectUrl: "https://accounts.google.com/.well-known/openid-configuration",
        },
      },
    },
    securityRequirements: [{ schemes: { google: { list: ["openid", "profile", "email"] } } }],
    defaultInputModes: ["application/json", "text/plain"],
    defaultOutputModes: ["application/json", "image/png"],
    skills: [
      {
        id: "route-optimizer-traffic",
        name: "Traffic-Aware Route Optimizer",
        description: "Calculates the optimal driving route between two or more locations.",
        tags: ["maps", "routing", "navigation"],
        examples: ["Plan a route from Mountain View to SFO."],
        inputModes: ["application/json", "text/plain"],
        outputModes: ["application/json"],
      },
    ],
    signatures: [
      {
        protected: "eyJhbGciOiJFUzI1NiJ9",
        signature: "QFdkNLNszlGj3z3u0YQGt_T9LixY3qtdQpZmsTdDHDe3fXV9y9-B3m2-XgCpzuhiLt8E0tV6HXoZKHv4GtHgKQ",
      },
    ],
    ...overrides,
  };
}

export function sequentialA2AIds() {
  const counters = { task: 0, context: 0, config: 0, artifact: 0 };
  return {
    next(kind: "task" | "context" | "config" | "artifact"): string {
      counters[kind] += 1;
      return `${kind}-${counters[kind]}`;
    },
  };
}

export function testSessionBinding(): SessionTransportBinding {
  return {
    sessionId: sessionId("session-a2a-1"),
    authoritativeSnapshotRef: "snap-1" as never,
    localRuntimeInstanceId: "rt-local" as never,
    remoteRuntimeInstanceId: "rt-remote" as never,
    channelId: channelId("ch-a2a-1"),
    channelGeneration: channelGeneration(1),
    localEndpoint: descriptorRef("endpoint-local"),
    remoteEndpoint: descriptorRef("endpoint-remote"),
    negotiated: {
      wireVersion: wireVersion(1),
      transport: "a2a",
      codecRef: "comms/wire-v1",
      protocolVersion: "comms/1",
      a2aProfile: "a2a/1.0",
      features: [],
    },
    schemaEpochId: "epoch-1",
    status: "active",
    outboundSequence: 0,
    inboundSequence: 0,
    establishedAt: "2026-08-15T00:00:00Z",
    updatedAt: "2026-08-15T00:00:00Z",
  };
}

export function testPeerEndpoint(): PeerEndpoint {
  return {
    endpointRef: descriptorRef("endpoint-local"),
    transport: "a2a",
    uri: "https://agent.example.com/a2a/v1",
    wireVersions: [wireVersion(1)],
    maxFrameBytes: 1_048_576,
  };
}

export function mobilityReceipt(
  overrides: Partial<SchemaAdmissionReceipt> = {},
): SchemaAdmissionReceipt {
  const binding = {
    activationDomainId: "default" as never,
    bindingGeneration: 1 as never,
    epochId: epochId("42"),
    epochOrdinal: epochOrdinal(1),
    schemaRef: { schemaId: "s", revisionId: "r", digest: "d" as never } as never,
    policyRef: { policyId: "p", revisionId: "1", digest: "d" as never } as never,
    handlerManifestRef: { manifestId: "m", digest: "d" as never } as never,
    runtimeHead: "snap" as never,
    admissionId: schemaAdmissionId("adm-mob"),
    activatedBy: "operator",
    activatedAt: "2026-08-15T00:00:00Z",
  };
  return {
    admissionId: schemaAdmissionId("adm-mob"),
    activationDomainId: "default" as never,
    fromBinding: binding,
    toBinding: binding,
    beforeSnapshotRef: "snap-0" as never,
    afterSnapshotRef: "snap-1" as never,
    extensionPlanRef: "plan",
    admissionTombstoneId: "tomb" as never,
    committedBy: "operator",
    committedAt: "2026-08-15T00:00:00Z",
    storeSequence: 1 as never,
    correlationId: correlationId("corr-mob"),
    occurrenceId: occurrenceId("occ-mob"),
    idempotencyKey: idempotencyKey("idem-mob"),
    planDigest: "pd" as never,
    authorizationEvidenceRef: "auth-mob",
    ...overrides,
  };
}

export function userTextMessage(text: string, extras: { taskId?: string; contextId?: string } = {}) {
  return {
    messageId: "msg-user-1",
    role: "ROLE_USER" as const,
    parts: [{ text, mediaType: "text/plain" as const }],
    ...extras,
  };
}
