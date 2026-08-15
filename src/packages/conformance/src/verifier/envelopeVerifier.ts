import type { VersionedEvidenceEnvelope } from "../foundation/versionedEvidenceEnvelope.js";
import { isSha256HexDigest } from "../canonical/evidenceDigest.js";
import {
  conformanceViolation,
  type ConformanceViolation,
} from "../foundation/conformanceViolation.js";

const MAX_REF_LEN = 4096;

export function verifyEvidenceEnvelope(
  envelope: VersionedEvidenceEnvelope,
  now: string,
): ConformanceViolation[] {
  const violations: ConformanceViolation[] = [];
  if (envelope.envelopeSchemaVersion !== 1) {
    violations.push(
      conformanceViolation("envelope_invalid", "unsupported envelope schema version"),
    );
  }
  if (envelope.signatureAlgorithm === "none") {
    violations.push(
      conformanceViolation("trust_invalid", "signatureAlgorithm none is not permitted"),
    );
  }
  if (envelope.digestAlgorithm !== "sha256") {
    violations.push(conformanceViolation("envelope_invalid", "digestAlgorithm must be sha256"));
  }
  if (!isSha256HexDigest(envelope.subjectDigest)) {
    violations.push(conformanceViolation("digest_mismatch", "subjectDigest must be sha256 hex"));
  }
  if (!isSha256HexDigest(envelope.evidenceRootDigest)) {
    violations.push(
      conformanceViolation("digest_mismatch", "evidenceRootDigest must be sha256 hex"),
    );
  }
  if (envelope.payloadRef.length === 0 || envelope.payloadRef.length > MAX_REF_LEN) {
    violations.push(conformanceViolation("envelope_invalid", "payloadRef out of bounds"));
  }
  if (envelope.expiresAt !== undefined && now > envelope.expiresAt) {
    violations.push(conformanceViolation("revoked", "evidence envelope expired"));
  }
  if (envelope.notBefore !== undefined && now < envelope.notBefore) {
    violations.push(conformanceViolation("envelope_invalid", "evidence envelope not yet valid"));
  }
  return violations;
}
