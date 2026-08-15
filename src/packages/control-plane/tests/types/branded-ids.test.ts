import { describe, expect, it } from "vitest";
import { bindingGeneration, epochOrdinal, schemaId, schemaRevisionId } from "@cantilune/core";

describe("control-plane branded ids", () => {
  it("keeps schema revision distinct from binding generation", () => {
    const revision = schemaRevisionId("rev-001");
    const generation = bindingGeneration(2);
    expect(revision).not.toBe(generation);
    expect(typeof revision).toBe("string");
    expect(typeof generation).toBe("number");
  });

  it("keeps epoch ordinal as numeric brand", () => {
    const ordinal = epochOrdinal(3);
    expect(ordinal as number).toBe(3);
    expect(schemaId("default-v1")).toBe("default-v1");
  });
});
