import { describe, expect, it } from "vitest";
import { validateOutboundEnvelope } from "../../src/security/envelopePolicy.js";
import { MemoryCommsStore } from "../../src/memory/memoryCommsStore.js";
import { buildTestAuthContext, buildTestEnvelope } from "../support/envelopeFixtures.js";
import { epochId, epochOrdinal } from "@cantilune/core";

describe("envelopePolicy stale binding branches", () => {
  it("rejects stale epoch when binding resolver active", () => {
    const store = new MemoryCommsStore();
    const envelope = buildTestEnvelope({
      metadata: {
        ...buildTestEnvelope().metadata,
        epochId: epochId("99"),
        epochOrdinal: epochOrdinal(9),
      },
    });
    const result = validateOutboundEnvelope({
      context: buildTestAuthContext(),
      envelope,
      sessionAuthority: { isController: () => true, isMember: () => true },
      bindingResolver: {
        getActiveBinding: () => ({
          activationDomainId: "default" as never,
          bindingGeneration: 1 as never,
          epochId: epochId("42"),
          epochOrdinal: epochOrdinal(1),
          schemaRef: { schemaId: "s", revisionId: "r", digest: "d" as never } as never,
          policyRef: { policyId: "p", revisionId: "1", digest: "d" as never } as never,
          handlerManifestRef: { manifestId: "m", digest: "d" as never } as never,
          runtimeHead: "snap" as never,
          admissionId: "adm" as never,
          activatedBy: "op",
          activatedAt: "2026-08-11T16:00:00Z",
        }),
      },
      store,
      clock: { now: () => "2026-08-11T16:00:00Z" },
    });
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error.code).toBe("stale_binding");
  });
});
