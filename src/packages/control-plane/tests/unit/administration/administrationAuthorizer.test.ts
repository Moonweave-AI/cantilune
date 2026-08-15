import { describe, expect, it } from "vitest";
import { contentDigest, epochId, epochOrdinal, schemaAdmissionId } from "@cantilune/core";
import { buildAdmissionHarness } from "../../support/buildAdmissionHarness.js";
import { createAdministrationAuthorizer } from "../../../src/administration/administrationAuthorizer.js";
import { admissionEvidenceSubjectDigest } from "../../../src/administration/evidenceSubject.js";
import { extensionPlanCanonicalDigest } from "../../../src/schema/extensionPlanDigest.js";
import {
  authorizerContext,
  proposerContext,
  qualifierContext,
} from "../../support/testAdminContext.js";

describe("administration authorizer", () => {
  const authorizer = createAdministrationAuthorizer();

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
      admissionId: schemaAdmissionId("adm-auth"),
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
    };
  }

  it("rejects missing schema-authorizer role", () => {
    const harness = buildAdmissionHarness();
    const subject = sampleSubject(harness);
    const planDig = subject.extensionPlanDigest;
    const result = authorizer.authorize({
      context: qualifierContext(),
      subject,
      qualification: {
        subjectDigest: admissionEvidenceSubjectDigest(subject),
        extensionPlanDigest: planDig,
        qualifiedBy: "qualifier",
        qualifiedAt: "2026-08-11T00:00:00Z",
        evaluatorVersion: "qualification/1.0",
      },
      proposer: "proposer",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("authorization_denied");
  });

  it("rejects proposer self-authorization", () => {
    const harness = buildAdmissionHarness();
    const subject = sampleSubject(harness);
    const planDig = subject.extensionPlanDigest;
    const result = authorizer.authorize({
      context: proposerContext(),
      subject,
      qualification: {
        subjectDigest: admissionEvidenceSubjectDigest(subject),
        extensionPlanDigest: planDig,
        qualifiedBy: "qualifier",
        qualifiedAt: "2026-08-11T00:00:00Z",
        evaluatorVersion: "qualification/1.0",
      },
      proposer: proposerContext().principal.actorRef.actorId as string,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("separation_of_duties_violation");
  });

  it("rejects qualification subject digest mismatch", () => {
    const harness = buildAdmissionHarness();
    const subject = sampleSubject(harness);
    const planDig = subject.extensionPlanDigest;
    const result = authorizer.authorize({
      context: authorizerContext(),
      subject,
      qualification: {
        subjectDigest: contentDigest("wrong"),
        extensionPlanDigest: planDig,
        qualifiedBy: "qualifier",
        qualifiedAt: "2026-08-11T00:00:00Z",
        evaluatorVersion: "qualification/1.0",
      },
      proposer: "proposer",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain("subject digest mismatch");
  });

  it("authorizes and verifies matching evidence", () => {
    const harness = buildAdmissionHarness();
    const subject = sampleSubject(harness);
    const planDig = subject.extensionPlanDigest;
    const qualification = {
      subjectDigest: admissionEvidenceSubjectDigest(subject),
      extensionPlanDigest: planDig,
      qualifiedBy: "qualifier",
      qualifiedAt: "2026-08-11T00:00:00Z",
      evaluatorVersion: "qualification/1.0",
    };
    const authorized = authorizer.authorize({
      context: authorizerContext(),
      subject,
      qualification,
      proposer: "proposer",
    });
    expect(authorized.ok).toBe(true);
    if (!authorized.ok) return;

    const verified = authorizer.verify({
      subject,
      qualification,
      authorization: authorized.value,
      operator: authorized.value.authorizedBy,
      now: Date.parse(authorized.value.authorizedAt),
    });
    expect(verified.ok).toBe(true);
  });

  it("verify rejects expired authorization", () => {
    const harness = buildAdmissionHarness();
    const subject = sampleSubject(harness);
    const planDig = subject.extensionPlanDigest;
    const qualification = {
      subjectDigest: admissionEvidenceSubjectDigest(subject),
      extensionPlanDigest: planDig,
      qualifiedBy: "qualifier",
      qualifiedAt: "2026-08-11T00:00:00Z",
      evaluatorVersion: "qualification/1.0",
    };
    const authorized = authorizer.authorize({
      context: authorizerContext(),
      subject,
      qualification,
      proposer: "proposer",
    });
    expect(authorized.ok).toBe(true);
    if (!authorized.ok) return;

    const expired = authorizer.verify({
      subject,
      qualification,
      authorization: authorized.value,
      operator: authorized.value.authorizedBy,
      now: Date.parse(authorized.value.expiresAt) + 1,
    });
    expect(expired.ok).toBe(false);
    if (expired.ok) return;
    expect(expired.error.message).toContain("expired");
  });

  it("verify rejects operator mismatch and digest drift", () => {
    const harness = buildAdmissionHarness();
    const subject = sampleSubject(harness);
    const planDig = subject.extensionPlanDigest;
    const qualification = {
      subjectDigest: admissionEvidenceSubjectDigest(subject),
      extensionPlanDigest: planDig,
      qualifiedBy: "qualifier",
      qualifiedAt: "2026-08-11T00:00:00Z",
      evaluatorVersion: "qualification/1.0",
    };
    const authorized = authorizer.authorize({
      context: authorizerContext(),
      subject,
      qualification,
      proposer: "proposer",
    });
    expect(authorized.ok).toBe(true);
    if (!authorized.ok) return;

    const operatorMismatch = authorizer.verify({
      subject,
      qualification,
      authorization: authorized.value,
      operator: "other-operator",
      now: Date.parse(authorized.value.authorizedAt),
    });
    expect(operatorMismatch.ok).toBe(false);

    const authDrift = authorizer.verify({
      subject,
      qualification,
      authorization: { ...authorized.value, subjectDigest: contentDigest("drift") },
      operator: authorized.value.authorizedBy,
      now: Date.parse(authorized.value.authorizedAt),
    });
    expect(authDrift.ok).toBe(false);

    const qualDrift = authorizer.verify({
      subject,
      qualification: { ...qualification, subjectDigest: contentDigest("drift") },
      authorization: authorized.value,
      operator: authorized.value.authorizedBy,
      now: Date.parse(authorized.value.authorizedAt),
    });
    expect(qualDrift.ok).toBe(false);
  });
});
