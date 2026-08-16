import { describe, expect, it } from "vitest";
import { runtimeInstanceId } from "@cantilune/core";
import {
  createReconciliationService,
  ReconciliationService,
} from "../../../src/rollout/reconciliationService.js";
import { buildAdmissionHarness } from "../../support/buildAdmissionHarness.js";

describe("reconciliation service", () => {
  it("creates factory instance", () => {
    expect(createReconciliationService()).toBeInstanceOf(ReconciliationService);
    expect(createReconciliationService({})).toBeInstanceOf(ReconciliationService);
  });

  it("tracks desired bindings and acknowledges runtime instances", () => {
    const harness = buildAdmissionHarness();
    const service = createReconciliationService();
    const instanceA = runtimeInstanceId("runtime-a");
    const instanceB = runtimeInstanceId("runtime-b");

    service.setDesired({
      domainId: harness.genesisBinding.activationDomainId,
      targetBinding: harness.genesisBinding,
      runtimeInstanceIds: [instanceA, instanceB],
    });

    const beforeAck = service.report();
    expect(beforeAck.pending).toBe(2);
    expect(beforeAck.acknowledged).toBe(0);

    service.acknowledge(instanceA, harness.genesisBinding);
    const afterAck = service.report();
    expect(afterAck.acknowledged).toBe(1);
    expect(afterAck.pending).toBe(1);

    const bindings = service.list();
    const acknowledged = bindings.find((item) => item.runtimeInstanceId === instanceA);
    expect(acknowledged?.status).toBe("acknowledged");
    expect(acknowledged?.drift).toBe(false);
  });

  it("ignores acknowledge for unknown instance", () => {
    const harness = buildAdmissionHarness();
    const service = createReconciliationService();
    service.setDesired({
      domainId: harness.genesisBinding.activationDomainId,
      targetBinding: harness.genesisBinding,
      runtimeInstanceIds: [runtimeInstanceId("runtime-known")],
    });
    service.acknowledge(runtimeInstanceId("runtime-unknown"), harness.genesisBinding);
    expect(service.report().pending).toBe(1);
  });

  it("acknowledges without observed binding leaves pending reconciliation", () => {
    const harness = buildAdmissionHarness();
    const service = createReconciliationService();
    const instance = runtimeInstanceId("runtime-no-obs");
    service.setDesired({
      domainId: harness.genesisBinding.activationDomainId,
      targetBinding: harness.genesisBinding,
      runtimeInstanceIds: [instance],
    });
    service.acknowledge(instance, undefined);
    const binding = service.list()[0]!;
    expect(binding.status).toBe("pending");
    expect(binding.lastAcknowledgedAt).toBeDefined();
  });

  it("reports drift when observed binding differs", () => {
    const harness = buildAdmissionHarness();
    const service = createReconciliationService();
    const instance = runtimeInstanceId("runtime-drift");
    service.setDesired({
      domainId: harness.genesisBinding.activationDomainId,
      targetBinding: harness.genesisBinding,
      runtimeInstanceIds: [instance],
    });
    const staleObserved = {
      ...harness.genesisBinding,
      schemaRef: {
        ...harness.genesisBinding.schemaRef,
        digest: harness.genesisRevision.schemaRef.digest,
      },
    };
    service.acknowledge(instance, staleObserved);
    const report = service.report();
    expect(report.drift).toBe(0);
    service.acknowledge(instance, harness.genesisBinding);
    expect(service.list()[0]?.status).toBe("acknowledged");
  });
});
