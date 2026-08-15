import { describe, expect, it } from "vitest";
import { policyId, policyRevisionId } from "@cantilune/core";
import {
  createPolicyEvaluatorFromRevision,
  createPolicyRevision,
  evaluatePolicyRevision,
  snapshotPolicyRevision,
  verifyPolicyRevisionIntegrity,
} from "../../../src/policy/policyRevision.js";
import type { PolicyRule } from "../../../src/policy/policyRevision.js";
import { buildAdmissionHarness } from "../../support/buildAdmissionHarness.js";
import { buildConfigT0 } from "@cantilune/test-fixtures";
import {
  actorRef,
  actorId,
  coordinationIntent,
  emptyFootprint,
  operationTypeId,
} from "@cantilune/core";

describe("policy revision", () => {
  it("evaluates first matching rule", () => {
    const harness = buildAdmissionHarness();
    const revision = createPolicyRevision({
      policyId: policyId("test-policy"),
      revisionId: policyRevisionId("1"),
      compatibleSchemaRefs: [harness.genesisRevision.schemaRef],
      rules: [
        { ruleId: "deny-introduce", operationTypeId: "introduce_artifact", decision: "deny" },
        { ruleId: "allow-all", decision: "allow" },
      ],
      createdBy: "admin",
      createdAt: "2026-08-11T00:00:00Z",
    });
    expect(evaluatePolicyRevision(revision, { operationTypeId: "introduce_artifact" })).toBe(
      "deny",
    );
    expect(evaluatePolicyRevision(revision, { operationTypeId: "delegate" })).toBe("allow");
    expect(evaluatePolicyRevision(revision, { operationTypeId: "unknown_op" })).toBe("allow");
  });

  it("skips rules when principalRole or operationTypeId mismatch", () => {
    const revision = createPolicyRevision({
      policyId: policyId("role-policy"),
      revisionId: policyRevisionId("2"),
      compatibleSchemaRefs: [],
      rules: [
        { ruleId: "role-only", principalRole: "task", decision: "allow" },
        { ruleId: "op-only", operationTypeId: "delegate", decision: "deny" },
      ],
      createdBy: "admin",
      createdAt: "2026-08-11T00:00:00Z",
    });
    expect(evaluatePolicyRevision(revision, { principalRole: "other" })).toBe("deny");
    expect(evaluatePolicyRevision(revision, { principalRole: "task" })).toBe("allow");
    expect(evaluatePolicyRevision(revision, { operationTypeId: "delegate" })).toBe("deny");
  });

  it("creates runtime policy evaluator from revision", () => {
    const harness = buildAdmissionHarness();
    const revision = createPolicyRevision({
      policyId: policyId("eval-policy"),
      revisionId: policyRevisionId("3"),
      compatibleSchemaRefs: [harness.genesisRevision.schemaRef],
      rules: [{ ruleId: "allow-all", decision: "allow" }],
      createdBy: "admin",
      createdAt: "2026-08-11T00:00:00Z",
    });
    const evaluator = createPolicyEvaluatorFromRevision(revision);
    const template = harness.genesisRevision.schema.templates[0]!;
    const decision = evaluator.evaluate({
      snapshot: buildConfigT0(),
      intent: coordinationIntent(
        actorRef(actorId("agent-a"), "agent"),
        operationTypeId("introduce_artifact"),
        [],
      ),
      template,
      effectiveFootprint: emptyFootprint(),
    });
    expect(decision.kind).toBe("allow");
  });

  it("createPolicyEvaluatorFromRevision denies when no rule matches", () => {
    const harness = buildAdmissionHarness();
    const revision = createPolicyRevision({
      policyId: policyId("deny-default"),
      revisionId: policyRevisionId("1"),
      compatibleSchemaRefs: [harness.genesisRevision.schemaRef],
      rules: [{ ruleId: "deny-specific", operationTypeId: "missing_op", decision: "allow" }],
      createdBy: "admin",
      createdAt: "2026-08-11T00:00:00Z",
    });
    const evaluator = createPolicyEvaluatorFromRevision(revision);
    const template = { ...harness.genesisRevision.schema.templates[0]!, requiredRoles: [] };
    const decision = evaluator.evaluate({
      snapshot: buildConfigT0(),
      intent: coordinationIntent(
        actorRef(actorId("agent-b"), "agent"),
        operationTypeId("introduce_artifact"),
        [],
      ),
      template,
      effectiveFootprint: emptyFootprint(),
    });
    expect(decision.kind).toBe("deny");
  });

  it("detaches policy inputs and pins evaluator authority to the verified revision", () => {
    const harness = buildAdmissionHarness();
    const compatibleSchemaRefs = [{ ...harness.genesisRevision.schemaRef }];
    const rules: { ruleId: string; decision: "allow" | "deny" }[] = [
      { ruleId: "deny-all", decision: "deny" },
    ];
    const revision = createPolicyRevision({
      policyId: policyId("immutable-policy"),
      revisionId: policyRevisionId("1"),
      compatibleSchemaRefs,
      rules,
      createdBy: "admin",
      createdAt: "2026-08-13T00:00:00Z",
    });
    const evaluator = createPolicyEvaluatorFromRevision(revision);

    rules[0]!.decision = "allow";
    compatibleSchemaRefs[0]!.digest =
      "caller-mutated" as (typeof compatibleSchemaRefs)[0]["digest"];

    expect(revision.rules[0]?.decision).toBe("deny");
    expect(revision.compatibleSchemaRefs[0]?.digest).toBe(harness.genesisRevision.schemaRef.digest);
    expect(() =>
      (revision.rules as unknown as PolicyRule[]).push({ ruleId: "escaped", decision: "allow" }),
    ).toThrow(TypeError);
    const decision = evaluator.evaluate({
      snapshot: buildConfigT0(),
      intent: coordinationIntent(
        actorRef(actorId("agent-c"), "agent"),
        operationTypeId("introduce_artifact"),
        [],
      ),
      template: harness.genesisRevision.schema.templates[0]!,
      effectiveFootprint: emptyFootprint(),
    });
    expect(decision.kind).toBe("deny");
  });

  it("fails closed on malformed, accessor-backed, or digest-tampered policy authority", () => {
    const harness = buildAdmissionHarness();
    const valid = createPolicyRevision({
      policyId: policyId("strict-policy"),
      revisionId: policyRevisionId("1"),
      compatibleSchemaRefs: [harness.genesisRevision.schemaRef],
      rules: [
        {
          ruleId: "scoped",
          principalRole: "from",
          operationTypeId: "introduce_artifact",
          templateRevision: "1",
          decision: "deny",
        },
      ],
      createdBy: "admin",
      createdAt: "2026-08-13T00:00:00Z",
    });
    expect(verifyPolicyRevisionIntegrity(valid)).toBe(true);
    expect(
      verifyPolicyRevisionIntegrity({
        ...valid,
        policyRef: { ...valid.policyRef, digest: "tampered" as typeof valid.policyRef.digest },
      }),
    ).toBe(false);

    for (const malformed of [
      null,
      { ...valid, policyRef: null },
      { ...valid, compatibleSchemaRefs: "not-an-array" },
      { ...valid, rules: "not-an-array" },
      { ...valid, defaultDecision: "allow" },
      { ...valid, rules: [{ ruleId: "", decision: "deny" }] },
      { ...valid, rules: [{ ruleId: "bad", decision: "maybe" }] },
      { ...valid, rules: [{ ruleId: "bad", principalRole: 3, decision: "deny" }] },
    ]) {
      expect(verifyPolicyRevisionIntegrity(malformed as never)).toBe(false);
    }

    let getterCalls = 0;
    const accessorRule = Object.defineProperty({}, "ruleId", {
      get() {
        getterCalls++;
        return "unsafe";
      },
    });
    Object.defineProperty(accessorRule, "decision", { value: "deny", enumerable: true });
    expect(() => snapshotPolicyRevision({ ...valid, rules: [accessorRule as never] })).toThrow(
      /own policy data property/,
    );
    expect(getterCalls).toBe(0);
  });
});
