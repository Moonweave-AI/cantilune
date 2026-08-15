import { createHash } from "node:crypto";
import {
  type Result,
  err,
  ok,
  actorRef,
  contentRef,
  correlationId,
  epochId,
  epochOrdinal,
  idempotencyKey,
  occurrenceId,
  operationTemplateRef,
  sessionId,
  type ActorRef,
} from "@cantilune/core";
import { commsViolation, type CommsViolation } from "../foundation/commsViolation.js";
import {
  COMMS_LIMITS,
  COMMS_REGISTRY_VERSION_V1,
  COMMS_WIRE_VERSION_V1,
} from "../foundation/commsLimits.js";
import { type CommunicationEnvelope } from "../envelope/communicationEnvelope.js";
import {
  isCommunicationOperationCode,
  type CommunicationOperationCode,
} from "../protocol/communicationOperationRegistry.js";
import {
  channelGeneration,
  channelId,
  messageId,
  registryVersion,
  wireVersion,
} from "../foundation/messageId.js";

const ALLOWED_FRAME_KEYS = [
  "wireVersion",
  "registryVersion",
  "messageId",
  "operationCode",
  "metadata",
  "sender",
  "recipient",
  "channelId",
  "channelGeneration",
  "sequence",
  "replyToMessageId",
  "payload",
  "ackMode",
  "issuedAt",
  "expiresAt",
  "integrityDigest",
] as const;

const ALLOWED_METADATA_KEYS = [
  "epochId",
  "epochOrdinal",
  "bindingGeneration",
  "operationTemplateRef",
  "sessionId",
  "correlationId",
  "occurrenceId",
  "causationId",
  "idempotencyKey",
] as const;

const ALLOWED_PAYLOAD_KEYS = [
  "contentRef",
  "contentDigest",
  "mediaType",
  "byteLength",
  "classification",
] as const;

const ALLOWED_ACTOR_KEYS = ["actorId", "kind"] as const;
const ALLOWED_ACK_MODES = [
  "transportReceived",
  "durablyAccepted",
  "runtimeObserved",
  "businessCommitted",
] as const;

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function rejectUnknownKeys(
  record: Record<string, unknown>,
  allowed: readonly string[],
  path: string,
): Result<void, CommsViolation> {
  for (const key of Object.keys(record)) {
    if (!allowed.includes(key)) {
      return err(
        commsViolation("codec_invalid", "ingress", `unknown field ${key}`, {
          path: `${path}.${key}`,
        }),
      );
    }
  }
  return ok(undefined);
}

function requireString(value: unknown, path: string): Result<string, CommsViolation> {
  if (typeof value !== "string" || value.length === 0) {
    return err(commsViolation("codec_invalid", "ingress", `expected non-empty string at ${path}`));
  }
  return ok(value);
}

function requireNumber(value: unknown, path: string): Result<number, CommsViolation> {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return err(commsViolation("codec_invalid", "ingress", `expected number at ${path}`));
  }
  return ok(value);
}

function parseActorRef(value: unknown, path: string): Result<ActorRef, CommsViolation> {
  if (!isPlainRecord(value)) {
    return err(commsViolation("codec_invalid", "ingress", `expected actor object at ${path}`));
  }
  const keys = rejectUnknownKeys(value, ALLOWED_ACTOR_KEYS, path);
  if (!keys.ok) {
    return keys;
  }
  const actorIdResult = requireString(value.actorId, `${path}.actorId`);
  if (!actorIdResult.ok) {
    return actorIdResult;
  }
  const kindResult = requireString(value.kind, `${path}.kind`);
  if (!kindResult.ok) {
    return kindResult;
  }
  if (
    kindResult.value !== "human" &&
    kindResult.value !== "agent" &&
    kindResult.value !== "tool" &&
    kindResult.value !== "reviewer" &&
    kindResult.value !== "runtime" &&
    kindResult.value !== "environment"
  ) {
    return err(commsViolation("codec_invalid", "ingress", `invalid actor kind at ${path}.kind`));
  }
  return ok(actorRef(actorIdResult.value as never, kindResult.value as ActorRef["kind"]));
}

