import { type WireVersion } from "../foundation/messageId.js";
import { A2A_PROFILE_PINNED } from "../foundation/commsLimits.js";

export interface NegotiatedProtocol {
  readonly wireVersion: WireVersion;
  readonly transport: string;
  readonly codecRef: string;
  readonly protocolVersion: string;
  readonly a2aProfile: string;
  readonly features: readonly string[];
}

export function defaultNegotiatedProtocol(
  wire: WireVersion,
  transport: string,
): NegotiatedProtocol {
  return {
    wireVersion: wire,
    transport,
    codecRef: "comms/wire-v1",
    protocolVersion: "comms/1",
    a2aProfile: A2A_PROFILE_PINNED,
    features: [],
  };
}
