import { describe, it, expect } from "vitest";
import * as syscallExports from "../../src/index.js";

describe("@cantilune/syscall package exports", () => {
  it("exports createSyscall", () => {
    expect(syscallExports.createSyscall).toBeTypeOf("function");
  });

  it("exports createStaticSchemaProvider", () => {
    expect(syscallExports.createStaticSchemaProvider).toBeTypeOf("function");
  });

  it("exports schemasFromTemplates", () => {
    expect(syscallExports.schemasFromTemplates).toBeTypeOf("function");
  });

  it("exports mergeWithToolSchemas", () => {
    expect(syscallExports.mergeWithToolSchemas).toBeTypeOf("function");
  });

  it("exports external-tool observation recovery helpers", () => {
    expect(syscallExports.retryToolObservation).toBeTypeOf("function");
    expect(syscallExports.toolArgumentsDigest).toBeTypeOf("function");
  });
});
