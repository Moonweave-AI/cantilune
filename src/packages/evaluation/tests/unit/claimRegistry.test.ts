import { describe, it, expect } from "vitest";
import { createClaimRegistry } from "../../src/claims/claimRegistry.js";
import {
  evaluationClaimId,
  evaluationProtocolId,
  metricId,
  aggregateAnalysisId,
} from "../../src/foundation/evaluationIds.js";
import type { EvaluationClaim, EvaluationProtocol } from "../../src/claims/evaluationClaim.js";
import type { ClaimDecision } from "../../src/review/claimDecision.js";
import type { ContentDigest } from "@cantilune/core";

function makeDecision(overrides: Partial<ClaimDecision> = {}): ClaimDecision {
  return {
    claimRef: evaluationClaimId("c1"),
    protocolRef: evaluationProtocolId("p1"),
    analysisRefs: [aggregateAnalysisId("a1")],
    status: "supported",
    guardrailViolations: [],
    evidenceRoot: "root-digest" as ContentDigest,
    reviewerAttestations: [
      {
        reviewerId: "rev-1",
        role: "ai-eval",
        decision: "approve",
        rationale: "ok",
        coiDeclaration: "none",
        attestedAt: "2026-01-16",
        signatureRef: "sig-1",
      },
    ],
    limitations: [],
    applicability: "all",
    decidedAt: "2026-01-16",
    publishedAt: undefined,
    supersedes: undefined,
    retractionReason: undefined,
    signatureRefs: ["sig-1"],
    ...overrides,
  };
}

function makeClaim(id: string): EvaluationClaim {
  return {
    claimId: evaluationClaimId(id),
    claimVersion: 1,
    claimCode: "evaluation.c1",
    statement: "Test claim",
    nullHypothesis: "No difference",
    targetPopulation: "test-pop",
    candidateSubjectPolicy: "latest-c9",
    baselineFamily: "cursor",
    primaryMetricRefs: [metricId("m1")],
    secondaryMetricRefs: [],
    guardrailMetricRefs: [],
    successRule: "effect > 0",
    failureRule: "effect <= 0",
    inconclusiveRule: "CI crosses 0",
    samplePlanRef: "plan-1",
    uncertaintyMethod: "frequentist",
    multipleComparisonPolicy: "bonferroni",
    stoppingRule: "none",
    rescopeOrTerminationRule: "any-core-claim-fails",
    ownerRef: "owner-1",
    requiredReviewerRoles: ["ai-eval", "stats"],
    status: "proposed",
    protocolDigest: "digest-1" as ContentDigest,
    createdAt: "2026-01-01",
    frozenAt: undefined,
    supersedes: undefined,
  };
}

function makeProtocol(id: string, claimRefs: string[]): EvaluationProtocol {
  return {
    protocolId: evaluationProtocolId(id),
    protocolVersion: 1,
    claimRefs: claimRefs.map(evaluationClaimId),
    benchmarkSuiteRef: "suite-1",
    candidateSelection: "latest-c9",
    baselineSelection: "latest-stable",
    populationDefinition: "all-cases",
    samplingMethod: "census",
    sampleSize: 100,
    seedPolicy: "deterministic",
    repetitionPolicy: "3x",
    randomizationPlan: "blocked",
    blindingPlan: "double-blind",
    metricPlan: "primary+guardrail",
    analysisPlan: "preregistered",
    missingDataPolicy: "exclude",
    outlierPolicy: "winsorize",
    stoppingPolicy: "none",
    securityPlanRef: "sec-1",
    privacyPlanRef: "priv-1",
    budgetPolicyRef: "budget-1",
    reviewPolicyRef: "review-1",
    amendmentOf: undefined,
    protocolDigest: "proto-digest" as ContentDigest,
    frozenAt: undefined,
  };
}

