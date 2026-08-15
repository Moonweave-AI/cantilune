import { describe, expect, it } from "vitest";
import { buildCommsRuntimeHarness } from "../support/buildCommsRuntimeHarness.js";
import { createRuntimeCommsPorts } from "../../src/integration/runtimeCommsPorts.js";
import { schemaAdmissionId, epochId, epochOrdinal } from "@cantilune/core";

describe("runtimeCommsPorts commitReconnect", () => {
  it("commits reconnect via epoch administration when recovery succeeds", async () => {
    const harness = buildCommsRuntimeHarness();
    const ports = createRuntimeCommsPorts({
      runtime: harness.runtime,
      epochAdmin: harness.epochAdmin,
    });
    const admissionId = schemaAdmissionId("adm-ports-rc-001");
    const prepared = await harness.epochAdmin.prepareEpochTransition({
      domainId: harness.binding.activationDomainId,
      admissionId,
      planDigest: "plan-digest-ports" as never,
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
    await harness.epochAdmin.commitEpochTransition(prepared.value);
    const result = await ports.runtimeCommit.commitReconnect({
      planDigest: "plan-digest-ports",
      admissionId: admissionId as string,
    });
    expect(result.ok).toBe(true);
  });
});
