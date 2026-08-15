import type { ContentDigest } from "@cantilune/core";

/** Evidence family marker types — M2 scaffold; product producers fill concrete payloads. */

export interface SourceOccurrenceEvidence {
  readonly occurrenceId: string;
  readonly ruleId: string;
  readonly eventDigest: ContentDigest;
  readonly beforeSnapshotRef: string;
  readonly afterSnapshotRef: string;
}

export interface ReplayEvidence {
  readonly recipeRef: string;
  readonly replayDigest: ContentDigest;
  readonly deterministic: boolean;
}

export interface RuleRankEvidence {
  readonly ruleId: string;
  readonly rankDigest: ContentDigest;
}

export interface StaticSmcEvidence {
  readonly signatureVersion: string;
  readonly smcDigest: ContentDigest;
}

export interface OperationalProjectionEvidence {
  readonly projectionKind: "operational";
  readonly soundDigest: ContentDigest;
  readonly reflectionDigest: ContentDigest;
}

export interface ProjectionReflectionEvidence {
  readonly projectionKind: "dag" | "petri" | "pi" | "morphism";
  readonly reflectionDigest: ContentDigest;
}

export interface TerminalCompatibilityEvidence {
  readonly terminalDigest: ContentDigest;
}

export interface ResourceQuiescenceEvidence {
  readonly resourceDigest: ContentDigest;
  readonly quiescenceDigest: ContentDigest;
}

export interface DeletionPermissionEvidence {
  readonly permissionDigest: ContentDigest;
}

export interface QualificationEvidence {
  readonly qualificationDigest: ContentDigest;
}

export interface AuthorizationEvidence {
  readonly authorizationDigest: ContentDigest;
}

export interface DagSemanticEvidence {
  readonly configDigest: ContentDigest;
  readonly sccDigest: ContentDigest;
  readonly rankDigest: ContentDigest;
  readonly edgeCoverageDigest: ContentDigest;
}

export interface PetriSemanticEvidence {
  readonly declarationDigest: ContentDigest;
  readonly markingDigest: ContentDigest;
  readonly firingDigest: ContentDigest;
  readonly registryDigest: ContentDigest;
}

export interface PiSemanticEvidence {
  readonly nativeStepDigest: ContentDigest;
  readonly actionDigest: ContentDigest;
  readonly freshnessDigest: ContentDigest;
  readonly registryDigest: ContentDigest;
}

export interface MorphismSemanticEvidence {
  readonly mappingDigest: ContentDigest;
  readonly structureDigest: ContentDigest;
}

export interface FormalAdmissionEvidence {
  readonly admissionDigest: ContentDigest;
  readonly extensionDigest: ContentDigest;
  readonly tombstoneId?: string;
}

export interface StableWindowEvidence {
  readonly windowDigest: ContentDigest;
}

export interface FairnessEvidence {
  readonly fairnessDigest: ContentDigest;
}

export interface PositiveProgressEvidence {
  readonly progressDigest: ContentDigest;
}

export interface CrossEpochEvidence {
  readonly fromEpochId: string;
  readonly toEpochId: string;
  readonly chainDigest: ContentDigest;
}

export interface CommonTrajectoryEvidence {
  readonly trajectoryDigest: ContentDigest;
  readonly terminalDigest: ContentDigest;
}

export interface FmsAlignmentEvidence {
  readonly alignmentDigest: ContentDigest;
}

export interface ArtifactProvenanceEvidence {
  readonly commitSha: string;
  readonly treeDigest: ContentDigest;
  readonly lockfileDigest: ContentDigest;
  readonly toolchainDigest: ContentDigest;
}

export type { LeanBuildAttestation } from "./leanBuildAttestation.js";

export interface MachineVerificationAttestationEvidence {
  readonly runId: string;
  readonly decisionDigest: ContentDigest;
}

export interface HumanReviewAttestationEvidence {
  readonly reviewerId: string;
  readonly decision: "approved" | "rejected" | "conflict";
  readonly reviewedAt: string;
}
