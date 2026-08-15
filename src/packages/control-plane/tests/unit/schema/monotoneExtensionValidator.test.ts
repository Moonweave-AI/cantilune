import { describe, expect, it } from "vitest";
import {
  buildOrchestrationSchema,
  defaultTemplates,
  operationDeclarationFromTemplate,
  type ObjectTypeDeclaration,
  type OperationTemplate,
  type OperationTypeDeclaration,
  type OrchestrationSchema,
} from "@cantilune/runtime";
import {
  objectTypeId,
  operationTypeId,
  operationTemplateRef,
  schemaRevisionId,
  type ObjectTypeId,
  type OperationTypeId,
} from "@cantilune/core";
import { computeMonotoneExtensionPlan } from "../../../src/schema/monotoneExtensionValidator.js";
import { createSchemaRevision } from "../../../src/schema/schemaRevision.js";

function cloneSchema(schema: OrchestrationSchema): OrchestrationSchema {
  return {
    ...schema,
    objectTypes: new Map(schema.objectTypes),
    operationTypes: new Map(schema.operationTypes),
    templates: [...schema.templates],
    resourceRules: [...schema.resourceRules],
  };
}

function refsFor(from: OrchestrationSchema, to: OrchestrationSchema) {
  const fromRevision = createSchemaRevision({
    schema: from,
    revisionId: schemaRevisionId("rev-from"),
    createdBy: "test",
    createdAt: "2026-08-11T00:00:00Z",
  });
  const toRevision = createSchemaRevision({
    schema: to,
    revisionId: schemaRevisionId("rev-to"),
    createdBy: "test",
    createdAt: "2026-08-11T00:00:01Z",
    parentRef: fromRevision.schemaRef,
  });
  return { fromRef: fromRevision.schemaRef, toRef: toRevision.schemaRef };
}

