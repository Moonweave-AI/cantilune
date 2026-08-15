import {
  admissionTombstoneId,
  correlationId,
  err,
  occurrenceId,
  ok,
  storeSequence,
  type PlanDigest,
  type PreparedAdmissionId,
  type Result,
  type SchemaAdmissionId,
  type SchemaAdmissionReceipt,
  type SchemaEpochBinding,
} from "@cantilune/core";
import type { RuntimeEpochAdministration, RuntimeEpochReceipt } from "@cantilune/runtime";
import {
  controlPlaneViolation,
  type ControlPlaneViolation,
} from "../errors/controlPlaneViolation.js";
import type {
  ControlPlaneStore,
  FinalizeAdmissionCommitInput,
} from "../ports/controlPlaneStore.js";
import type { SchemaAdmissionRecord } from "../admission/schemaAdmissionRequest.js";
import type {
  CommitDecisionRecord,
  PreparedAdmissionRecord,
} from "../admission/preparedAdmissionRecord.js";
import { createNextBinding } from "../activation/epochTransitionPlan.js";
import type { AdministrationAuthorizer } from "../administration/administrationAuthorizer.js";
import { buildAdmissionEvidenceSubject } from "../administration/buildEvidenceSubject.js";
import type { FileControlPlaneStore } from "../file/fileControlPlaneStore.js";
import type { ControlPlaneOutbox } from "../events/controlPlaneOutbox.js";

export interface CommitAdmissionTransactionDeps {
  readonly store: ControlPlaneStore;
  readonly epochAdmin: RuntimeEpochAdministration;
  readonly authorizer: AdministrationAuthorizer;
  readonly outbox: ControlPlaneOutbox;
  readonly fileStore?: FileControlPlaneStore;
  readonly updateBinding: (binding: SchemaEpochBinding) => void;
}

export interface CommitAdmissionTransactionInput {
  readonly admissionId: SchemaAdmissionId;
  readonly preparedId: PreparedAdmissionId;
  readonly operator: string;
  readonly record: SchemaAdmissionRecord;
  readonly active: SchemaEpochBinding;
  readonly preparedRecord: PreparedAdmissionRecord;
}

function buildReceipt(input: {
  readonly record: SchemaAdmissionRecord;
  readonly active: SchemaEpochBinding;
  readonly toBinding: SchemaEpochBinding;
  readonly runtimeReceipt: RuntimeEpochReceipt;
  readonly planDigest: PlanDigest;
  readonly operator: string;
  readonly store: ControlPlaneStore;
}): SchemaAdmissionReceipt {
  const committedAt = new Date().toISOString();
  return {
    admissionId: input.record.request.admissionId,
    activationDomainId: input.record.request.activationDomainId,
    fromBinding: input.active,
    toBinding: input.toBinding,
    beforeSnapshotRef: input.runtimeReceipt.beforeSnapshotRef,
    afterSnapshotRef: input.runtimeReceipt.afterSnapshotRef,
    extensionPlanRef: input.planDigest as string,
    qualificationEvidenceRef: JSON.stringify(input.record.qualification),
    authorizationEvidenceRef: JSON.stringify(input.record.authorization),
    fourViewEvidenceRef: input.record.fourView?.evidenceDigest as string,
    admissionTombstoneId: admissionTombstoneId(`tomb-${input.record.request.admissionId}`),
    committedBy: input.operator,
    committedAt,
    storeSequence: storeSequence((input.store.snapshot().lastSequence as number) + 1),
    correlationId: correlationId(`corr-${input.record.request.admissionId}`),
    occurrenceId: occurrenceId(`occ-${input.record.request.admissionId}`),
    idempotencyKey: input.record.request.idempotencyKey,
    planDigest: input.planDigest,
  };
}

