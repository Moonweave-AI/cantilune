import { buildConfigT0 } from "@cantilune/test-fixtures";
import {
  contentDigest,
  handlerManifestId,
  type IdempotencyKey,
  type Result,
  type SchemaAdmissionId,
  type SchemaAdmissionReceipt,
  type SchemaEpochBinding,
  type SchemaRef,
} from "@cantilune/core";
import type { ControlPlaneViolation } from "../../src/errors/controlPlaneViolation.js";
import {
  computeEvidenceDigest,
  createConformanceEvidenceVerifier,
  type FourViewEvidenceBundle,
} from "@cantilune/conformance";
import type {
  ReviewedDecision,
  SignedHumanReviewAttestation,
} from "@cantilune/conformance/admission";
import { createMemoryCryptoVerifier } from "@cantilune/conformance/admission";
import {
  buildReviewedEngineeringAdmissionForTest,
  defaultTestReviewerTrustStore,
} from "@cantilune/conformance/testing";
import {
  AdmissionRegistry,
  createActiveSchemaContext,
  createMemoryEpochAdministration,
  createMutableBindingHolder,
  createMutablePolicyEvaluatorHolder,
  createMutableSchemaContextHolder,
  type OrchestrationSchema,
} from "@cantilune/runtime";
import { createMemoryRuntimePersistence, MemoryResourceLockTable } from "@cantilune/runtime/memory";
import { createDeterministicIdGenerator } from "./deterministicIds.js";
import { MemoryControlPlaneStore } from "../../src/memory/memoryControlPlaneStore.js";
import {
  createFileControlPlaneStore,
  type FileControlPlaneStore,
} from "../../src/file/fileControlPlaneStore.js";
import {
  bootstrapDefaultControlPlane,
  createFullControlPlaneService,
  type FullControlPlaneService,
} from "../../src/engine/controlPlaneService.js";
import { createControlPlaneOutbox } from "../../src/events/controlPlaneOutbox.js";
import type { SchemaRevision } from "../../src/schema/schemaRevision.js";
import type { SchemaAdmissionRecord } from "../../src/admission/schemaAdmissionRequest.js";
import { createHandlerManifest, type HandlerManifest } from "../../src/manifest/handlerManifest.js";
import {
  createPolicyEvaluatorFromRevision,
  type PolicyRevision,
} from "../../src/policy/policyRevision.js";
import { templateAwarePolicyEvaluator } from "@cantilune/runtime";
import { authorizerContext, qualifierContext, testAdminContext } from "./testAdminContext.js";

