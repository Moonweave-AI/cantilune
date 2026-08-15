import type { ConformanceProfile } from "./conformanceProfile.js";
import type { ConformanceStatusAxes } from "./conformanceStatus.js";
import type { ConformanceViolation } from "./conformanceViolation.js";
import type { VerificationRunId } from "./conformanceId.js";

export interface VerificationDecision {
  readonly runId: VerificationRunId;
  readonly profile: ConformanceProfile;
  readonly status: ConformanceStatusAxes;
  readonly violations: readonly ConformanceViolation[];
  readonly evidenceRootDigest: string;
  readonly decidedAt: string;
  readonly cacheKey?: string;
}

const BLOCKED_RELEASE = new Set(["blocked", "revoked", "expired"]);

export function decisionAccepted(decision: VerificationDecision): boolean {
  return (
    decision.status.machine === "verified" &&
    decision.violations.length === 0 &&
    decision.status.humanReview === "approved" &&
    decision.status.release === "accepted" &&
    !BLOCKED_RELEASE.has(decision.status.release)
  );
}
