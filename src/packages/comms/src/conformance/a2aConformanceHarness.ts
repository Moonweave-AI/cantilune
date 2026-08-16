/**
 * Pinned a2a/0.1 conformance harness (ADR-0018 T4).
 *
 * Parameterized over a transport-pair factory so Loopback, FileTransport, and
 * NetTransport share one CI gate: wire-v1 strict codec, 15-family / 60-code
 * registry coverage, admission-bound reconnect sequencing, and E-Stop on
 * send / receive / handshake. The harness does not authorize a public A2A
 * interoperability claim — that still requires an independent Security review.
 */
import {
  actorRef,
  correlationId,
  epochId,
  epochOrdinal,
  idempotencyKey,
  occurrenceId,
  operationTemplateRef,
  schemaAdmissionId,
  sessionId,
  type Result,
} from "@cantilune/core";
import type { CommunicationTransport } from "../ports/communicationTransport.js";
import type { EStopGate } from "../security/identityVerifier.js";
import { sealVerifiedEnvelope } from "../security/commsCapability.js";
import {
  computeEnvelopeIntegrityDigest,
  encodeCommunicationWireFrame,
  parseCommunicationWireFrame,
  verifyEnvelopeIntegrityDigest,
} from "../codec/strictWireCodec.js";
import {
  ALL_OPERATION_CODES,
  deriveOperationFamily,
  type CommunicationOperationCode,
} from "../protocol/communicationOperationRegistry.js";
import {
  A2A_PROFILE_PINNED,
  COMMS_REGISTRY_VERSION_V1,
  COMMS_WIRE_VERSION_V1,
} from "../foundation/commsLimits.js";
import { A2ATransportAdapter } from "../transports/a2a/a2aTransportAdapter.js";
import { decodeA2AFrame } from "../transports/a2a/a2aCodec.js";
import type { CommsViolation } from "../foundation/commsViolation.js";
import {
  buildReconnectPlanFromReceipt,
  createCommsServices,
  executeAdmissionReconnect,
} from "../engine/createCommsServices.js";
import { channelGeneration, channelId, messageId } from "../foundation/messageId.js";
import type { AdmissionReconnectPlan } from "../reconnect/admissionReconnectPlan.js";
import type { CommsStore } from "../ports/commsStore.js";
import type { CommunicationEnvelope } from "../envelope/communicationEnvelope.js";
import type { SessionHandshake } from "../session/sessionTransportBinding.js";

export interface RawFrameTransport {
  sendRawFrame(bytes: Uint8Array): Promise<Result<void, CommsViolation>>;
}

export interface ClosableTransport {
  close(): Promise<void>;
}

export interface A2AConformancePair {
  readonly local: CommunicationTransport;
  readonly remote: CommunicationTransport;
  readonly eStopGate?: EStopGate;
  close?(): Promise<void>;
}

export interface A2AConformancePairOptions {
  readonly eStopGate?: EStopGate;
}

export interface A2AConformanceHarnessInput {
  readonly transportId: string;
  readonly createPair: (
    options?: A2AConformancePairOptions,
  ) => A2AConformancePair | Promise<A2AConformancePair>;
}

export interface A2AConformanceCaseResult {
  readonly id: string;
  readonly passed: boolean;
  readonly detail?: string;
}

export interface A2AConformanceReport {
  readonly profile: typeof A2A_PROFILE_PINNED;
  readonly transportId: string;
  readonly results: readonly A2AConformanceCaseResult[];
  readonly passed: boolean;
}

const CASE_IDS = [
  "profile-pin",
  "wire-versions",
  "integrity-digest",
  "unknown-field-rejected",
  "registry-60-codes",
  "registry-15-families",
  "e-stop-dispatch",
  "e-stop-receive",
  "e-stop-handshake",
  "admission-reconnect",
  "a2a-adapter-round-trip",
] as const;

function isRawFrameTransport(
  transport: CommunicationTransport,
): transport is CommunicationTransport & RawFrameTransport {
  return (
    "sendRawFrame" in transport &&
    typeof (transport as RawFrameTransport).sendRawFrame === "function"
  );
}

function makeEStop(frozen: boolean): EStopGate {
  let current = frozen;
  return {
    isFrozen: () => current,
    setFrozen: (next) => {
      current = next;
    },
  };
}

