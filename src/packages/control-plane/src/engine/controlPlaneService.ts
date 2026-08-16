import {
  activationDomainId,
  bindingGeneration,
  contentDigest,
  epochId,
  epochOrdinal,
  err,
  handlerManifestId,
  ok,
  policyId,
  policyRevisionId,
  schemaAdmissionId,
  schemaRevisionId,
  snapshotRef,
  storeSequence,
  type ActivationDomainId,
  type Result,
  type RuntimeInstanceId,
  type SchemaAdmissionId,
  type SchemaAdmissionReceipt,
  type SchemaEpochBinding,
  type ActorId,
  type CollaborationSnapshot,
  type SchemaRef,
  type TranscriptAccessRequest,
} from "@cantilune/core";
import { createDefaultSchema, type RuntimeEpochAdministration } from "@cantilune/runtime";
import type { ConformanceEvidenceVerifier } from "@cantilune/conformance";
import type { SealedAdmissionGateDeps } from "@cantilune/conformance/admission";
import {
  controlPlaneViolation,
  type ControlPlaneViolation,
} from "../errors/controlPlaneViolation.js";
import {
  admissionDigest,
  type ControlPlaneEventEnvelope,
  type ControlPlaneStore,
} from "../ports/controlPlaneStore.js";
import {
  createSchemaRevision,
  type SchemaRevision,
  type SchemaRevisionSummary,
} from "../schema/schemaRevision.js";
import { computeMonotoneExtensionPlan } from "../schema/monotoneExtensionValidator.js";
import type {
  ApproveSchemaAdmissionCommand,
  RegisterSchemaRevisionCommand,
  SchemaAdmissionRecord,
  SubmitSchemaAdmissionCommand,
} from "../admission/schemaAdmissionRequest.js";
import { canTransitionAdmission } from "../admission/schemaAdmissionState.js";
import type { MemoryControlPlaneStore } from "../memory/memoryControlPlaneStore.js";
import {
  prepareSchemaAdmission,
  commitSchemaAdmission,
  activatePolicyRevision,
  recoverSchemaAdmissionCommit,
  type ControlPlaneWorkerDeps,
  type PrepareSchemaAdmissionCommand,
  type CommitSchemaAdmissionCommand,
} from "./controlPlaneWorker.js";
import type { PreparedAdmissionHandle } from "../admission/preparedAdmissionRecord.js";
import type {
  ActivatePolicyRevisionCommand,
  PolicyActivationReceipt,
} from "../policy/policyActivation.js";
import type { ControlPlaneOutbox } from "../events/controlPlaneOutbox.js";
import type { FileControlPlaneStore } from "../file/fileControlPlaneStore.js";
import {
  ReconciliationService,
  type ReconciliationReport,
} from "../rollout/reconciliationService.js";
import type { RuntimeBinding, RolloutPlan } from "../rollout/runtimeBinding.js";
import {
  administrationActorId,
  type AdministrationContext,
} from "../administration/administrationContext.js";
import { nextEpochFrom } from "../activation/epochIdentity.js";
import { extensionPlanCanonicalDigest } from "../schema/extensionPlanDigest.js";
import {
  createQualificationEvaluator,
  type QualificationEvaluator,
} from "../administration/qualificationEvaluator.js";
import {
  createAdministrationAuthorizer,
  type AdministrationAuthorizer,
} from "../administration/administrationAuthorizer.js";
import type { AdmissionEvidenceSubject } from "../administration/evidenceSubject.js";
import { createPolicyRevision, type PolicyRevision } from "../policy/policyRevision.js";
import { createHandlerManifest } from "../manifest/handlerManifest.js";
import {
  decodeActivatePolicyRevisionWire,
  decodeApproveSchemaAdmissionWire,
  decodeRegisterSchemaRevisionWire,
  decodeSubmitSchemaAdmissionWire,
} from "../codec/ingressWireCodec.js";
import {
  createNamespaceRegistry,
  type AssignNamespaceRoleInput,
  type NamespaceRecord,
  type NamespaceRegistry,
  type RegisterNamespaceInput,
} from "../namespace/namespaceRegistry.js";
import {
  createTranscriptAccessWorkflow,
  type DecideTranscriptAccessInput,
  type RequestTranscriptAccessInput,
  type TranscriptAccessDecision,
  type TranscriptAccessWorkflow,
} from "../namespace/transcriptAccessWorkflow.js";
import {
  projectFleetConsole,
  type FleetConsoleProjection,
} from "../fleet/fleetConsoleProjection.js";

