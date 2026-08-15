import { describe, expect, it } from "vitest";
import {
  epochId,
  epochOrdinal,
  idempotencyKey,
  planDigest,
  schemaAdmissionId,
} from "@cantilune/core";
import {
  buildAdmissionHarness,
  createSchemaRevision,
} from "../../support/buildAdmissionHarness.js";
import {
  buildAdmissionEvidenceSubject,
  toFourViewSubject,
} from "../../../src/administration/buildEvidenceSubject.js";
import { admissionEvidenceSubjectDigest } from "../../../src/administration/evidenceSubject.js";
import { extensionPlanCanonicalDigest } from "../../../src/schema/extensionPlanDigest.js";
import type { SchemaAdmissionRecord } from "../../../src/admission/schemaAdmissionRequest.js";

describe("build admission evidence subject", () => {
  it("returns undefined when required fields are missing", () => {
    const harness = buildAdmissionHarness();
    const partial: SchemaAdmissionRecord = {
      request: {
        admissionId: schemaAdmissionId("adm-partial"),
        activationDomainId: harness.genesisBinding.activationDomainId,
        expectedBindingGeneration: harness.genesisBinding.bindingGeneration,
        expectedSchemaRef: harness.genesisRevision.schemaRef,
        expectedEpochId: harness.genesisBinding.epochId,
        expectedEpochOrdinal: harness.genesisBinding.epochOrdinal,
        expectedRuntimeHead: harness.genesisBinding.runtimeHead,
        candidateSchemaRef: harness.genesisRevision.schemaRef,
        requestedBy: "proposer",
        requestedAt: "2026-08-11T00:00:00Z",
        idempotencyKey: idempotencyKey("idem-partial"),
      },
      state: "validating",
      updatedAt: "2026-08-11T00:00:00Z",
    };
    expect(buildAdmissionEvidenceSubject(partial, harness.genesisBinding)).toBeUndefined();
  });

  it("returns undefined when qualification plan digest is missing", () => {
    const harness = buildAdmissionHarness();
    const record: SchemaAdmissionRecord = {
      request: {
        admissionId: schemaAdmissionId("adm-no-plan-dig"),
        activationDomainId: harness.genesisBinding.activationDomainId,
        expectedBindingGeneration: harness.genesisBinding.bindingGeneration,
        expectedSchemaRef: harness.genesisRevision.schemaRef,
        expectedEpochId: harness.genesisBinding.epochId,
        expectedEpochOrdinal: harness.genesisBinding.epochOrdinal,
        expectedRuntimeHead: harness.genesisBinding.runtimeHead,
        candidateSchemaRef: harness.genesisRevision.schemaRef,
        requestedBy: "proposer",
        requestedAt: "2026-08-11T00:00:00Z",
        idempotencyKey: idempotencyKey("idem-no-plan-dig"),
      },
      state: "awaiting_authorization",
      extensionPlan: {
        fromSchemaRef: harness.genesisRevision.schemaRef,
        toSchemaRef: harness.genesisRevision.schemaRef,
        addedObjectTypeIds: [],
        addedOperationTypeIds: [],
        objectEmbedding: new Map(),
        operationEmbedding: new Map(),
      },
      targetSchemaRef: harness.genesisRevision.schemaRef,
      targetEpochId: epochId("43"),
      targetEpochOrdinal: epochOrdinal(2),
      qualification: {
        subjectDigest: planDigest("subj") as never,
        extensionPlanDigest: planDigest("plan") as never,
        qualifiedBy: "qualifier",
        qualifiedAt: "2026-08-11T00:00:00Z",
        evaluatorVersion: "qualification/1.0",
      },
      updatedAt: "2026-08-11T00:00:00Z",
    };
    delete (record.qualification as { extensionPlanDigest?: unknown }).extensionPlanDigest;
    expect(buildAdmissionEvidenceSubject(record, harness.genesisBinding)).toBeUndefined();
  });

  it("builds subject and maps to four-view subject", () => {
    const harness = buildAdmissionHarness();
    const candidate = createSchemaRevision({
      schema: harness.genesisRevision.schema,
      revisionId: harness.genesisRevision.schemaRef.revisionId,
      parentRef: harness.genesisRevision.schemaRef,
      createdBy: "author",
      createdAt: "2026-08-11T00:00:00Z",
    });
    const extensionPlan = {
      fromSchemaRef: harness.genesisRevision.schemaRef,
      toSchemaRef: candidate.schemaRef,
      addedObjectTypeIds: [],
      addedOperationTypeIds: [],
      objectEmbedding: new Map(),
      operationEmbedding: new Map(),
    };
    const planDig = extensionPlanCanonicalDigest(extensionPlan);
    const subjectBase = {
      admissionId: schemaAdmissionId("adm-subject"),
      activationDomainId: harness.genesisBinding.activationDomainId,
      fromSchemaRef: harness.genesisRevision.schemaRef,
      toSchemaRef: candidate.schemaRef,
      fromEpochId: harness.genesisBinding.epochId,
      toEpochId: epochId("43"),
      fromEpochOrdinal: harness.genesisBinding.epochOrdinal,
      toEpochOrdinal: epochOrdinal(2),
      extensionPlanDigest: planDig,
      expectedRuntimeHead: harness.genesisBinding.runtimeHead,
      expectedBindingGeneration: harness.genesisBinding.bindingGeneration as number,
    };
    const record: SchemaAdmissionRecord = {
      request: {
        ...subjectBase,
        expectedBindingGeneration: harness.genesisBinding.bindingGeneration,
        expectedSchemaRef: harness.genesisRevision.schemaRef,
        expectedEpochId: harness.genesisBinding.epochId,
        expectedEpochOrdinal: harness.genesisBinding.epochOrdinal,
        candidateSchemaRef: candidate.schemaRef,
        requestedBy: "proposer",
        requestedAt: "2026-08-11T00:00:00Z",
        idempotencyKey: idempotencyKey("idem-subject"),
      },
      state: "awaiting_authorization",
      extensionPlan,
      targetSchemaRef: candidate.schemaRef,
      targetEpochId: epochId("43"),
      targetEpochOrdinal: epochOrdinal(2),
      qualification: {
        subjectDigest: admissionEvidenceSubjectDigest(subjectBase),
        extensionPlanDigest: planDig,
        qualifiedBy: "qualifier",
        qualifiedAt: "2026-08-11T00:00:00Z",
        evaluatorVersion: "qualification/1.0",
      },
      updatedAt: "2026-08-11T00:00:00Z",
    };
    const subject = buildAdmissionEvidenceSubject(record, harness.genesisBinding);
    expect(subject).toBeDefined();
    const fourView = toFourViewSubject(subject!);
    expect(fourView.admissionId).toBe("adm-subject");
    expect(fourView.expectedBindingGeneration).toBe(harness.genesisBinding.bindingGeneration);
  });
});
