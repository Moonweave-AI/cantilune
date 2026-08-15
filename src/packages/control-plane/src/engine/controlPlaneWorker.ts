import { randomUUID } from "node:crypto";
import {
  err,
  ok,
  preparedAdmissionId,
  schemaAdmissionId,
  type PlanDigest,
  type Result,
  type SchemaAdmissionId,
  type SchemaAdmissionReceipt,
  type SchemaEpochBinding,
} from "@cantilune/core";
import {
  allowedOperationsFromSchema,
  snapshotSchemaEpochBinding,
  type RuntimeEpochAdministration,
} from "@cantilune/runtime";
import type { ConformanceEvidenceVerifier, FourViewEvidenceBundle } from "@cantilune/conformance";
import type {
  ReviewedDecision,
  SignedHumanReviewAttestation,
  SealedAdmissionGateDeps,
} from "@cantilune/conformance/admission";
import { validateSealedAdmissionPrepare } from "@cantilune/conformance/admission";
import {
  controlPlaneViolation,
  type ControlPlaneViolation,
} from "../errors/controlPlaneViolation.js";
import type { ControlPlaneStore } from "../ports/controlPlaneStore.js";
import { createPolicyBindingUpdate } from "../activation/epochTransitionPlan.js";
import {
  validateHandlerManifestAgainstSchema,
  type HandlerManifest,
} from "../manifest/handlerManifest.js";
import type {
  ActivatePolicyRevisionCommand,
  PolicyActivationReceipt,
} from "../policy/policyActivation.js";
import type { ControlPlaneOutbox } from "../events/controlPlaneOutbox.js";
import type { FileControlPlaneStore } from "../file/fileControlPlaneStore.js";
import { canTransitionAdmission } from "../admission/schemaAdmissionState.js";
import {
  toPreparedHandle,
  type PreparedAdmissionHandle,
} from "../admission/preparedAdmissionRecord.js";
import {
  administrationActorId,
  hasRole,
  type AdministrationContext,
} from "../administration/administrationContext.js";
import type { AdministrationAuthorizer } from "../administration/administrationAuthorizer.js";
import {
  buildAdmissionEvidenceSubject,
  toFourViewSubject,
} from "../administration/buildEvidenceSubject.js";
import { extensionPlanCanonicalDigest } from "../schema/extensionPlanDigest.js";
import {
  executeCommitAdmissionTransaction,
  recoverForwardCommit,
  type CommitAdmissionTransactionDeps,
} from "./commitAdmissionTransaction.js";
import {
  snapshotPolicyRevision,
  verifyPolicyRevisionIntegrity,
  type PolicyRevision,
} from "../policy/policyRevision.js";

export interface PrepareSchemaAdmissionCommand {
  readonly context: AdministrationContext;
  readonly admissionId: SchemaAdmissionId;
  readonly fourViewEvidence: FourViewEvidenceBundle;
  readonly reviewedDecision: ReviewedDecision;
  readonly signedAttestation: SignedHumanReviewAttestation;
  readonly handlerManifest: HandlerManifest;
}

export interface CommitSchemaAdmissionCommand {
  readonly context: AdministrationContext;
  readonly admissionId: SchemaAdmissionId;
  readonly preparedHandle: PreparedAdmissionHandle;
}

export interface ControlPlaneWorkerDeps {
  readonly store: ControlPlaneStore;
  readonly epochAdmin: RuntimeEpochAdministration;
  readonly conformance: ConformanceEvidenceVerifier;
  readonly authorizer: AdministrationAuthorizer;
  readonly outbox: ControlPlaneOutbox;
  readonly fileStore?: FileControlPlaneStore;
  readonly sealedAdmissionGate?: SealedAdmissionGateDeps;
  readonly updateBinding: (binding: SchemaEpochBinding) => void;
  readonly onPolicyActivated?: (revision: PolicyRevision, binding: SchemaEpochBinding) => void;
}

function fallbackSealedAdmissionGateDeps(): SealedAdmissionGateDeps {
  throw new Error(
    "sealedAdmissionGate is required in ControlPlaneWorkerDeps: " +
      "provide a real trustStore, cryptoVerifier, and requiredReviewerRoles",
  );
}

function ensureNotFrozen(store: ControlPlaneStore, phase: ControlPlaneViolation["phase"]) {
  if (store.isFrozen()) {
    return err(controlPlaneViolation("control_plane_frozen", phase, "control plane is frozen"));
  }
  return ok(undefined);
}