export interface ControlPlaneService {
  registerSchemaRevision(
    command: RegisterSchemaRevisionCommand,
  ): Promise<Result<SchemaRevision, ControlPlaneViolation>>;
  getSchemaRevision(ref: SchemaRef): Promise<SchemaRevision | undefined>;
  listSchemaRevisions(query?: {
    readonly schemaId?: string;
  }): Promise<readonly SchemaRevisionSummary[]>;
  submitSchemaAdmission(
    command: SubmitSchemaAdmissionCommand,
  ): Promise<Result<SchemaAdmissionRecord, ControlPlaneViolation>>;
  approveSchemaAdmission(
    command: ApproveSchemaAdmissionCommand,
  ): Promise<Result<SchemaAdmissionRecord, ControlPlaneViolation>>;
  getActiveBinding(domainId: ActivationDomainId): Promise<SchemaEpochBinding | undefined>;
  getSchemaAdmission(id: SchemaAdmissionId): Promise<SchemaAdmissionRecord | undefined>;
  readEvents(cursor?: number): Promise<readonly ControlPlaneEventEnvelope[]>;
  registerNamespace(input: RegisterNamespaceInput): Result<NamespaceRecord, ControlPlaneViolation>;
  listNamespaces(): readonly NamespaceRecord[];
  assignNamespaceRole(
    input: AssignNamespaceRoleInput,
  ): Result<NamespaceRecord, ControlPlaneViolation>;
  requestTranscriptAccess(
    input: RequestTranscriptAccessInput,
  ): Result<TranscriptAccessRequest, ControlPlaneViolation>;
  decideTranscriptAccess(
    input: DecideTranscriptAccessInput,
  ): Result<TranscriptAccessDecision, ControlPlaneViolation>;
  projectFleetConsole(snapshot: CollaborationSnapshot, reader: ActorId): FleetConsoleProjection;
}

export interface FullControlPlaneService extends ControlPlaneService {
  prepareSchemaAdmission(
    command: PrepareSchemaAdmissionCommand,
  ): Promise<Result<PreparedAdmissionHandle, ControlPlaneViolation>>;
  commitSchemaAdmission(
    command: CommitSchemaAdmissionCommand,
  ): Promise<Result<SchemaAdmissionReceipt, ControlPlaneViolation>>;
  recoverSchemaAdmissionCommit(
    admissionId: SchemaAdmissionId,
  ): Promise<Result<SchemaAdmissionReceipt, ControlPlaneViolation>>;
  activatePolicyRevision(
    command: ActivatePolicyRevisionCommand,
  ): Result<PolicyActivationReceipt, ControlPlaneViolation>;
  submitSchemaAdmissionWire(
    wire: unknown,
    context: AdministrationContext,
  ): Promise<Result<SchemaAdmissionRecord, ControlPlaneViolation>>;
  approveSchemaAdmissionWire(
    wire: unknown,
    context: AdministrationContext,
  ): Promise<Result<SchemaAdmissionRecord, ControlPlaneViolation>>;
  registerSchemaRevisionWire(
    wire: unknown,
    context: AdministrationContext,
  ): Promise<Result<SchemaRevision, ControlPlaneViolation>>;
  activatePolicyRevisionWire(
    wire: unknown,
    context: AdministrationContext,
  ): Result<PolicyActivationReceipt, ControlPlaneViolation>;
  setFleetRollout(
    plan: RolloutPlan,
    context: AdministrationContext,
  ): Result<void, ControlPlaneViolation>;
  acknowledgeRuntimeInstance(
    runtimeInstanceId: RuntimeInstanceId,
    observedBinding: SchemaEpochBinding,
    context: AdministrationContext,
  ): Result<void, ControlPlaneViolation>;
  listRuntimeBindings(): readonly RuntimeBinding[];
  rolloutReport(): ReconciliationReport;
}

