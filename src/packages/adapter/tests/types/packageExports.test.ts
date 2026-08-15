import { describe, expect, it } from "vitest";
import { createAdapter, createEmbedder, getProvider, listProviders } from "../../src/index.js";

describe("@cantilune/adapter package exports", () => {
  it("exports createAdapter", () => {
    expect(createAdapter).toBeTypeOf("function");
  });

  it("exports createEmbedder", () => {
    expect(createEmbedder).toBeTypeOf("function");
  });

  it("exports getProvider", () => {
    expect(getProvider).toBeTypeOf("function");
  });

  it("exports listProviders", () => {
    expect(listProviders).toBeTypeOf("function");
    expect(listProviders().length).toBeGreaterThan(0);
  });

  it("resolves providers case-insensitively", () => {
    expect(getProvider("ANTHROPIC")?.slug).toBe("anthropic");
    expect(getProvider("Google")?.slug).toBe("google");
  });
});
