import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { bindingGeneration, runtimeInstanceId } from "@cantilune/core";
import { MemoryControlPlaneStore } from "../../../src/memory/memoryControlPlaneStore.js";
import { createFileControlPlaneStore } from "../../../src/file/fileControlPlaneStore.js";
import { ReconciliationService } from "../../../src/rollout/reconciliationService.js";
import { buildAdmissionHarness, testAdminContext } from "../../support/buildAdmissionHarness.js";

describe("L7 fleet binding crash recovery", () => {
  it("recovers pending, drift, and acknowledged bindings after process restart", () => {
    const dir = mkdtempSync(join(tmpdir(), "cantilune-cp-fleet-"));
    try {
      const harness = buildAdmissionHarness();
      const fileStore = createFileControlPlaneStore(dir, harness.store);
      fileStore.persist();

      const pendingId = runtimeInstanceId("runtime-pending");
      const ackId = runtimeInstanceId("runtime-ack");
      const driftId = runtimeInstanceId("runtime-drift");
      const written = new ReconciliationService({ fileStore });
      written.setDesired({
        domainId: harness.genesisBinding.activationDomainId,
        targetBinding: harness.genesisBinding,
        runtimeInstanceIds: [pendingId, ackId, driftId],
      });
      written.acknowledge(ackId, harness.genesisBinding);
      written.acknowledge(driftId, {
        ...harness.genesisBinding,
        bindingGeneration: bindingGeneration(99),
      });

      const firstReport = written.report();
      expect(firstReport.pending).toBe(1);
      expect(firstReport.acknowledged).toBe(1);
      expect(firstReport.drift).toBe(1);

      const restartedMemory = new MemoryControlPlaneStore();
      const restartedStore = createFileControlPlaneStore(dir, restartedMemory);
      const recovered = new ReconciliationService({ fileStore: restartedStore });
      const report = recovered.report();
      expect(report.pending).toBe(1);
      expect(report.acknowledged).toBe(1);
      expect(report.drift).toBe(1);
      expect(report.failed).toBe(0);

      const byId = new Map(recovered.list().map((item) => [item.runtimeInstanceId, item]));
      expect(byId.get(pendingId)?.status).toBe("pending");
      expect(byId.get(ackId)?.status).toBe("acknowledged");
      expect(byId.get(driftId)?.status).toBe("drift");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("createFullControlPlaneService recovers fleet bindings through fileStore", () => {
    const dir = mkdtempSync(join(tmpdir(), "cantilune-cp-fleet-svc-"));
    try {
      const first = buildAdmissionHarness({ persistDir: dir });
      const pendingId = runtimeInstanceId("svc-pending");
      const ackId = runtimeInstanceId("svc-ack");
      expect(
        first.service.setFleetRollout(
          {
            domainId: first.genesisBinding.activationDomainId,
            targetBinding: first.genesisBinding,
            runtimeInstanceIds: [pendingId, ackId],
          },
          testAdminContext(["rollout-admin"], "rollout-operator"),
        ).ok,
      ).toBe(true);
      expect(
        first.service.acknowledgeRuntimeInstance(
          ackId,
          first.genesisBinding,
          testAdminContext(["runtime-worker"], "svc-ack"),
        ).ok,
      ).toBe(true);

      const restarted = buildAdmissionHarness({ persistDir: dir });
      const report = restarted.service.rolloutReport();
      expect(report.pending).toBe(1);
      expect(report.acknowledged).toBe(1);
      expect(
        restarted.service
          .listRuntimeBindings()
          .some((item) => item.runtimeInstanceId === pendingId && item.status === "pending"),
      ).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