export interface ControlPlaneServiceDeps {
  readonly store: ControlPlaneStore;
  readonly defaultDomainId?: ActivationDomainId;
  readonly qualification?: QualificationEvaluator;
  readonly authorizer?: AdministrationAuthorizer;
  readonly namespaceRegistry?: NamespaceRegistry;
  readonly transcriptAccessWorkflow?: TranscriptAccessWorkflow;
}

export interface FullControlPlaneServiceDeps extends ControlPlaneServiceDeps {
  readonly epochAdmin: RuntimeEpochAdministration;
  readonly conformance: ConformanceEvidenceVerifier;
  readonly outbox: ControlPlaneOutbox;
  readonly fileStore?: FileControlPlaneStore;
  readonly sealedAdmissionGate?: SealedAdmissionGateDeps;
  readonly reconciliation?: ReconciliationService;
  readonly fleetInstanceIds?: readonly RuntimeInstanceId[];
  readonly onBindingActivated?: (binding: SchemaEpochBinding) => void;
  readonly onPolicyActivated?: (revision: PolicyRevision, binding: SchemaEpochBinding) => void;
}

function ensureNotFrozen(
  store: ControlPlaneStore,
  phase: ControlPlaneViolation["phase"],
): Result<void, ControlPlaneViolation> {
  if (store.isFrozen()) {
    return err(controlPlaneViolation("control_plane_frozen", phase, "control plane is frozen"));
  }
  return ok(undefined);
}

function buildSubjectFromPlan(
  record: SchemaAdmissionRecord,
  active: SchemaEpochBinding,
  planDigest: ReturnType<typeof extensionPlanCanonicalDigest>,
): AdmissionEvidenceSubject {
  return {
    admissionId: record.request.admissionId,
    activationDomainId: record.request.activationDomainId,
    fromSchemaRef: active.schemaRef,
    toSchemaRef: record.targetSchemaRef!,
    fromEpochId: active.epochId,
    toEpochId: record.targetEpochId!,
    fromEpochOrdinal: active.epochOrdinal,
    toEpochOrdinal: record.targetEpochOrdinal!,
    extensionPlanDigest: planDigest,
    expectedRuntimeHead: record.request.expectedRuntimeHead,
    expectedBindingGeneration: active.bindingGeneration as number,
  };
}

function validateActiveBindingForSubmit(
  active: SchemaEpochBinding | undefined,
  request: SubmitSchemaAdmissionCommand["request"],
): Result<SchemaEpochBinding, ControlPlaneViolation> {
  if (active === undefined) {
    return err(controlPlaneViolation("stale_active_binding", "validate", "no active binding"));
  }
  if (active.bindingGeneration !== request.expectedBindingGeneration) {
    return err(
      controlPlaneViolation("stale_active_binding", "validate", "binding generation mismatch"),
    );
  }
  if (active.runtimeHead !== request.expectedRuntimeHead) {
    return err(controlPlaneViolation("runtime_head_changed", "validate", "runtime head mismatch"));
  }
  if (active.schemaRef.digest !== request.expectedSchemaRef.digest) {
    return err(
      controlPlaneViolation("stale_active_binding", "validate", "expected schema mismatch"),
    );
  }
  if (active.epochId !== request.expectedEpochId) {
    return err(controlPlaneViolation("epoch_not_advanced", "validate", "expected epoch mismatch"));
  }
  if (active.epochOrdinal !== request.expectedEpochOrdinal) {
    return err(
      controlPlaneViolation("epoch_not_advanced", "validate", "expected epoch ordinal mismatch"),
    );
  }
  return ok(active);
}

