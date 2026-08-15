import { describe, expect, it } from "vitest";
import { createActiveSchemaContext } from "../../../src/engine/activeSchemaContext.js";
import { createMutableSchemaContextHolder } from "../../../src/engine/memoryEpochAdministration.js";
import { resolveActiveSchemaContext } from "../../../src/engine/schemaContextProvider.js";
import { createDefaultSchema } from "../../../src/schema/defaultSchema.js";
import { epochId } from "@cantilune/core";

describe("resolveActiveSchemaContext", () => {
  it("returns direct active schema context", () => {
    const schema = createDefaultSchema();
    const context = createActiveSchemaContext(schema, epochId("42"));
    expect(resolveActiveSchemaContext({ schemaContext: context }).epochId).toBe("42");
  });

  it("reads from mutable schema holder", () => {
    const schema = createDefaultSchema();
    const holder = createMutableSchemaContextHolder(
      createActiveSchemaContext(schema, epochId("42")),
    );
    expect(resolveActiveSchemaContext({ schemaContext: holder }).schema.schemaId).toBe(
      schema.schemaId,
    );
  });
});
