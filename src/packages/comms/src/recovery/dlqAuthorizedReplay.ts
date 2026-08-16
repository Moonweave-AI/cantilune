/**
 * Privileged DLQ replay (ADR-0018 A20): authorized operators may re-open a
 * dead-lettered delivery for outbox re-dispatch. Fail-closed without receipt.
 */
import { type Result, err, ok } from "@cantilune/core";
import { type CommsViolation, commsViolation } from "../foundation/commsViolation.js";
import type { CommsStore } from "../ports/commsStore.js";
import type { DeadLetterRecord } from "../delivery/deliveryRecord.js";
import type { MessageId } from "../foundation/messageId.js";

export interface DlqReplayAuthorization {
  readonly authorizationReceipt: string;
  readonly operatorPrincipal: string;
  readonly reason: string;
}

export interface DlqReplayResult {
  readonly messageId: string;
  readonly deliveryId: string;
  readonly redispatched: boolean;
}

function assertAuthorized(auth: DlqReplayAuthorization): Result<void, CommsViolation> {
  if (auth.authorizationReceipt.trim().length === 0) {
    return err(
      commsViolation(
        "authorization_denied",
        "session",
        "DLQ replay requires a non-empty authorizationReceipt",
      ),
    );
  }
  if (auth.operatorPrincipal.trim().length === 0) {
    return err(
      commsViolation("authorization_denied", "session", "DLQ replay requires operatorPrincipal"),
    );
  }
  if (auth.reason.trim().length === 0) {
    return err(
      commsViolation("authorization_denied", "session", "DLQ replay requires a reason"),
    );
  }
  return ok(undefined);
}

/**
 * Re-open a dead-lettered delivery into a dispatchable state after privilege check.
 */
export function replayDeadLetter(input: {
  readonly store: CommsStore;
  readonly messageId: MessageId;
  readonly deadLetter: DeadLetterRecord;
  readonly auth: DlqReplayAuthorization;
}): Result<DlqReplayResult, CommsViolation> {
  const gate = assertAuthorized(input.auth);
  if (!gate.ok) return gate;

  const delivery = input.store.getDelivery(input.messageId);
  if (delivery === undefined) {
    return err(
      commsViolation(
        "invalid_input",
        "session",
        `delivery not found for message ${input.messageId as string}`,
      ),
    );
  }
  if (delivery.state !== "deadLettered") {
    return err(
      commsViolation(
        "invalid_input",
        "session",
        `delivery state is ${delivery.state}, expected deadLettered`,
      ),
    );
  }
  if (delivery.deliveryId !== input.deadLetter.deliveryId) {
    return err(
      commsViolation(
        "invalid_input",
        "session",
        "deadLetter.deliveryId does not match store delivery",
      ),
    );
  }

  const next = {
    ...delivery,
    state: "queued" as const,
    lastSafeError: `dlq-replay:${input.auth.operatorPrincipal}:${input.auth.reason}`,
  };
  const updated = input.store.updateDelivery(input.messageId, next);
  if (!updated) {
    return err(
      commsViolation("stale_binding", "session", "failed to update delivery for DLQ replay", {
        retryable: true,
      }),
    );
  }

  return ok({
    messageId: input.messageId as string,
    deliveryId: input.deadLetter.deliveryId as string,
    redispatched: true,
  });
}
