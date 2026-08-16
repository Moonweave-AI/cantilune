/**
 * Cross-process child for NetTransport system tests (ADR-0018 T3).
 *
 * Args: <config.json>
 *   mode=full     — connect with NetTransport and send one strict-wire-v1 frame
 *   mode=partial  — complete mTLS then write a truncated header and exit
 *
 * Imports the built dist (requires `pnpm build` of @cantilune/comms).
 */
import { readFileSync } from "node:fs";
import { connect as tlsConnect } from "node:tls";
import { NetTransport } from "../../dist/transports/net/netTransport.js";
import {
  encodeCommunicationWireFrame,
  computeEnvelopeIntegrityDigest,
} from "../../dist/codec/strictWireCodec.js";

const configPath = process.argv[2];
if (configPath === undefined) {
  process.stderr.write("usage: netTransportDispatchChild.mjs <config.json>\n");
  process.exit(1);
}

const config = JSON.parse(readFileSync(configPath, "utf8"));

function buildEnvelope(messageId) {
  const base = {
    wireVersion: 1,
    registryVersion: 1,
    messageId,
    operationCode: "send",
    metadata: {
      epochId: "42",
      epochOrdinal: 1,
      operationTemplateRef: { operationTypeId: "send", revision: "1" },
      sessionId: "session-net-xproc",
      correlationId: "corr-net-xproc",
      occurrenceId: "occ-net-xproc",
      idempotencyKey: "idem-net-xproc",
    },
    sender: { actorId: "child-1", kind: "agent" },
    recipient: { actorId: "parent-1", kind: "agent" },
    channelId: "ch-net-xproc",
    channelGeneration: 1,
    sequence: 1,
    payload: {
      contentRef: "content://net-xproc",
      contentDigest: "digest-net-xproc",
      mediaType: "application/json",
      byteLength: 10,
      classification: "internal",
    },
    ackMode: "durablyAccepted",
    issuedAt: "2026-08-15T00:00:00Z",
    expiresAt: "2099-01-01T00:00:00Z",
  };
  return { ...base, integrityDigest: computeEnvelopeIntegrityDigest(base) };
}

async function sendFull() {
  const transport = new NetTransport({
    endpointId: "net-child",
    tls: config.tls,
    connect: config.connect,
    pinnedPeerFingerprints: config.pinnedPeerFingerprints,
    expectedPeerActorRef: config.expectedPeerActorRef ?? "net-parent",
    readyTimeoutMs: 8_000,
  });
  await transport.ready();
  const bytes = encodeCommunicationWireFrame(buildEnvelope(config.messageId));
  const sent = await transport.sendRawFrame(bytes);
  if (!sent.ok) {
    process.stderr.write(`${sent.error.message}\n`);
    await transport.close();
    process.exit(2);
  }
  await transport.close();
  process.exit(0);
}

function sendPartial() {
  return new Promise((resolve, reject) => {
    const socket = tlsConnect(
      {
        host: config.connect.host,
        port: config.connect.port,
        key: config.tls.key,
        cert: config.tls.cert,
        ca: config.tls.ca,
        rejectUnauthorized: true,
        minVersion: "TLSv1.3",
        servername: "localhost",
      },
      () => {
        socket.write(Buffer.from([0x01, 0x00, 0x00]), () => {
          socket.destroy();
          resolve(undefined);
        });
      },
    );
    socket.once("error", reject);
  });
}

try {
  if (config.mode === "partial") {
    await sendPartial();
    process.exit(0);
  }
  await sendFull();
} catch (error) {
  const message = error instanceof Error ? error.message : "child failed";
  process.stderr.write(`${message}\n`);
  process.exit(1);
}
