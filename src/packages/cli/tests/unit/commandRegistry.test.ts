import { describe, it, expect, vi } from "vitest";
import { createCommandRegistry } from "../../src/commands/registry.js";
import { createStore } from "../../src/store.js";

describe("CommandRegistry", () => {
  it("registers and retrieves commands", () => {
    const registry = createCommandRegistry();
    registry.register({
      name: "/world",
      description: "Show world view",
      category: "view",
      handler: (_args, store) => {
        store.activeView = "world";
      },
    });

    expect(registry.getAll()).toHaveLength(1);
    expect(registry.getByCategory("view")).toHaveLength(1);
    expect(registry.getByCategory("help")).toHaveLength(0);
  });

  it("finds commands with fuzzy matching", () => {
    const registry = createCommandRegistry();
    registry.register({
      name: "/graph",
      aliases: ["/g"],
      description: "Graph view",
      category: "view",
      handler: vi.fn(),
    });
    registry.register({
      name: "/help",
      description: "Help view",
      category: "help",
      handler: vi.fn(),
    });

    const matches = registry.find("/gr");
    expect(matches[0]?.name).toBe("/graph");
  });

  it("parses positional and flag arguments", () => {
    const registry = createCommandRegistry();
    registry.register({
      name: "/export",
      description: "Export data",
      category: "export",
      args: [
        { name: "format", description: "Format", required: true, type: "string" },
        { name: "depth", description: "Depth flag", required: false, type: "number" },
      ],
      handler: vi.fn(),
    });

    const parsed = registry.parse("/export json --depth 3");
    expect(parsed?.args.format).toBe("json");
    expect(parsed?.args.depth).toBe(3);
  });

  it("executes command handlers against store", async () => {
    const registry = createCommandRegistry();
    const store = createStore();
    registry.register({
      name: "/world",
      description: "Show world view",
      category: "view",
      handler: (_args, s) => {
        s.activeView = "world";
        s.mode = "view";
      },
    });

    await registry.execute("/world", store);
    expect(store.activeView).toBe("world");
    expect(store.mode).toBe("view");
  });
});
