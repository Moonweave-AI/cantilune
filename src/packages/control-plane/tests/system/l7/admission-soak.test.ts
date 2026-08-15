import { describe, expect, it } from "vitest";
import { idempotencyKey, schemaAdmissionId, schemaRevisionId } from "@cantilune/core";
import {
  buildAdmissionHarness,
  createSchemaRevision,
} from "../../support/buildAdmissionHarness.js";

describe("L7 admission soak", () => {
  it("completes repeated prepare→commit cycles without drift", async () => {
    const harness = buildAdmissionHarness();
    let binding = harness.genesisBinding;
    let currentRevision = harness.genesisRevision;

    for (let cycle = 0; cycle < 5; cycle += 1) {
      const candidate = createSchemaRevision({
        schema: currentRevision.schema,
        revisionId: schemaRevisionId(`rev-soak-${cycle}`),
        parentRef: currentRevision.schemaRef,
        createdBy: "soak",
        createdAt: `2026-08-11T10:0${cycle}:00Z`,
      });
      harness.registerRevision(candidate);

      const committed = await harness.runAdmissionPipeline({
        admissionId: schemaAdmissionId(`adm-soak-${cycle}`),
        candidate,
        idempotencyKey: idempotencyKey(`idem-soak-${cycle}`),
        requestedAt: `2026-08-11T10:0${cycle}:00Z`,
      });
      expect(committed.ok).toBe(true);
      if (!committed.ok) {
        return;
      }

      binding = committed.value.toBinding;
      currentRevision = candidate;
    }

    expect(
      (binding.bindingGeneration as number) >=
        (harness.genesisBinding.bindingGeneration as number) + 5,
    ).toBe(true);
  });
});
