import {
  validateAuditTailMatchesHistory,
  validateSnapshotIntegrity,
  withSnapshotRef,
} from "@cantilune/core";
import type { CollaborationSnapshot, CoordinationChange, CoreViolation } from "@cantilune/core";
import { committedChangeId } from "../foundation/brands.js";
import { runtimeViolation } from "../foundation/errors.js";
import type { RuntimeViolation } from "../foundation/errors.js";
import type { AdmissionRegistry } from "../admission/admissionRegistry.js";
import type { AdmissionTicket } from "../admission/admissionTicket.js";
import type { AdmittedRecord } from "../admission/admittedRecord.js";
import type { Clock } from "../ports/clock.js";
import type { DurableCoordinator } from "../ports/durableCoordinator.js";
import type { IdGenerator } from "../ports/idGenerator.js";
import type { ResourceLockTable } from "../ports/resourceLockTable.js";
import { coordinationChangeFromCommit, withHeartbeatEmittedAt } from "../replay/recipe.js";
import type { RunHistoryTracker } from "../engine/runHistoryTracker.js";
import { evaluateEnsures } from "../schema/conditionEvaluator.js";
import { applyAdmittedChange } from "./applyChange.js";
import { allocateFreshRefsForRecipe } from "./allocateFreshRefs.js";
import { changeContinuesChain } from "../codec/observationBridge.js";
import type { OperationHandlerRegistry } from "./handlerRegistry.js";
import type { ContentRefAuthority } from "../ports/contentRefAuthority.js";
import { validateCommitContentAvailability } from "./contentRefAvailability.js";

export interface CommitInput {
  readonly ticket: AdmissionTicket;
}

export interface CommitResult {
  readonly change: CoordinationChange;
  readonly after: CollaborationSnapshot;
  readonly committedChangeId: ReturnType<typeof committedChangeId>;
}

export interface CommitterDeps {
  readonly durable: DurableCoordinator;
  readonly registry: AdmissionRegistry;
  readonly clock: Clock;
  readonly idGen: IdGenerator;
  readonly handlers: OperationHandlerRegistry;
  readonly locks: ResourceLockTable;
  readonly runHistory?: RunHistoryTracker;
  readonly contentRefAuthority?: ContentRefAuthority;
}

export function createCommitter(deps: CommitterDeps) {
  return {
    commit(input: CommitInput): CommitResult | RuntimeViolation {
      const head = deps.durable.head();
      const resolved = deps.registry.resolveForCommit(input.ticket, head);
      if (!resolved.ok) {
        deps.registry.cancel(input.ticket);
        return runtimeViolation(
          "admission_rejected",
          `admission ticket invalid: ${resolved.error.kind}`,
        );
      }

      const admitted: AdmittedRecord = resolved.record;

      try {
        return executeCommit(deps, admitted, input.ticket);
      } finally {
        deps.locks.release(admitted.admittedId);
        deps.registry.consume(input.ticket);
      }
    },
  };
}

/**
 * Cross-change invariants checked against the durable log before the commit is
 * attempted, so a rejected chain never reaches storage.
 *
 * Only the link to the last logged change is examined. Re-validating the whole
 * log on every commit was both quadratic and wrong: it demanded raw
 * `beforeRef === afterRef` contiguity, which an observation between two commits
 * legitimately breaks, so the first commit after any observation was refused —
 * and stayed refused, since the gap in the log is permanent. Earlier links were
 * checked when they were committed, so the chain holds inductively.
 */
