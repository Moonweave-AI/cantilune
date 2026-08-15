import { describe, expect, it } from "vitest";
import { encodeOrchestrationSchema } from "../../../src/schema/schemaWireCodec.js";
import {
  decodeActivatePolicyRevisionWire,
  decodeApproveSchemaAdmissionWire,
  decodeRegisterSchemaRevisionWire,
  decodeSubmitSchemaAdmissionWire,
} from "../../../src/codec/ingressWireCodec.js";
import { testAdminContext } from "../../support/testAdminContext.js";
import { buildAdmissionHarness } from "../../support/buildAdmissionHarness.js";
import { idempotencyKey, schemaAdmissionId } from "@cantilune/core";

describe("ingress wire codec decoders", () => {
  it("decodeApproveSchemaAdmissionWire accepts valid wire and rejects invalid", () => {
    const decoded = decodeApproveSchemaAdmissionWire(
      { admissionId: schemaAdmissionId("adm-approve") },
      testAdminContext(["schema-authorizer"], "authorizer"),
    );
    expect(decoded.ok).toBe(true);

    const bad = decodeApproveSchemaAdmissionWire("not-object", testAdminContext([], "x"));
    expect(bad.ok).toBe(false);
    const unknown = decodeApproveSchemaAdmissionWire(
      { admissionId: "adm", extra: true },
      testAdminContext([], "x"),
    );
    expect(unknown.ok).toBe(false);
  });

  it("decodeRegisterSchemaRevisionWire accepts schema with optional parentRef", () => {
    const harness = buildAdmissionHarness();
    const wireSchema = encodeOrchestrationSchema(harness.genesisRevision.schema);
    const decoded = decodeRegisterSchemaRevisionWire(
      {
        schema: wireSchema,
        revisionId: "rev-wire",
        createdAt: "2026-08-11T00:00:00Z",
        parentRef: {
          schemaId: harness.genesisRevision.schemaRef.schemaId,
          revisionId: harness.genesisRevision.schemaRef.revisionId,
          digest: harness.genesisRevision.schemaRef.digest,
        },
      },
      testAdminContext(["schema-registrar"], "registrar"),
    );
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    expect(decoded.value.parentRef).toBeDefined();
  });

  it("decodeRegisterSchemaRevisionWire rejects invalid schema object", () => {
    const decoded = decodeRegisterSchemaRevisionWire(
      { schema: "bad", revisionId: "rev", createdAt: "2026-08-11T00:00:00Z" },
      testAdminContext([], "x"),
    );
    expect(decoded.ok).toBe(false);
  });

  it("decodeActivatePolicyRevisionWire validates arrays and schema refs", () => {
    const harness = buildAdmissionHarness();
    const decoded = decodeActivatePolicyRevisionWire(
      {
        policyId: "fleet-policy",
        revisionId: "2",
        activationDomainId: "default",
        expectedBindingGeneration: 1,
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
    expect(decoded.ok).toBe(true);

    const missingArrays = decodeActivatePolicyRevisionWire(
      {
        policyId: "fleet-policy",
        revisionId: "2",
        activationDomainId: "default",
        expectedBindingGeneration: 1,
        createdBy: "policy-admin",
        createdAt: "2026-08-11T00:00:00Z",
        activatedAt: "2026-08-11T00:01:00Z",
      },
      testAdminContext(["policy-admin"], "policy-admin"),
    );
    expect(missingArrays.ok).toBe(false);
  });

  it("decodeSubmitSchemaAdmissionWire rejects malformed schema refs", () => {
    const decoded = decodeSubmitSchemaAdmissionWire(
      {
        admissionId: schemaAdmissionId("adm-bad-ref"),
        activationDomainId: "default",
        expectedBindingGeneration: 1,
        expectedSchemaRef: { schemaId: "default-v1" },
        expectedEpochId: "42",
        expectedEpochOrdinal: 1,
        expectedRuntimeHead: "snap-S0",
        candidateSchemaRef: {
          schemaId: "default-v1",
          revisionId: "rev-002",
          digest: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
        },
        requestedBy: "proposer",
        requestedAt: "2026-08-11T00:00:00Z",
        idempotencyKey: idempotencyKey("idem-bad-ref"),
      },
      testAdminContext(["schema-proposer"], "proposer"),
    );
    expect(decoded.ok).toBe(false);
  });
});
