import { describe, expect, it } from "vitest";
import { epochId, operationTemplateRef, operationTypeId } from "@cantilune/core";
import { applyRecipe } from "../../../src/execution/applyChange.js";
import { InMemoryHandlerRegistry } from "../../../src/execution/handlerRegistry.js";
import { replayRecipe } from "../../../src/replay/recipe.js";
import { defaultIntroduceTemplate } from "../../../src/schema/defaultSchema.js";
import { buildConfigT0 } from "@cantilune/test-fixtures";

describe("applyRecipe", () => {
  const ctx = { template: defaultIntroduceTemplate() };

  it("reports missing handler with explicit revision", () => {
    const registry = new InMemoryHandlerRegistry();
    const recipe = replayRecipe({
      epochId: epochId("42"),
      operationTypeId: operationTypeId("introduce_artifact"),
      templateRef: operationTemplateRef("introduce_artifact", "99"),
      matchBindings: [],
      visibility: "external",
    });
    const result = applyRecipe(buildConfigT0(), recipe, registry, ctx);
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.reason).toContain("@99");
  });

  it("reports missing handler with default revision label", () => {
    const registry = new InMemoryHandlerRegistry();
    const recipe = replayRecipe({
      epochId: epochId("42"),
      operationTypeId: operationTypeId("introduce_artifact"),
      matchBindings: [],
      visibility: "external",
    });
    const result = applyRecipe(buildConfigT0(), recipe, registry, ctx);
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.reason).toContain("@default");
  });
});
