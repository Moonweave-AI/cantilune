/**
 * Digest reference to a `@cantilune/conformance` ProjectionCertificate.
 * Observability must not copy the certificate interface (ADR-0025).
 */
export interface ProjectionCertificateDigest {
  readonly digest: string;
}

export function projectionCertificateDigest(digest: string): ProjectionCertificateDigest {
  if (digest.length === 0) {
    throw new Error("ProjectionCertificateDigest.digest must be a non-empty string");
  }
  return { digest };
}