export async function prepareSchemaAdmission(
  deps: ControlPlaneWorkerDeps,
  command: PrepareSchemaAdmissionCommand,
): Promise<Result<PreparedAdmissionHandle, ControlPlaneViolation>> {
  const gate = ensureNotFrozen(deps.store, "prepare");
  if (!gate.ok) {
    return gate;
  }
  const record = deps.store.getAdmission(command.admissionId);
  if (record === undefined || !canTransitionAdmission(record.state, "preparing")) {
    return err(
      controlPlaneViolation("invalid_input", "prepare", "admission not ready for prepare"),
    );
  }
  const active = deps.store.getActiveBinding(record.request.activationDomainId);
  if (
    active === undefined ||
    record.targetSchemaRef === undefined ||
    record.targetEpochId === undefined ||
    record.qualification === undefined ||
    record.authorization === undefined
  ) {
    return err(controlPlaneViolation("invalid_input", "prepare", "missing authorization fields"));
  }
  const subject = buildAdmissionEvidenceSubject(record, active);
  if (subject === undefined) {
    return err(controlPlaneViolation("invalid_input", "prepare", "cannot build evidence subject"));
  }
  const verified = await validateSealedAdmissionPrepare(
    {
      reviewedDecision: command.reviewedDecision,
      signedAttestation: command.signedAttestation,
      bundle: command.fourViewEvidence,
      subject: toFourViewSubject(subject),
    },
    deps.sealedAdmissionGate ?? fallbackSealedAdmissionGateDeps(),
  );
  if (!verified.ok) {
    const message = verified.error.map((v) => v.message).join("; ");
    return err(controlPlaneViolation("conformance_invalid", "prepare", message));
  }
  const candidate = deps.store.getRevision(record.targetSchemaRef);
  if (candidate === undefined) {
    return err(controlPlaneViolation("schema_not_found", "prepare", "candidate revision missing"));
  }
  const manifestOk = validateHandlerManifestAgainstSchema(command.handlerManifest, [
    ...allowedOperationsFromSchema(candidate.schema),
  ]);
  if (!manifestOk.ok) {
    return manifestOk;
  }
  const planDig = extensionPlanCanonicalDigest(record.extensionPlan!);
  const prepareResult = await deps.epochAdmin.prepareEpochTransition({
    admissionId: command.admissionId,
    domainId: record.request.activationDomainId,
    expectedBindingGeneration: record.request.expectedBindingGeneration,
    expectedHead: record.request.expectedRuntimeHead,
    expectedEpochId: record.request.expectedEpochId,
    expectedEpochOrdinal: record.request.expectedEpochOrdinal,
    targetSchemaRef: record.targetSchemaRef,
    targetEpochId: record.targetEpochId,
    targetEpochOrdinal: record.targetEpochOrdinal!,
    planDigest: planDig as string,
  });
  if (!prepareResult.ok) {
    return err(
      controlPlaneViolation("preparation_expired", "prepare", prepareResult.error.message, {
        retryable: true,
      }),
    );
  }
  const preparedId = preparedAdmissionId(`prep-${randomUUID()}`);
  const preparedRecord = {
    preparedId,
    admissionId: command.admissionId,
    activationDomainId: record.request.activationDomainId,
    fromSchemaRef: active.schemaRef,
    toSchemaRef: record.targetSchemaRef,
    fromEpochId: active.epochId,
    toEpochId: record.targetEpochId,
    fromEpochOrdinal: active.epochOrdinal,
    toEpochOrdinal: record.targetEpochOrdinal!,
    expectedBindingGeneration: active.bindingGeneration,
    expectedRuntimeHead: record.request.expectedRuntimeHead,
    planDigest: planDig as PlanDigest,
    runtimePreparedId: prepareResult.value.preparedId,
    issuedAt: prepareResult.value.issuedAt,
    expiresAt: prepareResult.value.expiresAt,
    consumed: false,
  };
  deps.store.putPrepared(preparedRecord);
  deps.store.putAdmission({
    ...record,
    fourView: verified.value,
    targetHandlerManifestRef: command.handlerManifest.manifestRef,
    state: "prepared",
    updatedAt: new Date().toISOString(),
  });
  deps.store.appendEvent(
    deps.store.nextEvent("SchemaAdmissionPrepared", administrationActorId(command.context), {
      admissionId: command.admissionId,
      preparedId,
    }),
  );
  return ok(toPreparedHandle(preparedRecord));
}

export async function commitSchemaAdmission(
  deps: ControlPlaneWorkerDeps,
  command: CommitSchemaAdmissionCommand,
): Promise<Result<SchemaAdmissionReceipt, ControlPlaneViolation>> {
  const gate = ensureNotFrozen(deps.store, "commit");
  if (!gate.ok) {
    return gate;
  }
  const record = deps.store.getAdmission(command.admissionId);
  if (record?.state !== "prepared") {
    const recovery = await recoverForwardCommit(deps, command.admissionId);
    if (recovery.ok) {
      return recovery;
    }
    return err(controlPlaneViolation("invalid_input", "commit", "admission not prepared"));
  }
  if (record.qualification === undefined || record.authorization === undefined) {
    return err(controlPlaneViolation("authorization_denied", "commit", "missing evidence bundle"));
  }
  const active = deps.store.getActiveBinding(record.request.activationDomainId);
  if (active === undefined) {
    return err(controlPlaneViolation("stale_active_binding", "commit", "active binding missing"));
  }
  const subject = buildAdmissionEvidenceSubject(record, active);
  if (subject === undefined) {
    return err(controlPlaneViolation("invalid_input", "commit", "evidence subject missing"));
  }
  const operator = administrationActorId(command.context);
  const authOk = deps.authorizer.verify({
    subject,
    qualification: record.qualification,
    authorization: record.authorization,
    operator,
  });
  if (!authOk.ok) {
    return authOk;
  }
  const preparedRecord = deps.store.consumePrepared(command.preparedHandle.preparedId);
  if (preparedRecord === undefined) {
    const existing = deps.store.getCommitDecision(command.admissionId);
    if (existing?.preparedId === command.preparedHandle.preparedId) {
      return recoverForwardCommit(deps, command.admissionId);
    }
    return err(
      controlPlaneViolation("invalid_input", "commit", "prepared token invalid or consumed"),
    );
  }
  if (preparedRecord.admissionId !== command.admissionId) {
    return err(
      controlPlaneViolation("invalid_input", "commit", "prepared token admission mismatch"),
    );
  }
  if (Date.now() > Date.parse(preparedRecord.expiresAt)) {
    return err(controlPlaneViolation("preparation_expired", "commit", "preparation expired"));
  }
  if (preparedRecord.expectedBindingGeneration !== active.bindingGeneration) {
    return err(controlPlaneViolation("stale_active_binding", "commit", "binding generation drift"));
  }

  return executeCommitAdmissionTransaction(deps, {
    admissionId: command.admissionId,
    preparedId: preparedRecord.preparedId,
    operator,
    record,
    active,
    preparedRecord,
  });
}

