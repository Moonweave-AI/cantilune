import { describe, expect, it } from "vitest";
import { objectTypeId, schemaId, schemaRevisionId } from "@cantilune/core";
import {
  buildOrchestrationSchema,
  type ObjectTypeDeclaration,
  type OperationTypeDeclaration,
  type OrchestrationSchema,
} from "@cantilune/runtime";
import {
  createSchemaRevision,
  revisionKey,
  sameSchemaFamily,
  verifySchemaRevisionIntegrity,
} from "../../../src/schema/schemaRevision.js";

describe("schema revision helpers", () => {
  it("creates revision with optional parent and provenance", () => {
    const base = buildOrchestrationSchema("default-v1");
    const parent = createSchemaRevision({
      schema: base,
      revisionId: schemaRevisionId("rev-parent"),
      createdBy: "author",
      createdAt: "2026-08-11T00:00:00Z",
    });
    const child = createSchemaRevision({
      schema: base,
      revisionId: schemaRevisionId("rev-child"),
      parentRef: parent.schemaRef,
      provenanceEvidence: ["evidence://1"],
      createdBy: "author",
      createdAt: "2026-08-11T00:01:00Z",
    });
    expect(child.parentRef).toEqual(parent.schemaRef);
    expect(child.provenanceEvidence).toEqual(["evidence://1"]);
    expect(revisionKey(child.schemaRef)).toBe("default-v1@rev-child");
    expect(sameSchemaFamily(schemaId("default-v1"), schemaId("default-v1"))).toBe(true);
    expect(verifySchemaRevisionIntegrity(child)).toBe(true);
  });

  it("deeply detaches the authoritative schema from mutable constructor input", () => {
    const base = buildOrchestrationSchema("mutable-input");
    const firstObjectKey = [...base.objectTypes.keys()][0]!;
    const firstOperationKey = [...base.operationTypes.keys()][0]!;
    const sourceObject: ObjectTypeDeclaration = {
      ...base.objectTypes.get(firstObjectKey)!,
      metadata: { owner: "original" },
    };
    const sourceOperation: OperationTypeDeclaration = {
      ...base.operationTypes.get(firstOperationKey)!,
      templateRef: { ...base.operationTypes.get(firstOperationKey)!.templateRef },
      requiredRoles: [...base.operationTypes.get(firstOperationKey)!.requiredRoles],
      portContract: {
        ...base.operationTypes.get(firstOperationKey)!.portContract,
        inputs: [...base.operationTypes.get(firstOperationKey)!.portContract.inputs],
        outputs: [...base.operationTypes.get(firstOperationKey)!.portContract.outputs],
        requires: base.operationTypes
          .get(firstOperationKey)!
          .portContract.requires.map((condition) => ({
            ...condition,
            bindings: { ...condition.bindings },
          })),
        ensures: base.operationTypes
          .get(firstOperationKey)!
          .portContract.ensures.map((condition) => ({
            ...condition,
            bindings: { ...condition.bindings },
          })),
      },
    };
    const sourceTemplate = {
      ...base.templates[0]!,
      templateRef: { ...base.templates[0]!.templateRef },
      requiredRoles: [...base.templates[0]!.requiredRoles],
      requires: base.templates[0]!.requires.map((condition) => ({
        ...condition,
        bindings: { ...condition.bindings },
      })),
      ensures: base.templates[0]!.ensures.map((condition) => ({
        ...condition,
        bindings: { ...condition.bindings },
      })),
    };
    const sourceRule = {
      ruleId: "rule-1",
      objectTypeId: objectTypeId("artifact"),
      structuralMode: "affine" as const,
      capacity: 3,
      allowsCopy: false,
      allowsDrop: true,
      requiresQuiescence: false,
    };
    const source: OrchestrationSchema = {
      ...base,
      objectTypes: new Map(base.objectTypes).set(firstObjectKey, sourceObject),
      operationTypes: new Map(base.operationTypes).set(firstOperationKey, sourceOperation),
      templates: [sourceTemplate, ...base.templates.slice(1)],
      resourceRules: [sourceRule],
    };
    const revision = createSchemaRevision({
      schema: source,
      revisionId: schemaRevisionId("rev-detached"),
      provenanceEvidence: ["evidence://original"],
      createdBy: "author",
      createdAt: "2026-08-11T00:00:00Z",
    });
    const digest = revision.canonicalDigest;

    (source.objectTypes as Map<unknown, unknown>).clear();
    (source.operationTypes as Map<unknown, unknown>).clear();
    (source.templates as (typeof sourceTemplate)[]).length = 0;
    (source.resourceRules as (typeof sourceRule)[]).length = 0;
    (sourceObject.metadata as Record<string, string>).owner = "mutated";
    (sourceOperation.requiredRoles as string[]).push("mutated");
    (sourceOperation.portContract.requires[0]!.bindings as Record<string, string>).participant =
      "mutated";
    (sourceTemplate.requires[0]!.bindings as Record<string, string>).participant = "mutated";
    sourceRule.capacity = 999;

    expect(revision.schema.objectTypes.get(firstObjectKey)?.metadata.owner).toBe("original");
    expect(revision.schema.operationTypes.get(firstOperationKey)?.requiredRoles).not.toContain(
      "mutated",
    );
    expect(
      revision.schema.operationTypes.get(firstOperationKey)?.portContract.requires[0]?.bindings
        .participant,
    ).not.toBe("mutated");
    expect(revision.schema.templates[0]?.requires[0]?.bindings.participant).not.toBe("mutated");
    expect(revision.schema.resourceRules[0]?.capacity).toBe(3);
    expect(revision.canonicalDigest).toBe(digest);
    expect(verifySchemaRevisionIntegrity(revision)).toBe(true);
  });

  it("exposes schema maps without mutable Map methods", () => {
    const revision = createSchemaRevision({
      schema: buildOrchestrationSchema("readonly-map"),
      revisionId: schemaRevisionId("rev-readonly-map"),
      createdBy: "author",
      createdAt: "2026-08-11T00:00:00Z",
    });
    const objectCount = revision.schema.objectTypes.size;
    const operationCount = revision.schema.operationTypes.size;

    expect(() => (revision.schema.objectTypes as unknown as Map<unknown, unknown>).clear()).toThrow(
      TypeError,
    );
    expect(() =>
      (revision.schema.operationTypes as unknown as Map<unknown, unknown>).clear(),
    ).toThrow(TypeError);
    expect(revision.schema.objectTypes.size).toBe(objectCount);
    expect(revision.schema.operationTypes.size).toBe(operationCount);
  });
});
