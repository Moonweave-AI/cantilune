import { describe, expect, it } from "vitest";
import { operationTypeId, operationTemplateRef } from "@cantilune/core";
import { InMemoryTemplateRegistry } from "../../../src/schema/templateRegistry.js";
import { defaultIntroduceTemplate } from "../../../src/schema/defaultSchema.js";
import type { OperationTemplate } from "../../../src/schema/operationTemplate.js";

describe("InMemoryTemplateRegistry", () => {
  const v1 = defaultIntroduceTemplate();
  const v2: OperationTemplate = {
    ...v1,
    templateRef: operationTemplateRef("introduce_artifact", "2"),
    description: "v2",
  };

  it("registers and resolves by revision", () => {
    const registry = new InMemoryTemplateRegistry();
    registry.register(v1);
    registry.register(v2);
    expect(registry.get(operationTypeId("introduce_artifact"), "1")?.description).toBe(
      v1.description,
    );
    expect(registry.get(operationTypeId("introduce_artifact"), "2")?.description).toBe("v2");
    expect(registry.get(operationTypeId("introduce_artifact"))?.templateRef.revision).toBe("1");
  });

  it("lists unique templates", () => {
    const registry = new InMemoryTemplateRegistry();
    registry.register(v1);
    registry.register(v2);
    expect(registry.list()).toHaveLength(2);
  });

  it("returns undefined for unknown operation", () => {
    const registry = new InMemoryTemplateRegistry();
    expect(registry.get(operationTypeId("delegate"))).toBeUndefined();
  });
});
