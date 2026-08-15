import type { ContentDigest, EpochId, SnapshotRef } from "@cantilune/core";

/**
 * Certified trace evidence — stores full event identity derived from core's
 * CoordinationChange / ValidatedRunHistory, rule, match, derivation,
 * replay recipe, four independent projection view results, and shared-execution digest.
 *
 * All four projection views (DAG, Petri, π-calc, Morphism) must come from
 * the SAME source event/trace and carry independent evidence.
 */
export interface CertifiedTraceEvidence {
  readonly coreEventRef: string;
  readonly coreChangeDigest: ContentDigest;
  readonly rule: string;
  readonly matchRef: string;
  readonly derivationRef: string;
  readonly replayRecipeRef: string;
  readonly beforeRef: SnapshotRef;
  readonly eventRef: string;
  readonly afterRef: SnapshotRef;
  readonly sourceConfigDigest: ContentDigest;
  readonly targetConfigDigest: ContentDigest;
  readonly signatureVersion: string;
  readonly executionEpoch: EpochId;
  readonly opportunityEpoch: number;
  readonly classification: EventClassification;
  readonly rankBefore: number;
  readonly rankAfter: number;
  readonly resourceFacts: readonly string[];
  readonly sessionFacts: readonly string[];
  readonly deleteFacts: readonly string[];
  readonly modelInputRef: string | undefined;
  readonly policyInputRef: string | undefined;
  readonly externalInputRef: string | undefined;
  readonly branchChoiceIdentity: string | undefined;
  readonly probability: number | undefined;
  readonly sharedExecutionDigest: ContentDigest;
  readonly dagView: ProjectionViewResult;
  readonly petriView: ProjectionViewResult;
  readonly piCalcView: ProjectionViewResult;
  readonly morphismView: ProjectionViewResult;
  readonly admissionEvidence: AdmissionTraceEvidence | undefined;
}

export type EventClassification = "internal" | "external" | "administrative";

/**
 * Each projection view carries independent mapState/mapEvent/Lift results,
 * mapped event identities, and its own evidence chain.
 */
export interface ProjectionViewResult {
  readonly viewName: "dag" | "petri" | "piCalc" | "morphism";
  readonly mapState: ProjectionStepResult;
  readonly mapEvent: ProjectionStepResult;
  readonly lift: ProjectionStepResult;
  readonly native: ProjectionStepResult;
  readonly reflection: ProjectionStepResult;
  readonly replay: ProjectionStepResult;
  readonly terminal: ProjectionStepResult;
  readonly mappedEventIdentities: readonly MappedEventIdentity[];
  readonly evidenceChainDigest: ContentDigest;
}

export interface ProjectionStepResult {
  readonly status: "consistent" | "inconsistent" | "notApplicable";
  readonly evidenceRef: string | undefined;
  readonly detail: string | undefined;
}

export interface MappedEventIdentity {
  readonly sourceEventRef: string;
  readonly projectedEventRef: string;
  readonly mappingDigest: ContentDigest;
}

export interface AdmissionTraceEvidence {
  readonly fromVersion: string;
  readonly toVersion: string;
  readonly extensionRef: string | undefined;
  readonly tombstoneRef: string | undefined;
  readonly fourViewCertificateRef: string | undefined;
}
