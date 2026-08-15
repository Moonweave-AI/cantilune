import type { ContentDigest } from "@cantilune/core";
import type {
  MetricId,
  EvaluationClaimId,
  JudgeProtocolId,
  ScorerRef,
} from "../foundation/evaluationIds.js";
import type {
  MetricEndpointRole,
  MetricAggregation,
  MetricDirection,
  MissingTreatment,
  FailureTreatment,
} from "../foundation/evaluationStatus.js";

export interface MetricDefinition {
  readonly metricId: MetricId;
  readonly metricVersion: number;
  readonly claimRef: EvaluationClaimId;
  readonly endpointRole: MetricEndpointRole;
  readonly inputSchemaRef: string;
  readonly scorerRef: ScorerRef;
  readonly scorerBuild: string;
  readonly scorerDigest: ContentDigest;
  readonly unit: string;
  readonly direction: MetricDirection;
  readonly population: string;
  readonly stratification: readonly string[];
  readonly aggregation: MetricAggregation;
  readonly failureTreatment: FailureTreatment;
  readonly missingTreatment: MissingTreatment;
  readonly threshold: number | undefined;
  readonly equivalenceMargin: number | undefined;
  readonly uncertaintyMethod: string;
  readonly effectSizeMethod: string;
  readonly judgeProtocolRef: JudgeProtocolId | undefined;
  readonly metricDigest: ContentDigest;
}
