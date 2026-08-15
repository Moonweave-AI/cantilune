import { describe, expect, it } from "vitest";
import {
  bindingGeneration,
  epochId,
  epochOrdinal,
  schemaAdmissionId,
  snapshotRef,
} from "@cantilune/core";
import {
  createNextBinding,
  createPolicyBindingUpdate,
} from "../../../src/activation/epochTransitionPlan.js";
import { buildAdmissionHarness } from "../../support/buildAdmissionHarness.js";

describe("epoch transition plan", () => {
  it("creates next binding with advanced epoch", () => {
    const harness = buildAdmissionHarness();
    const next = createNextBinding({
      domainId: harness.genesisBinding.activationDomainId,
      current: harness.genesisBinding,
      targetSchemaRef: harness.genesisRevision.schemaRef,
      targetEpochId: epochId("43"),
      targetEpochOrdinal: epochOrdinal(2),
      targetPolicyRef: harness.genesisBinding.policyRef,
      targetHandlerManifestRef: harness.genesisBinding.handlerManifestRef,
      runtimeHead: snapshotRef("snap-S1"),
      admissionId: schemaAdmissionId("adm-next"),
      activatedBy: "operator",
      activatedAt: "2026-08-11T00:00:00Z",
    });
    expect(next.epochOrdinal).toBe(epochOrdinal(2));
    expect(next.bindingGeneration).toBe(
      bindingGeneration((harness.genesisBinding.bindingGeneration as number) + 1),
    );
  });

  it("throws when epoch does not advance", () => {
    const harness = buildAdmissionHarness();
    expect(() =>
      createNextBinding({
        domainId: harness.genesisBinding.activationDomainId,
        current: harness.genesisBinding,
        targetSchemaRef: harness.genesisRevision.schemaRef,
        targetEpochId: harness.genesisBinding.epochId,
        targetEpochOrdinal: harness.genesisBinding.epochOrdinal,
        targetPolicyRef: harness.genesisBinding.policyRef,
        targetHandlerManifestRef: harness.genesisBinding.handlerManifestRef,
        runtimeHead: harness.genesisBinding.runtimeHead,
        admissionId: schemaAdmissionId("adm-stale"),
        activatedBy: "operator",
        activatedAt: "2026-08-11T00:00:00Z",
      }),
    ).toThrow("epoch_not_advanced");
  });

  it("bumps binding generation for policy-only update", () => {
    const harness = buildAdmissionHarness();
    const updated = createPolicyBindingUpdate({
      current: harness.genesisBinding,
      targetPolicyRef: harness.genesisBinding.policyRef,
      admissionId: schemaAdmissionId("adm-policy"),
      activatedBy: "policy-admin",
      activatedAt: "2026-08-11T00:00:00Z",
    });
    expect(updated.schemaRef).toEqual(harness.genesisBinding.schemaRef);
    expect(updated.bindingGeneration).toBe(
      bindingGeneration((harness.genesisBinding.bindingGeneration as number) + 1),
    );
  });
});
