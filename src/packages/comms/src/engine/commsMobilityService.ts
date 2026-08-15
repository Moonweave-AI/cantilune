import { type Result, err, ok } from "@cantilune/core";
import { type CommsViolation, commsViolation } from "../foundation/commsViolation.js";
import { type CommsStore } from "../ports/commsStore.js";
import {
  type EndpointDelegationPlan,
  type EndpointDelegationReceipt,
  type FreshEndpointAllocation,
} from "../mobility/endpointDelegation.js";
import { type FreshEndpointAllocator } from "../ports/communicationTransport.js";
import { type AuthenticatedCommsContext } from "../peer/authenticatedPeerContext.js";
import { type SessionAuthority } from "../ports/runtimePorts.js";
import { type EStopGate } from "../security/identityVerifier.js";

export interface CommsMobilityServiceDeps {
  readonly store: CommsStore;
  readonly allocator: FreshEndpointAllocator;
  readonly sessionAuthority: SessionAuthority;
  readonly eStop: EStopGate;
  readonly clock: { now(): string };
}

export class CommsMobilityService {
  constructor(private readonly deps: CommsMobilityServiceDeps) {}

  delegate(
    context: AuthenticatedCommsContext,
    plan: EndpointDelegationPlan,
  ): Result<EndpointDelegationReceipt, CommsViolation> {
    if (this.deps.eStop.isFrozen()) {
      return err(commsViolation("comms_frozen", "delegate", "comms E-Stop active"));
    }
    if (!this.deps.sessionAuthority.isController(plan.metadata.sessionId, context.peer.principal)) {
      return err(
        commsViolation("authorization_denied", "delegate", "delegator not session controller"),
      );
    }
    this.deps.store.putDelegation(plan);
    const receipt: EndpointDelegationReceipt = {
      planDigest: plan.planDigest,
      peerAckDigest: plan.planDigest,
      delegatedAt: this.deps.clock.now(),
      oldEndpointTombstoneRef: `tombstone://${plan.oldEndpointRef as string}`,
    };
    this.deps.store.putDelegationReceipt(receipt);
    return ok(receipt);
  }

  allocateFreshEndpoint(): Result<FreshEndpointAllocation, CommsViolation> {
    return this.deps.allocator.allocate();
  }
}
