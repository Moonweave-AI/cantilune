/**
 * Cross-process child for FileTransport system tests (ADR-0018 D1).
 *
 * Args: <outboxDir> <messageId>
 * Writes a single strict-wire-v1 frame into <outboxDir> named for <messageId>,
 * then exits 0. The parent process reads it from the peer inbox.
 *
 * This script imports the built dist (requires `pnpm build` of @cantilune/comms)
 * so the child runs as a genuinely independent process against the real
 * filesystem — not an in-process mock.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { encodeCommunicationWireFrame } from "../../dist/codec/strictWireCodec.js";
import { computeEnvelopeIntegrityDigest } from "../../dist/codec/strictWireCodec.js";

const [outboxDir, messageId] = process.argv.slice(2);
if (outboxDir === undefined || messageId === undefined) {
  process.stderr.write("usage: fileTransportDispatchChild.mjs <outboxDir> <messageId>\n");
  process.exit(1);
}

mkdirSync(outboxDir, { recursive: true });

const baseEnvelope = {
  wireVersion: 1,
  registryVersion: 1,
  messageId,
  operationCode: "send",
  metadata: {
    epochId: "42",
    epochOrdinal: 1,
    operationTemplateRef: { operationTypeId: "send", revision: "1" },
    sessionId: "session-cross-process",
    correlationId: "corr-cross-process",
    occurrenceId: "occ-cross-process",
    idempotencyKey: "idem-cross-process",
  },
  sender: { actorId: "child-1", kind: "agent" },
  recipient: { actorId: "parent-1", kind: "agent" },
  channelId: "ch-cross-process",
  channelGeneration: 1,
  sequence: 1,
  payload: {
    contentRef: "content://cross-process",
    contentDigest: "digest-cross",
    mediaType: "application/json",
    byteLength: 10,
    classification: "internal",
  },
  ackMode: "durablyAccepted",
  issuedAt: "2026-08-14T00:00:00Z",
  expiresAt: "2099-01-01T00:00:00Z",
};
const integrityDigest = computeEnvelopeIntegrityDigest(baseEnvelope);
const envelope = { ...baseEnvelope, integrityDigest };
const bytes = encodeCommunicationWireFrame(envelope);
const name = `${"0000000001"}-${String(messageId).replace(/[^A-Za-z0-9._-]/g, "_")}.frame`;
writeFileSync(join(outboxDir, name), Buffer.from(bytes).toString("base64"), "utf8");
process.exit(0);