export function handlerManifestForSchema(schema: OrchestrationSchema): HandlerManifest {
  return createHandlerManifest({
    manifestId: handlerManifestId("test-handlers"),
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
}

export function buildFourViewEvidence(
  admissionId: SchemaAdmissionId,
  record: SchemaAdmissionRecord,
  active: SchemaEpochBinding,
): FourViewEvidenceBundle {
  const planDig = record.qualification!.extensionPlanDigest;
  const facetDigest = (facet: string) => computeEvidenceDigest({ admissionId, facet, planDig });
  return {
    admissionId: admissionId as string,
    activationDomainId: active.activationDomainId as string,
    fromSchemaRef: active.schemaRef,
    toSchemaRef: record.targetSchemaRef!,
    fromEpochId: active.epochId as string,
    toEpochId: record.targetEpochId! as string,
    fromEpochOrdinal: active.epochOrdinal as number,
    toEpochOrdinal: record.targetEpochOrdinal! as number,
    extensionPlanDigest: planDig as string,
    expectedRuntimeHead: record.request.expectedRuntimeHead as string,
    expectedBindingGeneration: active.bindingGeneration as number,
    dependencyDigest: facetDigest("dependency"),
    resourceDigest: facetDigest("resource"),
    sessionDigest: facetDigest("session"),
    structureDigest: facetDigest("structure"),
    verifierVersion: "conformance/3.0-m2",
    evidenceRef: `evidence://${admissionId}`,
  };
}

export function buildReviewedAdmissionDecision(
  admissionId: SchemaAdmissionId,
  record: SchemaAdmissionRecord,
  active: SchemaEpochBinding,
): {
  readonly reviewedDecision: ReviewedDecision;
  readonly signedAttestation: SignedHumanReviewAttestation;
} {
  const bundle = buildFourViewEvidence(admissionId, record, active);
  const subject = {
    admissionId: bundle.admissionId,
    activationDomainId: bundle.activationDomainId,
    fromSchemaRef: bundle.fromSchemaRef,
    toSchemaRef: bundle.toSchemaRef,
    fromEpochId: bundle.fromEpochId,
    toEpochId: bundle.toEpochId,
    fromEpochOrdinal: bundle.fromEpochOrdinal,
    toEpochOrdinal: bundle.toEpochOrdinal,
    extensionPlanDigest: bundle.extensionPlanDigest,
    expectedRuntimeHead: bundle.expectedRuntimeHead,
    expectedBindingGeneration: bundle.expectedBindingGeneration,
  };
  const reviewed = buildReviewedEngineeringAdmissionForTest({ bundle, subject });
  if (!reviewed.ok) {
    throw new Error(reviewed.error.map((v) => v.message).join("; "));
  }
  return reviewed.value;
}

export function buildAdmissionHarness(options?: { readonly persistDir?: string }): {
  readonly service: FullControlPlaneService;
  readonly store: MemoryControlPlaneStore;
  readonly fileStore: FileControlPlaneStore | undefined;
  readonly genesisBinding: SchemaEpochBinding;
  readonly genesisRevision: SchemaRevision;
  readonly schemaHolder: ReturnType<typeof createMutableSchemaContextHolder>;
  readonly bindingHolder: ReturnType<typeof createMutableBindingHolder>;
  readonly policyHolder: ReturnType<typeof createMutablePolicyEvaluatorHolder>;
  readonly activePolicyRevision: {
    get(): PolicyRevision | undefined;
    set(revision: PolicyRevision): void;
  };
  readonly durable: ReturnType<typeof createMemoryRuntimePersistence>["durable"];
  readonly locks: MemoryResourceLockTable;
  readonly revisions: Map<string, SchemaRevision>;
  registerRevision(revision: SchemaRevision): void;
  runAdmissionPipeline(input: {
    readonly admissionId: SchemaAdmissionId;
    readonly candidate: SchemaRevision;
    readonly idempotencyKey: IdempotencyKey;
    readonly requestedAt: string;
  }): Promise<Result<SchemaAdmissionReceipt, ControlPlaneViolation>>;
} {
  const store = new MemoryControlPlaneStore();
  const { genesisBinding, genesisRevision } = bootstrapDefaultControlPlane(store);
  const fileStore =
    options?.persistDir !== undefined
      ? createFileControlPlaneStore(options.persistDir, store)
      : undefined;
  const revisions = new Map<string, SchemaRevision>();
  revisions.set(
    `${genesisRevision.schemaRef.schemaId}@${genesisRevision.schemaRef.revisionId}`,
    genesisRevision,
  );

  const t0 = buildConfigT0();
  const { durable } = createMemoryRuntimePersistence({ initial: t0 });
  const locks = new MemoryResourceLockTable();
  const registry = new AdmissionRegistry(locks);
  const schemaHolder = createMutableSchemaContextHolder(
    createActiveSchemaContext(genesisRevision.schema, genesisBinding.epochId, genesisBinding),
  );
  const bindingHolder = createMutableBindingHolder(genesisBinding);
  const policyHolder = createMutablePolicyEvaluatorHolder(templateAwarePolicyEvaluator());
  let activePolicyRevision: PolicyRevision | undefined;
  const policyRevisionRef = {
    get: () => activePolicyRevision,
    set: (revision: PolicyRevision) => {
      activePolicyRevision = revision;
    },
  };

  const epochAdmin = createMemoryEpochAdministration({
    durable,
    registry,
    locks,
    schemaHolder,
    bindingHolder,
    domainId: genesisBinding.activationDomainId,
    idGen: createDeterministicIdGenerator({
      snapshotRefs: ["snap-E1", "snap-E2", "snap-E3", "snap-E4", "snap-E5", "snap-E6"],
    }),
    resolveSchema: (ref: SchemaRef) => revisions.get(`${ref.schemaId}@${ref.revisionId}`)?.schema,
  });

  const service = createFullControlPlaneService({
    store,
    epochAdmin,
    conformance: createConformanceEvidenceVerifier(),
    outbox: createControlPlaneOutbox(),
    ...(fileStore !== undefined ? { fileStore } : {}),
    sealedAdmissionGate: {
      trustStore: defaultTestReviewerTrustStore(),
      crypto: createMemoryCryptoVerifier(),
      requiredReviewerRoles: ["formal", "security"],
    },
    onBindingActivated: (binding) => bindingHolder.set(binding),
    onPolicyActivated: (revision, binding) => {
      policyRevisionRef.set(revision);
      policyHolder.set(createPolicyEvaluatorFromRevision(revision));
      bindingHolder.set(binding);
    },
  });

  function registerRevision(revision: SchemaRevision): void {
    revisions.set(`${revision.schemaRef.schemaId}@${revision.schemaRef.revisionId}`, revision);
    store.registerRevision(revision);
  }

  async function runAdmissionPipeline(input: {
    readonly admissionId: SchemaAdmissionId;
    readonly candidate: SchemaRevision;
    readonly idempotencyKey: IdempotencyKey;
    readonly requestedAt: string;
  }): Promise<Result<SchemaAdmissionReceipt, ControlPlaneViolation>> {
    let binding = store.getActiveBinding(genesisBinding.activationDomainId)!;

    const submitted = await service.submitSchemaAdmission({
      context: qualifierContext(),
      request: {
        admissionId: input.admissionId,
        activationDomainId: binding.activationDomainId,
        expectedBindingGeneration: binding.bindingGeneration,
        expectedSchemaRef: binding.schemaRef,
        expectedEpochId: binding.epochId,
        expectedEpochOrdinal: binding.epochOrdinal,
        expectedRuntimeHead: binding.runtimeHead,
        candidateSchemaRef: input.candidate.schemaRef,
        requestedBy: "proposer",
        requestedAt: input.requestedAt,
        idempotencyKey: input.idempotencyKey,
      },
    });
    if (!submitted.ok) {
      return submitted;
    }

    const approved = await service.approveSchemaAdmission({
      context: authorizerContext(),
      admissionId: input.admissionId,
    });
    if (!approved.ok) {
      return approved;
    }

    binding = store.getActiveBinding(genesisBinding.activationDomainId)!;
    const record = (await service.getSchemaAdmission(input.admissionId))!;
    const reviewArtifacts = buildReviewedAdmissionDecision(input.admissionId, record, binding);
    const prepared = await service.prepareSchemaAdmission({
      context: testAdminContext(["schema-committer"], "operator"),
      admissionId: input.admissionId,
      fourViewEvidence: buildFourViewEvidence(input.admissionId, record, binding),
      reviewedDecision: reviewArtifacts.reviewedDecision,
      signedAttestation: reviewArtifacts.signedAttestation,
      handlerManifest: handlerManifestForSchema(input.candidate.schema),
    });
    if (!prepared.ok) {
      return prepared;
    }

    return service.commitSchemaAdmission({
      context: authorizerContext(),
      admissionId: input.admissionId,
      preparedHandle: prepared.value,
    });
  }

  return {
    service,
    store,
    fileStore,
    genesisBinding,
    genesisRevision,
    schemaHolder,
    bindingHolder,
    policyHolder,
    activePolicyRevision: policyRevisionRef,
    durable,
    locks,
    revisions,
    registerRevision,
    runAdmissionPipeline,
  };
}

export {
  proposerContext,
  authorizerContext,
  qualifierContext,
  testAdminContext,
} from "./testAdminContext.js";
export { createSchemaRevision } from "../../src/schema/schemaRevision.js";
