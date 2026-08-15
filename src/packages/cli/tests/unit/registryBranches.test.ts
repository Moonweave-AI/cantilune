import { describe, it, expect } from "vitest";
import { createCommandRegistry } from "../../src/commands/registry.js";

describe("registry branch coverage", () => {
  it("covers boolean flag without value and bare flag assignment", () => {
    const registry = createCommandRegistry();
    registry.register({
      name: "/flags",
      description: "flaggy",
      category: "view",
      args: [
        { name: "verbose", description: "v", required: false, type: "boolean" },
        { name: "tag", description: "t", required: false, type: "string" },
      ],
      handler: () => undefined,
    });

    expect(registry.parse("/flags --verbose --tag")?.args.verbose).toBe(true);
    expect(registry.parse("/flags --tag=")?.args.tag).toBe("");
  });

  it("covers required flag validation after positional parsing", () => {
    const registry = createCommandRegistry();
    registry.register({
      name: "/need-flag",
      description: "needs flag",
      category: "view",
      args: [{ name: "--format", description: "fmt", required: true, type: "string" }],
      handler: () => undefined,
    });
    expect(() => registry.parse("/need-flag")).toThrow(/Missing required argument/);
  });

  it("covers invalid boolean flag parsing", () => {
    const registry = createCommandRegistry();
    registry.register({
      name: "/bool",
      description: "bool",
      category: "view",
      args: [{ name: "flag", description: "f", required: true, type: "boolean" }],
      handler: () => undefined,
    });
    expect(() => registry.parse("/bool maybe")).toThrow(/Expected boolean/);
  });

  it("covers flag without schema uses raw string", () => {
    const registry = createCommandRegistry();
    registry.register({
      name: "/raw",
      description: "raw flag",
      category: "view",
      handler: () => undefined,
    });
    expect(registry.parse("/raw --extra=val")?.args.extra).toBe("val");
  });

  it("covers fuzzy find scoring edge cases", () => {
    const registry = createCommandRegistry();
    registry.register({
      name: "/alpha",
      description: "beta gamma",
      category: "view",
      handler: () => undefined,
    });
    expect(registry.find("beta gamma")[0]?.name).toBe("/alpha");
    expect(registry.find("zzz")).toHaveLength(0);
  });

  it("covers boolean flag with following flag token", () => {
    const registry = createCommandRegistry();
    registry.register({
      name: "/flags",
      description: "flags",
      category: "view",
      args: [{ name: "verbose", description: "v", required: false, type: "boolean" }],
      handler: () => undefined,
    });
    expect(registry.parse("/flags --verbose --other")?.args.verbose).toBe(true);
  });

  it("scores exact command name matches highest", () => {
    const registry = createCommandRegistry();
    registry.register({
      name: "/exact",
      description: "desc",
      category: "view",
      handler: () => undefined,
    });
    registry.register({
      name: "/exactly",
      description: "desc",
      category: "view",
      handler: () => undefined,
    });
    expect(registry.find("/exact")[0]?.name).toBe("/exact");
  });

  it("normalizes registered command names without leading slash", () => {
    const registry = createCommandRegistry();
    registry.register({
      name: "world",
      description: "no slash",
      category: "view",
      handler: () => undefined,
    });
    expect(registry.getAll()[0]?.name).toBe("/world");
  });

  it("sets string flag to true when value token missing", () => {
    const registry = createCommandRegistry();
    registry.register({
      name: "/s",
      description: "s",
      category: "view",
      args: [{ name: "tag", description: "t", required: false, type: "string" }],
      handler: () => undefined,
    });
    expect(registry.parse("/s --tag")?.args.tag).toBe(true);
  });

  it("assigns unknown flag value from following token", () => {
    const registry = createCommandRegistry();
    registry.register({
      name: "/raw",
      description: "raw flag",
      category: "view",
      handler: () => undefined,
    });
    expect(registry.parse("/raw --extra val")?.args.extra).toBe("val");
  });

  it("scores substring matches in command names", () => {
    const registry = createCommandRegistry();
    registry.register({
      name: "/foobar",
      description: "desc",
      category: "view",
      handler: () => undefined,
    });
    expect(registry.find("bar")[0]?.name).toBe("/foobar");
  });

  it("returns null for non-slash input and empty command token edge cases", () => {
    const registry = createCommandRegistry();
    registry.register({
      name: "/ok",
      description: "ok",
      category: "view",
      handler: () => undefined,
    });
    expect(registry.parse("hello")).toBeNull();
    expect(registry.parse("/missing")).toBeNull();
    expect(registry.find("")[0]?.name).toBe("/ok");
  });

  it("throws when required positional argument is missing", () => {
    const registry = createCommandRegistry();
    registry.register({
      name: "/pos",
      description: "positional",
      category: "view",
      args: [{ name: "target", description: "t", required: true, type: "string" }],
      handler: () => undefined,
    });
    expect(() => registry.parse("/pos")).toThrow(/Missing required argument: target/);
  });
});
