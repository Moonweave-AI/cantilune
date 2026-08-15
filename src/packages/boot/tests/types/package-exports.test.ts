import { describe, it, expect } from "vitest";
import * as bootExports from "../../src/index.js";

describe("@cantilune/boot package exports", () => {
  it("exports bootCantilune", () => {
    expect(bootExports.bootCantilune).toBeTypeOf("function");
  });

  it("exports bootMemoryOS", () => {
    expect(bootExports.bootMemoryOS).toBeTypeOf("function");
  });

  it("exports bootFileOS", () => {
    expect(bootExports.bootFileOS).toBeTypeOf("function");
  });

  it("exports runAgentLoop", () => {
    expect(bootExports.runAgentLoop).toBeTypeOf("function");
  });

  it("exports createAgentLoopHistory", () => {
    expect(bootExports.createAgentLoopHistory).toBeTypeOf("function");
  });

  it("exports strict private-history validation", () => {
    expect(bootExports.requireAgentLoopHistory).toBeTypeOf("function");
  });

  it("exports createTerminationController", () => {
    expect(bootExports.createTerminationController).toBeTypeOf("function");
  });

  it("exports mergeToolExecutors", () => {
    expect(bootExports.mergeToolExecutors).toBeTypeOf("function");
  });

  it("exports DEFAULT_TEMPLATES array", () => {
    expect(Array.isArray(bootExports.DEFAULT_TEMPLATES)).toBe(true);
    expect(bootExports.DEFAULT_TEMPLATES.length).toBeGreaterThan(0);
  });
});
