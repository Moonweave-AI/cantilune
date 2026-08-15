import type { VerificationDecision } from "../foundation/verificationDecision.js";
import type { VerificationRunId } from "../foundation/conformanceId.js";
import { deepFreeze } from "./deepFreeze.js";

const verifiedBrand: unique symbol = Symbol("VerifiedDecision");
const reviewedBrand: unique symbol = Symbol("ReviewedDecision");

/** Machine-verified decision — only constructible via sealVerifiedDecision. */
export interface VerifiedDecision {
  readonly [verifiedBrand]: true;
  readonly runId: VerificationRunId;
  readonly decision: VerificationDecision;
  readonly verifiedAt: string;
  readonly verifierBuild: string;
}

/** Human-reviewed decision — only constructible via sealReviewedDecision. */
export interface ReviewedDecision {
  readonly [reviewedBrand]: true;
  readonly verified: VerifiedDecision;
  readonly reviewerId: string;
  readonly reviewDecision: "approved" | "rejected" | "conflict";
  readonly reviewedAt: string;
}

export function isVerifiedDecision(value: unknown): value is VerifiedDecision {
  return (
    typeof value === "object" &&
    value !== null &&
    verifiedBrand in value &&
    (value as VerifiedDecision)[verifiedBrand] === true
  );
}

export function isReviewedDecision(value: unknown): value is ReviewedDecision {
  return (
    typeof value === "object" &&
    value !== null &&
    reviewedBrand in value &&
    (value as ReviewedDecision)[reviewedBrand] === true
  );
}

/** Called by machine verification workflow only. */
export function sealVerifiedDecision(input: {
  readonly decision: VerificationDecision;
  readonly verifiedAt: string;
  readonly verifierBuild: string;
}): VerifiedDecision {
  if (input.decision.status.machine !== "verified") {
    throw new Error("cannot seal decision: machine status is not verified");
  }
  if (input.decision.violations.length > 0) {
    throw new Error("cannot seal decision: violations present");
  }
  const frozenDecision = deepFreeze(structuredClone(input.decision));
  const sealed: VerifiedDecision = Object.seal({
    [verifiedBrand]: true as const,
    runId: input.decision.runId,
    decision: frozenDecision,
    verifiedAt: input.verifiedAt,
    verifierBuild: input.verifierBuild,
  });
  return deepFreeze(sealed) as VerifiedDecision;
}

/** Called by human review workflow only. */
export function sealReviewedDecision(input: {
  readonly verified: VerifiedDecision;
  readonly reviewerId: string;
  readonly reviewDecision: "approved" | "rejected" | "conflict";
  readonly reviewedAt: string;
}): ReviewedDecision {
  if (!isVerifiedDecision(input.verified)) {
    throw new Error("cannot seal review: input is not a VerifiedDecision");
  }
  const sealed: ReviewedDecision = Object.seal({
    [reviewedBrand]: true as const,
    verified: input.verified,
    reviewerId: input.reviewerId,
    reviewDecision: input.reviewDecision,
    reviewedAt: input.reviewedAt,
  });
  return deepFreeze(sealed) as ReviewedDecision;
}
