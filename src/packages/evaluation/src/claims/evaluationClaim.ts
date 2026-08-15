import type { ContentDigest } from "@cantilune/core";
import type {
  EvaluationClaimId,
  EvaluationProtocolId,
  MetricId,
} from "../foundation/evaluationIds.js";
import type { ClaimStatus } from "../foundation/evaluationStatus.js";

export interface EvaluationClaim {
  readonly claimId: EvaluationClaimId;
  readonly claimVersion: number;
  readonly claimCode: string;
  readonly statement: string;
  readonly nullHypothesis: string;
  readonly targetPopulation: string;
  readonly candidateSubjectPolicy: string;
  readonly baselineFamily: string;
  readonly primaryMetricRefs: readonly MetricId[];
  readonly secondaryMetricRefs: readonly MetricId[];
  readonly guardrailMetricRefs: readonly MetricId[];
  readonly successRule: string;
  readonly failureRule: string;
  readonly inconclusiveRule: string;
  readonly samplePlanRef: string;
  readonly uncertaintyMethod: string;
  readonly multipleComparisonPolicy: string;
  readonly stoppingRule: string;
  readonly rescopeOrTerminationRule: string;
  readonly ownerRef: string;
  readonly requiredReviewerRoles: readonly string[];
  readonly status: ClaimStatus;
  readonly protocolDigest: ContentDigest;
  readonly createdAt: string;
  readonly frozenAt: string | undefined;
  readonly supersedes: EvaluationClaimId | undefined;
}

export interface EvaluationProtocol {
  readonly protocolId: EvaluationProtocolId;
  readonly protocolVersion: number;
  readonly claimRefs: readonly EvaluationClaimId[];
  readonly benchmarkSuiteRef: string;
  readonly candidateSelection: string;
  readonly baselineSelection: string;
  readonly populationDefinition: string;
  readonly samplingMethod: string;
  readonly sampleSize: number;
  readonly seedPolicy: string;
  readonly repetitionPolicy: string;
  readonly randomizationPlan: string;
  readonly blindingPlan: string;
  readonly metricPlan: string;
  readonly analysisPlan: string;
  readonly missingDataPolicy: string;
  readonly outlierPolicy: string;
  readonly stoppingPolicy: string;
  readonly securityPlanRef: string;
  readonly privacyPlanRef: string;
  readonly budgetPolicyRef: string;
  readonly reviewPolicyRef: string;
  readonly amendmentOf: EvaluationProtocolId | undefined;
  readonly protocolDigest: ContentDigest;
  readonly frozenAt: string | undefined;
}

export function isClaimFrozen(claim: EvaluationClaim): boolean {
  return claim.frozenAt !== undefined && claim.status !== "proposed";
}

export function isProtocolFrozen(protocol: EvaluationProtocol): boolean {
  return protocol.frozenAt !== undefined;
}
