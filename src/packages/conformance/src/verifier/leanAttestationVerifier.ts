import type { Result } from "@cantilune/core";
import { err, ok } from "@cantilune/core";
import type { ConformanceViolation } from "../foundation/conformanceViolation.js";
import { conformanceViolation } from "../foundation/conformanceViolation.js";
import {
  bindLeanAttestationToProofManifest,
  computeLeanBuildAttestationDigest,
  leanBuildAttestationComplete,
  type LeanBuildAttestation,
} from "../evidence/leanBuildAttestation.js";
import { isProofManifestRef } from "../evidence/leanBuildAttestation.js";
import { sealVerifiedDecision, type VerifiedDecision } from "../lifecycle/sealedDecision.js";
import type { VerificationDecision } from "../foundation/verificationDecision.js";
import { initialConformanceStatus } from "../foundation/conformanceStatus.js";
import { verificationRunId } from "../foundation/conformanceId.js";
import type { TrustStore } from "../ports/trustStore.js";
import type { CryptoVerifier } from "../ports/cryptoVerifier.js";
import { canonicalJsonBytes } from "../canonical/canonicalEncoding.js";

export const LEAN_ATTESTATION_VERIFIER_BUILD = "lean-attestation-verifier/0.2.0";

export interface LeanAttestationVerifyInput {
  readonly attestation: LeanBuildAttestation;
  readonly proofManifestRef: string;
  readonly payloadDigest: string;
  readonly trustStore: TrustStore;
  readonly crypto: CryptoVerifier;
  readonly now?: () => string;
}

export async function verifyLeanBuildAttestation(
  input: LeanAttestationVerifyInput,
): Promise<
  Result<
    { readonly attestationDigest: string; readonly verified: VerifiedDecision },
    ConformanceViolation[]
  >
> {
  const now = input.now ?? (() => new Date().toISOString());
  const violations: ConformanceViolation[] = [];

  if (!leanBuildAttestationComplete(input.attestation)) {
    violations.push(
      conformanceViolation("missing_evidence", "lean build attestation structure incomplete"),
    );
  }
  if (!isProofManifestRef(input.proofManifestRef)) {
    violations.push(
      conformanceViolation(
        "projection_invalid",
        "proof manifest ref must match proof-manifest/{sha256}",
      ),
    );
  }
  if (
    leanBuildAttestationComplete(input.attestation) &&
    !bindLeanAttestationToProofManifest(input.attestation, input.proofManifestRef)
  ) {
    violations.push(
      conformanceViolation(
        "projection_invalid",
        "proof manifest ref does not bind to attestation digest",
      ),
    );
  }

  const attestationDigest = computeLeanBuildAttestationDigest(input.attestation) as string;
  if (input.payloadDigest !== attestationDigest) {
    violations.push(
      conformanceViolation("admission_invalid", "attestation digest binding mismatch"),
    );
  }

  if (now() < input.attestation.notBefore || now() > input.attestation.expiresAt) {
    violations.push(conformanceViolation("revoked", "lean attestation outside validity window"));
  }

  const roots = input.trustStore.getRoots("conformance/lean-builder");
  const root = roots.find((entry) => entry.keyId === input.attestation.keyId);
  if (root === undefined) {
    violations.push(conformanceViolation("trust_invalid", "lean builder key not in trust store"));
  } else {
    const payload = canonicalJsonBytes({
      attestationDigest,
      builderIdentity: input.attestation.builderIdentity,
      gitCommit: input.attestation.gitCommit,
      gitTree: input.attestation.gitTree,
    });
    const signatureBytes = Buffer.from(input.attestation.signature, "base64");
    const valid = await input.crypto.verifySignature(
      "attestation",
      payload,
      Uint8Array.from(signatureBytes),
      root.publicKey,
    );
    if (!valid) {
      violations.push(conformanceViolation("trust_invalid", "lean attestation signature invalid"));
    }
  }

  if (violations.length > 0) {
    return err(violations);
  }

  const decision: VerificationDecision = {
    runId: verificationRunId(`lean-${now()}`),
    profile: "fourProjection",
    status: {
      ...initialConformanceStatus(),
      theory: "reviewed",
      machine: "verified",
      humanReview: "pending",
      release: "notEvaluated",
    },
    violations: [],
    evidenceRootDigest: attestationDigest,
    decidedAt: now(),
  };

  const verified = sealVerifiedDecision({
    decision,
    verifiedAt: now(),
    verifierBuild: LEAN_ATTESTATION_VERIFIER_BUILD,
  });

  return ok({ attestationDigest, verified });
}
