import { describe, expect, it, vi } from "vitest";
import {
  bindingGeneration,
  idempotencyKey,
  policyId,
  policyRevisionId,
  schemaAdmissionId,
  schemaRevisionId,
  type ActivationDomainId,
  type SchemaEpochBinding,
} from "@cantilune/core";
import {
  buildAdmissionHarness,
  buildFourViewEvidence,
  buildReviewedAdmissionDecision,
  createSchemaRevision,
  authorizerContext,
  handlerManifestForSchema,
  qualifierContext,
  testAdminContext,
} from "../support/buildAdmissionHarness.js";
import { createPolicyRevision } from "../../src/policy/policyRevision.js";
import { toPreparedHandle } from "../../src/admission/preparedAdmissionRecord.js";

describe("control plane worker branches", () => {
  it("rejects prepare when admission is not authorized", async () => {
    const harness = buildAdmissionHarness();
    const candidate = createSchemaRevision({
      schema: harness.genesisRevision.schema,
      revisionId: schemaRevisionId("rev-worker-prepare"),
      parentRef: harness.genesisRevision.schemaRef,
      createdBy: "author",
      createdAt: "2026-08-11T00:00:00Z",
    });
    harness.registerRevision(candidate);
    const admissionId = schemaAdmissionId("adm-worker-prepare");
    await harness.service.submitSchemaAdmission({
      context: qualifierContext(),
      request: {
        admissionId,
        activationDomainId: harness.genesisBinding.activationDomainId,
        expectedBindingGeneration: harness.genesisBinding.bindingGeneration,
        expectedSchemaRef: harness.genesisRevision.schemaRef,
        expectedEpochId: harness.genesisBinding.epochId,
        expectedEpochOrdinal: harness.genesisBinding.epochOrdinal,
        expectedRuntimeHead: harness.genesisBinding.runtimeHead,
        candidateSchemaRef: candidate.schemaRef,
        requestedBy: "proposer",
        requestedAt: "2026-08-11T00:00:00Z",
        idempotencyKey: idempotencyKey("idem-worker-prepare"),
      },
    });
    const record = (await harness.service.getSchemaAdmission(admissionId))!;
    const review = buildReviewedAdmissionDecision(admissionId, record, harness.genesisBinding);
    const prepared = await harness.service.prepareSchemaAdmission({
      context: testAdminContext(["schema-committer"], "operator"),
      admissionId,
      fourViewEvidence: buildFourViewEvidence(admissionId, record, harness.genesisBinding),
      reviewedDecision: review.reviewedDecision,
      signedAttestation: review.signedAttestation,
      handlerManifest: handlerManifestForSchema(candidate.schema),
    });
    expect(prepared.ok).toBe(false);
    if (!prepared.ok) expect(prepared.error.code).toBe("invalid_input");
  });

  it("rejects expired prepared token on commit", async () => {
    const harness = buildAdmissionHarness();
    const candidate = createSchemaRevision({
      schema: harness.genesisRevision.schema,
      revisionId: schemaRevisionId("rev-worker-expired"),
      parentRef: harness.genesisRevision.schemaRef,
      createdBy: "author",
      createdAt: "2026-08-11T00:00:00Z",
    });
    harness.registerRevision(candidate);
    const admissionId = schemaAdmissionId("adm-worker-expired");
    await harness.service.submitSchemaAdmission({
      context: qualifierContext(),
      request: {
        admissionId,
        activationDomainId: harness.genesisBinding.activationDomainId,
        expectedBindingGeneration: harness.genesisBinding.bindingGeneration,
        expectedSchemaRef: harness.genesisRevision.schemaRef,
        expectedEpochId: harness.genesisBinding.epochId,
        expectedEpochOrdinal: harness.genesisBinding.epochOrdinal,
        expectedRuntimeHead: harness.genesisBinding.runtimeHead,
        candidateSchemaRef: candidate.schemaRef,
        requestedBy: "proposer",
        requestedAt: "2026-08-11T00:00:00Z",
        idempotencyKey: idempotencyKey("idem-worker-expired"),
      },
    });
    await harness.service.approveSchemaAdmission({ context: authorizerContext(), admissionId });
    const record = (await harness.service.getSchemaAdmission(admissionId))!;
    const review = buildReviewedAdmissionDecision(admissionId, record, harness.genesisBinding);
    const prepared = await harness.service.prepareSchemaAdmission({
      context: testAdminContext(["schema-committer"], "operator"),
      admissionId,
      fourViewEvidence: buildFourViewEvidence(admissionId, record, harness.genesisBinding),
      reviewedDecision: review.reviewedDecision,
      signedAttestation: review.signedAttestation,
      handlerManifest: handlerManifestForSchema(candidate.schema),
    });
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;

    const stored = harness.store.getPrepared(prepared.value.preparedId)!;
    harness.store.putPrepared({ ...stored, expiresAt: "2020-01-01T00:00:00Z" });

    const committed = await harness.service.commitSchemaAdmission({
      context: authorizerContext(),
      admissionId,
      preparedHandle: toPreparedHandle({ ...stored, expiresAt: "2020-01-01T00:00:00Z" }),
    });
    expect(committed.ok).toBe(false);
    if (!committed.ok) expect(committed.error.code).toBe("preparation_expired");
  });

  it("rejects commit with binding generation drift", async () => {
    const harness = buildAdmissionHarness();
    const candidate = createSchemaRevision({
      schema: harness.genesisRevision.schema,
      revisionId: schemaRevisionId("rev-worker-drift"),
      parentRef: harness.genesisRevision.schemaRef,
      createdBy: "author",
      createdAt: "2026-08-11T00:00:00Z",
    });
    harness.registerRevision(candidate);
    const admissionId = schemaAdmissionId("adm-worker-drift");
    await harness.service.submitSchemaAdmission({
      context: qualifierContext(),
      request: {
        admissionId,
        activationDomainId: harness.genesisBinding.activationDomainId,
        expectedBindingGeneration: harness.genesisBinding.bindingGeneration,
        expectedSchemaRef: harness.genesisRevision.schemaRef,
        expectedEpochId: harness.genesisBinding.epochId,
        expectedEpochOrdinal: harness.genesisBinding.epochOrdinal,
        expectedRuntimeHead: harness.genesisBinding.runtimeHead,
        candidateSchemaRef: candidate.schemaRef,
        requestedBy: "proposer",
        requestedAt: "2026-08-11T00:00:00Z",
        idempotencyKey: idempotencyKey("idem-worker-drift"),
      },
    });
    await harness.service.approveSchemaAdmission({ context: authorizerContext(), admissionId });
    const record = (await harness.service.getSchemaAdmission(admissionId))!;
    const review = buildReviewedAdmissionDecision(admissionId, record, harness.genesisBinding);
    const prepared = await harness.service.prepareSchemaAdmission({
      context: testAdminContext(["schema-committer"], "operator"),
      admissionId,
      fourViewEvidence: buildFourViewEvidence(admissionId, record, harness.genesisBinding),
      reviewedDecision: review.reviewedDecision,
      signedAttestation: review.signedAttestation,
      handlerManifest: handlerManifestForSchema(candidate.schema),
    });
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;

    const stored = harness.store.getPrepared(prepared.value.preparedId)!;
    harness.store.putPrepared({
      ...stored,
      expectedBindingGeneration: bindingGeneration(
        (harness.genesisBinding.bindingGeneration as number) - 1,
      ),
    });

    const committed = await harness.service.commitSchemaAdmission({
      context: authorizerContext(),
      admissionId,
      preparedHandle: toPreparedHandle({
        ...stored,
        expectedBindingGeneration: bindingGeneration(
          (harness.genesisBinding.bindingGeneration as number) - 1,
        ),
      }),
    });
    expect(committed.ok).toBe(false);
    if (!committed.ok) expect(committed.error.code).toBe("stale_active_binding");
  });

  it("blocks prepare while control plane is frozen", async () => {
    const harness = buildAdmissionHarness();
    const candidate = createSchemaRevision({
      schema: harness.genesisRevision.schema,
      revisionId: schemaRevisionId("rev-worker-freeze"),
      parentRef: harness.genesisRevision.schemaRef,
      createdBy: "author",
      createdAt: "2026-08-11T00:00:00Z",
    });
    harness.registerRevision(candidate);
    const admissionId = schemaAdmissionId("adm-worker-freeze");
    await harness.service.submitSchemaAdmission({
      context: qualifierContext(),
      request: {
        admissionId,
        activationDomainId: harness.genesisBinding.activationDomainId,
        expectedBindingGeneration: harness.genesisBinding.bindingGeneration,
        expectedSchemaRef: harness.genesisRevision.schemaRef,
        expectedEpochId: harness.genesisBinding.epochId,
        expectedEpochOrdinal: harness.genesisBinding.epochOrdinal,
        expectedRuntimeHead: harness.genesisBinding.runtimeHead,
        candidateSchemaRef: candidate.schemaRef,
        requestedBy: "proposer",
        requestedAt: "2026-08-11T00:00:00Z",
        idempotencyKey: idempotencyKey("idem-worker-freeze"),
      },
    });
    await harness.service.approveSchemaAdmission({ context: authorizerContext(), admissionId });
    harness.store.setFrozen(true);
    const record = (await harness.service.getSchemaAdmission(admissionId))!;
    const review = buildReviewedAdmissionDecision(admissionId, record, harness.genesisBinding);
    const prepared = await harness.service.prepareSchemaAdmission({
      context: testAdminContext(["schema-committer"], "operator"),
      admissionId,
      fourViewEvidence: buildFourViewEvidence(admissionId, record, harness.genesisBinding),
      reviewedDecision: review.reviewedDecision,
      signedAttestation: review.signedAttestation,
      handlerManifest: handlerManifestForSchema(candidate.schema),
    });
    expect(prepared.ok).toBe(false);
    if (!prepared.ok) expect(prepared.error.code).toBe("control_plane_frozen");
  });

  it("activatePolicyRevision rejects missing active binding", () => {
    const harness = buildAdmissionHarness();
    const revision = createPolicyRevision({
      policyId: policyId("missing-binding-policy"),
      revisionId: policyRevisionId("1"),
      compatibleSchemaRefs: [harness.genesisRevision.schemaRef],
      rules: [{ ruleId: "allow", decision: "allow" }],
      createdBy: "admin",
      createdAt: "2026-08-11T00:00:00Z",
    });
    const snapshot = harness.store.snapshot();
    (snapshot.activeBindings as Map<ActivationDomainId, SchemaEpochBinding>).clear();
    harness.store.restoreSnapshot(snapshot);
    const result = harness.service.activatePolicyRevision({
      context: testAdminContext(["policy-admin"], "policy-admin"),
      policyRevision: revision,
      activationDomainId: harness.genesisBinding.activationDomainId,
      expectedBindingGeneration: harness.genesisBinding.bindingGeneration,
      activatedAt: "2026-08-11T00:00:00Z",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("stale_active_binding");
  });

  it("blocks policy activation while control plane is frozen", () => {
    const harness = buildAdmissionHarness();
    harness.store.setFrozen(true);
    const revision = createPolicyRevision({
      policyId: policyId("frozen-policy"),
      revisionId: policyRevisionId("1"),
      compatibleSchemaRefs: [harness.genesisRevision.schemaRef],
      rules: [{ ruleId: "allow", decision: "allow" }],
      createdBy: "admin",
      createdAt: "2026-08-11T00:00:00Z",
    });
    const result = harness.service.activatePolicyRevision({
      context: testAdminContext(["policy-admin"], "policy-admin"),
      policyRevision: revision,
      activationDomainId: harness.genesisBinding.activationDomainId,
      expectedBindingGeneration: harness.genesisBinding.bindingGeneration,
      activatedAt: "2026-08-11T00:00:00Z",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("control_plane_frozen");
  });

  it("activatePolicyRevision rejects policy binding CAS failure", () => {
    const harness = buildAdmissionHarness();
    const revision = createPolicyRevision({
      policyId: policyId("cas-fail-policy"),
      revisionId: policyRevisionId("1"),
      compatibleSchemaRefs: [harness.genesisRevision.schemaRef],
      rules: [{ ruleId: "allow", decision: "allow" }],
      createdBy: "admin",
      createdAt: "2026-08-11T00:00:00Z",
    });
    vi.spyOn(harness.store, "casActiveBinding").mockReturnValue(false);
    const result = harness.service.activatePolicyRevision({
      context: testAdminContext(["policy-admin"], "policy-admin"),
      policyRevision: revision,
      activationDomainId: harness.genesisBinding.activationDomainId,
      expectedBindingGeneration: harness.genesisBinding.bindingGeneration,
      activatedAt: "2026-08-11T00:00:00Z",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("commit_conflict");
    vi.restoreAllMocks();
  });

  it("recoverForwardCommit rejects when no recoverable decision exists", async () => {
    const harness = buildAdmissionHarness();
    const recovered = await harness.service.recoverSchemaAdmissionCommit(
      schemaAdmissionId("adm-no-recovery"),
    );
    expect(recovered.ok).toBe(false);
    if (!recovered.ok) expect(recovered.error.code).toBe("invalid_input");
  });
});
