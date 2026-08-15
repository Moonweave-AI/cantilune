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
} from "@cantilune/core";
import {
  createStaticSchemaResolver,
  schemaLookupKey,
} from "../../../src/ports/runtimeSchemaResolver.js";
import { createDefaultSchema } from "../../../src/schema/defaultSchema.js";
import { schemaContentDigest } from "../../../src/schema/schemaContentDigest.js";

describe("createStaticSchemaResolver", () => {
  const schema = createDefaultSchema();
  const binding = {
    activationDomainId: activationDomainId("default"),
    bindingGeneration: bindingGeneration(1),
    epochId: epochId("42"),
    epochOrdinal: epochOrdinal(1),
    schemaRef: {
      schemaId: schema.schemaId,
      revisionId: schemaRevisionId("rev-001"),
      digest: schemaContentDigest(schema),
    },
    policyRef: policyRef(policyId("p"), policyRevisionId("1"), contentDigest("p1")),
    handlerManifestRef: handlerManifestRef(handlerManifestId("h"), handlerManifestDigest("h1")),
    runtimeHead: "snap-S0" as never,
    admissionId: schemaAdmissionId("bootstrap"),
    activatedBy: "bootstrap",
    activatedAt: "2026-08-11T00:00:00Z",
  };

  const resolver = createStaticSchemaResolver({
    domainId: activationDomainId("default"),
    binding,
    schemas: new Map([[schemaLookupKey(binding.schemaRef), schema]]),
  });

  it("returns binding for matching domain", async () => {
    const active = await resolver.active(activationDomainId("default"));
    expect(active?.epochId).toBe("42");
  });

  it("returns undefined for unknown domain", async () => {
    expect(await resolver.active(activationDomainId("other"))).toBeUndefined();
  });

  it("resolves a schema only by its complete immutable ref key", async () => {
    const resolved = await resolver.resolveSchema(binding.schemaRef);
    expect(resolved).not.toBe(schema);
    expect(resolved?.schemaId).toBe(schema.schemaId);
    expect([...resolved!.operationTypes.keys()]).toEqual([...schema.operationTypes.keys()]);

    const wrongRevision = await resolver.resolveSchema({
      ...binding.schemaRef,
      revisionId: schemaRevisionId("rev-other"),
    });
    const wrongDigest = await resolver.resolveSchema({
      ...binding.schemaRef,
      digest: schemaDigest("digest-other"),
    });
    expect(wrongRevision).toBeUndefined();
    expect(wrongDigest).toBeUndefined();
  });

  it("returns undefined for unknown schema ref", async () => {
    const resolved = await resolver.resolveSchema({
      schemaId: schemaId("missing"),
      revisionId: schemaRevisionId("rev-x"),
      digest: schemaDigest("x"),
    });
    expect(resolved).toBeUndefined();
  });

  it("resolves binding by epoch within domain", async () => {
    const byEpoch = await resolver.resolveByEpoch(activationDomainId("default"), epochId("42"));
    expect(byEpoch?.bindingGeneration).toBe(1);
    expect(
      await resolver.resolveByEpoch(activationDomainId("default"), epochId("99")),
    ).toBeUndefined();
    expect(
      await resolver.resolveByEpoch(activationDomainId("other"), epochId("42")),
    ).toBeUndefined();
  });

  it("detaches and freezes binding and schema values at construction", async () => {
    const mutableSchema = createDefaultSchema("mutable-schema");
    const mutableBinding = {
      ...binding,
      schemaRef: {
        schemaId: mutableSchema.schemaId,
        revisionId: schemaRevisionId("mutable-rev"),
        digest: schemaContentDigest(mutableSchema),
      },
      policyRef: { ...binding.policyRef },
      handlerManifestRef: { ...binding.handlerManifestRef },
    };
    const originalRef = { ...mutableBinding.schemaRef };
    const originalOperationCount = mutableSchema.operationTypes.size;
    const schemas = new Map([[schemaLookupKey(originalRef), mutableSchema]]);
    const isolatedResolver = createStaticSchemaResolver({
      domainId: mutableBinding.activationDomainId,
      binding: mutableBinding,
      schemas,
    });

    Object.assign(mutableBinding, { epochId: epochId("mutated-epoch") });
    Object.assign(mutableBinding.schemaRef, { digest: schemaDigest("mutated-digest") });
    Object.assign(mutableSchema, { wireVersion: 999 });
    (mutableSchema.operationTypes as Map<unknown, unknown>).clear();
    schemas.clear();

    const active = await isolatedResolver.active(activationDomainId("default"));
    const resolved = await isolatedResolver.resolveSchema(originalRef);
    expect(active?.epochId).toBe(epochId("42"));
    expect(active?.schemaRef.digest).toBe(originalRef.digest);
    expect(Object.isFrozen(active)).toBe(true);
    expect(Object.isFrozen(active?.schemaRef)).toBe(true);
    expect(resolved?.wireVersion).toBe(1);
    expect(resolved?.operationTypes.size).toBe(originalOperationCount);
    expect(Object.isFrozen(resolved)).toBe(true);
    expect(() => Object.assign(resolved!, { wireVersion: 2 })).toThrow(TypeError);
    expect((resolved?.operationTypes as { set?: unknown }).set).toBeUndefined();
  });
});
