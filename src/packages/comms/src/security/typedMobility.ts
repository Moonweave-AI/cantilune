/**
 * Admission-bound typed mobility (ADR-0028).
 * Channel / name capability transfer requires a committed SchemaAdmissionReceipt
 * bound to the existing SessionTransportBinding endpoints — no second identity layer.
 * Missing or unusable receipt fail-closes and freezes E-Stop (same family as rotateEndpointPin).
 */
import { type Result, err, ok, type SchemaAdmissionReceipt, type SessionId } from "@cantilune/core";
import { commsViolation, type CommsViolation } from "../foundation/commsViolation.js";
import { type ChannelId, type DescriptorRef } from "../foundation/messageId.js";
import { type SessionTransportBinding } from "../session/sessionTransportBinding.js";
import { type EStopGate } from "./identityVerifier.js";

export interface TransferChannelCapabilityInput {
  readonly session: SessionTransportBinding;
  readonly channelId: ChannelId;
  readonly fromEndpoint: DescriptorRef;
  readonly toEndpoint: DescriptorRef;
  readonly admissionReceiptRef: string;
  readonly eStop: EStopGate;
  readonly resolveReceipt: (ref: string) => Promise<SchemaAdmissionReceipt | undefined>;
}

export interface ChannelCapabilityTransfer {
  readonly sessionId: SessionId;
  readonly channelId: ChannelId;
  readonly fromEndpoint: DescriptorRef;
  readonly toEndpoint: DescriptorRef;
  readonly admissionReceiptRef: string;
  readonly transferredAt: string;
}

function rejectAndStop(
  eStop: EStopGate,
  message: string,
  code: CommsViolation["code"] = "admission_receipt_invalid",
): Result<never, CommsViolation> {
  eStop.setFrozen(true);
  return err(commsViolation(code, "delegate", message, { retryable: false }));
}

function isUsableAdmissionReceipt(receipt: SchemaAdmissionReceipt): boolean {
  return (
    typeof receipt.admissionId === "string" &&
    receipt.admissionId.length > 0 &&
    typeof receipt.committedAt === "string" &&
    !Number.isNaN(Date.parse(receipt.committedAt)) &&
    receipt.toBinding !== undefined &&
    typeof receipt.authorizationEvidenceRef === "string" &&
    receipt.authorizationEvidenceRef.length > 0
  );
}

function endpointOnSession(
  session: SessionTransportBinding,
  endpoint: DescriptorRef,
): boolean {
  return endpoint === session.localEndpoint || endpoint === session.remoteEndpoint;
}

export async function transferChannelCapability(
  input: TransferChannelCapabilityInput,
): Promise<Result<ChannelCapabilityTransfer, CommsViolation>> {
  if (input.eStop.isFrozen()) {
    return err(commsViolation("comms_frozen", "delegate", "comms E-Stop active"));
  }
  if (input.admissionReceiptRef.trim().length === 0) {
    return rejectAndStop(input.eStop, "admission receipt ref required");
  }

  let receipt: SchemaAdmissionReceipt | undefined;
  try {
    receipt = await input.resolveReceipt(input.admissionReceiptRef);
  } catch {
    return rejectAndStop(input.eStop, "admission receipt resolver failed");
  }
  if (receipt === undefined || !isUsableAdmissionReceipt(receipt)) {
    return rejectAndStop(input.eStop, "admission receipt missing or unusable");
  }

  if (receipt.afterSnapshotRef !== input.session.authoritativeSnapshotRef) {
    return rejectAndStop(
      input.eStop,
      "admission receipt is not bound to the session snapshot",
    );
  }

  if (input.channelId !== input.session.channelId) {
    return rejectAndStop(
      input.eStop,
      "channel is not the session channel",
      "stale_channel_generation",
    );
  }

  if ((input.toEndpoint as string).trim().length === 0) {
    return rejectAndStop(input.eStop, "toEndpoint is required", "invalid_input");
  }

  if (!endpointOnSession(input.session, input.fromEndpoint)) {
    return rejectAndStop(
      input.eStop,
      "fromEndpoint is not a session endpoint",
      "identity_unverified",
    );
  }

  return ok({
    sessionId: input.session.sessionId,
    channelId: input.channelId,
    fromEndpoint: input.fromEndpoint,
    toEndpoint: input.toEndpoint,
    admissionReceiptRef: input.admissionReceiptRef,
    transferredAt: receipt.committedAt,
  });
}