export async function recoverSchemaAdmissionCommit(
  deps: CommitAdmissionTransactionDeps,
  admissionId: SchemaAdmissionId,
): Promise<Result<SchemaAdmissionReceipt, ControlPlaneViolation>> {
  return recoverForwardCommit(deps, admissionId);
}

export function activatePolicyRevision(
  deps: Pick<
    ControlPlaneWorkerDeps,
    "store" | "outbox" | "fileStore" | "updateBinding" | "onPolicyActivated"
  > & {
    readonly context: AdministrationContext;
  },
  command: ActivatePolicyRevisionCommand,
): Result<PolicyActivationReceipt, ControlPlaneViolation> {
  const gate = ensureNotFrozen(deps.store, "activate");
  if (!gate.ok) {
    return gate;
  }
  if (!hasRole(deps.context, "policy-admin")) {
    return err(
      controlPlaneViolation("authorization_denied", "activate", "missing policy-admin role"),
    );
  }
  let policyRevision: PolicyRevision;
  try {
    policyRevision = snapshotPolicyRevision(command.policyRevision);
  } catch {
    return err(controlPlaneViolation("invalid_input", "activate", "invalid policy revision"));
  }
  if (!verifyPolicyRevisionIntegrity(policyRevision)) {
    return err(
      controlPlaneViolation("invalid_input", "activate", "policy revision integrity mismatch"),
    );
  }
  const active = deps.store.getActiveBinding(command.activationDomainId);
  if (active === undefined) {
    return err(controlPlaneViolation("stale_active_binding", "activate", "active binding missing"));
  }
  if (active.bindingGeneration !== command.expectedBindingGeneration) {
    return err(
      controlPlaneViolation("stale_active_binding", "activate", "binding generation mismatch"),
    );
  }
  const compatible = policyRevision.compatibleSchemaRefs.some(
    (ref) => ref.digest === active.schemaRef.digest,
  );
  if (!compatible) {
    return err(
      controlPlaneViolation("invalid_input", "activate", "policy incompatible with active schema"),
    );
  }
  deps.store.registerPolicy(policyRevision);
  const nextBinding = snapshotSchemaEpochBinding(
    createPolicyBindingUpdate({
      current: active,
      targetPolicyRef: policyRevision.policyRef,
      admissionId: schemaAdmissionId(
        `policy-${policyRevision.policyRef.policyId}-${policyRevision.policyRef.revisionId}`,
      ),
      activatedBy: administrationActorId(deps.context),
      activatedAt: command.activatedAt,
    }),
  );
  const casOk = deps.store.casActiveBinding({
    domainId: command.activationDomainId,
    expectedGeneration: command.expectedBindingGeneration,
    nextBinding,
  });
  if (!casOk) {
    return err(controlPlaneViolation("commit_conflict", "activate", "policy binding CAS failed"));
  }
  deps.updateBinding(snapshotSchemaEpochBinding(nextBinding));
  deps.onPolicyActivated?.(
    snapshotPolicyRevision(policyRevision),
    snapshotSchemaEpochBinding(nextBinding),
  );
  const receipt: PolicyActivationReceipt = {
    policyRef: policyRevision.policyRef,
    compatibleSchemaRefs: policyRevision.compatibleSchemaRefs,
    activationDomainId: command.activationDomainId,
    fromBindingGeneration: active.bindingGeneration,
    toBindingGeneration: nextBinding.bindingGeneration,
    activatedBy: administrationActorId(deps.context),
    activatedAt: command.activatedAt,
    storeSequence: deps.store.snapshot().lastSequence as number,
  };
  const event = deps.store.nextEvent(
    "PolicyActivationCommitted",
    administrationActorId(deps.context),
    receipt,
  );
  deps.store.appendEvent(event);
  deps.outbox.enqueue(event);
  deps.fileStore?.persist();
  return ok(receipt);
}
