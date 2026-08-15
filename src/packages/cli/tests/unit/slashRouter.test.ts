import { describe, it, expect } from "vitest";
import { createCommandRegistry } from "../../src/commands/registry.js";
import { isSlashInput, slashQueryFromInput } from "../../src/tui/hooks/useSlashCommands.js";

describe("slash router helpers", () => {
  it("detects slash prefix", () => {
    expect(isSlashInput("/world")).toBe(true);
    expect(isSlashInput("  /graph")).toBe(true);
    expect(isSlashInput("hello")).toBe(false);
  });

  it("extracts slash query without leading slash", () => {
    expect(slashQueryFromInput("/world actors")).toBe("world actors");
    expect(slashQueryFromInput("chat")).toBe("");
  });

  it("ranks exact prefix matches ahead of fuzzy matches", () => {
    const registry = createCommandRegistry();
    registry.register({
      name: "/graph",
      description: "Graph overview",
      category: "view",
      handler: () => undefined,
    });
    registry.register({
      name: "/graph-path",
      description: "Graph path finder",
      category: "view",
      handler: () => undefined,
    });
    registry.register({
      name: "/help",
      description: "Help screen",
      category: "help",
      handler: () => undefined,
    });

    const matches = registry.find("/graph");
    expect(matches.map((m) => m.name)).toEqual(["/graph", "/graph-path"]);
  });
});
