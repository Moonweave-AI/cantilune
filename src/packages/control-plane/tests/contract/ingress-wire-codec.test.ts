import { describe, expect, it } from "vitest";
import { idempotencyKey, schemaAdmissionId } from "@cantilune/core";
import { testAdminContext } from "../support/testAdminContext.js";
import {
  decodeActivatePolicyRevisionWire,
  decodeSubmitSchemaAdmissionWire,
} from "../../src/codec/ingressWireCodec.js";

describe("L5 ingress wire codec", () => {
  it("rejects unknown fields on submitSchemaAdmission wire", () => {
    const decoded = decodeSubmitSchemaAdmissionWire(
      {
        admissionId: "adm-wire-001",
        activationDomainId: "default",
        expectedBindingGeneration: 1,
        expectedSchemaRef: {
          schemaId: "default-v1",
          revisionId: "rev-001",
          digest: "abc",
        },
        expectedEpochId: "42",
        expectedEpochOrdinal: 1,
        expectedRuntimeHead: "snap-S0",
        candidateSchemaRef: {
          schemaId: "default-v1",
          revisionId: "rev-002",
          digest: "def",
        },
        requestedBy: "proposer",
        requestedAt: "2026-08-11T14:00:00Z",
        idempotencyKey: "idem-wire-001",
        forgedField: true,
      },
      testAdminContext(["schema-proposer"], "proposer"),
    );
    expect(decoded.ok).toBe(false);
    if (decoded.ok) {
      return;
    }
    expect(decoded.error.code).toBe("invalid_input");
  });

  it("rejects unknown fields on activatePolicyRevision wire", () => {
    const decoded = decodeActivatePolicyRevisionWire(
      {
        policyId: "fleet-policy",
        revisionId: "2",
        activationDomainId: "default",
        expectedBindingGeneration: 1,
        compatibleSchemaRefs: [],
        rules: [{ ruleId: "allow-all", decision: "allow" }],
        createdBy: "policy-admin",
        createdAt: "2026-08-11T14:00:00Z",
        activatedAt: "2026-08-11T14:01:00Z",
        extra: "not-allowed",
      },
      testAdminContext(["policy-admin"], "policy-admin"),
    );
    expect(decoded.ok).toBe(false);
    if (decoded.ok) {
      return;
    }
    expect(decoded.error.code).toBe("invalid_input");
  });

  it("accepts valid submit wire and maps idempotency key", () => {
    const decoded = decodeSubmitSchemaAdmissionWire(
      {
        admissionId: schemaAdmissionId("adm-wire-valid"),
        activationDomainId: "default",
        expectedBindingGeneration: 1,
        expectedSchemaRef: {
          schemaId: "default-v1",
          revisionId: "rev-001",
          digest: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
        },
        expectedEpochId: "42",
        expectedEpochOrdinal: 1,
        expectedRuntimeHead: "snap-S0",
        candidateSchemaRef: {
          schemaId: "default-v1",
          revisionId: "rev-002",
          digest: "fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210",
        },
        requestedBy: "proposer",
        requestedAt: "2026-08-11T14:00:00Z",
        idempotencyKey: idempotencyKey("idem-wire-valid"),
      },
      testAdminContext(["schema-proposer"], "proposer"),
    );
    expect(decoded.ok).toBe(true);
  });
});
