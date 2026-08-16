/**
 * Endpoint fingerprint pin rotation — new pin only via admission receipt.
 * Invalid receipt or stale pin presentation fail-closes and freezes E-Stop.
 */
import { type Result, err, ok, type SchemaAdmissionReceipt } from "@cantilune/core";
import { commsViolation, type CommsViolation } from "../foundation/commsViolation.js";
import { type PeerDirectory } from "../ports/communicationTransport.js";
import {
  fingerprintInPinnedSet,
  fingerprintsEqual,
  isSha256Fingerprint,
  normalizeCertificateFingerprint,
} from "./certificateFingerprint.js";
import { type EStopGate } from "./identityVerifier.js";

export interface RotateEndpointPinInput {
  readonly peerRef: string;
  readonly oldFingerprint: string;
  readonly newFingerprint: string;
  readonly admissionReceiptRef: string;
  readonly directory: PeerDirectory;
  readonly eStop: EStopGate;
  readonly resolveReceipt: (ref: string) => Promise<SchemaAdmissionReceipt | undefined>;
}

export interface EndpointPinRotation {
  readonly peerRef: string;
  readonly previousFingerprints: readonly string[];
  readonly pinnedFingerprints: readonly string[];
  readonly admissionReceiptRef: string;
}

function rejectAndStop(
  eStop: EStopGate,
  message: string,
  code: CommsViolation["code"] = "admission_receipt_invalid",
): Result<never, CommsViolation> {
  eStop.setFrozen(true);
  return err(commsViolation(code, "authenticate", message, { retryable: false }));
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

export async function rotateEndpointPin(
  input: RotateEndpointPinInput,
): Promise<Result<EndpointPinRotation, CommsViolation>> {
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

  if (!isSha256Fingerprint(input.oldFingerprint) || !isSha256Fingerprint(input.newFingerprint)) {
    return rejectAndStop(
      input.eStop,
      "fingerprint is not a SHA-256 hex digest",
      "identity_unverified",
    );
  }

  const oldFingerprint = normalizeCertificateFingerprint(input.oldFingerprint);
  const newFingerprint = normalizeCertificateFingerprint(input.newFingerprint);
  const previous = input.directory.getPinnedFingerprints(input.peerRef);

  if (previous.length > 0 && !fingerprintInPinnedSet(oldFingerprint, previous)) {
    return rejectAndStop(
      input.eStop,
      "old fingerprint is not the current pin",
      "identity_unverified",
    );
  }

  if (fingerprintsEqual(oldFingerprint, newFingerprint)) {
    const pinnedFingerprints = previous.length > 0 ? previous : [newFingerprint];
    if (previous.length === 0) {
      input.directory.setPinnedFingerprints(input.peerRef, pinnedFingerprints);
    }
    return ok({
      peerRef: input.peerRef,
      previousFingerprints: previous,
      pinnedFingerprints,
      admissionReceiptRef: input.admissionReceiptRef,
    });
  }

  const pinnedFingerprints = [newFingerprint];
  input.directory.setPinnedFingerprints(input.peerRef, pinnedFingerprints);
  return ok({
    peerRef: input.peerRef,
    previousFingerprints: previous,
    pinnedFingerprints,
    admissionReceiptRef: input.admissionReceiptRef,
  });
}
