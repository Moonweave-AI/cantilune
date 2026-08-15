import type { SchemaRef } from "@cantilune/core";

/** Admission verification subject — fields must come from evidence, not verifier padding. */
export interface AdmissionSubject {
  readonly admissionId: string;
  readonly activationDomainId: string;
  readonly fromSchemaRef: SchemaRef;
  readonly toSchemaRef: SchemaRef;
  readonly fromEpochId: string;
  readonly toEpochId: string;
  readonly fromEpochOrdinal: number;
  readonly toEpochOrdinal: number;
  readonly extensionPlanDigest: string;
  readonly expectedRuntimeHead: string;
  readonly expectedBindingGeneration: number;
  readonly tombstoneId?: string;
}

export interface RuleOccurrenceSubject {
  readonly artifactSubjectRef: string;
  readonly signatureVersion: string;
  readonly epochId: string;
  readonly ruleId: string;
  readonly occurrenceId: string;
  readonly beforeSnapshotRef: string;
  readonly eventRef: string;
  readonly afterSnapshotRef: string;
  readonly replayRecipeRef: string;
}

export interface TrajectorySubject {
  readonly productSubjectRef: string;
  readonly epochChainRef: string;
  readonly initialStateRef: string;
  readonly terminalStateRef: string;
  readonly selectedOccurrenceRef: string;
  readonly selectedIndex: number;
  readonly trajectoryDigest: string;
  readonly kernelDigest: string;
}