function parseMetadata(value: unknown): Result<CommunicationEnvelope["metadata"], CommsViolation> {
  if (!isPlainRecord(value)) {
    return err(commsViolation("codec_invalid", "ingress", "metadata must be object"));
  }
  const keys = rejectUnknownKeys(value, ALLOWED_METADATA_KEYS, "metadata");
  if (!keys.ok) {
    return keys;
  }
  const epochIdStr = requireString(value.epochId, "metadata.epochId");
  if (!epochIdStr.ok) {
    return epochIdStr;
  }
  const epochOrd = requireNumber(value.epochOrdinal, "metadata.epochOrdinal");
  if (!epochOrd.ok) {
    return epochOrd;
  }
  const templateRaw = value.operationTemplateRef;
  if (!isPlainRecord(templateRaw)) {
    return err(
      commsViolation("codec_invalid", "ingress", "metadata.operationTemplateRef must be object"),
    );
  }
  const templateKeys = rejectUnknownKeys(
    templateRaw,
    ["operationTypeId", "revision"],
    "metadata.operationTemplateRef",
  );
  if (!templateKeys.ok) {
    return templateKeys;
  }
  const opType = requireString(
    templateRaw.operationTypeId,
    "metadata.operationTemplateRef.operationTypeId",
  );
  if (!opType.ok) {
    return opType;
  }
  const rev = requireString(templateRaw.revision, "metadata.operationTemplateRef.revision");
  if (!rev.ok) {
    return rev;
  }
  const session = requireString(value.sessionId, "metadata.sessionId");
  if (!session.ok) {
    return session;
  }
  const corr = requireString(value.correlationId, "metadata.correlationId");
  if (!corr.ok) {
    return corr;
  }
  const occ = requireString(value.occurrenceId, "metadata.occurrenceId");
  if (!occ.ok) {
    return occ;
  }
  return ok({
    epochId: epochId(epochIdStr.value),
    epochOrdinal: epochOrdinal(epochOrd.value),
    operationTemplateRef: operationTemplateRef(opType.value, rev.value),
    sessionId: sessionId(session.value),
    correlationId: correlationId(corr.value),
    occurrenceId: occurrenceId(occ.value),
    ...(typeof value.causationId === "string"
      ? { causationId: correlationId(value.causationId) }
      : {}),
    ...(typeof value.idempotencyKey === "string"
      ? { idempotencyKey: idempotencyKey(value.idempotencyKey) }
      : {}),
  });
}

function parsePayload(value: unknown): Result<CommunicationEnvelope["payload"], CommsViolation> {
  if (!isPlainRecord(value)) {
    return err(commsViolation("codec_invalid", "ingress", "payload must be object"));
  }
  const keys = rejectUnknownKeys(value, ALLOWED_PAYLOAD_KEYS, "payload");
  if (!keys.ok) {
    return keys;
  }
  const contentRefStr = requireString(value.contentRef, "payload.contentRef");
  if (!contentRefStr.ok) {
    return contentRefStr;
  }
  const digest = requireString(value.contentDigest, "payload.contentDigest");
  if (!digest.ok) {
    return digest;
  }
  const mediaType = requireString(value.mediaType, "payload.mediaType");
  if (!mediaType.ok) {
    return mediaType;
  }
  const byteLength = requireNumber(value.byteLength, "payload.byteLength");
  if (!byteLength.ok) {
    return byteLength;
  }
  const classification = requireString(value.classification, "payload.classification");
  if (!classification.ok) {
    return classification;
  }
  if (
    classification.value !== "public" &&
    classification.value !== "internal" &&
    classification.value !== "restricted"
  ) {
    return err(commsViolation("codec_invalid", "ingress", "invalid payload classification"));
  }
  return ok({
    contentRef: contentRef(contentRefStr.value),
    contentDigest: digest.value as never,
    mediaType: mediaType.value,
    byteLength: byteLength.value,
    classification: classification.value as "public" | "internal" | "restricted",
  });
}

