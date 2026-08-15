/** Four separated state axes — never collapse into a single boolean. */

export type TheoryEvidenceStatus =
  "missing" | "partialScaffold" | "implementedUnverified" | "proved" | "reviewed";

export type MachineVerificationStatus =
  "candidate" | "incomplete" | "invalid" | "verified" | "unavailable" | "toolFailure";

export type HumanReviewStatus = "unassigned" | "pending" | "approved" | "rejected" | "conflict";

export type ReleaseDecisionStatus =
  "notEvaluated" | "blocked" | "conditional" | "accepted" | "superseded" | "expired" | "revoked";

export interface ConformanceStatusAxes {
  readonly theory: TheoryEvidenceStatus;
  readonly machine: MachineVerificationStatus;
  readonly humanReview: HumanReviewStatus;
  readonly release: ReleaseDecisionStatus;
}

export function initialConformanceStatus(): ConformanceStatusAxes {
  return {
    theory: "partialScaffold",
    machine: "candidate",
    humanReview: "unassigned",
    release: "notEvaluated",
  };
}
