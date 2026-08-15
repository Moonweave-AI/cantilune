import { type Result, ok } from "@cantilune/core";
import { type CommsViolation } from "../foundation/commsViolation.js";
import { type PeerDirectory } from "../ports/communicationTransport.js";
import { type IdentityVerifier, type EndpointPolicy } from "../security/identityVerifier.js";
import { type PeerDescriptor, type PeerCompatibilityResult } from "../peer/peerDescriptor.js";
import { type DescriptorRef, wireVersion } from "../foundation/messageId.js";
import { defaultNegotiatedProtocol } from "../peer/negotiatedProtocol.js";
import { COMMS_WIRE_VERSION_V1 } from "../foundation/commsLimits.js";

export interface CommsPeerServiceDeps {
  readonly directory: PeerDirectory;
  readonly identity: IdentityVerifier;
  readonly endpointPolicy: EndpointPolicy;
}

export class CommsPeerService {
  constructor(private readonly deps: CommsPeerServiceDeps) {}

  async resolvePeer(descriptorRef: DescriptorRef): Promise<Result<PeerDescriptor, CommsViolation>> {
    const descriptor = await this.deps.directory.resolve(descriptorRef);
    if (descriptor === undefined) {
      return {
        ok: false,
        error: {
          code: "invalid_input",
          phase: "query",
          message: "peer not found",
          retryable: false,
        },
      };
    }
    for (const endpoint of descriptor.endpoints) {
      const policy = this.deps.endpointPolicy.assertEndpointAllowed(endpoint.uri);
      if (!policy.ok) {
        return policy;
      }
    }
    return ok(descriptor);
  }

  negotiateCompatibility(descriptor: PeerDescriptor): PeerCompatibilityResult {
    const supports = descriptor.supportedWireVersions.some(
      (v) => (v as number) === COMMS_WIRE_VERSION_V1,
    );
    if (!supports) {
      return { compatibility: "incompatible", reason: "wire version mismatch" };
    }
    const transport = descriptor.supportedTransports[0] ?? "loopback";
    defaultNegotiatedProtocol(wireVersion(COMMS_WIRE_VERSION_V1), transport);
    return {
      compatibility: "ready",
      negotiatedWireVersion: wireVersion(COMMS_WIRE_VERSION_V1),
      negotiatedTransport: transport,
    };
  }
}
