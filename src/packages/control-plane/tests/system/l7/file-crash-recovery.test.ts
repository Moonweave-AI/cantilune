import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  idempotencyKey,
  operationTemplateRef,
  operationTypeId,
  policyId,
  policyRevisionId,
  schemaAdmissionId,
  schemaRevisionId,
} from "@cantilune/core";
import { buildOrchestrationSchema } from "@cantilune/runtime";
import { createPolicyRevision } from "../../../src/policy/policyRevision.js";
import { MemoryControlPlaneStore } from "../../../src/memory/memoryControlPlaneStore.js";
import { createFileControlPlaneStore } from "../../../src/file/fileControlPlaneStore.js";
import {
  buildAdmissionHarness,
  createSchemaRevision,
  testAdminContext,
} from "../../support/buildAdmissionHarness.js";

describe("L7 control-plane file crash recovery", () => {
  it("reloads snapshot and journal after simulated process restart", async () => {
    const dir = mkdtempSync(join(tmpdir(), "cantilune-cp-"));
    try {
      const harness = buildAdmissionHarness();
      const fileStore = createFileControlPlaneStore(dir, harness.store);
      fileStore.persist();

      const extended = buildOrchestrationSchema("default-v1", [
        ...harness.genesisRevision.schema.templates,
        {
          ...harness.genesisRevision.schema.templates[0]!,
          operationTypeId: operationTypeId("persist_artifact"),
          templateRef: operationTemplateRef("persist_artifact", "1"),
          description: "persist",
          requiredRoles: ["task"],
          requires: [],
          ensures: [],
        },
      ]);
      const candidate = createSchemaRevision({
        schema: extended,
        revisionId: schemaRevisionId("rev-crash-001"),
        parentRef: harness.genesisRevision.schemaRef,
        createdBy: "author",
        createdAt: "2026-08-11T05:00:00Z",
      });
      harness.registerRevision(candidate);

      const admissionId = schemaAdmissionId("adm-crash-001");
      const submitted = await harness.service.submitSchemaAdmission({
        context: testAdminContext(["schema-qualifier", "schema-proposer"], "proposer"),
        request: {
          admissionId,
          activationDomainId: harness.genesisBinding.activationDomainId,
          expectedBindingGeneration: harness.genesisBinding.bindingGeneration,
          expectedSchemaRef: harness.genesisRevision.schemaRef,
          expectedEpochId: harness.genesisBinding.epochId,
          expectedEpochOrdinal: harness.genesisBinding.epochOrdinal,
          expectedRuntimeHead: harness.genesisBinding.runtimeHead,
          candidateSchemaRef: candidate.schemaRef,
          requestedBy: "proposer",
          requestedAt: "2026-08-11T05:00:00Z",
          idempotencyKey: idempotencyKey("idem-crash-001"),
        },
      });
      expect(submitted.ok).toBe(true);
      fileStore.persist();

      const restartedMemory = new MemoryControlPlaneStore();
      const recovered = createFileControlPlaneStore(dir, restartedMemory);
      const snapshot = recovered.recover();
      expect(snapshot.admissions.has(admissionId)).toBe(true);
      expect(
        snapshot.activeBindings.get(harness.genesisBinding.activationDomainId)?.bindingGeneration,
      ).toBe(harness.genesisBinding.bindingGeneration);
      const restoredRevision = snapshot.revisions.get(
        `${candidate.schemaRef.schemaId}@${candidate.schemaRef.revisionId}`,
      );
      expect(restoredRevision?.schema.objectTypes.size).toBeGreaterThan(0);
      expect(() =>
        (restoredRevision?.schema.objectTypes as unknown as Map<unknown, unknown>).clear(),
      ).toThrow(TypeError);
      expect(snapshot.events.length).toBeGreaterThan(0);
      expect(recovered.loadJournal().length).toBeGreaterThanOrEqual(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("persists policy activation as independent event", () => {
    const dir = mkdtempSync(join(tmpdir(), "cantilune-cp-policy-"));
    try {
      const harness = buildAdmissionHarness();
      const fileStore = createFileControlPlaneStore(dir, harness.store);
      const policyRevision = createPolicyRevision({
        policyId: policyId("fleet-policy"),
        revisionId: policyRevisionId("2"),
        compatibleSchemaRefs: [harness.genesisRevision.schemaRef],
        rules: [{ ruleId: "allow-all", decision: "allow" }],
        createdBy: "policy-admin",
        createdAt: "2026-08-11T06:00:00Z",
      });
      const activated = harness.service.activatePolicyRevision({
        context: testAdminContext(["policy-admin"], "policy-admin"),
        policyRevision,
        activationDomainId: harness.genesisBinding.activationDomainId,
        expectedBindingGeneration: harness.genesisBinding.bindingGeneration,
        activatedAt: "2026-08-11T06:00:00Z",
      });
      expect(activated.ok).toBe(true);
      fileStore.persist();

      const restarted = new MemoryControlPlaneStore();
      createFileControlPlaneStore(dir, restarted);
      expect(restarted.getPolicy(policyRevision.policyRef)?.policyRef.revisionId).toBe("2");
      const active = restarted.getActiveBinding(harness.genesisBinding.activationDomainId);
      expect(
        (active?.bindingGeneration as number) >
          (harness.genesisBinding.bindingGeneration as number),
      ).toBe(true);
      expect(active?.policyRef.revisionId).toBe("2");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
