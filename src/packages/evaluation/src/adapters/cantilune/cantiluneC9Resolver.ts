import {
  ok,
  violations,
  violation,
  type EvaluationResult,
} from "../../foundation/evaluationResult.js";
import type {
  ConformanceCertificateResolver,
  ResolvedCertificate,
} from "../../ports/productEvidence.js";
import type { CertificateValidity } from "../../foundation/evaluationStatus.js";

/**
 * Resolves sealed C9 PackageConformanceCertificates from a conformance-backed store.
 * checkRevocation MUST honor the revocation checkpoint parameter (ADR-0011 A54).
 */
export function createCantiluneC9Resolver(
  certificateStore: CertificateStorePort,
): ConformanceCertificateResolver {
  return {
    async resolve(certificateRef: string): Promise<EvaluationResult<ResolvedCertificate>> {
      const cert = await certificateStore.getCertificate(certificateRef);
      if (cert === undefined) {
        return violations([
          violation(
            "subject_certificate_invalid",
            "certificate.ref",
            `Certificate not found: ${certificateRef}`,
          ),
        ]);
      }
      return ok(cert);
    },

    async checkValidity(certificateRef: string): Promise<CertificateValidity> {
      const cert = await certificateStore.getCertificate(certificateRef);
      if (cert === undefined) return "expired";
      return cert.status;
    },

    async checkRevocation(certificateRef: string, checkpoint: string): Promise<boolean> {
      if (typeof checkpoint !== "string" || checkpoint.length === 0) {
        // Fail-closed: missing checkpoint must not silently skip revocation.
        return true;
      }

      if (certificateStore.isRevokedAtCheckpoint !== undefined) {
        return certificateStore.isRevokedAtCheckpoint(certificateRef, checkpoint);
      }

      const cert = await certificateStore.getCertificate(certificateRef);
      if (cert === undefined) return true;
      if (cert.status === "revoked") return true;

      // When the store exposes a checkpoint on the certificate, a mismatched
      // caller checkpoint fails closed (A54: mid-run revocation detection).
      const certCheckpoint = cert.revocationCheckpoint;
      if (typeof certCheckpoint === "string" && certCheckpoint !== checkpoint) {
        return true;
      }
      return false;
    },
  };
}

export interface CertificateStorePort {
  getCertificate(ref: string): Promise<ResolvedCertificate | undefined>;
  /**
   * Optional conformance RevocationStore bridge.
   * When present, checkRevocation delegates checkpoint-aware lookup here.
   */
  isRevokedAtCheckpoint?(certificateRef: string, checkpoint: string): Promise<boolean>;
}
