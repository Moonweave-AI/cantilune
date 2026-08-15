import type { Result } from "@cantilune/core";
import { err, ok } from "@cantilune/core";
import type { CertificateId } from "../foundation/conformanceId.js";
import type { PackageConformanceCertificate } from "../certificate/packageConformanceCertificate.js";
import type { ConformanceViolation } from "../foundation/conformanceViolation.js";
import { conformanceViolation } from "../foundation/conformanceViolation.js";
import type { CertificateLifecycleRecord } from "./certificateLifecycle.js";

export interface SupersessionInput {
  readonly priorCertificateId: CertificateId;
  readonly successor: PackageConformanceCertificate;
  readonly supersededAt?: string;
}

export function supersedeCertificate(
  prior: CertificateLifecycleRecord,
  input: SupersessionInput,
): Result<CertificateLifecycleRecord, ConformanceViolation[]> {
  if (prior.state !== "issued") {
    return err([
      conformanceViolation("admission_invalid", "only issued certificates can be superseded"),
    ]);
  }
  if (prior.certificateId !== input.priorCertificateId) {
    return err([conformanceViolation("admission_invalid", "prior certificate id mismatch")]);
  }
  if (input.successor.supersedes !== input.priorCertificateId) {
    return err([
      conformanceViolation(
        "admission_invalid",
        "successor certificate must reference prior id in supersedes",
      ),
    ]);
  }
  const supersededAt = input.supersededAt ?? new Date().toISOString();
  return ok({
    certificateId: prior.certificateId,
    state: "superseded",
    updatedAt: supersededAt,
  });
}

export function isSupersededState(record: CertificateLifecycleRecord): boolean {
  return record.state === "superseded";
}