function validatePreCommit(
  deps: CommitterDeps,
  after: CollaborationSnapshot,
  change: CoordinationChange,
): RuntimeViolation | undefined {
  const previous = deps.durable.changes().at(-1);
  if (previous !== undefined) {
    if (!changeContinuesChain(previous, change, (ref) => deps.durable.get(ref))) {
      return runtimeViolation("commit_atomic_failed", "change chain validation failed", {
        expected: previous.afterRef,
        actual: change.beforeRef,
        path: "beforeRef",
      });
    }
    if (change.epochId !== after.epochId) {
      return runtimeViolation("commit_atomic_failed", "change epoch differs from snapshot epoch", {
        expected: after.epochId,
        actual: change.epochId,
        path: "epochId",
      });
    }
  }

  if (deps.runHistory !== undefined) {
    try {
      validateAuditTailMatchesHistory(after, deps.runHistory.current());
    } catch (error) {
      return runtimeViolation("commit_atomic_failed", "auditTail/history mismatch before commit", {
        ...causeDetail(error),
      });
    }
  }

  return undefined;
}

function executeCommit(
  deps: CommitterDeps,
  admitted: AdmittedRecord,
  _ticket: AdmissionTicket,
): CommitResult | RuntimeViolation {
  const recordedAt = deps.clock.now();
  const recipeWithFreshIds = allocateFreshRefsForRecipe(
    admitted.recipe,
    admitted.intent.operationTypeId,
    deps.idGen,
  );
  const replayAuthority =
    admitted.intent.operationTypeId === "emit_heartbeat"
      ? withHeartbeatEmittedAt(recipeWithFreshIds, recordedAt)
      : recipeWithFreshIds;

  const admittedForApply = { ...admitted, recipe: replayAuthority };
  const applyResult = applyAdmittedChange(admittedForApply, deps.handlers);
  if (!applyResult.ok) {
    return runtimeViolation("apply_failed", applyResult.reason, {
      operationTypeId: admitted.intent.operationTypeId,
    });
  }

  const contentViolation = validateCommitContentAvailability(
    admitted.beforeSnapshot,
    applyResult.after,
    admitted.intent.operationTypeId,
    deps.contentRefAuthority,
  );
  if (contentViolation !== undefined) return contentViolation;

  const afterRef = deps.idGen.snapshotRef();
  const after = withSnapshotRef(applyResult.after, afterRef);

  try {
    validateSnapshotIntegrity(after);
  } catch (error) {
    return runtimeViolation("apply_failed", "post-apply snapshot integrity failed", {
      operationTypeId: admitted.intent.operationTypeId,
      ...causeDetail(error),
    });
  }

  const failedEnsure = evaluateEnsures(
    after,
    admitted.intent.matchBindings,
    admitted.template.ensures,
  );
  if (failedEnsure !== undefined) {
    return runtimeViolation("apply_failed", `template ensure failed: ${failedEnsure.kind}`, {
      operationTypeId: admitted.intent.operationTypeId,
      path: failedEnsure.kind,
    });
  }

  const change = coordinationChangeFromCommit({
    recipe: replayAuthority,
    changeId: deps.idGen.changeId(),
    recordedAt,
    beforeRef: admitted.beforeRef,
    afterRef,
    initiator: admitted.intent.initiator,
    involved: applyResult.involved,
  });

  const preCommitViolation = validatePreCommit(deps, after, change);
  if (preCommitViolation !== undefined) {
    return preCommitViolation;
  }

  const commitResult = deps.durable.commit({
    expectedHead: admitted.beforeRef,
    after,
    change,
    recipe: replayAuthority,
    idempotencyKey: change.changeId,
  });

  if (!commitResult.ok) {
    return runtimeViolation("commit_atomic_failed", commitResult.reason);
  }

  deps.runHistory?.recordChange(change);

  return {
    change,
    after,
    committedChangeId: committedChangeId(change.changeId),
  };
}

function extractCoreViolation(error: unknown): CoreViolation | undefined {
  if (error !== null && typeof error === "object" && "violation" in error) {
    const violation = (error as { violation?: CoreViolation }).violation;
    return violation;
  }
  return undefined;
}

/** Spreadable `cause` detail, empty when the error carries no core violation. */
function causeDetail(error: unknown): { cause?: CoreViolation } {
  const cause = extractCoreViolation(error);
  return cause !== undefined ? { cause } : {};
}

export type Committer = ReturnType<typeof createCommitter>;