function validateCandidateRevisions(
  store: ControlPlaneStore,
  active: SchemaEpochBinding,
  candidateSchemaRef: SchemaRef,
): Result<
  { readonly candidate: SchemaRevision; readonly currentRevision: SchemaRevision },
  ControlPlaneViolation
> {
  const candidate = store.getRevision(candidateSchemaRef);
  if (candidate === undefined) {
    return err(
      controlPlaneViolation("schema_not_found", "validate", "candidate revision not found"),
    );
  }
  const currentRevision = store.getRevision(active.schemaRef);
  if (currentRevision === undefined) {
    return err(
      controlPlaneViolation("schema_not_found", "validate", "active schema revision not found"),
    );
  }
  return ok({ candidate, currentRevision });
}

function claimOrReplayAdmission(
  store: ControlPlaneStore,
  record: SchemaAdmissionRecord,
): Result<SchemaAdmissionRecord | undefined, ControlPlaneViolation> {
  const digest = admissionDigest(record);
  const claim = store.claimIdempotency({
    key: record.request.idempotencyKey,
    digest,
  });
  if (claim === "conflict") {
    return err(
      controlPlaneViolation("idempotency_conflict", "validate", "idempotency key digest conflict"),
    );
  }
  if (claim === "replay") {
    const existing = store.getAdmission(record.request.admissionId);
    if (existing !== undefined) {
      return ok(existing);
    }
  }
  return ok(undefined);
}

