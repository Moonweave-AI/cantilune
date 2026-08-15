import { createHash } from "node:crypto";
import { type ContentDigest, contentDigest } from "@cantilune/core";
import { canonicalJsonBytes } from "./canonicalJson.js";

const HEX64 = /^[a-f0-9]{64}$/;

function computeDigest(value: unknown): ContentDigest {
  const hex = createHash("sha256").update(canonicalJsonBytes(value)).digest("hex");
  return contentDigest(hex);
}

/** Product-owned comms conformance evidence — not part of central verifier scope. */
export interface CommsProductCertificateSubject {
  readonly packageName: "@cantilune/comms";
  readonly packageVersion: string;
  readonly registryVersion: number;
  readonly wireVersion: number;
  readonly a2aProfile: string;
  readonly occurrenceCount: number;
  readonly reconnectEvidenceDigest: ContentDigest;
  readonly messagingSagaDigest: ContentDigest;
  readonly fileStoreDigest: ContentDigest;
}

export interface CommsProductCertificate {
  readonly subject: CommsProductCertificateSubject;
  readonly claimScope: "reference" | "product";
  readonly verifierBuild: string;
  readonly evidenceDigest: ContentDigest;
  readonly proofManifestRef: string;
}

export function commsCertificateComplete(subject: CommsProductCertificateSubject): boolean {
  const digestOk = (value: string) => HEX64.test(value);
  return (
    subject.packageVersion.length > 0 &&
    subject.registryVersion > 0 &&
    subject.wireVersion > 0 &&
    subject.a2aProfile.length > 0 &&
    subject.occurrenceCount > 0 &&
    digestOk(subject.reconnectEvidenceDigest as string) &&
    digestOk(subject.messagingSagaDigest as string) &&
    digestOk(subject.fileStoreDigest as string)
  );
}

export function verifyCommsProductCertificate(certificate: CommsProductCertificate): boolean {
  if (!commsCertificateComplete(certificate.subject)) {
    return false;
  }
  const expected = computeDigest({
    profile: "canonicalProtocol",
    claimScope: certificate.claimScope,
    subject: certificate.subject,
    proofManifestRef: certificate.proofManifestRef,
    verifierBuild: certificate.verifierBuild,
  });
  return (
    (certificate.evidenceDigest as string) === (expected as string) &&
    certificate.proofManifestRef.startsWith("proof://")
  );
}

export const COMMS_CONFORMANCE_PROFILE = "canonicalProtocol" as const;