describe("Claim registry", () => {
  it("registers and retrieves a claim", () => {
    const registry = createClaimRegistry();
    const claim = makeClaim("c1");
    const result = registry.registerClaim(claim);
    expect(result.ok).toBe(true);
    expect(registry.getClaim(evaluationClaimId("c1"))).toBeDefined();
  });

  it("rejects duplicate claim registration", () => {
    const registry = createClaimRegistry();
    const claim = makeClaim("c1");
    registry.registerClaim(claim);
    const result = registry.registerClaim(claim);
    expect(result.ok).toBe(false);
  });

  it("rejects invalid claim code", () => {
    const registry = createClaimRegistry();
    const claim = { ...makeClaim("c1"), claimCode: "invalid.code" };
    const result = registry.registerClaim(claim);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.violations[0]!.message).toContain("Invalid claim code");
  });

  it("lists all claims", () => {
    const registry = createClaimRegistry();
    registry.registerClaim(makeClaim("c1"));
    registry.registerClaim(makeClaim("c2"));
    expect(registry.listClaims()).toHaveLength(2);
  });

  it("registers and freezes a protocol", () => {
    const registry = createClaimRegistry();
    registry.registerClaim(makeClaim("c1"));
    const protocol = makeProtocol("p1", ["c1"]);
    registry.registerProtocol(protocol);

    const result = registry.freezeProtocol(evaluationProtocolId("p1"), "2026-01-15");
    expect(result.ok).toBe(true);

    const frozen = registry.getProtocol(evaluationProtocolId("p1"));
    expect(frozen?.frozenAt).toBe("2026-01-15");
  });

  it("freezing protocol transitions associated claims to protocolFrozen with frozenAt", () => {
    const registry = createClaimRegistry();
    registry.registerClaim(makeClaim("c1"));
    registry.registerProtocol(makeProtocol("p1", ["c1"]));
    registry.freezeProtocol(evaluationProtocolId("p1"), "2026-01-15");

    const claim = registry.getClaim(evaluationClaimId("c1"));
    expect(claim?.status).toBe("protocolFrozen");
    expect(claim?.frozenAt).toBe("2026-01-15");
  });

  it("rejects freezing with missing claim references", () => {
    const registry = createClaimRegistry();
    const protocol = makeProtocol("p1", ["nonexistent-claim"]);
    registry.registerProtocol(protocol);
    const result = registry.freezeProtocol(evaluationProtocolId("p1"), "2026-01-15");
    expect(result.ok).toBe(false);
  });

  it("rejects freezing already-frozen protocol", () => {
    const registry = createClaimRegistry();
    registry.registerProtocol(makeProtocol("p1", []));
    registry.freezeProtocol(evaluationProtocolId("p1"), "2026-01-15");
    const result = registry.freezeProtocol(evaluationProtocolId("p1"), "2026-01-16");
    expect(result.ok).toBe(false);
  });

  it("rejects freezing non-existent protocol", () => {
    const registry = createClaimRegistry();
    const result = registry.freezeProtocol(evaluationProtocolId("nope"), "2026-01-15");
    expect(result.ok).toBe(false);
  });

  it("transitions claim via evidence-driven recordMeasurement", () => {
    const registry = createClaimRegistry();
    registry.registerClaim(makeClaim("c1"));
    registry.registerProtocol(makeProtocol("p1", ["c1"]));
    registry.freezeProtocol(evaluationProtocolId("p1"), "2026-01-15");

    const result = registry.recordMeasurement(evaluationClaimId("c1"), "analysis-ref-1");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.status).toBe("measured");
  });

  it("recordMeasurement rejects without analysisRef", () => {
    const registry = createClaimRegistry();
    registry.registerClaim(makeClaim("c1"));
    registry.registerProtocol(makeProtocol("p1", ["c1"]));
    registry.freezeProtocol(evaluationProtocolId("p1"), "2026-01-15");

    const result = registry.recordMeasurement(evaluationClaimId("c1"), "");
    expect(result.ok).toBe(false);
  });

  it("deep-copies claims so external mutations are safe", () => {
    const registry = createClaimRegistry();
    const claim = makeClaim("c1");
    registry.registerClaim(claim);
    const retrieved = registry.getClaim(evaluationClaimId("c1"));
    expect(retrieved).toBeDefined();
    expect(retrieved).not.toBe(claim);
  });

  it("recordMeasurement rejects missing claim", () => {
    const registry = createClaimRegistry();
    const result = registry.recordMeasurement(evaluationClaimId("missing"), "analysis-1");
    expect(result.ok).toBe(false);
  });

  it("decides claim with supported status", () => {
    const registry = createClaimRegistry();
    registry.registerClaim(makeClaim("c1"));
    registry.registerProtocol(makeProtocol("p1", ["c1"]));
    registry.freezeProtocol(evaluationProtocolId("p1"), "2026-01-15");
    registry.recordMeasurement(evaluationClaimId("c1"), "analysis-ref-1");

    const result = registry.decideClaim(evaluationClaimId("c1"), makeDecision());
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.status).toBe("supported");
  });

  it("decideClaim rejects mismatched claimRef", () => {
    const registry = createClaimRegistry();
    registry.registerClaim(makeClaim("c1"));
    const result = registry.decideClaim(
      evaluationClaimId("c1"),
      makeDecision({ claimRef: evaluationClaimId("other") }),
    );
    expect(result.ok).toBe(false);
  });

  it("decideClaim rejects empty analysis refs", () => {
    const registry = createClaimRegistry();
    registry.registerClaim(makeClaim("c1"));
    const result = registry.decideClaim(
      evaluationClaimId("c1"),
      makeDecision({ analysisRefs: [] }),
    );
    expect(result.ok).toBe(false);
  });

  it("decideClaim rejects blocked decision status", () => {
    const registry = createClaimRegistry();
    registry.registerClaim(makeClaim("c1"));
    registry.registerProtocol(makeProtocol("p1", ["c1"]));
    registry.freezeProtocol(evaluationProtocolId("p1"), "2026-01-15");
    registry.recordMeasurement(evaluationClaimId("c1"), "analysis-ref-1");
    const result = registry.decideClaim(
      evaluationClaimId("c1"),
      makeDecision({ status: "blocked" }),
    );
    expect(result.ok).toBe(false);
  });

  it("attestDecision transitions to independentlyReviewed when quorum met", () => {
    const registry = createClaimRegistry();
    registry.registerClaim(makeClaim("c1"));
    registry.registerProtocol(makeProtocol("p1", ["c1"]));
    registry.freezeProtocol(evaluationProtocolId("p1"), "2026-01-15");
    registry.recordMeasurement(evaluationClaimId("c1"), "analysis-ref-1");
    registry.decideClaim(evaluationClaimId("c1"), makeDecision());

    const result = registry.attestDecision(
      evaluationClaimId("c1"),
      {
        requiredRoles: ["ai-eval"],
        requiredCount: 1,
        selfReviewProhibited: true,
        claimOwnerRef: "owner-1",
      },
      makeDecision({
        reviewerAttestations: [
          {
            reviewerId: "rev-1",
            role: "ai-eval",
            decision: "approve",
            rationale: "reviewed",
            coiDeclaration: "none",
            attestedAt: "2026-01-17",
            signatureRef: "sig-2",
          },
        ],
      }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.status).toBe("independentlyReviewed");
  });

  it("attestDecision rejects when review quorum not met", () => {
    const registry = createClaimRegistry();
    registry.registerClaim(makeClaim("c1"));
    const result = registry.attestDecision(
      evaluationClaimId("c1"),
      {
        requiredRoles: ["ai-eval"],
        requiredCount: 2,
        selfReviewProhibited: true,
        claimOwnerRef: "owner-1",
      },
      makeDecision({ reviewerAttestations: [] }),
    );
    expect(result.ok).toBe(false);
  });
});
