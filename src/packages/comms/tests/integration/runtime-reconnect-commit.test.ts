import { describe, expect, it } from "vitest";
import { epochId, epochOrdinal, schemaAdmissionId } from "@cantilune/core";
import { buildCommsRuntimeHarness } from "../support/buildCommsRuntimeHarness.js";
import { createRuntimeCommsPorts } from "../../src/integration/runtimeCommsPorts.js";

describe("runtime reconnect commit port", () => {
  it("recovers epoch receipt by admission id", async () => {
    const harness = buildCommsRuntimeHarness();
    const ports = createRuntimeCommsPorts({
      runtime: harness.runtime,
      epochAdmin: harness.epochAdmin,
    });

    const admissionId = schemaAdmissionId("adm-runtime-reconnect-001");
    const prepared = await harness.epochAdmin.prepareEpochTransition({
      domainId: harness.binding.activationDomainId,
      admissionId,
      planDigest: "plan-digest-runtime-001" as never,
      expectedHead: harness.runtime.getHead()!.snapshotRef,
      expectedBindingGeneration: harness.binding.bindingGeneration,
      expectedEpochId: harness.binding.epochId,
      expectedEpochOrdinal: harness.binding.epochOrdinal,
      targetEpochId: epochId("43"),
      targetEpochOrdinal: epochOrdinal(2),
      targetSchemaRef: harness.binding.schemaRef,
    });
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) {
      return;
    }

    const committed = await harness.epochAdmin.commitEpochTransition(prepared.value);
    expect(committed.ok).toBe(true);
    if (!committed.ok) {
      return;
    }

    const reconnectCommit = await ports.runtimeCommit.commitReconnect({
      planDigest: "plan-digest-runtime-001",
      admissionId: admissionId as string,
    });
    expect(reconnectCommit.ok).toBe(true);
    if (!reconnectCommit.ok) {
      return;
    }
    expect(reconnectCommit.value.receiptRef).toBe(committed.value.afterSnapshotRef as string);
    expect(harness.binding.epochId).toBe(epochId("42"));
    expect(harness.epochAdmin).toBeDefined();
  });
});