export function computeEnvelopeIntegrityDigest(
  frame: Omit<CommunicationEnvelope, "integrityDigest">,
): string {
  const canonical = JSON.stringify({
    wireVersion: frame.wireVersion,
    registryVersion: frame.registryVersion,
    messageId: frame.messageId,
    operationCode: frame.operationCode,
    metadata: frame.metadata,
    sender: frame.sender,
    recipient: frame.recipient,
    channelId: frame.channelId,
    channelGeneration: frame.channelGeneration,
    sequence: frame.sequence,
    payload: frame.payload,
    ackMode: frame.ackMode,
    issuedAt: frame.issuedAt,
    expiresAt: frame.expiresAt,
  });
  return createHash("sha256").update(canonical).digest("hex");
}

export function verifyEnvelopeIntegrityDigest(
  envelope: CommunicationEnvelope,
): Result<void, CommsViolation> {
  const { integrityDigest, ...rest } = envelope;
  const expected = computeEnvelopeIntegrityDigest(rest);
  if (integrityDigest !== expected) {
    return err(commsViolation("codec_invalid", "ingress", "integrityDigest mismatch"));
  }
  return ok(undefined);
}

function parseFrameHeader(
  parsed: Record<string, unknown>,
): Result<
  { readonly messageId: string; readonly operationCode: CommunicationOperationCode },
  CommsViolation
> {
  if (parsed.wireVersion !== COMMS_WIRE_VERSION_V1) {
    return err(commsViolation("wire_unsupported", "ingress", "unsupported wireVersion"));
  }
  if (parsed.registryVersion !== COMMS_REGISTRY_VERSION_V1) {
    return err(commsViolation("codec_invalid", "ingress", "unsupported registryVersion"));
  }

  const msgId = requireString(parsed.messageId, "messageId");
  if (!msgId.ok) {
    return msgId;
  }
  const opCode = requireString(parsed.operationCode, "operationCode");
  if (!opCode.ok) {
    return opCode;
  }
  if (!isCommunicationOperationCode(opCode.value)) {
    return err(commsViolation("codec_invalid", "ingress", "unknown operationCode"));
  }

  return ok({
    messageId: msgId.value,
    operationCode: opCode.value as CommunicationOperationCode,
  });
}

function parseFrameParticipants(parsed: Record<string, unknown>): Result<
  {
    readonly metadata: CommunicationEnvelope["metadata"];
    readonly sender: ActorRef;
    readonly recipient: ActorRef;
    readonly channelId: string;
    readonly channelGeneration: number;
    readonly sequence: number;
  },
  CommsViolation
> {
  const metadata = parseMetadata(parsed.metadata);
  if (!metadata.ok) {
    return metadata;
  }
  const sender = parseActorRef(parsed.sender, "sender");
  if (!sender.ok) {
    return sender;
  }
  const recipient = parseActorRef(parsed.recipient, "recipient");
  if (!recipient.ok) {
    return recipient;
  }
  const channelIdStr = requireString(parsed.channelId, "channelId");
  if (!channelIdStr.ok) {
    return channelIdStr;
  }
  const channelGen = requireNumber(parsed.channelGeneration, "channelGeneration");
  if (!channelGen.ok) {
    return channelGen;
  }
  const sequence = requireNumber(parsed.sequence, "sequence");
  if (!sequence.ok) {
    return sequence;
  }
  if (sequence.value < 1) {
    return err(commsViolation("codec_invalid", "ingress", "sequence must be >= 1"));
  }

  return ok({
    metadata: metadata.value,
    sender: sender.value,
    recipient: recipient.value,
    channelId: channelIdStr.value,
    channelGeneration: channelGen.value,
    sequence: sequence.value,
  });
}

function parseFrameBody(parsed: Record<string, unknown>): Result<
  {
    readonly payload: CommunicationEnvelope["payload"];
    readonly ackMode: CommunicationEnvelope["ackMode"];
    readonly issuedAt: string;
    readonly expiresAt: string;
    readonly integrityDigest: string;
  },
  CommsViolation
