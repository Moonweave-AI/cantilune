import { describe, expect, it } from "vitest";
import {
  idempotencyKey,
  planDigest,
  preparedAdmissionId,
  schemaAdmissionId,
  schemaDigest,
  schemaRevisionId,
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
import { toPreparedHandle } from "../../src/admission/preparedAdmissionRecord.js";

describe("L5 control-plane contract negatives", () => {
  it("rejects forged prepared handle on commit", async () => {
    const harness = buildAdmissionHarness();
    const candidate = createSchemaRevision({
      schema: harness.genesisRevision.schema,
      revisionId: schemaRevisionId("rev-forge"),
      parentRef: harness.genesisRevision.schemaRef,
      createdBy: "author",
      createdAt: "2026-08-11T07:00:00Z",
    });
    harness.registerRevision(candidate);

    const admissionId = schemaAdmissionId("adm-forge-001");
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
        requestedAt: "2026-08-11T07:00:00Z",
        idempotencyKey: idempotencyKey("idem-forge-001"),
      },
    });
    await harness.service.approveSchemaAdmission({
      context: authorizerContext(),
      admissionId,
    });

    const forged = toPreparedHandle({
      preparedId: preparedAdmissionId("prep-forged-token"),
      admissionId,
      activationDomainId: harness.genesisBinding.activationDomainId,
      fromSchemaRef: harness.genesisRevision.schemaRef,
      toSchemaRef: candidate.schemaRef,
      fromEpochId: harness.genesisBinding.epochId,
      toEpochId: harness.genesisBinding.epochId,
      fromEpochOrdinal: harness.genesisBinding.epochOrdinal,
      toEpochOrdinal: harness.genesisBinding.epochOrdinal,
      expectedBindingGeneration: harness.genesisBinding.bindingGeneration,
      expectedRuntimeHead: harness.genesisBinding.runtimeHead,
      planDigest: planDigest("forged-plan"),
      runtimePreparedId: "prep-runtime-forged",
      issuedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      consumed: false,
    });

    const committed = await harness.service.commitSchemaAdmission({
      context: authorizerContext(),
      admissionId,
      preparedHandle: forged,
    });
    expect(committed.ok).toBe(false);
    if (committed.ok) {
      return;
    }
    expect(committed.error.code).toBe("invalid_input");
  });

  it("rejects prepared token reused across admissions", async () => {
    const harness = buildAdmissionHarness();
    const candidateA = createSchemaRevision({
      schema: harness.genesisRevision.schema,
      revisionId: schemaRevisionId("rev-cross-a"),
      parentRef: harness.genesisRevision.schemaRef,
      createdBy: "author",
      createdAt: "2026-08-11T08:00:00Z",
    });
    const candidateB = createSchemaRevision({
      schema: harness.genesisRevision.schema,
      revisionId: schemaRevisionId("rev-cross-b"),
      parentRef: harness.genesisRevision.schemaRef,
      createdBy: "author",
      createdAt: "2026-08-11T08:01:00Z",
    });
    harness.registerRevision(candidateA);
    harness.registerRevision(candidateB);

    const admissionA = schemaAdmissionId("adm-cross-a");
    const admissionB = schemaAdmissionId("adm-cross-b");

    for (const [admissionId, candidate, idem] of [
      [admissionA, candidateA, "idem-cross-a"],
      [admissionB, candidateB, "idem-cross-b"],
    ] as const) {
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
          requestedAt: "2026-08-11T08:00:00Z",
          idempotencyKey: idempotencyKey(idem),
        },
      });
      await harness.service.approveSchemaAdmission({
        context: authorizerContext(),
        admissionId,
      });
    }

    const recordA = (await harness.service.getSchemaAdmission(admissionA))!;
    const reviewA = buildReviewedAdmissionDecision(admissionA, recordA, harness.genesisBinding);
    const preparedA = await harness.service.prepareSchemaAdmission({
      context: testAdminContext(["schema-committer"], "operator"),
      admissionId: admissionA,
      fourViewEvidence: buildFourViewEvidence(admissionA, recordA, harness.genesisBinding),
      reviewedDecision: reviewA.reviewedDecision,
      signedAttestation: reviewA.signedAttestation,
      handlerManifest: handlerManifestForSchema(candidateA.schema),
    });
    expect(preparedA.ok).toBe(true);
    if (!preparedA.ok) {
      return;
    }

    const crossCommit = await harness.service.commitSchemaAdmission({
      context: authorizerContext(),
      admissionId: admissionB,
      preparedHandle: preparedA.value,
    });
    expect(crossCommit.ok).toBe(false);
    if (crossCommit.ok) {
      return;
    }
    expect(crossCommit.error.code).toBe("invalid_input");
  });

  it("rejects four-view evidence with mismatched schema digests", async () => {
    const harness = buildAdmissionHarness();
    const candidate = createSchemaRevision({
      schema: harness.genesisRevision.schema,
      revisionId: schemaRevisionId("rev-evidence"),
      parentRef: harness.genesisRevision.schemaRef,
      createdBy: "author",
      createdAt: "2026-08-11T09:00:00Z",
    });
    harness.registerRevision(candidate);
    const admissionId = schemaAdmissionId("adm-evidence-001");

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
        requestedAt: "2026-08-11T09:00:00Z",
        idempotencyKey: idempotencyKey("idem-evidence-001"),
      },
    });
    await harness.service.approveSchemaAdmission({
      context: authorizerContext(),
      admissionId,
    });

    const record = (await harness.service.getSchemaAdmission(admissionId))!;
    const bundle = buildFourViewEvidence(admissionId, record, harness.genesisBinding);
    const forgedBundle = {
      ...bundle,
      toSchemaRef: {
        ...bundle.toSchemaRef,
        digest: schemaDigest("wrong-target-digest"),
      },
    };

    const reviewed = buildReviewedAdmissionDecision(admissionId, record, harness.genesisBinding);
    const prepared = await harness.service.prepareSchemaAdmission({
      context: testAdminContext(["schema-committer"], "operator"),
      admissionId,
      fourViewEvidence: forgedBundle,
      reviewedDecision: reviewed.reviewedDecision,
      signedAttestation: reviewed.signedAttestation,
      handlerManifest: handlerManifestForSchema(candidate.schema),
    });
    expect(prepared.ok).toBe(false);
    if (prepared.ok) {
      return;
    }
    expect(prepared.error.code).toBe("conformance_invalid");
  });

  it("blocks commit while control plane is frozen", async () => {
    const harness = buildAdmissionHarness();
    const candidate = createSchemaRevision({
      schema: harness.genesisRevision.schema,
      revisionId: schemaRevisionId("rev-freeze"),
      parentRef: harness.genesisRevision.schemaRef,
      createdBy: "author",
      createdAt: "2026-08-11T10:00:00Z",
    });
    harness.registerRevision(candidate);
    const admissionId = schemaAdmissionId("adm-freeze-001");

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
        requestedAt: "2026-08-11T10:00:00Z",
        idempotencyKey: idempotencyKey("idem-freeze-001"),
      },
    });
    await harness.service.approveSchemaAdmission({
      context: authorizerContext(),
      admissionId,
    });

    const record = (await harness.service.getSchemaAdmission(admissionId))!;
    const reviewFreeze = buildReviewedAdmissionDecision(
      admissionId,
      record,
      harness.genesisBinding,
    );
    const prepared = await harness.service.prepareSchemaAdmission({
      context: testAdminContext(["schema-committer"], "operator"),
      admissionId,
      fourViewEvidence: buildFourViewEvidence(admissionId, record, harness.genesisBinding),
      reviewedDecision: reviewFreeze.reviewedDecision,
      signedAttestation: reviewFreeze.signedAttestation,
      handlerManifest: handlerManifestForSchema(candidate.schema),
    });
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) {
      return;
    }

    harness.store.setFrozen(true);
    const committed = await harness.service.commitSchemaAdmission({
      context: authorizerContext(),
      admissionId,
      preparedHandle: prepared.value,
    });
    expect(committed.ok).toBe(false);
    if (committed.ok) {
      return;
    }
    expect(committed.error.code).toBe("control_plane_frozen");
  });
});
