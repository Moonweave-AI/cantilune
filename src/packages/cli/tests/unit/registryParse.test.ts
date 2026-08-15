import { describe, it, expect } from "vitest";
import { createCommandRegistry } from "../../src/commands/registry.js";

describe("registry parse edge cases", () => {
  it("rejects duplicate command registration", () => {
    const registry = createCommandRegistry();
    registry.register({
      name: "/dup",
      description: "one",
      category: "view",
      handler: () => undefined,
    });
    expect(() =>
      registry.register({
        name: "/dup",
        description: "two",
        category: "view",
        handler: () => undefined,
      }),
    ).toThrow(/already registered/);
  });

  it("parses boolean and flag=value forms", () => {
    const registry = createCommandRegistry();
    registry.register({
      name: "/flaggy",
      description: "flags",
      category: "view",
      args: [
        { name: "verbose", description: "Verbose", required: false, type: "boolean" },
        { name: "count", description: "Count", required: false, type: "number" },
      ],
      handler: () => undefined,
    });

    expect(registry.parse("/flaggy --verbose")?.args.verbose).toBe(true);
    expect(registry.parse("/flaggy --count=3")?.args.count).toBe(3);
  });

  it("throws on invalid number and missing required args", () => {
    const registry = createCommandRegistry();
    registry.register({
      name: "/need",
      description: "needs arg",
      category: "view",
      args: [{ name: "id", description: "Id", required: true, type: "string" }],
      handler: () => undefined,
    });
    expect(() => registry.parse("/need")).toThrow(/Missing required argument/);
    expect(() =>
      registry.register({
        name: "/num",
        description: "num",
        category: "view",
        args: [{ name: "n", description: "N", required: true, type: "number" }],
        handler: () => undefined,
      }),
    ).not.toThrow();
    const numRegistry = createCommandRegistry();
    numRegistry.register({
      name: "/num",
      description: "num",
      category: "view",
      args: [{ name: "n", description: "N", required: true, type: "number" }],
      handler: () => undefined,
    });
    expect(() => numRegistry.parse("/num abc")).toThrow(/Expected number/);
  });

  it("finds by alias and description", () => {
    const registry = createCommandRegistry();
    registry.register({
      name: "/world",
      aliases: ["/w"],
      description: "Show collaboration snapshot",
      category: "view",
      handler: () => undefined,
    });
    expect(registry.find("/w")[0]?.name).toBe("/world");
    expect(registry.find("collaboration")[0]?.name).toBe("/world");
    expect(registry.find("")).toHaveLength(1);
  });

  it("execute throws for unknown commands", async () => {
    const registry = createCommandRegistry();
    await expect(registry.execute("/missing", { mode: "chat" } as never)).rejects.toThrow(
      /Unknown command/,
    );
  });
});
