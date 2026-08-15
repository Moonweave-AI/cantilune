import { describe, expect, it } from "vitest";
import {
  activationDomainId,
  idempotencyKey,
  operationTemplateRef,
  operationTypeId,
  schemaAdmissionId,
  schemaRevisionId,
} from "@cantilune/core";
import { buildOrchestrationSchema } from "@cantilune/runtime";
import { MemoryControlPlaneStore } from "../../src/memory/memoryControlPlaneStore.js";
import {
  bootstrapDefaultControlPlane,
  createControlPlaneService,
} from "../../src/engine/controlPlaneService.js";
import { createSchemaRevision } from "../../src/schema/schemaRevision.js";
import { proposerContext, testAdminContext } from "../support/testAdminContext.js";

describe("control-plane service integration", () => {
  it("registers immutable schema revisions without activating", async () => {
    const store = new MemoryControlPlaneStore();
    const { service, genesisRevision } = bootstrapDefaultControlPlane(store);
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
    const result = await service.registerSchemaRevision({
      context: testAdminContext(["schema-registrar"], "author"),
      schema: extended,
      revisionId: schemaRevisionId("rev-002"),
      parentRef: genesisRevision.schemaRef,
      createdAt: "2026-08-11T01:00:00Z",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    const returnedOperationCount = result.value.schema.operationTypes.size;
    expect(() =>
      (result.value.schema.operationTypes as unknown as Map<unknown, unknown>).clear(),
    ).toThrow(TypeError);
    expect(() => {
      (result.value.schemaRef as { digest: string }).digest = "mutated";
    }).toThrow(TypeError);
    expect(store.getRevision(result.value.schemaRef)?.schema.operationTypes.size).toBe(
      returnedOperationCount,
    );
    const active = store.getActiveBinding(activationDomainId("default"));
    expect(active?.schemaRef.revisionId).toBe(genesisRevision.schemaRef.revisionId);
  });

  it("rejects proposer self-approval", async () => {
    const store = new MemoryControlPlaneStore();
    const { service, genesisRevision, genesisBinding } = bootstrapDefaultControlPlane(store);
    const candidate = createSchemaRevision({
      schema: genesisRevision.schema,
      revisionId: schemaRevisionId("rev-dup"),
      createdBy: "author",
      createdAt: "2026-08-11T02:00:00Z",
      parentRef: genesisRevision.schemaRef,
    });
    store.registerRevision(candidate);

    const submitted = await service.submitSchemaAdmission({
      context: proposerContext(),
      request: {
        admissionId: schemaAdmissionId("adm-001"),
        activationDomainId: genesisBinding.activationDomainId,
        expectedBindingGeneration: genesisBinding.bindingGeneration,
        expectedSchemaRef: genesisRevision.schemaRef,
        expectedEpochId: genesisBinding.epochId,
        expectedEpochOrdinal: genesisBinding.epochOrdinal,
        expectedRuntimeHead: genesisBinding.runtimeHead,
        candidateSchemaRef: candidate.schemaRef,
        requestedBy: "proposer",
        requestedAt: "2026-08-11T02:00:00Z",
        idempotencyKey: idempotencyKey("idem-001"),
      },
    });
    expect(submitted.ok).toBe(true);
    if (!submitted.ok) {
      return;
    }

    const approved = await service.approveSchemaAdmission({
      context: proposerContext(),
      admissionId: schemaAdmissionId("adm-001"),
    });
    expect(approved.ok).toBe(false);
    if (approved.ok) {
      return;
    }
    expect(approved.error.code).toBe("separation_of_duties_violation");
  });
});

describe("immutable revision registry", () => {
  it("rejects duplicate revision registration", async () => {
    const store = new MemoryControlPlaneStore();
    const service = createControlPlaneService({ store });
    const schema = buildOrchestrationSchema("default-v1");
    const command = {
      context: testAdminContext(["schema-registrar"], "author"),
      schema,
      revisionId: schemaRevisionId("rev-001"),
      createdAt: "2026-08-11T00:00:00Z",
    };
    expect((await service.registerSchemaRevision(command)).ok).toBe(true);
    const second = await service.registerSchemaRevision(command);
    expect(second.ok).toBe(false);
    if (second.ok) {
      return;
    }
    expect(second.error.code).toBe("revision_conflict");
  });
});
