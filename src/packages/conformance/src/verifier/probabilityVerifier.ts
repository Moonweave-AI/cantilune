import type { ContentDigest } from "@cantilune/core";
import type {
  FairnessEvidence,
  PositiveProgressEvidence,
  StableWindowEvidence,
} from "../evidence/evidenceFamilies.js";
import { computeEvidenceDigest, isSha256HexDigest } from "../canonical/evidenceDigest.js";
import {
  conformanceViolation,
  type ConformanceViolation,
} from "../foundation/conformanceViolation.js";

export interface ProbabilityEvidenceBundle {
  readonly stableWindow: StableWindowEvidence;
  readonly fairness: FairnessEvidence;
  readonly progress: PositiveProgressEvidence;
}

function requireDigest(
  value: unknown,
  path: string,
  violations: ConformanceViolation[],
): value is ContentDigest {
  if (typeof value !== "string" || !isSha256HexDigest(value)) {
    violations.push(
      conformanceViolation("digest_mismatch", `${path} must be sha256 hex digest`, path),
    );
    return false;
  }
  return true;
}

export function computeProbabilityEvidenceDigest(bundle: ProbabilityEvidenceBundle): ContentDigest {
  return computeEvidenceDigest({
    profile: "canonicalProtocol",
    kind: "probability",
    evidence: {
      stableWindow: bundle.stableWindow.windowDigest,
      fairness: bundle.fairness.fairnessDigest,
      progress: bundle.progress.progressDigest,
    },
  });
}

export function verifyProbabilityEvidence(input: {
  readonly bundle: ProbabilityEvidenceBundle;
  readonly evidenceDigest: ContentDigest;
}): ConformanceViolation[] {
  const violations: ConformanceViolation[] = [];

  requireDigest(
    input.bundle.stableWindow.windowDigest,
    "bundle.stableWindow.windowDigest",
    violations,
  );
  requireDigest(input.bundle.fairness.fairnessDigest, "bundle.fairness.fairnessDigest", violations);
  requireDigest(input.bundle.progress.progressDigest, "bundle.progress.progressDigest", violations);
  if (!requireDigest(input.evidenceDigest, "evidenceDigest", violations)) {
    return violations;
  }

  const expected = computeProbabilityEvidenceDigest(input.bundle);
  if ((input.evidenceDigest as string) !== (expected as string)) {
    violations.push(
      conformanceViolation(
        "probability_invalid",
        "probability evidenceDigest does not match recomputed digest",
        "evidenceDigest",
      ),
    );
  }

  return violations;
}
