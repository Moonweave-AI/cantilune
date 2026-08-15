import { type Result, err, ok } from "@cantilune/core";
import { type CommsViolation, commsViolation } from "../foundation/commsViolation.js";
import { type CommsStore } from "../ports/commsStore.js";
import { type CommunicationTransport } from "../ports/communicationTransport.js";
import { type DeliveryRecord } from "../delivery/deliveryRecord.js";
import { type EStopGate } from "../security/identityVerifier.js";
import { type Clock } from "../ports/runtimePorts.js";
import { messageId } from "../foundation/messageId.js";
import { COMMS_LIMITS } from "../foundation/commsLimits.js";
import { assertVerifiedEnvelope, sealVerifiedEnvelope } from "../security/commsCapability.js";

export interface OutboxDispatcherDeps {
  readonly store: CommsStore;
  readonly transport: CommunicationTransport;
  readonly eStop: EStopGate;
  readonly clock: Clock;
}

export interface OutboxDispatchResult {
  readonly dispatched: readonly string[];
  readonly skipped: readonly string[];
  readonly failed: readonly { readonly deliveryId: string; readonly reason: string }[];
}

/** Drains queued outbox deliveries with retry budget and E-Stop awareness. */
export class OutboxDispatcher {
  constructor(private readonly deps: OutboxDispatcherDeps) {}

  async dispatchPending(): Promise<Result<OutboxDispatchResult, CommsViolation>> {
    if (this.deps.eStop.isFrozen()) {
      return err(commsViolation("comms_frozen", "send", "comms E-Stop active"));
    }

    const snapshot = this.deps.store.snapshot();
    const dispatched: string[] = [];
    const skipped: string[] = [];
    const failed: { deliveryId: string; reason: string }[] = [];

    for (const delivery of snapshot.outbox) {
      const outcome = await this.dispatchOne(delivery);
      if (outcome.kind === "skipped") {
        skipped.push(outcome.deliveryId);
      } else if (outcome.kind === "failed") {
        failed.push({ deliveryId: outcome.deliveryId, reason: outcome.reason });
      } else {
        dispatched.push(outcome.deliveryId);
      }
    }

    return ok({ dispatched, skipped, failed });
  }

  private async dispatchOne(
    delivery: DeliveryRecord,
  ): Promise<
    | { readonly kind: "skipped"; readonly deliveryId: string }
    | { readonly kind: "failed"; readonly deliveryId: string; readonly reason: string }
    | { readonly kind: "dispatched"; readonly deliveryId: string }
  > {
    const deliveryId = delivery.deliveryId as string;
    if (delivery.state !== "queued" && delivery.state !== "retryWait") {
      return { kind: "skipped", deliveryId };
    }
    if (delivery.attempt >= COMMS_LIMITS.maxRetryAttempts) {
      return { kind: "failed", deliveryId, reason: "retry budget exhausted" };
    }

    const envelope = this.resolveEnvelope(delivery);
    if (envelope === undefined) {
      return { kind: "failed", deliveryId, reason: "envelope missing" };
    }

    const verified = sealVerifiedEnvelope({
      envelope,
      verifiedAt: this.deps.clock.now(),
    });
    const sealed = assertVerifiedEnvelope(verified);
    if (!sealed.ok) {
      return { kind: "failed", deliveryId, reason: sealed.error.message };
    }

    const result = await this.deps.transport.dispatch(verified);
    if (!result.ok) {
      const retried = this.markRetry(delivery, result.error.message);
      if (retried === "dead") {
        return { kind: "failed", deliveryId, reason: result.error.message };
      }
      return { kind: "skipped", deliveryId };
    }

    const dispatchedRecord: DeliveryRecord = {
      ...delivery,
      state: "dispatched",
      attempt: delivery.attempt + 1,
      dispatchedAt: this.deps.clock.now(),
    };
    this.deps.store.updateDelivery(messageId(delivery.envelopeRef), dispatchedRecord);
    return { kind: "dispatched", deliveryId };
  }

  private markRetry(delivery: DeliveryRecord, reason: string): "retry" | "dead" {
    const nextAttempt = delivery.attempt + 1;
    if (nextAttempt >= COMMS_LIMITS.maxRetryAttempts) {
      this.deps.store.updateDelivery(messageId(delivery.envelopeRef), {
        ...delivery,
        state: "deadLettered",
        attempt: nextAttempt,
        lastSafeError: reason,
        terminalAt: this.deps.clock.now(),
      });
      return "dead";
    }
    this.deps.store.updateDelivery(messageId(delivery.envelopeRef), {
      ...delivery,
      state: "retryWait",
      attempt: nextAttempt,
      lastSafeError: reason,
      nextAttemptAt: this.deps.clock.now(),
    });
    return "retry";
  }

  private resolveEnvelope(delivery: DeliveryRecord) {
    return this.deps.store.getEnvelope(messageId(delivery.envelopeRef));
  }
}