export function createControlPlaneService(deps: ControlPlaneServiceDeps): ControlPlaneService {
  const qualification = deps.qualification ?? createQualificationEvaluator();
  const authorizer = deps.authorizer ?? createAdministrationAuthorizer();
  const namespaceRegistry = deps.namespaceRegistry ?? createNamespaceRegistry();
  const transcriptAccessWorkflow =
    deps.transcriptAccessWorkflow ??
    createTranscriptAccessWorkflow({ registry: namespaceRegistry });

  return {
    async registerSchemaRevision(command) {
      const gate = ensureNotFrozen(deps.store, "register");
      if (!gate.ok) {
        return gate;
      }
      const revision = createSchemaRevision({
        schema: command.schema,
        revisionId: command.revisionId,
        createdBy: administrationActorId(command.context),
        createdAt: command.createdAt,
        ...(command.parentRef !== undefined ? { parentRef: command.parentRef } : {}),
      });
      if (deps.store.getRevision(revision.schemaRef) !== undefined) {
        return err(
          controlPlaneViolation(
            "revision_conflict",
            "register",
            "schema revision already registered",
          ),
        );
      }
      deps.store.registerRevision(revision);
      deps.store.appendEvent(
        deps.store.nextEvent("SchemaRevisionRegistered", administrationActorId(command.context), {
          schemaRef: revision.schemaRef,
        }),
      );
      return ok(revision);
    },

    async getSchemaRevision(ref) {
      return deps.store.getRevision(ref);
    },

    async listSchemaRevisions(query) {
      return deps.store.listRevisions(query?.schemaId).map((revision) => ({
        schemaRef: revision.schemaRef,
        status: "registered" as const,
        createdAt: revision.createdAt,
      }));
    },

    async submitSchemaAdmission(command) {
      const gate = ensureNotFrozen(deps.store, "validate");
      if (!gate.ok) {
        return gate;
      }

      const activeResult = validateActiveBindingForSubmit(
        deps.store.getActiveBinding(command.request.activationDomainId),
        command.request,
      );
      if (!activeResult.ok) {
        return activeResult;
      }
      const active = activeResult.value;

      const revisionsResult = validateCandidateRevisions(
        deps.store,
        active,
        command.request.candidateSchemaRef,
      );
      if (!revisionsResult.ok) {
        return revisionsResult;
      }
      const { candidate, currentRevision } = revisionsResult.value;

      const extension = computeMonotoneExtensionPlan(
        currentRevision.schema,
        candidate.schema,
        active.schemaRef,
        candidate.schemaRef,
      );
      if (!extension.ok) {
        return extension;
      }

      const nextEpoch = nextEpochFrom(active.epochId, active.epochOrdinal);
      const planDig = extensionPlanCanonicalDigest(extension.value);
      let record: SchemaAdmissionRecord = {
        request: {
          ...command.request,
          requestedBy: administrationActorId(command.context),
        },
        state: "validating",
        extensionPlan: extension.value,
        targetSchemaRef: candidate.schemaRef,
        targetEpochId: nextEpoch.epochId,
        targetEpochOrdinal: nextEpoch.epochOrdinal,
        updatedAt: command.request.requestedAt,
      };

      const subject = buildSubjectFromPlan(record, active, planDig);
      const qualified = qualification.qualify({
        context: command.context,
        subject,
        extensionPlan: extension.value,
      });
      if (!qualified.ok) {
        deps.store.releaseIdempotency(command.request.idempotencyKey);
        return qualified;
      }

      record = {
        ...record,
        state: "awaiting_authorization",
        qualification: qualified.value,
        updatedAt: command.request.requestedAt,
      };

      const idempotencyResult = claimOrReplayAdmission(deps.store, record);
      if (!idempotencyResult.ok) {
        return idempotencyResult;
      }
      if (idempotencyResult.value !== undefined) {
        return ok(idempotencyResult.value);
      }

      deps.store.putAdmission(record);
      deps.store.appendEvent(
        deps.store.nextEvent(
          "SchemaAdmissionSubmitted",
          administrationActorId(command.context),
          { admissionId: command.request.admissionId },
          command.request.idempotencyKey,
        ),
      );
      deps.store.appendEvent(
        deps.store.nextEvent("SchemaAdmissionQualified", administrationActorId(command.context), {
          admissionId: command.request.admissionId,
        }),
      );
      return ok(record);
    },

    async approveSchemaAdmission(command) {
      const gate = ensureNotFrozen(deps.store, "authorize");
      if (!gate.ok) {
        return gate;
      }
      const existing = deps.store.getAdmission(command.admissionId);
      if (existing === undefined) {
        return err(controlPlaneViolation("invalid_input", "authorize", "admission not found"));
      }
      if (!canTransitionAdmission(existing.state, "authorized")) {
        return err(
          controlPlaneViolation(
            "invalid_input",
            "authorize",
            `cannot authorize from ${existing.state}`,
          ),
        );
      }
      const active = deps.store.getActiveBinding(existing.request.activationDomainId);
      if (
        active === undefined ||
        existing.qualification === undefined ||
        existing.extensionPlan === undefined
      ) {
        return err(controlPlaneViolation("invalid_input", "authorize", "missing qualification"));
      }
      const planDig = extensionPlanCanonicalDigest(existing.extensionPlan);
      const subject = buildSubjectFromPlan(existing, active, planDig);
      const authorized = authorizer.authorize({
        context: command.context,
        subject,
        qualification: existing.qualification,
        proposer: existing.request.requestedBy,
      });
      if (!authorized.ok) {
        return authorized;
      }
      const updated: SchemaAdmissionRecord = {
        ...existing,
        state: "authorized",
        authorization: authorized.value,
        updatedAt: new Date().toISOString(),
      };
      deps.store.putAdmission(updated);
      deps.store.appendEvent(
        deps.store.nextEvent("SchemaAdmissionAuthorized", administrationActorId(command.context), {
          admissionId: command.admissionId,
        }),
      );
      return ok(updated);
    },

    async getActiveBinding(domainId) {
      return deps.store.getActiveBinding(domainId);
    },

    async getSchemaAdmission(id) {
      return deps.store.getAdmission(id);
    },

    async readEvents(cursor) {
      return deps.store.readEvents(cursor !== undefined ? storeSequence(cursor) : undefined);
    },

    registerNamespace(input) {
      const gate = ensureNotFrozen(deps.store, "register");
      if (!gate.ok) {
        return gate;
      }
      return namespaceRegistry.registerNamespace(input);
    },

    listNamespaces() {
      return namespaceRegistry.listNamespaces();
    },

    assignNamespaceRole(input) {
      const gate = ensureNotFrozen(deps.store, "authorize");
      if (!gate.ok) {
        return gate;
      }
      return namespaceRegistry.assignRole(input);
    },

    requestTranscriptAccess(input) {
      const gate = ensureNotFrozen(deps.store, "validate");
      if (!gate.ok) {
        return gate;
      }
      return transcriptAccessWorkflow.requestTranscriptAccess(input);
    },

    decideTranscriptAccess(input) {
      const gate = ensureNotFrozen(deps.store, "authorize");
      if (!gate.ok) {
        return gate;
      }
      return transcriptAccessWorkflow.decideTranscriptAccess(input);
    },

    projectFleetConsole(snapshot, reader) {
      return projectFleetConsole(snapshot, reader);
    },
  };
}

