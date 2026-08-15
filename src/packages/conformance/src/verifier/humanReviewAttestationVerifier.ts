import { canonicalJsonBytes } from "../canonical/canonicalEncoding.js";
import { computeEvidenceDigest, isSha256HexDigest } from "../canonical/evidenceDigest.js";
import {
  conformanceViolation,
  type ConformanceViolation,
} from "../foundation/conformanceViolation.js";
import type { TrustStore, TrustRootEntry } from "../ports/trustStore.js";
import type { CryptoVerifier } from "../ports/cryptoVerifier.js";
import type { VerifiedDecision } from "../lifecycle/sealedDecision.js";
import {
  isSignedHumanReviewAttestation,
  type SignedHumanReviewAttestation,
} from "../certificate/signedHumanReviewAttestation.js";
import type { HumanReviewAttestation } from "../certificate/packageConformanceCertificate.js";

const REVIEWER_SCOPE = "conformance/human-review";
const MIN_QUORUM = 2;

export interface HumanReviewVerificationDeps {
  readonly trustStore: TrustStore;
  readonly crypto: CryptoVerifier;
  readonly requiredRoles: readonly string[];
  readonly now: string;
  readonly machineVerifierOwnerId?: string;
}

function attestationPayload(
  attestation: Omit<SignedHumanReviewAttestation, "signature">,
): Uint8Array {
  const { signature: _signature, ...unsigned } = attestation as SignedHumanReviewAttestation & {
    signature?: string;
  };
  return canonicalJsonBytes(unsigned);
}

function verifyAttestationDigest(
  attestation: SignedHumanReviewAttestation,
): ConformanceViolation[] {
  const expectedDigest = computeEvidenceDigest({
    reviewerId: attestation.reviewerId,
    roles: attestation.roles,
    decision: attestation.decision,
    machineDecisionRef: attestation.machineDecisionRef,
    reviewedAt: attestation.reviewedAt,
    commentRef: attestation.commentRef,
  }) as string;

  if (attestation.attestationDigest !== expectedDigest) {
    return [conformanceViolation("admission_invalid", "human review attestation digest mismatch")];
  }
  return [];
}

function verifyMachineDecisionBinding(
  attestation: SignedHumanReviewAttestation,
  verified: VerifiedDecision,
): ConformanceViolation[] {
  if (attestation.machineDecisionRef !== (verified.decision.evidenceRootDigest as string)) {
    return [
      conformanceViolation(
        "admission_invalid",
        "signed attestation does not bind to sealed machine decision",
      ),
    ];
  }
  return [];
}

function verifyTrustRootValidity(
  attestation: SignedHumanReviewAttestation,
  deps: HumanReviewVerificationDeps,
): { readonly violations: ConformanceViolation[]; readonly root?: TrustRootEntry } {
  const roots = deps.trustStore.getRoots(REVIEWER_SCOPE);
  const root = roots.find((entry) => entry.keyId === attestation.keyId);
  if (root === undefined) {
    return {
      violations: [
        conformanceViolation("trust_invalid", `unknown reviewer keyId ${attestation.keyId}`),
      ],
    };
  }

  const violations: ConformanceViolation[] = [];
  if (deps.now < root.notBefore || deps.now > root.expiresAt) {
    violations.push(
      conformanceViolation("trust_invalid", "reviewer trust root outside validity window"),
    );
  }
  return { violations, root };
}

function verifyRequiredRoles(
  attestation: SignedHumanReviewAttestation,
  root: TrustRootEntry,
  requiredRoles: readonly string[],
): ConformanceViolation[] {
  const violations: ConformanceViolation[] = [];
  for (const role of requiredRoles) {
    if (!attestation.roles.includes(role)) {
      violations.push(
        conformanceViolation("admission_invalid", `reviewer missing required role ${role}`),
      );
    }
    if (!root.scope.includes(role)) {
      violations.push(
        conformanceViolation("trust_invalid", `reviewer key not scoped for role ${role}`),
      );
    }
  }
  return violations;
}

function verifyQuorum(
  attestation: SignedHumanReviewAttestation,
  requiredRoles: readonly string[],
): ConformanceViolation[] {
  if (requiredRoles.length >= MIN_QUORUM && attestation.roles.length < MIN_QUORUM) {
    return [
      conformanceViolation(
        "admission_invalid",
        `human review quorum requires at least ${MIN_QUORUM} distinct roles`,
      ),
    ];
  }
  return [];
}

function verifyConflictOfInterest(
  attestation: SignedHumanReviewAttestation,
  machineVerifierOwnerId: string | undefined,
): ConformanceViolation[] {
  if (machineVerifierOwnerId !== undefined && attestation.reviewerId === machineVerifierOwnerId) {
    return [
      conformanceViolation(
        "admission_invalid",
        "reviewer conflicts with machine verifier owner (COI)",
      ),
    ];
  }
  return [];
}

async function verifyAttestationSignature(
  attestation: SignedHumanReviewAttestation,
  root: TrustRootEntry,
  crypto: CryptoVerifier,
): Promise<ConformanceViolation[]> {
  const signatureBytes = Buffer.from(attestation.signature, "base64");
  const payload = attestationPayload(attestation);
  const valid = await crypto.verifySignature(
    "attestation",
    payload,
    Uint8Array.from(signatureBytes),
    root.publicKey,
  );
  if (!valid) {
    return [conformanceViolation("trust_invalid", "human review attestation signature invalid")];
  }
  return [];
}

function verifyAttestationDigestFormat(
  attestation: SignedHumanReviewAttestation,
): ConformanceViolation[] {
  if (!isSha256HexDigest(attestation.attestationDigest)) {
    return [conformanceViolation("digest_mismatch", "attestationDigest must be sha256 hex")];
  }
  return [];
}

export async function verifyHumanReviewAttestation(
  attestation: HumanReviewAttestation,
  verified: VerifiedDecision,
  deps: HumanReviewVerificationDeps,
): Promise<ConformanceViolation[]> {
  if (!isSignedHumanReviewAttestation(attestation)) {
    return [
      conformanceViolation(
        "admission_invalid",
        "human review attestation must include keyId, signature, and attestationDigest",
      ),
    ];
  }

  const violations: ConformanceViolation[] = [
    ...verifyAttestationDigest(attestation),
    ...verifyMachineDecisionBinding(attestation, verified),
  ];

  const trustCheck = verifyTrustRootValidity(attestation, deps);
  violations.push(...trustCheck.violations);
  if (trustCheck.root === undefined) {
    return violations;
  }

  violations.push(
    ...verifyRequiredRoles(attestation, trustCheck.root, deps.requiredRoles),
    ...verifyQuorum(attestation, deps.requiredRoles),
    ...verifyConflictOfInterest(attestation, deps.machineVerifierOwnerId),
    ...(await verifyAttestationSignature(attestation, trustCheck.root, deps.crypto)),
    ...verifyAttestationDigestFormat(attestation),
  );

  return violations;
}
