import type { CoordinationChange, SnapshotRef } from "@cantilune/core";
import { computeEvidenceDigest } from "../canonical/evidenceDigest.js";
import { parseRecipeChainRef } from "../canonical/replayRecipeChainDigest.js";
import {
  conformanceViolation,
  type ConformanceViolation,
} from "../foundation/conformanceViolation.js";
import type { ReplayEvidence } from "../evidence/evidenceFamilies.js";
import type { RuleOccurrenceSubject } from "../subject/admissionSubject.js";
import type { DpoReplayPort } from "../ports/dpoReplayPort.js";
import { verifyReplayEvidenceBinding } from "./replayVerifier.js";

export interface DpoReplayExecutionEvidence {
  readonly recipeRef: string;
  readonly deterministic: boolean;
  readonly replayDigest: ReplayEvidence["replayDigest"];
  readonly fromSnapshotRef: SnapshotRef;
  readonly toSnapshotRef: SnapshotRef;
  readonly changes: readonly CoordinationChange[];
}

export function computeDpoReplayExecutionDigest(input: {
  readonly evidence: Omit<DpoReplayExecutionEvidence, "replayDigest" | "changes"> & {
    readonly changeCount: number;
  };
  readonly subject: RuleOccurrenceSubject;
}): ReplayEvidence["replayDigest"] {
  return computeEvidenceDigest({
    profile: "dpoReplayExecution",
    subject: {
      artifactSubjectRef: input.subject.artifactSubjectRef,
      epochId: input.subject.epochId,
      ruleId: input.subject.ruleId,
      occurrenceId: input.subject.occurrenceId,
      beforeSnapshotRef: input.subject.beforeSnapshotRef,
      afterSnapshotRef: input.subject.afterSnapshotRef,
      replayRecipeRef: input.subject.replayRecipeRef,
    },
    evidence: {
      recipeRef: input.evidence.recipeRef,
      deterministic: input.evidence.deterministic,
      changeCount: input.evidence.changeCount,
      fromSnapshotRef: input.evidence.fromSnapshotRef,
      toSnapshotRef: input.evidence.toSnapshotRef,
    },
  });
}

/** Structural + runtime DPO replay via injected port. */
export async function verifyDpoReplayWithPort(input: {
  readonly evidence: DpoReplayExecutionEvidence;
  readonly subject: RuleOccurrenceSubject;
  readonly replayPort: DpoReplayPort;
}): Promise<ConformanceViolation[]> {
  const structural = verifyReplayEvidenceBinding({
    evidence: {
      recipeRef: input.evidence.recipeRef,
      replayDigest: input.evidence.replayDigest,
      deterministic: input.evidence.deterministic,
    },
    subject: input.subject,
  });
  if (structural.length > 0) {
    return structural;
  }
  if (parseRecipeChainRef(input.evidence.recipeRef) === undefined) {
    return [
      conformanceViolation(
        "missing_evidence",
        "DPO replay requires recipe-chain:sha256:<digest> recipeRef",
        "evidence.recipeRef",
      ),
    ];
  }
  const expectedDigest = computeDpoReplayExecutionDigest({
    evidence: {
      recipeRef: input.evidence.recipeRef,
      deterministic: input.evidence.deterministic,
      changeCount: input.evidence.changes.length,
      fromSnapshotRef: input.evidence.fromSnapshotRef,
      toSnapshotRef: input.evidence.toSnapshotRef,
    },
    subject: input.subject,
  });
  if ((input.evidence.replayDigest as string) !== (expectedDigest as string)) {
    return [
      conformanceViolation(
        "digest_mismatch",
        "replayDigest must bind subject, recipe chain, endpoints, and changeCount",
        "evidence.replayDigest",
      ),
    ];
  }
  if (input.evidence.fromSnapshotRef !== (input.subject.beforeSnapshotRef as SnapshotRef)) {
    return [
      conformanceViolation(
        "subject_mismatch",
        "fromSnapshotRef must match subject.beforeSnapshotRef",
        "evidence.fromSnapshotRef",
      ),
    ];
  }
  if (input.evidence.toSnapshotRef !== (input.subject.afterSnapshotRef as SnapshotRef)) {
    return [
      conformanceViolation(
        "subject_mismatch",
        "toSnapshotRef must match subject.afterSnapshotRef",
        "evidence.toSnapshotRef",
      ),
    ];
  }
  const executed = await input.replayPort.execute({
    fromSnapshotRef: input.evidence.fromSnapshotRef,
    toSnapshotRef: input.evidence.toSnapshotRef,
    changes: input.evidence.changes,
    recipeRef: input.evidence.recipeRef,
  });
  if (!executed.ok) {
    return [
      conformanceViolation(
        "replay_failed",
        `runtime DPO replay failed: ${executed.error.code} ${executed.error.message}`,
      ),
    ];
  }
  if (executed.value.terminalSnapshotRef !== input.evidence.toSnapshotRef) {
    return [
      conformanceViolation(
        "replay_failed",
        "runtime replay terminal does not match expected afterSnapshotRef",
        "evidence.toSnapshotRef",
      ),
    ];
  }
  if (executed.value.stepCount !== input.evidence.changes.length) {
    return [
      conformanceViolation(
        "replay_failed",
        "runtime replay step count does not match supplied change chain",
        "evidence.changes",
      ),
    ];
  }
  return [];
}
