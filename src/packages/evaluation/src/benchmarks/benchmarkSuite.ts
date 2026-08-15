import type { ContentDigest } from "@cantilune/core";
import type {
  BenchmarkSuiteId,
  BenchmarkCaseId,
  DatasetId,
  EvaluationClaimId,
} from "../foundation/evaluationIds.js";
import type { SuiteStatus, BenchmarkCaseKind } from "../foundation/evaluationStatus.js";

export interface BenchmarkSuite {
  readonly suiteId: BenchmarkSuiteId;
  readonly suiteVersion: number;
  readonly name: string;
  readonly description: string;
  readonly claimRefs: readonly EvaluationClaimId[];
  readonly caseManifestRefs: readonly BenchmarkCaseId[];
  readonly datasetRefs: readonly DatasetId[];
  readonly coverageTaxonomy: readonly string[];
  readonly requiredStrata: readonly string[];
  readonly samplingPolicy: string;
  readonly defaultRunPolicy: string;
  readonly defaultScoringPolicy: string;
  readonly defaultBudgetPolicy: string;
  readonly provenanceRef: string;
  readonly licenseRef: string;
  readonly privacyReviewRef: string;
  readonly suiteDigest: ContentDigest;
  readonly status: SuiteStatus;
  readonly frozenAt: string | undefined;
  readonly supersedes: BenchmarkSuiteId | undefined;
}

export interface BenchmarkCase {
  readonly caseId: BenchmarkCaseId;
  readonly suiteId: BenchmarkSuiteId;
  readonly caseVersion: number;
  readonly caseKind: BenchmarkCaseKind;
  readonly claimRefs: readonly EvaluationClaimId[];
  readonly tags: readonly string[];
  readonly stratum: string;
  readonly inputArtifactRefs: readonly string[];
  readonly initialSnapshotRef: string;
  readonly schemaBindingRef: string;
  readonly policyRef: string;
  readonly requiredCapabilities: readonly string[];
  readonly requiredTools: readonly string[];
  readonly networkPolicy: string;
  readonly filesystemPolicy: string;
  readonly semanticOracleRefs: readonly string[];
  readonly successPredicateRef: string;
  readonly expectedTerminalClasses: readonly string[];
  readonly resourceCaps: ResourceCaps;
  /** Wall-clock timeout is engineering protection, NOT a formal C2 step bound */
  readonly maxStructuralSteps: number;
  readonly maxExecutionEpochs: number;
  readonly engineeringTimeout: number;
  readonly redactionPolicyRef: string;
  readonly caseDigest: ContentDigest;
}

export interface ResourceCaps {
  readonly maxTokensInput: number;
  readonly maxTokensOutput: number;
  readonly maxToolCalls: number;
  readonly maxNetworkRequests: number;
  readonly maxFilesystemOps: number;
  readonly maxCostCents: number;
}

export function isSuiteFrozen(suite: BenchmarkSuite): boolean {
  return suite.status === "frozen" && suite.frozenAt !== undefined;
}
