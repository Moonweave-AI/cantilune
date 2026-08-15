import { type Result, err, ok } from "@cantilune/core";
import { type CommsViolation, commsViolation } from "../foundation/commsViolation.js";
import { type CommsStore } from "../ports/commsStore.js";
import type { OutboxDispatcher } from "./outboxDispatcher.js";
import { type EStopGate } from "../security/identityVerifier.js";
import { deliveryAttemptId, commsEventId, messageId } from "../foundation/messageId.js";
import { type Clock, type EventSink } from "../ports/runtimePorts.js";

export interface DeliveryRecoveryDeps {
  readonly store: CommsStore;
  readonly outboxDispatcher: OutboxDispatcher;
  readonly eStop: EStopGate;
  readonly events: EventSink;
  readonly clock: Clock;
}

export interface DeliveryRecoveryReport {
  readonly redispatched: number;
  readonly deadLettered: number;
  readonly unchanged: number;
}

/** Reconciles unfinished delivery records after crash or transport failure. */
export class DeliveryRecovery {
  constructor(private readonly deps: DeliveryRecoveryDeps) {}

  async reconcile(): Promise<Result<DeliveryRecoveryReport, CommsViolation>> {
    if (this.deps.eStop.isFrozen()) {
      return err(commsViolation("comms_frozen", "recover", "comms E-Stop active"));
    }

    const snapshot = this.deps.store.snapshot();
    let redispatched = 0;
    let deadLettered = 0;
    let unchanged = 0;

    for (const delivery of snapshot.outbox) {
      if (delivery.state === "acknowledged" || delivery.state === "deadLettered") {
        unchanged += 1;
        continue;
      }
      if (delivery.state === "dispatched" && delivery.ackAt !== undefined) {
        unchanged += 1;
      }
    }

    const dispatch = await this.deps.outboxDispatcher.dispatchPending();
    if (!dispatch.ok) {
      return dispatch;
    }
    redispatched = dispatch.value.dispatched.length;
    deadLettered = dispatch.value.failed.length;

    for (const failure of dispatch.value.failed) {
      const snapshot = this.deps.store.snapshot();
      const delivery = snapshot.outbox.find((d) => d.deliveryId === failure.deliveryId);
      if (delivery !== undefined) {
        this.deps.store.updateDelivery(messageId(delivery.envelopeRef), {
          ...delivery,
          state: "deadLettered",
          terminalAt: this.deps.clock.now(),
          lastSafeError: failure.reason,
        });
      }
      this.deps.store.putDeadLetter({
        deliveryId: deliveryAttemptId(failure.deliveryId),
        envelopeRef: failure.deliveryId,
        reason: failure.reason,
        quarantinedAt: this.deps.clock.now(),
      });
      this.deps.events.emit({
        eventId: commsEventId(`evt-dlq-${failure.deliveryId}`),
        storeSequence: this.deps.store.nextSequence(),
        kind: "MessageDeadLettered",
        occurredAt: this.deps.clock.now(),
        payload: { deliveryId: failure.deliveryId, reason: failure.reason },
      });
    }

    return ok({ redispatched, deadLettered, unchanged });
  }
}
