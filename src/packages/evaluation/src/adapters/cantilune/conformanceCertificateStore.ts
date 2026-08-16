import type { ContentDigest } from "@cantilune/core";
import type { RevocationStore } from "@cantilune/conformance/ports";
import type { PackageConformanceCertificate } from "@cantilune/conformance";
import type {
  ConformanceCertificateResolver,
  ResolvedCertificate,
} from "../../ports/productEvidence.js";
import type { CertificateValidity } from "../../foundation/evaluationStatus.js";
import type { CertificateStorePort } from "./cantiluneC9Resolver.js";
import { createCantiluneC9Resolver } from "./cantiluneC9Resolver.js";

export interface ConformanceCertificateLookup {
  getByRef(ref: string): Promise<PackageConformanceCertificate | undefined>;
}

function mapStatus(status: PackageConformanceCertificate["status"]): CertificateValidity {
  if (status.release === "revoked") return "revoked";
  if (status.release === "expired" || status.release === "superseded") return "expired";
  if (status.release === "accepted" || status.release === "conditional") return "valid";
  // notEvaluated / blocked — treat as not yet valid for evaluation subjects
  return "expired";
}

/**
 * Adapts a real conformance certificate lookup + revocation store into the
 * evaluation CertificateStorePort (no local shim).
 */
export function createConformanceCertificateStore(options: {
  readonly certificates: ConformanceCertificateLookup;
  readonly revocationStore: RevocationStore;
}): CertificateStorePort {
  const { certificates, revocationStore } = options;
  return {
    async getCertificate(ref: string): Promise<ResolvedCertificate | undefined> {
      const cert = await certificates.getByRef(ref);
      if (cert === undefined) return undefined;
      return {
        certificateDigest: cert.evidenceRootDigest as ContentDigest,
        artifactSubjectDigest: cert.artifactSubject.artifactDigest,
        verifierBuild: cert.verifierBuild,
        policyVersion: cert.policyVersion,
        evidenceRootDigest: cert.evidenceRootDigest as ContentDigest,
        issuedAt: cert.issuedAt,
        expiresAt: cert.expiresAt,
        status: mapStatus(cert.status),
        revocationCheckpoint: cert.revocationCheckpoint,
      };
    },
    async isRevokedAtCheckpoint(certificateRef: string, checkpoint: string): Promise<boolean> {
      if (checkpoint !== revocationStore.checkpoint) {
        // Fail-closed when caller checkpoint diverges from store checkpoint (A54).
        return true;
      }
      return revocationStore.isRevoked(certificateRef);
    },
  };
}

export function createCantiluneC9ResolverFromConformance(options: {
  readonly certificates: ConformanceCertificateLookup;
  readonly revocationStore: RevocationStore;
}): ConformanceCertificateResolver {
  return createCantiluneC9Resolver(createConformanceCertificateStore(options));
}
