import { describe, expect, it } from "vitest";
import { encodeOrchestrationSchema } from "../../src/schema/schemaWireCodec.js";
import {
  decodeActivatePolicyRevisionWire,
  decodeApproveSchemaAdmissionWire,
  decodeRegisterSchemaRevisionWire,
  decodeSubmitSchemaAdmissionWire,
} from "../../src/codec/ingressWireCodec.js";
import { testAdminContext } from "../support/testAdminContext.js";
import { buildAdmissionHarness } from "../support/buildAdmissionHarness.js";
import { policyId, policyRevisionId } from "@cantilune/core";

describe("ingress wire codec rejection branches", () => {
  it.each([
    ["a non-object schema ref", null, "submit.expectedSchemaRef"],
    [
      "an unknown schema-ref field",
      { schemaId: "s", revisionId: "r", digest: "d", forged: true },
      "submit.expectedSchemaRef.forged",
    ],
    ["a missing schema id", { revisionId: "r", digest: "d" }, "submit.expectedSchemaRef.schemaId"],
    ["a missing digest", { schemaId: "s", revisionId: "r" }, "submit.expectedSchemaRef.digest"],
  ])("decodeSubmit rejects %s at the precise boundary", (_label, expectedSchemaRef, path) => {
    const decoded = decodeSubmitSchemaAdmissionWire(
      {
        admissionId: "adm-ref-boundary",
        activationDomainId: "default",
        expectedBindingGeneration: 1,
        expectedSchemaRef,
        expectedEpochId: "1",
        expectedEpochOrdinal: 1,
        expectedRuntimeHead: "snap",
        candidateSchemaRef: { schemaId: "s", revisionId: "r2", digest: "d2" },
        requestedBy: "proposer",
        requestedAt: "2026-08-11T00:00:00Z",
        idempotencyKey: "idem-ref-boundary",
      },
      testAdminContext([], "proposer"),
    );

    expect(decoded.ok).toBe(false);
    if (decoded.ok) return;
    expect(decoded.error).toMatchObject({
      code: "invalid_input",
      phase: "validate",
      path,
      retryable: false,
    });
  });

  it.each([
    ["expectedEpochOrdinal", "not-an-ordinal", "submit.expectedEpochOrdinal"],
    ["expectedRuntimeHead", "", "submit.expectedRuntimeHead"],
    ["candidateSchemaRef", null, "submit.candidateSchemaRef"],
    ["requestedBy", "", "submit.requestedBy"],
    ["requestedAt", "", "submit.requestedAt"],
    ["idempotencyKey", "", "submit.idempotencyKey"],
  ])("decodeSubmit rejects malformed %s before admission", (field, malformed, path) => {
    const decoded = decodeSubmitSchemaAdmissionWire(
      {
        admissionId: "adm-required-boundary",
        activationDomainId: "default",
        expectedBindingGeneration: 1,
        expectedSchemaRef: { schemaId: "s", revisionId: "r", digest: "d" },
        expectedEpochId: "1",
        expectedEpochOrdinal: 1,
        expectedRuntimeHead: "snap",
        candidateSchemaRef: { schemaId: "s", revisionId: "r2", digest: "d2" },
        requestedBy: "proposer",
        requestedAt: "2026-08-11T00:00:00Z",
        idempotencyKey: "idem-required-boundary",
        [field]: malformed,
      },
      testAdminContext([], "proposer"),
    );

    expect(decoded.ok).toBe(false);
    if (decoded.ok) return;
    expect(decoded.error).toMatchObject({
      code: "invalid_input",
      phase: "validate",
      path,
      retryable: false,
    });
  });

  it("decodeActivatePolicy rejects missing policyId and revisionId", () => {
    expect(
      decodeActivatePolicyRevisionWire(
        {
          revisionId: policyRevisionId("1"),
          activationDomainId: "default",
          expectedBindingGeneration: 1,
          compatibleSchemaRefs: [],
          rules: [],
          createdBy: "admin",
          createdAt: "2026-08-11T00:00:00Z",
          activatedAt: "2026-08-11T00:01:00Z",
        },
        testAdminContext(["policy-admin"], "admin"),
      ).ok,
    ).toBe(false);
    expect(
      decodeActivatePolicyRevisionWire(
        {
          policyId: policyId("p"),
          activationDomainId: "default",
          expectedBindingGeneration: 1,
          compatibleSchemaRefs: [],
          rules: [],
          createdBy: "admin",
          createdAt: "2026-08-11T00:00:00Z",
          activatedAt: "2026-08-11T00:01:00Z",
        },
        testAdminContext(["policy-admin"], "admin"),
      ).ok,
    ).toBe(false);
  });

  it("decodeSubmit rejects non-object and missing required submit fields", () => {
    expect(decodeSubmitSchemaAdmissionWire(null, testAdminContext([], "x")).ok).toBe(false);
    expect(
      decodeSubmitSchemaAdmissionWire(
        { admissionId: "adm", activationDomainId: "default" },
        testAdminContext([], "x"),
      ).ok,
    ).toBe(false);
  });

  it("decodeSubmit rejects invalid expectedBindingGeneration type", () => {
    expect(
      decodeSubmitSchemaAdmissionWire(
        {
          admissionId: "adm",
          activationDomainId: "default",
          expectedBindingGeneration: "not-a-number",
          expectedSchemaRef: { schemaId: "s", revisionId: "r", digest: "d" },
          expectedEpochId: "1",
          expectedEpochOrdinal: 1,
          expectedRuntimeHead: "snap",
          candidateSchemaRef: { schemaId: "s", revisionId: "r2", digest: "d2" },
          requestedBy: "p",
          requestedAt: "t",
          idempotencyKey: "k",
        },
        testAdminContext([], "x"),
      ).ok,
    ).toBe(false);
    expect(
      decodeSubmitSchemaAdmissionWire(
        {
          admissionId: "",
          activationDomainId: "default",
          expectedBindingGeneration: 1,
          expectedSchemaRef: { schemaId: "s", revisionId: "r", digest: "d" },
          expectedEpochId: "1",
          expectedEpochOrdinal: 1,
          expectedRuntimeHead: "snap",
          candidateSchemaRef: { schemaId: "s", revisionId: "r2", digest: "d2" },
          requestedBy: "p",
          requestedAt: "t",
          idempotencyKey: "k",
        },
        testAdminContext([], "x"),
      ).ok,
    ).toBe(false);
  });

  it("decodeApprove rejects invalid admissionId", () => {
    expect(
      decodeApproveSchemaAdmissionWire({ admissionId: "" }, testAdminContext([], "x")).ok,
    ).toBe(false);
  });

  it("decodeRegister rejects bad revisionId and schema keys", () => {
    const harness = buildAdmissionHarness();
    const wireSchema = encodeOrchestrationSchema(harness.genesisRevision.schema);
    expect(
      decodeRegisterSchemaRevisionWire(
        { schema: wireSchema, revisionId: "", createdAt: "2026-08-11T00:00:00Z" },
        testAdminContext([], "x"),
      ).ok,
    ).toBe(false);
    expect(
      decodeRegisterSchemaRevisionWire(
        {
          schema: { ...wireSchema, extra: true },
          revisionId: "rev",
          createdAt: "2026-08-11T00:00:00Z",
        },
        testAdminContext([], "x"),
      ).ok,
    ).toBe(false);
  });

  it("decodeActivatePolicy rejects invalid compatible schema ref entries", () => {
    expect(
      decodeActivatePolicyRevisionWire(
        {
          policyId: policyId("p"),
          revisionId: policyRevisionId("1"),
          activationDomainId: "default",
          expectedBindingGeneration: 1,
          compatibleSchemaRefs: [{ schemaId: "only-id" }],
          rules: [{ ruleId: "allow", decision: "allow" }],
          createdBy: "admin",
          createdAt: "2026-08-11T00:00:00Z",
          activatedAt: "2026-08-11T00:01:00Z",
        },
        testAdminContext(["policy-admin"], "admin"),
      ).ok,
    ).toBe(false);
  });

  it("decodeRegister rejects invalid parentRef", () => {
    const harness = buildAdmissionHarness();
    const wireSchema = encodeOrchestrationSchema(harness.genesisRevision.schema);
    expect(
      decodeRegisterSchemaRevisionWire(
        {
          schema: wireSchema,
          revisionId: "rev-parent",
          createdAt: "2026-08-11T00:00:00Z",
          parentRef: { schemaId: "only" },
        },
        testAdminContext([], "x"),
      ).ok,
    ).toBe(false);
  });

  it("decodeActivatePolicy rejects missing timestamps", () => {
    expect(
      decodeActivatePolicyRevisionWire(
        {
          policyId: policyId("p"),
          revisionId: policyRevisionId("1"),
          activationDomainId: "default",
          expectedBindingGeneration: 1,
          compatibleSchemaRefs: [],
          rules: [],
          createdBy: "admin",
          activatedAt: "2026-08-11T00:01:00Z",
        },
        testAdminContext(["policy-admin"], "admin"),
      ).ok,
    ).toBe(false);
  });

  it("decodeSubmit rejects missing domain and epoch fields", () => {
    expect(
      decodeSubmitSchemaAdmissionWire(
        {
          admissionId: "adm",
          expectedBindingGeneration: 1,
          expectedSchemaRef: { schemaId: "s", revisionId: "r", digest: "d" },
          expectedEpochId: "1",
          expectedEpochOrdinal: 1,
          expectedRuntimeHead: "snap",
          candidateSchemaRef: { schemaId: "s", revisionId: "r2", digest: "d2" },
          requestedBy: "p",
          requestedAt: "t",
          idempotencyKey: "k",
        },
        testAdminContext([], "x"),
      ).ok,
    ).toBe(false);
    expect(
      decodeSubmitSchemaAdmissionWire(
        {
          admissionId: "adm",
          activationDomainId: "default",
          expectedBindingGeneration: 1,
          expectedSchemaRef: { schemaId: "s", revisionId: "r", digest: "d" },
          expectedEpochOrdinal: 1,
          expectedRuntimeHead: "snap",
          candidateSchemaRef: { schemaId: "s", revisionId: "r2", digest: "d2" },
          requestedBy: "p",
          requestedAt: "t",
          idempotencyKey: "k",
        },
        testAdminContext([], "x"),
      ).ok,
    ).toBe(false);
  });

  it("service register and activate policy wire paths succeed", async () => {
    const harness = buildAdmissionHarness();
    const wireSchema = encodeOrchestrationSchema(harness.genesisRevision.schema);
    const registered = await harness.service.registerSchemaRevisionWire(
      {
        schema: wireSchema,
        revisionId: "rev-wire-register",
        createdAt: "2026-08-11T00:00:00Z",
      },
      testAdminContext(["schema-registrar"], "registrar"),
    );
    expect(registered.ok).toBe(true);

    const activated = harness.service.activatePolicyRevisionWire(
      {
        policyId: policyId("wire-policy"),
        revisionId: policyRevisionId("1"),
        activationDomainId: harness.genesisBinding.activationDomainId,
        expectedBindingGeneration: harness.genesisBinding.bindingGeneration,
        compatibleSchemaRefs: [
          {
            schemaId: harness.genesisRevision.schemaRef.schemaId,
            revisionId: harness.genesisRevision.schemaRef.revisionId,
            digest: harness.genesisRevision.schemaRef.digest,
          },
        ],
        rules: [{ ruleId: "allow-all", decision: "allow" }],
        createdBy: "policy-admin",
        createdAt: "2026-08-11T00:00:00Z",
        activatedAt: "2026-08-11T00:01:00Z",
      },
      testAdminContext(["policy-admin"], "policy-admin"),
    );
    expect(activated.ok).toBe(true);
  });
});
