import { describe, expect, it } from "vitest";
import {
  coordinationIntent,
  actorRef,
  actorId,
  operationTypeId,
  policyId,
  policyRevisionId,
  emptyFootprint,
} from "@cantilune/core";
import { buildConfigT0 } from "@cantilune/test-fixtures";
import { buildAdmissionHarness, testAdminContext } from "../support/buildAdmissionHarness.js";
import { createPolicyRevision } from "../../src/policy/policyRevision.js";

describe("policy activation updates binding and runtime evaluator", () => {
  it("bumps binding generation and swaps runtime policy evaluator", () => {
    const harness = buildAdmissionHarness();
    const denyRevision = createPolicyRevision({
      policyId: policyId("fleet-policy"),
      revisionId: policyRevisionId("deny-introduce"),
      compatibleSchemaRefs: [harness.genesisRevision.schemaRef],
      rules: [
        {
          ruleId: "deny-introduce",
          operationTypeId: "introduce_artifact",
          decision: "deny",
        },
      ],
      createdBy: "policy-admin",
      createdAt: "2026-08-11T12:00:00Z",
    });

    const activated = harness.service.activatePolicyRevision({
      context: testAdminContext(["policy-admin"], "policy-admin"),
      policyRevision: denyRevision,
      activationDomainId: harness.genesisBinding.activationDomainId,
      expectedBindingGeneration: harness.genesisBinding.bindingGeneration,
      activatedAt: "2026-08-11T12:01:00Z",
    });
    expect(activated.ok).toBe(true);
    if (!activated.ok) {
      return;
    }

    const active = harness.store.getActiveBinding(harness.genesisBinding.activationDomainId);
    expect(active?.policyRef.revisionId).toBe("deny-introduce");
    expect(
      (active?.bindingGeneration as number) > (harness.genesisBinding.bindingGeneration as number),
    ).toBe(true);
    expect(harness.activePolicyRevision.get()?.policyRef.revisionId).toBe("deny-introduce");

    const template = harness.genesisRevision.schema.templates[0]!;
    const decision = harness.policyHolder.get().evaluate({
      snapshot: buildConfigT0(),
      intent: coordinationIntent(
        actorRef(actorId("planner-p"), "agent"),
        operationTypeId("introduce_artifact"),
        [],
      ),
      template,
      effectiveFootprint: emptyFootprint(),
    });
    expect(decision.kind).toBe("deny");
  });
});