export function createFullControlPlaneService(
  deps: FullControlPlaneServiceDeps,
): FullControlPlaneService {
  const base = createControlPlaneService(deps);
  const reconciliation =
    deps.reconciliation ??
    new ReconciliationService(deps.fileStore !== undefined ? { fileStore: deps.fileStore } : {});
  const authorizer = deps.authorizer ?? createAdministrationAuthorizer();

  const workerDeps: ControlPlaneWorkerDeps = {
    store: deps.store,
    epochAdmin: deps.epochAdmin,
    conformance: deps.conformance,
    authorizer,
    outbox: deps.outbox,
    ...(deps.fileStore !== undefined ? { fileStore: deps.fileStore } : {}),
    ...(deps.sealedAdmissionGate !== undefined
      ? { sealedAdmissionGate: deps.sealedAdmissionGate }
      : {}),
    updateBinding: (binding) => {
      deps.onBindingActivated?.(binding);
      if (deps.fleetInstanceIds?.length) {
        reconciliation.setDesired({
          domainId: binding.activationDomainId,
          targetBinding: binding,
          runtimeInstanceIds: deps.fleetInstanceIds,
        });
      }
    },
    ...(deps.onPolicyActivated !== undefined ? { onPolicyActivated: deps.onPolicyActivated } : {}),
  };

  return {
    ...base,
    prepareSchemaAdmission: (command) => prepareSchemaAdmission(workerDeps, command),
    commitSchemaAdmission: (command) => commitSchemaAdmission(workerDeps, command),
    recoverSchemaAdmissionCommit: (admissionId) =>
      recoverSchemaAdmissionCommit(workerDeps, admissionId),
    activatePolicyRevision: (command) =>
      activatePolicyRevision(
        {
          store: deps.store,
          outbox: deps.outbox,
          context: command.context,
          updateBinding: workerDeps.updateBinding,
          ...(deps.fileStore !== undefined ? { fileStore: deps.fileStore } : {}),
          ...(deps.onPolicyActivated !== undefined
            ? { onPolicyActivated: deps.onPolicyActivated }
            : {}),
        },
        command,
      ),
    submitSchemaAdmissionWire: async (wire, context) => {
      const decoded = decodeSubmitSchemaAdmissionWire(wire, context);
      if (!decoded.ok) {
        return decoded;
      }
      return base.submitSchemaAdmission(decoded.value);
    },
    approveSchemaAdmissionWire: async (wire, context) => {
      const decoded = decodeApproveSchemaAdmissionWire(wire, context);
      if (!decoded.ok) {
        return decoded;
      }
      return base.approveSchemaAdmission(decoded.value);
    },
    registerSchemaRevisionWire: async (wire, context) => {
      const decoded = decodeRegisterSchemaRevisionWire(wire, context);
      if (!decoded.ok) {
        return decoded;
      }
      return base.registerSchemaRevision(decoded.value);
    },
    activatePolicyRevisionWire: (wire, context) => {
      const decoded = decodeActivatePolicyRevisionWire(wire, context);
      if (!decoded.ok) {
        return decoded;
      }
      return activatePolicyRevision(
        {
          store: deps.store,
          outbox: deps.outbox,
          context: decoded.value.context,
          updateBinding: workerDeps.updateBinding,
          ...(deps.fileStore !== undefined ? { fileStore: deps.fileStore } : {}),
          ...(deps.onPolicyActivated !== undefined
            ? { onPolicyActivated: deps.onPolicyActivated }
            : {}),
        },
        decoded.value,
      );
    },
    setFleetRollout: (plan, context) => {
      const gate = ensureNotFrozen(deps.store, "activate");
      if (!gate.ok) {
        return gate;
      }
      reconciliation.setDesired(plan);
      deps.store.appendEvent(
        deps.store.nextEvent("RuntimeBindingDesired", administrationActorId(context), plan),
      );
      deps.fileStore?.persist();
      return ok(undefined);
    },
    acknowledgeRuntimeInstance: (runtimeInstanceId, observedBinding, context) => {
      const gate = ensureNotFrozen(deps.store, "query");
      if (!gate.ok) {
        return gate;
      }
      reconciliation.acknowledge(runtimeInstanceId, observedBinding);
      deps.store.appendEvent(
        deps.store.nextEvent("RuntimeBindingDesired", administrationActorId(context), {
          runtimeInstanceId,
          observedBinding,
        }),
      );
      deps.fileStore?.persist();
      return ok(undefined);
    },
    listRuntimeBindings: () => reconciliation.list(),
    rolloutReport: () => reconciliation.report(),
  };
}

