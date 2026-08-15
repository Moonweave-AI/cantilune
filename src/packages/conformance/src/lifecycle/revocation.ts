import type { Result } from "@cantilune/core";
import { err, ok } from "@cantilune/core";
import type { CertificateId } from "../foundation/conformanceId.js";
import type { CertificateRevocationRecord } from "../certificate/packageConformanceCertificate.js";
import type { ConformanceViolation } from "../foundation/conformanceViolation.js";
import { conformanceViolation } from "../foundation/conformanceViolation.js";
import type {
  CertificateLifecycleRecord,
  CertificateLifecycleState,
} from "./certificateLifecycle.js";

export interface RevocationInput {
  readonly certificateId: CertificateId;
  readonly reason: string;
  readonly checkpoint: string;
  readonly revokedAt?: string;
}

export function revokeCertificate(
  record: CertificateLifecycleRecord,
  input: RevocationInput,
): Result<
  { readonly record: CertificateLifecycleRecord; readonly revocation: CertificateRevocationRecord },
  ConformanceViolation[]
> {
  if (
    record.state !== "issued" &&
    record.state !== "humanReviewed" &&
    record.state !== "machineVerified"
  ) {
    return err([
      conformanceViolation(
        "admission_invalid",
        `cannot revoke certificate in state ${record.state}`,
      ),
    ]);
  }
  if (record.certificateId !== input.certificateId) {
    return err([
      conformanceViolation("admission_invalid", "certificate id mismatch on revocation"),
    ]);
  }
  const revokedAt = input.revokedAt ?? new Date().toISOString();
  const revocation: CertificateRevocationRecord = {
    certificateId: input.certificateId,
    revokedAt,
    reason: input.reason,
    checkpoint: input.checkpoint,
  };
  const next: CertificateLifecycleRecord = {
    certificateId: record.certificateId,
    state: "revoked" satisfies CertificateLifecycleState,
    updatedAt: revokedAt,
  };
  return ok({ record: next, revocation });
}

export function isRevokedState(record: CertificateLifecycleRecord): boolean {
  return record.state === "revoked";
}
