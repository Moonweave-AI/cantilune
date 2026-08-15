import { describe, expect, it } from "vitest";
import {
  idempotencyKey,
  operationTemplateRef,
  operationTypeId,
  schemaAdmissionId,
  schemaRevisionId,
} from "@cantilune/core";
import { buildOrchestrationSchema } from "@cantilune/runtime";
import { buildAdmissionHarness, createSchemaRevision } from "../support/buildAdmissionHarness.js";

describe("full admission prepare→commit→runtime epoch switch", () => {
  it("activates extended schema through prepare and commit", async () => {
    const harness = buildAdmissionHarness();
    const { store, genesisBinding, genesisRevision } = harness;

    const extended = buildOrchestrationSchema("default-v1", [
      ...genesisRevision.schema.templates,
      {
        ...genesisRevision.schema.templates[0]!,
        operationTypeId: operationTypeId("archive_artifact"),
        templateRef: operationTemplateRef("archive_artifact", "1"),
        description: "archive",
        requiredRoles: ["task", "from"],
        requires: [],
        ensures: [],
      },
    ]);
    const candidate = createSchemaRevision({
      schema: extended,
      revisionId: schemaRevisionId("rev-002"),
      parentRef: genesisRevision.schemaRef,
      createdBy: "author",
      createdAt: "2026-08-11T03:00:00Z",
    });
    harness.registerRevision(candidate);

    const committed = await harness.runAdmissionPipeline({
      admissionId: schemaAdmissionId("adm-full-001"),
      candidate,
      idempotencyKey: idempotencyKey("idem-full-001"),
      requestedAt: "2026-08-11T03:00:00Z",
    });
    expect(committed.ok).toBe(true);
    if (!committed.ok) {
      return;
    }

    const active = store.getActiveBinding(genesisBinding.activationDomainId);
    expect(active?.schemaRef.revisionId).toBe(candidate.schemaRef.revisionId);
    expect((active?.epochOrdinal as number) > (genesisBinding.epochOrdinal as number)).toBe(true);
    expect(harness.schemaHolder.get().schema.schemaId).toBe(extended.schemaId);
    expect(harness.bindingHolder.get().schemaRef.revisionId).toBe(candidate.schemaRef.revisionId);
  });
});
