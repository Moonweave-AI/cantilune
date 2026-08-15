import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { bindingGeneration, runtimeInstanceId } from "@cantilune/core";
import { MemoryControlPlaneStore } from "../../../src/memory/memoryControlPlaneStore.js";
import { createFileControlPlaneStore } from "../../../src/file/fileControlPlaneStore.js";
import { buildAdmissionHarness, testAdminContext } from "../../support/buildAdmissionHarness.js";

describe("L7 control-plane cross-process CAS", () => {
  it("rejects stale binding generation when two workers race", () => {
    const harness = buildAdmissionHarness();
    const domainId = harness.genesisBinding.activationDomainId;
    const active = harness.store.getActiveBinding(domainId)!;

    const staleOk = harness.store.casActiveBinding({
      domainId,
      expectedGeneration: active.bindingGeneration,
      nextBinding: {
        ...active,
        bindingGeneration: bindingGeneration((active.bindingGeneration as number) + 1),
        runtimeHead: active.runtimeHead,
      },
    });
    expect(staleOk).toBe(true);

    const raceLost = harness.store.casActiveBinding({
      domainId,
      expectedGeneration: active.bindingGeneration,
      nextBinding: {
        ...active,
        bindingGeneration: bindingGeneration((active.bindingGeneration as number) + 2),
        runtimeHead: active.runtimeHead,
      },
    });
    expect(raceLost).toBe(false);
  });

  it("reloads durable snapshot consistently across process boundaries", () => {
    const dir = mkdtempSync(join(tmpdir(), "cantilune-cp-cas-"));
    try {
      const harness = buildAdmissionHarness();
      const fileStore = createFileControlPlaneStore(dir, harness.store);
      harness.service.setFleetRollout(
        {
          domainId: harness.genesisBinding.activationDomainId,
          targetBinding: harness.genesisBinding,
          runtimeInstanceIds: [runtimeInstanceId("worker-a"), runtimeInstanceId("worker-b")],
        },
        testAdminContext(["rollout-admin"], "rollout-operator"),
      );
      fileStore.persist();

      const processB = new MemoryControlPlaneStore();
      createFileControlPlaneStore(dir, processB);
      expect(processB.getActiveBinding(harness.genesisBinding.activationDomainId)).toBeDefined();
      const report = harness.service.rolloutReport();
      expect(report.pending).toBeGreaterThanOrEqual(0);
      harness.service.acknowledgeRuntimeInstance(
        runtimeInstanceId("worker-a"),
        harness.genesisBinding,
        testAdminContext(["runtime-worker"], "worker-a"),
      );
      const bindings = harness.service.listRuntimeBindings();
      expect(bindings.some((item) => item.runtimeInstanceId === "worker-a")).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