/** Bootstrap genesis binding for tests and local wiring. */
export function bootstrapDefaultControlPlane(store: MemoryControlPlaneStore): {
  readonly service: ControlPlaneService;
  readonly genesisRevision: SchemaRevision;
  readonly genesisBinding: SchemaEpochBinding;
} {
  const schema = createDefaultSchema();
  const revision = createSchemaRevision({
    schema,
    revisionId: schemaRevisionId("rev-001"),
    createdBy: "bootstrap",
    createdAt: new Date().toISOString(),
  });
  store.registerRevision(revision);

  const defaultPolicy = createPolicyRevision({
    policyId: policyId("default-policy"),
    revisionId: policyRevisionId("1"),
    compatibleSchemaRefs: [revision.schemaRef],
    rules: [{ ruleId: "allow-all", decision: "allow" }],
    createdBy: "bootstrap",
    createdAt: new Date().toISOString(),
  });
  store.registerPolicy(defaultPolicy);

  const defaultManifest = createHandlerManifest({
    manifestId: handlerManifestId("default-handlers"),
    bindings: schema.templates.map((template) => ({
      operationTypeId: template.operationTypeId,
      templateRef: template.templateRef,
      handlerRevision: template.templateRef.revision,
      artifactRef: `artifact://${template.operationTypeId}`,
      artifactDigest: contentDigest(`artifact-${template.operationTypeId}`),
      runtimeCompatibility: "runtime/1",
    })),
    createdAt: new Date().toISOString(),
  });
  const binding: SchemaEpochBinding = {
    activationDomainId: activationDomainId("default"),
    bindingGeneration: bindingGeneration(1),
    epochId: epochId("42"),
    epochOrdinal: epochOrdinal(1),
    schemaRef: revision.schemaRef,
    policyRef: defaultPolicy.policyRef,
    handlerManifestRef: defaultManifest.manifestRef,
    runtimeHead: snapshotRef("snap-S0"),
    admissionId: schemaAdmissionId("bootstrap-genesis"),
    activatedBy: "bootstrap",
    activatedAt: new Date().toISOString(),
  };

  store.casActiveBinding({
    domainId: binding.activationDomainId,
    expectedGeneration: bindingGeneration(0),
    nextBinding: binding,
  });

  const service = createControlPlaneService({ store, defaultDomainId: binding.activationDomainId });
  return { service, genesisRevision: revision, genesisBinding: binding };
}
