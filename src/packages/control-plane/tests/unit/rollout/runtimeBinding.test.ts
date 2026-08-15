import { describe, expect, it } from "vitest";
import { bindingGeneration, runtimeInstanceId } from "@cantilune/core";
import { reconcileRuntimeBinding } from "../../../src/rollout/runtimeBinding.js";
import { buildAdmissionHarness } from "../../support/buildAdmissionHarness.js";

describe("runtime binding reconciliation", () => {
  it("marks pending when no observed binding", () => {
    const harness = buildAdmissionHarness();
    const reconciled = reconcileRuntimeBinding({
      runtimeInstanceId: runtimeInstanceId("rt-1"),
      desiredBinding: harness.genesisBinding,
      status: "acknowledged",
      drift: false,
    });
    expect(reconciled.status).toBe("pending");
    expect(reconciled.drift).toBe(true);
  });

  it("marks drift when generation or schema digest differs", () => {
    const harness = buildAdmissionHarness();
    const observed = {
      ...harness.genesisBinding,
      bindingGeneration: bindingGeneration(
        (harness.genesisBinding.bindingGeneration as number) + 1,
      ),
    };
    const reconciled = reconcileRuntimeBinding({
      runtimeInstanceId: runtimeInstanceId("rt-2"),
      desiredBinding: harness.genesisBinding,
      observedBinding: observed,
      status: "acknowledged",
    });
    expect(reconciled.status).toBe("drift");
    expect(reconciled.drift).toBe(true);
  });

  it("marks acknowledged when observed matches desired", () => {
    const harness = buildAdmissionHarness();
    const reconciled = reconcileRuntimeBinding({
      runtimeInstanceId: runtimeInstanceId("rt-3"),
      desiredBinding: harness.genesisBinding,
      observedBinding: harness.genesisBinding,
      status: "pending",
    });
    expect(reconciled.status).toBe("acknowledged");
    expect(reconciled.drift).toBe(false);
  });
});