async function applyRuntimeIdempotent(
  deps: CommitAdmissionTransactionDeps,
  admissionId: SchemaAdmissionId,
  preparedRecord: PreparedAdmissionRecord,
): Promise<Result<RuntimeEpochReceipt, ControlPlaneViolation>> {
  const commitResult = await deps.epochAdmin.commitEpochTransition({
    preparedId: preparedRecord.runtimePreparedId,
    planDigest: preparedRecord.planDigest as string,
    issuedAt: preparedRecord.issuedAt,
    expiresAt: preparedRecord.expiresAt,
  });
  if (commitResult.ok) {
    return commitResult;
  }
  const recovered = await deps.epochAdmin.recoverEpochTransition(admissionId);
  if (recovered.ok) {
    return recovered;
  }
  return err(
    controlPlaneViolation("commit_conflict", "commit", commitResult.error.message, {
      retryable: true,
    }),
  );
}

async function resolveRuntimeReceipt(
  deps: CommitAdmissionTransactionDeps,
  input: CommitAdmissionTransactionInput,
  decision: CommitDecisionRecord,
  toBinding: SchemaEpochBinding,
  preparedRecord: PreparedAdmissionRecord,
): Promise<
  Result<
    { readonly runtimeReceipt: RuntimeEpochReceipt; readonly decision: CommitDecisionRecord },
    ControlPlaneViolation
  >
> {
  if (decision.status === "runtime_applied" && decision.runtimeAfterRef !== undefined) {
    const recovered = await deps.epochAdmin.recoverEpochTransition(input.admissionId);
    if (!recovered.ok) {
      return err(
        controlPlaneViolation("commit_conflict", "commit", recovered.error.message, {
          retryable: true,
        }),
      );
    }
    return ok({ runtimeReceipt: recovered.value, decision });
  }
  if (decision.status === "decided" || decision.status === "recovery_required") {
    const applied = await applyRuntimeIdempotent(deps, input.admissionId, preparedRecord);
    if (!applied.ok) {
      deps.store.putCommitDecision({
        ...decision,
        status: "recovery_required",
        updatedAt: new Date().toISOString(),
      });
      deps.fileStore?.persist();
      return applied;
    }
    const runtimeReceipt = applied.value;
    if (runtimeReceipt.admissionId !== input.admissionId) {
      return err(
        controlPlaneViolation("commit_conflict", "commit", "runtime receipt admission mismatch"),
      );
    }
    if (runtimeReceipt.toBinding.schemaRef.digest !== preparedRecord.toSchemaRef.digest) {
      return err(
        controlPlaneViolation("commit_conflict", "commit", "runtime target schema mismatch"),
      );
    }
    const updatedDecision: CommitDecisionRecord = {
      ...decision,
      status: "runtime_applied",
      runtimeBeforeRef: runtimeReceipt.beforeSnapshotRef,
      runtimeAfterRef: runtimeReceipt.afterSnapshotRef,
      toBinding: {
        ...toBinding,
        runtimeHead: runtimeReceipt.afterSnapshotRef,
      },
      updatedAt: new Date().toISOString(),
    };
    deps.store.putCommitDecision(updatedDecision);
    deps.fileStore?.persist();
    return ok({ runtimeReceipt, decision: updatedDecision });
  }
  return err(controlPlaneViolation("invalid_input", "commit", "unexpected commit decision state"));
}

function handleFinalizeCasConflict(input: {
  readonly deps: CommitAdmissionTransactionDeps;
  readonly admissionId: SchemaAdmissionId;
  readonly domainId: SchemaAdmissionRecord["request"]["activationDomainId"];
  readonly finalizedBinding: SchemaEpochBinding;
  readonly receipt: SchemaAdmissionReceipt;
  readonly finalizeInput: FinalizeAdmissionCommitInput;
  readonly decision: CommitDecisionRecord;
}): Result<SchemaAdmissionReceipt, ControlPlaneViolation> {
  const current = input.deps.store.getActiveBinding(input.domainId);
  if (
    current?.bindingGeneration === input.finalizedBinding.bindingGeneration &&
    current?.schemaRef.digest === input.finalizedBinding.schemaRef.digest
  ) {
    input.deps.store.putCommitReceipt(input.receipt);
    input.deps.store.putAdmission(input.finalizeInput.admission);
    input.deps.store.putCommitDecision(input.finalizeInput.commitDecision);
    return ok(input.receipt);
  }
  input.deps.store.putCommitDecision({
    ...input.decision,
    status: "recovery_required",
    updatedAt: new Date().toISOString(),
  });
  input.deps.fileStore?.persist();
  return err(
    controlPlaneViolation("commit_conflict", "commit", "binding CAS failed after runtime apply", {
      retryable: true,
    }),
  );
}