function fail(id: string, detail: string): A2AConformanceCaseResult {
  return { id, passed: false, detail };
}

function pass(id: string, detail?: string): A2AConformanceCaseResult {
  return { id, passed: true, ...(detail !== undefined ? { detail } : {}) };
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return "unknown error";
}

async function closePair(pair: A2AConformancePair): Promise<void> {
  if (pair.close !== undefined) {
    await pair.close();
    return;
  }
  await closeIfPresent(pair.local);
  await closeIfPresent(pair.remote);
}

async function closeIfPresent(transport: CommunicationTransport): Promise<void> {
  const closer = (transport as CommunicationTransport & Partial<ClosableTransport>).close;
  if (typeof closer === "function") {
    await closer.call(transport);
  }
}

function buildHarnessEnvelope(
  operationCode: CommunicationOperationCode,
  id: string,
): CommunicationEnvelope {
  const base: Omit<CommunicationEnvelope, "integrityDigest"> = {
    wireVersion: 1 as never,
    registryVersion: 1 as never,
    messageId: messageId(id),
    operationCode,
    metadata: {
      epochId: epochId("42"),
      epochOrdinal: epochOrdinal(1),
      operationTemplateRef: operationTemplateRef(operationCode, "1"),
      sessionId: sessionId("session-a2a-harness"),
      correlationId: correlationId(`corr-${id}`),
      occurrenceId: occurrenceId(`occ-${id}`),
      idempotencyKey: idempotencyKey(`idem-${id}`),
    },
    sender: actorRef("human-1" as never, "human"),
    recipient: actorRef("agent-1" as never, "agent"),
    channelId: channelId("ch-a2a-harness"),
    channelGeneration: channelGeneration(1),
    sequence: 1,
    payload: {
      contentRef: "content://harness" as never,
      contentDigest: "digest-harness" as never,
      mediaType: "application/json",
      byteLength: 10,
      classification: "internal",
    },
    ackMode: "durablyAccepted",
    issuedAt: "2026-08-11T16:00:00Z",
    expiresAt: "2099-01-01T00:00:00Z",
  };
  return { ...base, integrityDigest: computeEnvelopeIntegrityDigest(base) };
}

function seal(envelope: CommunicationEnvelope) {
  return sealVerifiedEnvelope({ envelope, verifiedAt: "2026-08-11T16:00:00Z" });
}

function buildHandshake(): SessionHandshake {
  const sid = sessionId("session-a2a-hs");
  return {
    sessionId: sid,
    authoritativeSnapshotRef: "snap-1" as never,
    requester: "rt-req" as never,
    acceptor: "rt-acc" as never,
    offeredProtocols: [],
    endpointRef: "ep-1" as never,
    transcriptDigest: "transcript-a2a-harness",
    authEvidenceRef: "auth",
    metadata: {
      epochId: epochId("42"),
      epochOrdinal: epochOrdinal(1),
      operationTemplateRef: operationTemplateRef("introduce", "1"),
      sessionId: sid,
      correlationId: correlationId("corr-a2a-hs"),
      occurrenceId: occurrenceId("occ-a2a-hs"),
    },
    expiresAt: "2099-01-01T00:00:00Z",
  };
}

function acknowledgeIfPresent(transport: CommunicationTransport, id: string): void {
  const ack = (transport as CommunicationTransport & { acknowledge?: (mid: string) => unknown })
    .acknowledge;
  if (typeof ack === "function") {
    ack.call(transport, id);
  }
}

