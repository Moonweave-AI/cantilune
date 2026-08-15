import { describe, it, expect, vi } from "vitest";
import { createCommandRegistry } from "../../src/commands/registry.js";
import { registerWorldCommands } from "../../src/commands/worldCommands.js";
import { registerGraphCommands } from "../../src/commands/graphCommands.js";
import { registerPetriCommands } from "../../src/commands/petriCommands.js";
import { registerTraceCommands } from "../../src/commands/traceCommands.js";
import { registerReplayCommands } from "../../src/commands/replayCommands.js";
import { registerContentCommands } from "../../src/commands/contentCommands.js";
import { registerObserveCommands } from "../../src/commands/observeCommands.js";
import { registerSchemaCommands } from "../../src/commands/schemaCommands.js";
import { registerEvalCommands } from "../../src/commands/evalCommands.js";
import { registerExportCommands } from "../../src/commands/exportCommands.js";
import { registerControlCommands } from "../../src/commands/controlCommands.js";
import { registerSessionCommands } from "../../src/commands/sessionCommands.js";
import { createStore } from "../../src/store.js";

function fullRegistry() {
  const registry = createCommandRegistry();
  const modules = [
    registerWorldCommands,
    registerGraphCommands,
    registerPetriCommands,
    registerTraceCommands,
    registerReplayCommands,
    registerContentCommands,
    registerObserveCommands,
    registerSchemaCommands,
    registerEvalCommands,
    registerExportCommands,
    registerControlCommands,
    registerSessionCommands,
  ];
  for (const registerFn of modules) {
    for (const command of registerFn()) {
      registry.register(command);
    }
  }
  return registry;
}

const sampleArgs: Record<string, Record<string, unknown>> = {
  "/world diff": { refA: "snap:t0", refB: "snap:t1" },
  "/graph": { depth: 2, actor: "planner", op: "commit" },
  "/graph path": { refA: "chg:a", refB: "chg:b" },
  "/petri fire": { op: "publishArtifact", bindings: "{}" },
  "/petri reach": { goal: "commit:gate" },
  "/trace search": { keyword: "commit" },
  "/replay from": { ref: "snap:t0" },
  "/replay recipe": { changeId: "chg:001" },
  "/content cat": { ref: "sha256:abc" },
  "/content put": { file: "./task.md" },
  "/content search": { text: "lock" },
  "/schema diff": { epochA: "e0", epochB: "e1" },
  "/eval run": { suite: "coord-basic" },
  "/eval report": { runId: "run:1" },
  "/eval compare": { runA: "base", runB: "cand" },
  "/export graph": { format: "dot" },
  "/export petri": { format: "pnml" },
  "/export snapshot": { ref: "snap:t0" },
  "/tools test": { name: "readContent" },
  "/mcp connect": { url: "http://localhost" },
  "/session save": { name: "slot-a" },
  "/session load": { name: "slot-a" },
  "/help command": { command: "/world" },
};

describe("slash command handlers", () => {
  const registry = fullRegistry();

  it("registers all command modules", () => {
    expect(registry.getAll().length).toBeGreaterThan(40);
  });

  it("invokes every registered handler against store", async () => {
    for (const command of registry.getAll()) {
      const store = createStore();
      const args = sampleArgs[command.name] ?? {};
      await command.handler(args, store);
      expect(store).toBeDefined();
    }
  });

  it("executes single-token commands through registry", async () => {
    const store = createStore();
    await registry.execute("/world", store);
    expect(store.activeView).toBe("world");

    await registry.execute("/petri", store);
    expect(store.activeView).toBe("petri");

    await registry.execute("/help", store);
    expect(store.activeView).toBe("help");
  });

  it("parses graph numeric flags on single-token command", async () => {
    const store = createStore();
    await registry.execute("/graph --depth 2 --actor planner", store);
    expect(store.viewArgs.depth).toBe(2);
    expect(store.viewArgs.actor).toBe("planner");
  });

  it("executes commands by alias", async () => {
    const registry = createCommandRegistry();
    registry.register({
      name: "/help",
      aliases: ["/h"],
      description: "Help",
      category: "help",
      handler: (_args, store) => {
        store.activeView = "help";
      },
    });
    const store = createStore();
    await registry.execute("/h", store);
    expect(store.activeView).toBe("help");
  });

  it("resets private runtime history when clearing the visible session", async () => {
    const store = createStore();
    store.session = {
      ...store.session,
      messages: [{ role: "user", content: "remember me", timestamp: 1 }],
      turnCount: 1,
    };
    const resetRuntime = vi.fn(async () => undefined);

    await registry.execute("/clear", store, { resetRuntime });

    expect(resetRuntime).toHaveBeenCalledOnce();
    expect(resetRuntime).toHaveBeenCalledWith("clear");
    expect(store.session.messages).toEqual([]);
    expect(store.session.turnCount).toBe(0);
  });
});