export async function executeCommitAdmissionTransaction(
  deps: CommitAdmissionTransactionDeps,
  input: CommitAdmissionTransactionInput,
): Promise<Result<SchemaAdmissionReceipt, ControlPlaneViolation>> {
  const existingReceipt = deps.store.getCommitReceipt(input.admissionId);
  const existingDecision = deps.store.getCommitDecision(input.admissionId);
  if (existingDecision?.status === "finalized" && existingReceipt !== undefined) {
    return ok(existingReceipt);
  }

  const toBinding = createNextBinding({
    domainId: input.record.request.activationDomainId,
    current: input.active,
    targetSchemaRef: input.preparedRecord.toSchemaRef,
    targetEpochId: input.preparedRecord.toEpochId,
    targetEpochOrdinal: input.preparedRecord.toEpochOrdinal,
    targetPolicyRef: input.active.policyRef,
    targetHandlerManifestRef:
      input.record.targetHandlerManifestRef ?? input.active.handlerManifestRef,
    runtimeHead: input.preparedRecord.expectedRuntimeHead,
    admissionId: input.admissionId,
    activatedBy: input.operator,
    activatedAt: new Date().toISOString(),
  });

  let decision: CommitDecisionRecord =
    existingDecision ??
    ({
      admissionId: input.admissionId,
      preparedId: input.preparedId,
      expectedBindingGeneration: input.active.bindingGeneration,
      status: "decided",
      toBinding,
      operator: input.operator,
      updatedAt: new Date().toISOString(),
    } satisfies CommitDecisionRecord);

  if (decision.status === "decided") {
    deps.store.putCommitDecision(decision);
    deps.fileStore?.persist();
  }

  const runtimeResult = await resolveRuntimeReceipt(
    deps,
    input,
    decision,
    toBinding,
    input.preparedRecord,
  );
  if (!runtimeResult.ok) {
    return runtimeResult;
  }
  const runtimeReceipt = runtimeResult.value.runtimeReceipt;
  decision = runtimeResult.value.decision;

  const finalizedBinding = decision.toBinding ?? {
    ...toBinding,
    runtimeHead: runtimeReceipt.afterSnapshotRef,
  };
  const receipt = buildReceipt({
    record: input.record,
    active: input.active,
    toBinding: finalizedBinding,
    runtimeReceipt,
    planDigest: input.preparedRecord.planDigest,
    operator: input.operator,
    store: deps.store,
  });

  const finalizeInput: FinalizeAdmissionCommitInput = {
    domainId: input.record.request.activationDomainId,
    expectedGeneration: input.active.bindingGeneration,
    nextBinding: finalizedBinding,
    admission: { ...input.record, state: "committed", updatedAt: receipt.committedAt },
    commitDecision: {
      ...decision,
      status: "finalized",
      updatedAt: receipt.committedAt,
    },
    event: deps.store.nextEvent("SchemaAdmissionCommitted", input.operator, {
      admissionId: input.admissionId,
      fromEpochId: input.active.epochId,
      toEpochId: finalizedBinding.epochId,
      fromBindingGeneration: input.active.bindingGeneration,
      toBindingGeneration: finalizedBinding.bindingGeneration,
    }),
    receipt,
  };

  const finalizeResult = deps.store.finalizeAdmissionCommit(finalizeInput);
  if (finalizeResult === "cas_conflict") {
    return handleFinalizeCasConflict({
      deps,
      admissionId: input.admissionId,
      domainId: input.record.request.activationDomainId,
      finalizedBinding,
      receipt,
      finalizeInput,
      decision,
    });
  }

  deps.updateBinding(finalizedBinding);
  deps.outbox.enqueue(finalizeInput.event);
  deps.fileStore?.persist();
  deps.fileStore?.appendJournal(receipt);
  return ok(receipt);
}

