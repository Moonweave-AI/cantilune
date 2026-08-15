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

export interface A2ATransportAdapterOptions {
  readonly remoteEndpoint: string;
  readonly profile?: string;
  readonly sendFrame?: (
    endpoint: string,
    frame: Uint8Array,
  ) => Promise<Result<void, CommsViolation>>;
  readonly receiveFrame?: () => Promise<Result<Uint8Array, CommsViolation>>;
}

/**
 * Pinned-profile A2A transport adapter.
 * Production wiring injects real sendFrame/receiveFrame.
 */
export class A2ATransportAdapter implements CommunicationTransport {
  readonly transportId = "a2a";
  private readonly profile: string;

  constructor(private readonly options: A2ATransportAdapterOptions) {
    this.profile = options.profile ?? "a2a/0.1";
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
    if (this.options.sendFrame === undefined) {
      return err(
        commsViolation(
          "transport_failed",
          "send",
          "A2A sendFrame handler not provided — inject sendFrame in A2ATransportAdapterOptions",
        ),
      );
    }
    const wireBytes = encodeCommunicationWireFrame(envelope.envelope);
    const frame = encodeA2AFrame(
      { profile: "a2a/0.1", wireVersion: COMMS_WIRE_VERSION_V1, messageKind: "envelope" },
      wireBytes,
    );
    const sent = await this.options.sendFrame(this.options.remoteEndpoint, frame);
    if (!sent.ok) {
      return sent;
    }
    return ok({ attemptRef: `a2a-${envelope.envelope.messageId as string}` });
  }

  async receive(): Promise<Result<Uint8Array, CommsViolation>> {
    if (this.options.receiveFrame === undefined) {
      return err(
        commsViolation(
          "transport_failed",
          "receive",
          "A2A receiveFrame handler not provided — inject receiveFrame in A2ATransportAdapterOptions",
        ),
      );
    }
    return this.options.receiveFrame();
  }

  async handshake(
    request: SessionHandshake,
  ): Promise<Result<{ readonly ackDigest: string }, CommsViolation>> {
    const compatible = assertA2AProfileCompatible(this.profile);
    if (!compatible.ok) {
      return compatible;
    }
    if (this.options.sendFrame === undefined) {
      return err(
        commsViolation(
          "transport_failed",
          "send",
          "A2A sendFrame handler not provided — inject sendFrame in A2ATransportAdapterOptions",
        ),
      );
    }
    const body = new TextEncoder().encode(
      JSON.stringify({ transcriptDigest: request.transcriptDigest }),
    );
    const frame = encodeA2AFrame(
      { profile: "a2a/0.1", wireVersion: COMMS_WIRE_VERSION_V1, messageKind: "handshake" },
      body,
    );
    const sent = await this.options.sendFrame(this.options.remoteEndpoint, frame);
    if (!sent.ok) {
      return sent;
    }
    return ok({ ackDigest: request.transcriptDigest });
  }
}
