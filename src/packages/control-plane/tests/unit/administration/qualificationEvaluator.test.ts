import { describe, expect, it } from "vitest";
import {
  epochId,
  epochOrdinal,
  planDigest,
  schemaDigest,
  schemaAdmissionId,
} from "@cantilune/core";
import { buildAdmissionHarness } from "../../support/buildAdmissionHarness.js";
import { createQualificationEvaluator } from "../../../src/administration/qualificationEvaluator.js";
import { admissionEvidenceSubjectDigest } from "../../../src/administration/evidenceSubject.js";
import { extensionPlanCanonicalDigest } from "../../../src/schema/extensionPlanDigest.js";
import { authorizerContext, qualifierContext } from "../../support/testAdminContext.js";

describe("qualification evaluator", () => {
  const evaluator = createQualificationEvaluator();

  function sampleSubject(harness: ReturnType<typeof buildAdmissionHarness>) {
    const extensionPlan = {
      fromSchemaRef: harness.genesisRevision.schemaRef,
      toSchemaRef: harness.genesisRevision.schemaRef,
      addedObjectTypeIds: [],
      addedOperationTypeIds: [],
      objectEmbedding: new Map(),
      operationEmbedding: new Map(),
    };
    const planDig = extensionPlanCanonicalDigest(extensionPlan);
    return {
      subject: {
        admissionId: schemaAdmissionId("adm-qual"),
        activationDomainId: harness.genesisBinding.activationDomainId,
        fromSchemaRef: harness.genesisRevision.schemaRef,
        toSchemaRef: harness.genesisRevision.schemaRef,
        fromEpochId: harness.genesisBinding.epochId,
        toEpochId: epochId("43"),
        fromEpochOrdinal: harness.genesisBinding.epochOrdinal,
        toEpochOrdinal: epochOrdinal(2),
        extensionPlanDigest: planDig,
        expectedRuntimeHead: harness.genesisBinding.runtimeHead,
        expectedBindingGeneration: harness.genesisBinding.bindingGeneration as number,
      },
      extensionPlan,
      planDig,
    };
  }

  it("rejects missing schema-qualifier role", () => {
    const harness = buildAdmissionHarness();
    const { subject, extensionPlan } = sampleSubject(harness);
    const result = evaluator.qualify({
      context: authorizerContext(),
      subject,
      extensionPlan,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("qualification_failed");
  });

  it("rejects extension plan digest mismatch", () => {
    const harness = buildAdmissionHarness();
    const { subject, extensionPlan } = sampleSubject(harness);
    const drifted = { ...subject, extensionPlanDigest: planDigest("wrong") };
    const result = evaluator.qualify({
      context: qualifierContext(),
      subject: drifted,
      extensionPlan,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain("digest mismatch");
  });

  it("qualifies valid extension plan", () => {
    const harness = buildAdmissionHarness();
    const { subject, extensionPlan } = sampleSubject(harness);
    const okResult = evaluator.qualify({
      context: qualifierContext(),
      subject,
      extensionPlan,
    });
    expect(okResult.ok).toBe(true);
    if (!okResult.ok) return;
    expect(okResult.value.subjectDigest).toBe(admissionEvidenceSubjectDigest(subject));
  });

  it("rejects from/to schema ref mismatch with aligned plan digest", () => {
    const harness = buildAdmissionHarness();
    const extensionPlan = {
      fromSchemaRef: harness.genesisRevision.schemaRef,
      toSchemaRef: harness.genesisRevision.schemaRef,
      addedObjectTypeIds: [],
      addedOperationTypeIds: [],
      objectEmbedding: new Map(),
      operationEmbedding: new Map(),
    };
    const fromMismatchPlan = {
      ...extensionPlan,
      fromSchemaRef: { ...extensionPlan.fromSchemaRef, digest: schemaDigest("from-wrong") },
    };
    const fromPlanDig = extensionPlanCanonicalDigest(fromMismatchPlan);
    const fromSubject = {
      admissionId: schemaAdmissionId("adm-from"),
      activationDomainId: harness.genesisBinding.activationDomainId,
      fromSchemaRef: harness.genesisRevision.schemaRef,
      toSchemaRef: harness.genesisRevision.schemaRef,
      fromEpochId: harness.genesisBinding.epochId,
      toEpochId: epochId("43"),
      fromEpochOrdinal: harness.genesisBinding.epochOrdinal,
      toEpochOrdinal: epochOrdinal(2),
      extensionPlanDigest: fromPlanDig,
      expectedRuntimeHead: harness.genesisBinding.runtimeHead,
      expectedBindingGeneration: harness.genesisBinding.bindingGeneration as number,
    };
    expect(
      evaluator.qualify({
        context: qualifierContext(),
        subject: fromSubject,
        extensionPlan: fromMismatchPlan,
      }).ok,
    ).toBe(false);

    const toMismatchPlan = {
      ...extensionPlan,
      toSchemaRef: { ...extensionPlan.toSchemaRef, digest: schemaDigest("to-wrong") },
    };
    const toPlanDig = extensionPlanCanonicalDigest(toMismatchPlan);
    const toSubject = { ...fromSubject, extensionPlanDigest: toPlanDig };
    expect(
      evaluator.qualify({
        context: qualifierContext(),
        subject: toSubject,
        extensionPlan: toMismatchPlan,
      }).ok,
    ).toBe(false);
  });
});