export async function recoverForwardCommit(
  deps: CommitAdmissionTransactionDeps,
  admissionId: SchemaAdmissionId,
): Promise<Result<SchemaAdmissionReceipt, ControlPlaneViolation>> {
  const decision = deps.store.getCommitDecision(admissionId);
  if (decision?.toBinding === undefined) {
    return err(controlPlaneViolation("invalid_input", "commit", "no recoverable commit decision"));
  }
  if (decision.status === "finalized") {
    const receipt = deps.store.getCommitReceipt(admissionId);
    if (receipt !== undefined) {
      return ok(receipt);
    }
  }
  if (decision.status !== "runtime_applied" && decision.status !== "recovery_required") {
    return err(controlPlaneViolation("invalid_input", "commit", "commit not ready for recovery"));
  }
  const record = deps.store.getAdmission(admissionId);
  if (record === undefined) {
    return err(
      controlPlaneViolation("invalid_input", "commit", "admission missing during recovery"),
    );
  }
  const active = deps.store.getActiveBinding(record.request.activationDomainId);
  if (active === undefined) {
    return err(controlPlaneViolation("stale_active_binding", "commit", "active binding missing"));
  }
  const recovered = await deps.epochAdmin.recoverEpochTransition(admissionId);
  if (!recovered.ok) {
    return err(
      controlPlaneViolation("commit_conflict", "commit", recovered.error.message, {
        retryable: true,
      }),
    );
  }
  const receipt = deps.store.getCommitReceipt(admissionId);
  if (
    receipt?.toBinding.bindingGeneration === active.bindingGeneration &&
    receipt?.toBinding.schemaRef.digest === active.schemaRef.digest
  ) {
    return ok(receipt);
  }
  const subject = buildAdmissionEvidenceSubject(record, active);
  if (
    subject === undefined ||
    record.qualification === undefined ||
    record.authorization === undefined
  ) {
    return err(
      controlPlaneViolation("invalid_input", "commit", "missing evidence during recovery"),
    );
  }
  const operator = decision.operator ?? record.authorization.authorizedBy;
  const finalizeInput: FinalizeAdmissionCommitInput = {
    domainId: record.request.activationDomainId,
    expectedGeneration: decision.expectedBindingGeneration,
    nextBinding: decision.toBinding,
    admission: { ...record, state: "committed", updatedAt: new Date().toISOString() },
    commitDecision: {
      ...decision,
      status: "finalized",
      runtimeBeforeRef: recovered.value.beforeSnapshotRef,
      runtimeAfterRef: recovered.value.afterSnapshotRef,
      updatedAt: new Date().toISOString(),
    },
    event: deps.store.nextEvent("SchemaAdmissionCommitted", operator, {
      admissionId,
      fromEpochId: active.epochId,
      toEpochId: decision.toBinding.epochId,
      fromBindingGeneration: active.bindingGeneration,
      toBindingGeneration: decision.toBinding.bindingGeneration,
    }),
    receipt: buildReceipt({
      record,
      active,
      toBinding: decision.toBinding,
      runtimeReceipt: recovered.value,
      planDigest: record.qualification.extensionPlanDigest as PlanDigest,
      operator,
      store: deps.store,
    }),
  };
  const result = deps.store.finalizeAdmissionCommit(finalizeInput);
  if (result === "cas_conflict") {
    return err(
      controlPlaneViolation("commit_conflict", "commit", "recovery finalize CAS conflict", {
        retryable: true,
      }),
    );
  }
  deps.updateBinding(decision.toBinding);
  deps.outbox.enqueue(finalizeInput.event);
  deps.fileStore?.persist();
  return ok(finalizeInput.receipt);
}
