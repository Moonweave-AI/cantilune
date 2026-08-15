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
 * Resolves sealed C9 PackageConformanceCertificates from the conformance package.
 * Delegates to a CertificateStorePort — callers wire the actual conformance backend.
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

    async checkRevocation(certificateRef: string, _checkpoint: string): Promise<boolean> {
      const cert = await certificateStore.getCertificate(certificateRef);
      if (cert === undefined) return true;
      return cert.status === "revoked";
    },
  };
}

export interface CertificateStorePort {
  getCertificate(ref: string): Promise<ResolvedCertificate | undefined>;
}
