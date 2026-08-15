import { describe, expect, it } from "vitest";
import {
  activationDomainId,
  bindingGeneration,
  contentDigest,
  epochId,
  epochOrdinal,
  handlerManifestDigest,
  handlerManifestId,
  handlerManifestRef,
  policyId,
  policyRef,
  policyRevisionId,
  schemaAdmissionId,
  schemaDigest,
  schemaId,
  schemaRevisionId,
  snapshotRef,
  type SchemaEpochBinding,
} from "@cantilune/core";
import {
  parseSchemaBindingWire,
  serializeSchemaBindingWire,
} from "../../../src/codec/bindingWire.js";

function validBinding(overrides: Partial<SchemaEpochBinding> = {}): SchemaEpochBinding {
  return {
    activationDomainId: activationDomainId("default"),
    bindingGeneration: bindingGeneration(2),
    epochId: epochId("43"),
    epochOrdinal: epochOrdinal(2),
    schemaRef: {
      schemaId: schemaId("schema-1"),
      revisionId: schemaRevisionId("rev-1"),
      digest: schemaDigest("d"),
    },
    policyRef: policyRef(policyId("p"), policyRevisionId("1"), contentDigest("pd")),
    handlerManifestRef: handlerManifestRef(handlerManifestId("h"), handlerManifestDigest("hd")),
    runtimeHead: snapshotRef("snap-S0"),
    admissionId: schemaAdmissionId("adm-1"),
    previousBindingGeneration: bindingGeneration(1),
    activatedBy: "bootstrap",
    activatedAt: "2026-08-14T00:00:00Z",
    ...overrides,
  };
}

describe("SchemaBindingWire codec", () => {
  it("round-trips a binding with previousBindingGeneration", () => {
    const binding = validBinding();
    const wire = serializeSchemaBindingWire(binding);
    const parsed = parseSchemaBindingWire(wire);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.epochId).toBe(epochId("43"));
    expect(parsed.value.bindingGeneration).toBe(bindingGeneration(2));
    expect(parsed.value.previousBindingGeneration).toBe(bindingGeneration(1));
    expect(parsed.value.schemaRef.schemaId).toBe(schemaId("schema-1"));
    expect(parsed.value.admissionId).toBe(schemaAdmissionId("adm-1"));
  });

  it("round-trips a binding without previousBindingGeneration", () => {
    const binding = validBinding();
    const { previousBindingGeneration: _omit, ...rest } = binding;
    const withoutPrev = rest as SchemaEpochBinding;
    const wire = serializeSchemaBindingWire(withoutPrev);
    expect(wire.previousBindingGeneration).toBeUndefined();
    const parsed = parseSchemaBindingWire(wire);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.previousBindingGeneration).toBeUndefined();
  });

  it("rejects non-object input", () => {
    const parsed = parseSchemaBindingWire(null);
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.violation.code).toBe("codec_invalid");
  });

  it("rejects a missing required string field", () => {
    const wire = serializeSchemaBindingWire(validBinding()) as unknown as Record<string, unknown>;
    delete wire.admissionId;
    const parsed = parseSchemaBindingWire(wire);
    expect(parsed.ok).toBe(false);
  });

  it("rejects an empty string field", () => {
    const wire = serializeSchemaBindingWire(validBinding()) as unknown as Record<string, unknown>;
    wire.activatedBy = "";
    const parsed = parseSchemaBindingWire(wire);
    expect(parsed.ok).toBe(false);
  });

  it("rejects a non-finite bindingGeneration", () => {
    const wire = serializeSchemaBindingWire(validBinding()) as unknown as Record<string, unknown>;
    wire.bindingGeneration = Number.POSITIVE_INFINITY;
    const parsed = parseSchemaBindingWire(wire);
    expect(parsed.ok).toBe(false);
  });

  it("rejects a malformed schemaRef", () => {
    const wire = serializeSchemaBindingWire(validBinding()) as unknown as Record<string, unknown>;
    wire.schemaRef = "not-an-object";
    const parsed = parseSchemaBindingWire(wire);
    expect(parsed.ok).toBe(false);
  });

  it("rejects a schemaRef missing a field", () => {
    const wire = serializeSchemaBindingWire(validBinding()) as unknown as Record<string, unknown>;
    const ref = wire.schemaRef as Record<string, unknown>;
    delete ref.digest;
    const parsed = parseSchemaBindingWire(wire);
    expect(parsed.ok).toBe(false);
  });

  it("rejects a malformed policyRef", () => {
    const wire = serializeSchemaBindingWire(validBinding()) as unknown as Record<string, unknown>;
    wire.policyRef = { policyId: "p" };
    const parsed = parseSchemaBindingWire(wire);
    expect(parsed.ok).toBe(false);
  });

  it("rejects a malformed handlerManifestRef", () => {
    const wire = serializeSchemaBindingWire(validBinding()) as unknown as Record<string, unknown>;
    wire.handlerManifestRef = null;
    const parsed = parseSchemaBindingWire(wire);
    expect(parsed.ok).toBe(false);
  });

  it("rejects a non-finite previousBindingGeneration when present", () => {
    const wire = serializeSchemaBindingWire(validBinding()) as unknown as Record<string, unknown>;
    wire.previousBindingGeneration = "two";
    const parsed = parseSchemaBindingWire(wire);
    expect(parsed.ok).toBe(false);
  });

  it("accepts a present finite previousBindingGeneration", () => {
    const wire = serializeSchemaBindingWire(validBinding()) as unknown as Record<string, unknown>;
    wire.previousBindingGeneration = 1;
    const parsed = parseSchemaBindingWire(wire);
    expect(parsed.ok).toBe(true);
  });
});