describe("monotone extension validator", () => {
  it("accepts additive operation extension", () => {
    const base = buildOrchestrationSchema("default-v1");
    const extendedTemplate: OperationTemplate = {
      ...defaultTemplates()[0]!,
      operationTypeId: operationTypeId("archive_artifact"),
      templateRef: operationTemplateRef("archive_artifact", "1"),
      description: "Archive artifact",
      requiredRoles: ["task", "from"],
      requires: [],
      ensures: [],
    };
    const extended = buildOrchestrationSchema("default-v1", [...base.templates, extendedTemplate]);
    const fromRevision = createSchemaRevision({
      schema: base,
      revisionId: schemaRevisionId("rev-001"),
      createdBy: "test",
      createdAt: "2026-08-11T00:00:00Z",
    });
    const toRevision = createSchemaRevision({
      schema: extended,
      revisionId: schemaRevisionId("rev-002"),
      createdBy: "test",
      createdAt: "2026-08-11T00:00:00Z",
      parentRef: fromRevision.schemaRef,
    });
    const plan = computeMonotoneExtensionPlan(
      base,
      extended,
      fromRevision.schemaRef,
      toRevision.schemaRef,
    );
    expect(plan.ok).toBe(true);
    if (!plan.ok) {
      return;
    }
    expect(plan.value.addedOperationTypeIds).toContain(operationTypeId("archive_artifact"));
  });

  it("rejects deleted operation declarations", () => {
    const base = buildOrchestrationSchema("default-v1");
    const shrunkTemplates = base.templates.filter(
      (template) => template.operationTypeId !== operationTypeId("delegate"),
    );
    const shrunk = buildOrchestrationSchema("default-v1", shrunkTemplates);
    const fromRevision = createSchemaRevision({
      schema: base,
      revisionId: schemaRevisionId("rev-001"),
      createdBy: "test",
      createdAt: "2026-08-11T00:00:00Z",
    });
    const toRevision = createSchemaRevision({
      schema: shrunk,
      revisionId: schemaRevisionId("rev-002"),
      createdBy: "test",
      createdAt: "2026-08-11T00:00:00Z",
    });
    const plan = computeMonotoneExtensionPlan(
      base,
      shrunk,
      fromRevision.schemaRef,
      toRevision.schemaRef,
    );
    expect(plan.ok).toBe(false);
    if (plan.ok) {
      return;
    }
    expect(plan.error.code).toBe("declaration_deleted");
  });

  it("rejects schema family mismatch", () => {
    const from = buildOrchestrationSchema("default-v1");
    const to = buildOrchestrationSchema("other-family");
    const { fromRef, toRef } = refsFor(from, to);
    const plan = computeMonotoneExtensionPlan(from, to, fromRef, toRef);
    expect(plan.ok).toBe(false);
    if (plan.ok) return;
    expect(plan.error.code).toBe("non_monotone_extension");
  });

  it("rejects deleted or redefined object types", () => {
    const from = buildOrchestrationSchema("default-v1");
    const deleted = cloneSchema(from);
    (deleted.objectTypes as Map<ObjectTypeId, ObjectTypeDeclaration>).delete(
      objectTypeId("artifact"),
    );
    const { fromRef, toRef } = refsFor(from, deleted);
    const deletedPlan = computeMonotoneExtensionPlan(from, deleted, fromRef, toRef);
    expect(deletedPlan.ok).toBe(false);
    if (!deletedPlan.ok) {
      expect(deletedPlan.error.code).toBe("declaration_deleted");
    }

    const redefined = cloneSchema(from);
    const artifact = redefined.objectTypes.get(objectTypeId("artifact"))!;
    (redefined.objectTypes as Map<ObjectTypeId, ObjectTypeDeclaration>).set(
      objectTypeId("artifact"),
      { ...artifact, description: "changed" },
    );
    const refs2 = refsFor(from, redefined);
    const redefinedPlan = computeMonotoneExtensionPlan(from, redefined, refs2.fromRef, refs2.toRef);
    expect(redefinedPlan.ok).toBe(false);
    if (!redefinedPlan.ok) {
      expect(redefinedPlan.error.code).toBe("declaration_redefined");
    }
  });

  it("rejects port contract and template drift on operations", () => {
    const from = buildOrchestrationSchema("default-v1");
    const opId = operationTypeId("introduce_artifact");

    const changedTemplate: OperationTemplate = {
      ...from.templates.find((t) => t.operationTypeId === opId)!,
      requires: [{ kind: "task.exists", bindings: { task: "task" } }],
    };
    const portChangedOps = new Map(from.operationTypes) as Map<
      OperationTypeId,
      OperationTypeDeclaration
    >;
    portChangedOps.set(opId, operationDeclarationFromTemplate(changedTemplate));
    const portChanged = {
      ...cloneSchema(from),
      templates: from.templates.map((t) => (t.operationTypeId === opId ? changedTemplate : t)),
      operationTypes: portChangedOps,
    };
    const portRefs = refsFor(from, portChanged);
    const portPlan = computeMonotoneExtensionPlan(
      from,
      portChanged,
      portRefs.fromRef,
      portRefs.toRef,
    );
    expect(portPlan.ok).toBe(false);
    if (!portPlan.ok) {
      expect(portPlan.error.code).toBe("port_contract_changed");
    }

    const revisionDriftOps = new Map(from.operationTypes) as Map<
      OperationTypeId,
      OperationTypeDeclaration
    >;
    const driftDecl = revisionDriftOps.get(opId)!;
    revisionDriftOps.set(opId, {
      ...driftDecl,
      templateRef: operationTemplateRef("introduce_artifact", "2"),
    });
    const revisionDrift = { ...cloneSchema(from), operationTypes: revisionDriftOps };
    const driftRefs = refsFor(from, revisionDrift);
    const driftPlan = computeMonotoneExtensionPlan(
      from,
      revisionDrift,
      driftRefs.fromRef,
      driftRefs.toRef,
    );
    expect(driftPlan.ok).toBe(false);
    if (!driftPlan.ok) {
      expect(driftPlan.error.code).toBe("template_missing");
    }
  });

  it("rejects operation declaration field drift", () => {
    const from = buildOrchestrationSchema("default-v1");
    const opId = operationTypeId("introduce_artifact");
    const rolesChangedOps = new Map(from.operationTypes) as Map<
      OperationTypeId,
      OperationTypeDeclaration
    >;
    const decl = rolesChangedOps.get(opId)!;
    rolesChangedOps.set(opId, { ...decl, requiredRoles: ["task"] });
    const rolesChanged = { ...cloneSchema(from), operationTypes: rolesChangedOps };
    const rolesRefs = refsFor(from, rolesChanged);
    const rolesPlan = computeMonotoneExtensionPlan(
      from,
      rolesChanged,
      rolesRefs.fromRef,
      rolesRefs.toRef,
    );
    expect(rolesPlan.ok).toBe(false);
    if (!rolesPlan.ok) {
      expect(rolesPlan.error.code).toBe("declaration_redefined");
    }

    const visibilityChangedOps = new Map(from.operationTypes) as Map<
      OperationTypeId,
      OperationTypeDeclaration
    >;
    const visDecl = visibilityChangedOps.get(opId)!;
    visibilityChangedOps.set(opId, { ...visDecl, defaultVisibility: "internal" });
    const visibilityChanged = { ...cloneSchema(from), operationTypes: visibilityChangedOps };
    const visRefs = refsFor(from, visibilityChanged);
    const visPlan = computeMonotoneExtensionPlan(
      from,
      visibilityChanged,
      visRefs.fromRef,
      visRefs.toRef,
    );
    expect(visPlan.ok).toBe(false);
    if (!visPlan.ok) {
      expect(visPlan.error.code).toBe("declaration_redefined");
    }

    const sessionChangedOps = new Map(from.operationTypes) as Map<
      OperationTypeId,
      OperationTypeDeclaration
    >;
    const sessDecl = sessionChangedOps.get(opId)!;
    sessionChangedOps.set(opId, { ...sessDecl, mayCreateSessions: true });
    const sessionChanged = { ...cloneSchema(from), operationTypes: sessionChangedOps };
    const sessRefs = refsFor(from, sessionChanged);
    const sessPlan = computeMonotoneExtensionPlan(
      from,
      sessionChanged,
      sessRefs.fromRef,
      sessRefs.toRef,
    );
    expect(sessPlan.ok).toBe(false);
    if (!sessPlan.ok) {
      expect(sessPlan.error.code).toBe("declaration_redefined");
    }
  });

  it("rejects template snapshot drift and missing templates", () => {
    const from = buildOrchestrationSchema("default-v1");
    const opId = operationTypeId("introduce_artifact");

    const missingTemplate = {
      ...cloneSchema(from),
      templates: from.templates.filter((t) => t.operationTypeId !== opId),
    };
    const missingRefs = refsFor(from, missingTemplate);
    const missingPlan = computeMonotoneExtensionPlan(
      from,
      missingTemplate,
      missingRefs.fromRef,
      missingRefs.toRef,
    );
    expect(missingPlan.ok).toBe(false);
    if (!missingPlan.ok) {
      expect(missingPlan.error.code).toBe("template_missing");
    }

    const descriptionChanged = {
      ...cloneSchema(from),
      templates: from.templates.map((t) =>
        t.operationTypeId === opId ? { ...t, description: "changed description" } : t,
      ),
    };
    const descRefs = refsFor(from, descriptionChanged);
    const descPlan = computeMonotoneExtensionPlan(
      from,
      descriptionChanged,
      descRefs.fromRef,
      descRefs.toRef,
    );
    expect(descPlan.ok).toBe(false);
    if (!descPlan.ok) {
      expect(descPlan.error.code).toBe("declaration_redefined");
    }

    const requiresChanged = {
      ...cloneSchema(from),
      templates: from.templates.map((t) =>
        t.operationTypeId === opId ? { ...t, requires: [] } : t,
      ),
    };
    const reqRefs = refsFor(from, requiresChanged);
    const reqPlan = computeMonotoneExtensionPlan(
      from,
      requiresChanged,
      reqRefs.fromRef,
      reqRefs.toRef,
    );
    expect(reqPlan.ok).toBe(false);
    if (!reqPlan.ok) {
      expect(reqPlan.error.code).toBe("declaration_redefined");
    }

    const ensuresChanged = {
      ...cloneSchema(from),
      templates: from.templates.map((t) =>
        t.operationTypeId === opId ? { ...t, ensures: [] } : t,
      ),
    };
    const ensRefs = refsFor(from, ensuresChanged);
    const ensPlan = computeMonotoneExtensionPlan(
      from,
      ensuresChanged,
      ensRefs.fromRef,
      ensRefs.toRef,
    );
    expect(ensPlan.ok).toBe(false);
    if (!ensPlan.ok) {
      expect(ensPlan.error.code).toBe("declaration_redefined");
    }
  });

  it("rejects resource rule changes", () => {
    const from = buildOrchestrationSchema("default-v1");
    const rule = {
      ruleId: "r1",
      structuralMode: "affine" as const,
      allowsCopy: true,
      allowsDrop: false,
      requiresQuiescence: false,
    };
    const withRules = { ...cloneSchema(from), resourceRules: [rule] };
    const countChanged = {
      ...withRules,
      resourceRules: [
        ...withRules.resourceRules,
        {
          ruleId: "r2",
          structuralMode: "linear" as const,
          allowsCopy: false,
          allowsDrop: true,
          requiresQuiescence: true,
        },
      ],
    };
    const countRefs = refsFor(withRules, countChanged);
    const countPlan = computeMonotoneExtensionPlan(
      withRules,
      countChanged,
      countRefs.fromRef,
      countRefs.toRef,
    );
    expect(countPlan.ok).toBe(false);
    if (!countPlan.ok) {
      expect(countPlan.error.code).toBe("declaration_redefined");
    }

    const valueChanged = {
      ...withRules,
      resourceRules: [{ ...rule, allowsCopy: false }],
    };
    const valueRefs = refsFor(withRules, valueChanged);
    const valuePlan = computeMonotoneExtensionPlan(
      withRules,
      valueChanged,
      valueRefs.fromRef,
      valueRefs.toRef,
    );
    expect(valuePlan.ok).toBe(false);
    if (!valuePlan.ok) {
      expect(valuePlan.error.code).toBe("declaration_redefined");
    }
  });
});