export async function receiveSoon(
  transport: CommunicationTransport,
  attempts = 40,
  delayMs = 15,
): Promise<Result<Uint8Array, CommsViolation>> {
  for (let i = 0; i < attempts; i += 1) {
    const received = await transport.receive();
    if (received.ok || received.error.retryable !== true) {
      return received;
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  return transport.receive();
}

async function dispatchAndParse(
  pair: A2AConformancePair,
  envelope: CommunicationEnvelope,
): Promise<Result<CommunicationEnvelope, string>> {
  const sent = await pair.local.dispatch(seal(envelope));
  if (!sent.ok) {
    return { ok: false, error: sent.error.message };
  }
  const received = await receiveSoon(pair.remote);
  if (!received.ok) {
    return { ok: false, error: received.error.message };
  }
  const parsed = parseCommunicationWireFrame(received.value);
  if (!parsed.ok) {
    return { ok: false, error: parsed.error.message };
  }
  acknowledgeIfPresent(pair.remote, envelope.messageId as string);
  return { ok: true, value: parsed.value };
}

async function caseProfilePin(): Promise<A2AConformanceCaseResult> {
  if (A2A_PROFILE_PINNED !== "a2a/0.1") {
    return fail("profile-pin", `expected a2a/0.1, got ${A2A_PROFILE_PINNED}`);
  }
  return pass("profile-pin");
}

async function caseWireVersions(pair: A2AConformancePair): Promise<A2AConformanceCaseResult> {
  const parsed = await dispatchAndParse(pair, buildHarnessEnvelope("send", "msg-wire"));
  if (!parsed.ok) {
    return fail("wire-versions", parsed.error);
  }
  if (parsed.value.wireVersion !== COMMS_WIRE_VERSION_V1) {
    return fail("wire-versions", "wire version is not v1");
  }
  if (parsed.value.registryVersion !== COMMS_REGISTRY_VERSION_V1) {
    return fail("wire-versions", "registry version is not v1");
  }
  return pass("wire-versions");
}

async function caseIntegrity(pair: A2AConformancePair): Promise<A2AConformanceCaseResult> {
  const envelope = buildHarnessEnvelope("send", "msg-digest");
  const parsed = await dispatchAndParse(pair, envelope);
  if (!parsed.ok) {
    return fail("integrity-digest", parsed.error);
  }
  const verified = verifyEnvelopeIntegrityDigest(parsed.value);
  if (!verified.ok) {
    return fail("integrity-digest", verified.error.message);
  }
  return pass("integrity-digest");
}

async function caseUnknownField(pair: A2AConformancePair): Promise<A2AConformanceCaseResult> {
  if (!isRawFrameTransport(pair.local)) {
    return fail("unknown-field-rejected", "transport does not implement sendRawFrame");
  }
  const envelope = buildHarnessEnvelope("send", "msg-unknown");
  const body = JSON.parse(
    new TextDecoder().decode(encodeCommunicationWireFrame(envelope)),
  ) as Record<string, unknown>;
  body.extraField = "rejected";
  const bytes = new TextEncoder().encode(JSON.stringify(body));
  const sent = await pair.local.sendRawFrame(bytes);
  if (!sent.ok) {
    return fail("unknown-field-rejected", sent.error.message);
  }
  const received = await receiveSoon(pair.remote);
  if (!received.ok) {
    return fail("unknown-field-rejected", received.error.message);
  }
  const parsed = parseCommunicationWireFrame(received.value);
  if (parsed.ok) {
    return fail("unknown-field-rejected", "strict codec accepted an unknown field");
  }
  if (!parsed.error.message.includes("unknown field")) {
    return fail("unknown-field-rejected", parsed.error.message);
  }
  return pass("unknown-field-rejected");
}

async function caseRegistryCodes(pair: A2AConformancePair): Promise<A2AConformanceCaseResult> {
  if (ALL_OPERATION_CODES.length !== 60) {
    return fail(
      "registry-60-codes",
      `expected 60 codes, got ${String(ALL_OPERATION_CODES.length)}`,
    );
  }
  for (const [index, code] of ALL_OPERATION_CODES.entries()) {
    const parsed = await dispatchAndParse(
      pair,
      buildHarnessEnvelope(code, `msg-code-${String(index)}`),
    );
    if (!parsed.ok) {
      return fail("registry-60-codes", `${code}: ${parsed.error}`);
    }
    if (parsed.value.operationCode !== code) {
      return fail("registry-60-codes", `${code} round-tripped as ${parsed.value.operationCode}`);
    }
    if (deriveOperationFamily(parsed.value.operationCode) !== deriveOperationFamily(code)) {
      return fail("registry-60-codes", `${code} family mismatch`);
    }
  }
  return pass("registry-60-codes", "60");
}

async function caseRegistryFamilies(): Promise<A2AConformanceCaseResult> {
  const families = new Set(ALL_OPERATION_CODES.map((code) => deriveOperationFamily(code)));
  if (families.size !== 15) {
    return fail("registry-15-families", `expected 15 families, got ${String(families.size)}`);
  }
  return pass("registry-15-families", "15");
}

async function caseEStopDispatch(pair: A2AConformancePair): Promise<A2AConformanceCaseResult> {
  const result = await pair.local.dispatch(seal(buildHarnessEnvelope("send", "msg-estop-d")));
  if (result.ok) {
    return fail("e-stop-dispatch", "dispatch succeeded while frozen");
  }
  if (!result.error.message.includes("E-Stop frozen")) {
    return fail("e-stop-dispatch", result.error.message);
  }
  return pass("e-stop-dispatch");
}

async function caseEStopReceive(pair: A2AConformancePair): Promise<A2AConformanceCaseResult> {
  const result = await pair.remote.receive();
  if (result.ok) {
    return fail("e-stop-receive", "receive succeeded while frozen");
  }
  if (!result.error.message.includes("E-Stop frozen")) {
    return fail("e-stop-receive", result.error.message);
  }
  return pass("e-stop-receive");
}

async function caseEStopHandshake(pair: A2AConformancePair): Promise<A2AConformanceCaseResult> {
  const result = await pair.local.handshake(buildHandshake());
  if (result.ok) {
    return fail("e-stop-handshake", "handshake succeeded while frozen");
  }
  if (!result.error.message.includes("E-Stop frozen")) {
    return fail("e-stop-handshake", result.error.message);
  }
  return pass("e-stop-handshake");
}

function registerSessionBinding(store: CommsStore, plan: AdmissionReconnectPlan): void {
  store.casSessionBinding({
    sessionId: plan.sessionId,
    expectedGeneration: channelGeneration(0),
    next: {
      sessionId: plan.sessionId,
      authoritativeSnapshotRef: plan.expectedRuntimeHead,
      localRuntimeInstanceId: "runtime-local" as never,
      remoteRuntimeInstanceId: "runtime-remote" as never,
      channelId: channelId(`channel-${plan.sessionId as string}`),
      channelGeneration: plan.expectedChannelGeneration,
      localEndpoint: plan.oldEndpointRef,
      remoteEndpoint: plan.newEndpointRef,
      negotiated: {
        wireVersion: 1 as never,
        transport: "loopback",
        codecRef: "comms/wire-v1",
        protocolVersion: "comms/1",
        a2aProfile: A2A_PROFILE_PINNED,
        features: [],
      },
      schemaEpochId: String(plan.toBinding.epochId),
      status: "active",
      outboundSequence: 0,
      inboundSequence: 0,
      establishedAt: "2026-08-11T16:00:00Z",
      updatedAt: "2026-08-11T16:00:00Z",
    },
  });
}

async function caseAdmissionReconnect(pair: A2AConformancePair): Promise<A2AConformanceCaseResult> {
  const binding = {
    activationDomainId: "default" as never,
    bindingGeneration: 2 as never,
    epochId: "43" as never,
    epochOrdinal: 2 as never,
    schemaRef: { schemaId: "default-v1", revisionId: "rev-002", digest: "abc" as never } as never,
    policyRef: { policyId: "p", revisionId: "1", digest: "d" as never } as never,
    handlerManifestRef: { manifestId: "m", digest: "d" as never } as never,
    runtimeHead: "snap-E2" as never,
    admissionId: "adm-001" as never,
    activatedBy: "operator",
    activatedAt: "2026-08-11T15:00:00Z",
  } as const;
  const services = createCommsServices({
    mode: "test",
    bindingResolver: { getActiveBinding: () => binding },
    sessionAuthority: { isController: () => true, isMember: () => true },
    quiescence: { resourcesClear: async () => true, sessionsQuiescent: async () => true },
    clock: { now: () => "2026-08-11T16:00:00Z" },
    transport: pair.local,
  });
  const receipt = {
    admissionId: schemaAdmissionId("adm-a2a-harness"),
    activationDomainId: "default" as never,
    fromBinding: binding,
    toBinding: { ...binding, epochId: "43" as never, epochOrdinal: 2 as never },
    beforeSnapshotRef: "snap-E1" as never,
    afterSnapshotRef: "snap-E2" as never,
    extensionPlanRef: "plan-ref",
    admissionTombstoneId: "tomb-001" as never,
    committedBy: "operator",
    committedAt: "2026-08-11T15:00:00Z",
    storeSequence: 1 as never,
    correlationId: correlationId("corr-a2a-rc"),
    occurrenceId: occurrenceId("occ-a2a-rc"),
    idempotencyKey: idempotencyKey("idem-a2a-rc"),
    planDigest: "plan-digest" as never,
    authorizationEvidenceRef: "auth-evidence-a2a" as never,
  };
  const planResult = buildReconnectPlanFromReceipt({
    resolver: services.receiptResolver,
    receipt,
    sessionId: sessionId("session-a2a-rc"),
    operationTemplateRef: operationTemplateRef("introduce", "1"),
  });
  if (!planResult.ok) {
    return fail("admission-reconnect", planResult.error.message);
  }
  registerSessionBinding(services.store, planResult.value);
  const committed = await executeAdmissionReconnect({ services, plan: planResult.value });
  if (!committed.ok) {
    return fail("admission-reconnect", committed.error.message);
  }
  const handshake = await pair.local.handshake(buildHandshake());
  if (!handshake.ok) {
    return fail("admission-reconnect", handshake.error.message);
  }
  return pass("admission-reconnect");
}

async function caseA2AAdapter(pair: A2AConformancePair): Promise<A2AConformanceCaseResult> {
  const local = pair.local;
  if (!isRawFrameTransport(local)) {
    return fail("a2a-adapter-round-trip", "transport does not implement sendRawFrame");
  }
  const adapter = new A2ATransportAdapter({
    remoteEndpoint: "harness-peer",
    sendFrame: async (_endpoint, frame) => local.sendRawFrame(frame),
    receiveFrame: async () => receiveSoon(pair.remote),
  });
  const sent = await adapter.dispatch(seal(buildHarnessEnvelope("send", "msg-a2a-adapter")));
  if (!sent.ok) {
    return fail("a2a-adapter-round-trip", sent.error.message);
  }
  const received = await adapter.receive();
  if (!received.ok) {
    return fail("a2a-adapter-round-trip", received.error.message);
  }
  const decoded = decodeA2AFrame(received.value);
  if (!decoded.ok) {
    return fail("a2a-adapter-round-trip", decoded.error.message);
  }
  if (decoded.value.header.profile !== A2A_PROFILE_PINNED) {
    return fail("a2a-adapter-round-trip", "A2A profile is not pinned a2a/0.1");
  }
  const parsed = parseCommunicationWireFrame(decoded.value.body);
  if (!parsed.ok) {
    return fail("a2a-adapter-round-trip", parsed.error.message);
  }
  return pass("a2a-adapter-round-trip");
}

async function runOneCase(
  id: (typeof CASE_IDS)[number],
  input: A2AConformanceHarnessInput,
): Promise<A2AConformanceCaseResult> {
  if (id === "profile-pin") {
    return caseProfilePin();
  }
  if (id === "registry-15-families") {
    return caseRegistryFamilies();
  }
  const frozen = id.startsWith("e-stop-");
  const gate = makeEStop(false);
  const pair = await Promise.resolve(input.createPair({ eStopGate: gate }));
  if (frozen) {
    gate.setFrozen(true);
  }
  try {
    if (id === "wire-versions") {
      return await caseWireVersions(pair);
    }
    if (id === "integrity-digest") {
      return await caseIntegrity(pair);
    }
    if (id === "unknown-field-rejected") {
      return await caseUnknownField(pair);
    }
    if (id === "registry-60-codes") {
      return await caseRegistryCodes(pair);
    }
    if (id === "e-stop-dispatch") {
      return await caseEStopDispatch(pair);
    }
    if (id === "e-stop-receive") {
      return await caseEStopReceive(pair);
    }
    if (id === "e-stop-handshake") {
      return await caseEStopHandshake(pair);
    }
    if (id === "admission-reconnect") {
      return await caseAdmissionReconnect(pair);
    }
    return await caseA2AAdapter(pair);
  } finally {
    await closePair(pair);
  }
}

export async function runA2AConformanceHarness(
  input: A2AConformanceHarnessInput,
): Promise<A2AConformanceReport> {
  const results: A2AConformanceCaseResult[] = [];
  for (const id of CASE_IDS) {
    try {
      results.push(await runOneCase(id, input));
    } catch (error) {
      results.push(fail(id, errorMessage(error)));
    }
  }
  return {
    profile: A2A_PROFILE_PINNED,
    transportId: input.transportId,
    results,
    passed: results.every((result) => result.passed),
  };
}

export const A2A_CONFORMANCE_CASE_IDS: readonly string[] = CASE_IDS;