> {
  const payload = parsePayload(parsed.payload);
  if (!payload.ok) {
    return payload;
  }
  const ackMode = requireString(parsed.ackMode, "ackMode");
  if (!ackMode.ok) {
    return ackMode;
  }
  if (!ALLOWED_ACK_MODES.includes(ackMode.value as (typeof ALLOWED_ACK_MODES)[number])) {
    return err(commsViolation("codec_invalid", "ingress", "invalid ackMode"));
  }
  const issuedAt = requireString(parsed.issuedAt, "issuedAt");
  if (!issuedAt.ok) {
    return issuedAt;
  }
  const expiresAt = requireString(parsed.expiresAt, "expiresAt");
  if (!expiresAt.ok) {
    return expiresAt;
  }
  const integrityDigest = requireString(parsed.integrityDigest, "integrityDigest");
  if (!integrityDigest.ok) {
    return integrityDigest;
  }

  return ok({
    payload: payload.value,
    ackMode: ackMode.value as CommunicationEnvelope["ackMode"],
    issuedAt: issuedAt.value,
    expiresAt: expiresAt.value,
    integrityDigest: integrityDigest.value,
  });
}

export function parseCommunicationWireFrame(
  bytes: Uint8Array,
): Result<CommunicationEnvelope, CommsViolation> {
  if (bytes.byteLength > COMMS_LIMITS.maxFrameBytes) {
    return err(commsViolation("wire_oversized", "ingress", "frame exceeds maxFrameBytes"));
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    return err(commsViolation("codec_invalid", "ingress", "invalid UTF-8 JSON frame"));
  }
  if (!isPlainRecord(parsed)) {
    return err(commsViolation("codec_invalid", "ingress", "expected object frame"));
  }
  const topKeys = rejectUnknownKeys(parsed, ALLOWED_FRAME_KEYS, "frame");
  if (!topKeys.ok) {
    return topKeys;
  }

  const header = parseFrameHeader(parsed);
  if (!header.ok) {
    return header;
  }

  const participants = parseFrameParticipants(parsed);
  if (!participants.ok) {
    return participants;
  }

  const body = parseFrameBody(parsed);
  if (!body.ok) {
    return body;
  }

  const envelope: CommunicationEnvelope = {
    wireVersion: wireVersion(COMMS_WIRE_VERSION_V1),
    registryVersion: registryVersion(COMMS_REGISTRY_VERSION_V1),
    messageId: messageId(header.value.messageId),
    operationCode: header.value.operationCode,
    metadata: participants.value.metadata,
    sender: participants.value.sender,
    recipient: participants.value.recipient,
    channelId: channelId(participants.value.channelId),
    channelGeneration: channelGeneration(participants.value.channelGeneration),
    sequence: participants.value.sequence,
    payload: body.value.payload,
    ackMode: body.value.ackMode,
    issuedAt: body.value.issuedAt,
    expiresAt: body.value.expiresAt,
    integrityDigest: body.value.integrityDigest,
  };

  const digestOk = verifyEnvelopeIntegrityDigest(envelope);
  if (!digestOk.ok) {
    return digestOk;
  }

  return ok(envelope);
}

export function encodeCommunicationWireFrame(envelope: CommunicationEnvelope): Uint8Array {
  const body = {
    wireVersion: envelope.wireVersion,
    registryVersion: envelope.registryVersion,
    messageId: envelope.messageId,
    operationCode: envelope.operationCode,
    metadata: envelope.metadata,
    sender: envelope.sender,
    recipient: envelope.recipient,
    channelId: envelope.channelId,
    channelGeneration: envelope.channelGeneration,
    sequence: envelope.sequence,
    ...(envelope.replyToMessageId !== undefined
      ? { replyToMessageId: envelope.replyToMessageId }
      : {}),
    payload: envelope.payload,
    ackMode: envelope.ackMode,
    issuedAt: envelope.issuedAt,
    expiresAt: envelope.expiresAt,
    integrityDigest: envelope.integrityDigest,
  };
  return new TextEncoder().encode(JSON.stringify(body));
}

export function digestCommunicationFrame(envelope: CommunicationEnvelope): string {
  return computeEnvelopeIntegrityDigest({
    ...envelope,
    integrityDigest: "",
  } as Omit<CommunicationEnvelope, "integrityDigest">);
}
