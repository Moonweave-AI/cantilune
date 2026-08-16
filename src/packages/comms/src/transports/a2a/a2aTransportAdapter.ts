import { type Result, err, ok } from "@cantilune/core";
import { type CommunicationTransport } from "../../ports/communicationTransport.js";
import { type VerifiedEnvelope } from "../../envelope/communicationEnvelope.js";
import { type SessionHandshake } from "../../session/sessionTransportBinding.js";
import { type CommsViolation, commsViolation } from "../../foundation/commsViolation.js";
import { COMMS_WIRE_VERSION_V1 } from "../../foundation/commsLimits.js";
import { encodeCommunicationWireFrame } from "../../codec/strictWireCodec.js";
import { assertVerifiedEnvelope } from "../../security/commsCapability.js";
import { encodeA2AFrame } from "./a2aCodec.js";
import { assertA2AProfileCompatible } from "./a2aCompatibility.js";
import { createHttpA2AFrameHandlers } from "./a2aHttpFrames.js";

export interface A2ATransportAdapterOptions {
  readonly remoteEndpoint: string;
  readonly profile?: string;
  /**
   * Optional override. When omitted, defaults to HTTP POST/GET against
   * {@link remoteEndpoint} (A28).
   */
  readonly sendFrame?: (
    endpoint: string,
    frame: Uint8Array,
  ) => Promise<Result<void, CommsViolation>>;
  readonly receiveFrame?: () => Promise<Result<Uint8Array, CommsViolation>>;
  /** Optional fetch injection for tests. */
  readonly fetchImpl?: typeof fetch;
}

/**
 * Pinned-profile A2A transport adapter with default HTTP frame I/O.
 */
export class A2ATransportAdapter implements CommunicationTransport {
  readonly transportId = "a2a";
  private readonly profile: string;
  private readonly sendFrame: (
    endpoint: string,
    frame: Uint8Array,
  ) => Promise<Result<void, CommsViolation>>;
  private readonly receiveFrame: () => Promise<Result<Uint8Array, CommsViolation>>;

  constructor(private readonly options: A2ATransportAdapterOptions) {
    this.profile = options.profile ?? "a2a/0.1";
    const http = createHttpA2AFrameHandlers({
      ...(options.fetchImpl !== undefined ? { fetchImpl: options.fetchImpl } : {}),
    });
    this.sendFrame = options.sendFrame ?? http.sendFrame;
    this.receiveFrame =
      options.receiveFrame ??
      (async () => http.receiveFrame(options.remoteEndpoint));
  }

  async dispatch(
    envelope: VerifiedEnvelope,
  ): Promise<Result<{ readonly attemptRef: string }, CommsViolation>> {
    const sealed = assertVerifiedEnvelope(envelope);
    if (!sealed.ok) {
      return sealed;
    }
    const compatible = assertA2AProfileCompatible(this.profile);
    if (!compatible.ok) {
      return compatible;
    }
    const wireBytes = encodeCommunicationWireFrame(envelope.envelope);
    const frame = encodeA2AFrame(
      { profile: "a2a/0.1", wireVersion: COMMS_WIRE_VERSION_V1, messageKind: "envelope" },
      wireBytes,
    );
    const sent = await this.sendFrame(this.options.remoteEndpoint, frame);
    if (!sent.ok) {
      return sent;
    }
    return ok({ attemptRef: `a2a-${envelope.envelope.messageId as string}` });
  }

  async receive(): Promise<Result<Uint8Array, CommsViolation>> {
    return this.receiveFrame();
  }

  async handshake(
    request: SessionHandshake,
  ): Promise<Result<{ readonly ackDigest: string }, CommsViolation>> {
    const compatible = assertA2AProfileCompatible(this.profile);
    if (!compatible.ok) {
      return compatible;
    }
    const body = new TextEncoder().encode(
      JSON.stringify({ transcriptDigest: request.transcriptDigest }),
    );
    const frame = encodeA2AFrame(
      { profile: "a2a/0.1", wireVersion: COMMS_WIRE_VERSION_V1, messageKind: "handshake" },
      body,
    );
    const sent = await this.sendFrame(this.options.remoteEndpoint, frame);
    if (!sent.ok) {
      return sent;
    }
    return ok({ ackDigest: request.transcriptDigest });
  }
}
