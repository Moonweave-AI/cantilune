import { describe, expect, it } from "vitest";
import {
  activationDomainId,
  bindingGeneration,
  causationId,
  contentDigest,
  correlationId,
  controlPlaneEventId,
  epochOrdinal,
  handlerManifestDigest,
  handlerManifestId,
  handlerManifestRef,
  idempotencyKey,
  occurrenceId,
  planDigest,
  policyId,
  policyRef,
  policyRevisionId,
  preparedAdmissionId,
  runtimeInstanceId,
  schemaAdmissionId,
  schemaDigest,
  schemaId,
  schemaRef,
  schemaRevisionId,
  storeSequence,
  admissionTombstoneId,
  objectTypeId,
} from "../../../src/primitives/controlPlaneIds.js";

describe("controlPlaneIds", () => {
  it("brands string identifiers", () => {
    expect(schemaId("schema-1")).toBe("schema-1");
    expect(schemaAdmissionId("adm-1")).toBe("adm-1");
    expect(activationDomainId("default")).toBe("default");
    expect(correlationId("corr-1")).toBe("corr-1");
    expect(idempotencyKey("idem-1")).toBe("idem-1");
    expect(objectTypeId("artifact")).toBe("artifact");
  });

  it("brands numeric identifiers", () => {
    expect(bindingGeneration(2)).toBe(2);
    expect(epochOrdinal(3)).toBe(3);
    expect(storeSequence(10)).toBe(10);
  });

  it("builds immutable refs", () => {
    const sRef = schemaRef(schemaId("s"), schemaRevisionId("r1"), schemaDigest("d1"));
    expect(sRef.schemaId).toBe("s");
    const pRef = policyRef(policyId("p"), policyRevisionId("r1"), contentDigest("d2"));
    expect(pRef.policyId).toBe("p");
    const hRef = handlerManifestRef(handlerManifestId("h"), handlerManifestDigest("d3"));
    expect(hRef.manifestId).toBe("h");
  });

  it("covers remaining branded constructors", () => {
    expect(runtimeInstanceId("rt-1")).toBe("rt-1");
    expect(causationId("cause-1")).toBe("cause-1");
    expect(occurrenceId("occ-1")).toBe("occ-1");
    expect(controlPlaneEventId("evt-1")).toBe("evt-1");
    expect(preparedAdmissionId("prep-1")).toBe("prep-1");
    expect(admissionTombstoneId("tomb-1")).toBe("tomb-1");
    expect(planDigest("{}")).toBe("{}");
  });
});
