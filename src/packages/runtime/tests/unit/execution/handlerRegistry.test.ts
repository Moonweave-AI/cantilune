import { describe, expect, it } from "vitest";
import { operationTypeId } from "@cantilune/core";
import { InMemoryHandlerRegistry } from "../../../src/execution/handlerRegistry.js";
import { introduceArtifactHandler } from "../../../src/execution/handlers/introduceArtifact.js";

describe("InMemoryHandlerRegistry", () => {
  it("registers revision-specific handlers with default fallback", () => {
    const registry = new InMemoryHandlerRegistry();
    registry.register(operationTypeId("introduce_artifact"), introduceArtifactHandler, "2");
    expect(registry.get(operationTypeId("introduce_artifact"), "2")).toBe(introduceArtifactHandler);
    expect(registry.get(operationTypeId("introduce_artifact"))).toBe(introduceArtifactHandler);
    expect(registry.get(operationTypeId("introduce_artifact"), "1")).toBeUndefined();
  });
});
