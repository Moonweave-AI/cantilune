import { describe, it, expect, vi } from "vitest";
import { createCommandRegistry } from "../../src/commands/registry.js";
import { registerSwarmCommands } from "../../src/commands/swarmCommands.js";
import { createStore } from "../../src/store.js";
import { renderSwarmViewOutput } from "../../src/views/SwarmView.js";
import { sampleRuntime } from "../support/sampleRuntime.js";
import type { SwarmController, SwarmControllerStatus } from "../../src/wiring/swarmControl.js";
import type { ClusterResult } from "@cantilune/boot";

/** Build a controllable mock SwarmController. */
function mockController(opts: {
  startResult?: { ok: boolean; message?: string };
  activateResult?: { ok: boolean; message?: string };
  waitResult?: ClusterResult;
  running?: boolean;
  agents?: SwarmControllerStatus["agents"];
  events?: SwarmControllerStatus["events"];
}): SwarmController {
  const state = { running: opts.running ?? false };
  const events = opts.events ?? [];
  const agents = opts.agents ?? new Map();
  return {
    start: vi.fn(() => {
      const r = opts.startResult ?? { ok: true };
      if (r.ok) state.running = true;
      return r;
    }),
    stop: vi.fn(() => {
      state.running = false;
    }),
    status: vi.fn(() => ({ running: state.running, agents, events: [...events] })),
    activate: vi.fn(async () => opts.activateResult ?? { ok: true }),
    waitForCompletion: vi.fn(
      async () =>
        opts.waitResult ?? {
          ok: true,
          summary: "complete",
          agentResults: new Map(),
          totalElapsedMs: 0,
          totalTurns: 0,
        },
    ),
    shutdown: vi.fn(async () => undefined),
  } as unknown as SwarmController;
}

function servicesWith(controller: SwarmController | undefined) {
  return controller === undefined ? {} : { swarmControl: () => controller };
}

function registry() {
  const r = createCommandRegistry();
  for (const c of registerSwarmCommands()) r.register(c);
  return r;
}

describe("swarm command wiring", () => {
  it("swarm view prefetches swarm status and stashes it", () => {
    const controller = mockController({ running: true, events: [] });
    const reg = registry();
    const appStore = createStore({ runtime: sampleRuntime });

    reg.execute("/swarm", appStore, servicesWith(controller));

    expect(appStore.activeView).toBe("swarm");
    expect((appStore.viewArgs.swarmStatus as SwarmControllerStatus).running).toBe(true);
    expect(controller.status).toHaveBeenCalled();
  });

  it("swarm status view prefetches and sets the swarm-status view", () => {
    const controller = mockController({ running: true, events: [] });
    const reg = registry();
    const appStore = createStore({ runtime: sampleRuntime });

    reg.execute("/swarm status", appStore, servicesWith(controller));

    expect(appStore.activeView).toBe("swarm-status");
    expect((appStore.viewArgs.swarmStatus as SwarmControllerStatus).running).toBe(true);
  });

  it("swarm start drives the controller start and records status", () => {
    const controller = mockController({ startResult: { ok: true } });
    const reg = registry();
    const appStore = createStore({ runtime: sampleRuntime });

    reg.execute("/swarm start", appStore, servicesWith(controller));

    expect(controller.start).toHaveBeenCalledTimes(1);
    expect((appStore.viewArgs.swarmStatus as SwarmControllerStatus).running).toBe(true);
  });

  it("swarm start reports failure through notify", () => {
    const controller = mockController({
      startResult: { ok: false, message: "no runtime connected" },
    });
    const reg = registry();
    const appStore = createStore({ runtime: sampleRuntime });
    const notify = vi.fn();
    const services = { swarmControl: () => controller, notify };

    reg.execute("/swarm start", appStore, services);

    expect(controller.start).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith("warn", "no runtime connected");
  });

  it("swarm start reports already running", () => {
    const controller = mockController({
      startResult: { ok: true, message: "already running" },
    });
    const reg = registry();
    const appStore = createStore({ runtime: sampleRuntime });
    const notify = vi.fn();

    reg.execute("/swarm start", appStore, { swarmControl: () => controller, notify });

    expect(notify).toHaveBeenCalledWith("info", "already running");
  });

  it("swarm start with no controller warns the user", () => {
    const reg = registry();
    const appStore = createStore({ runtime: sampleRuntime });
    const notify = vi.fn();

    reg.execute("/swarm start", appStore, { notify });

    expect(notify).toHaveBeenCalledWith("warn", "no runtime connected — start an agent loop first");
  });

  it("swarm stop calls controller.stop", () => {
    const controller = mockController({ running: true });
    const reg = registry();
    const appStore = createStore({ runtime: sampleRuntime });
    const notify = vi.fn();

    reg.execute("/swarm stop", appStore, { swarmControl: () => controller, notify });

    expect(controller.stop).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith("info", "swarm stopped");
  });

  it("swarm stop with no controller warns the user", () => {
    const reg = registry();
    const appStore = createStore({ runtime: sampleRuntime });
    const notify = vi.fn();

    reg.execute("/swarm stop", appStore, { notify });

    expect(notify).toHaveBeenCalledWith("warn", "no runtime connected");
  });

  it("swarm activate stores manifest and commits activate_participant", async () => {
    const controller = mockController({ activateResult: { ok: true } });
    const reg = registry();
    const appStore = createStore({ runtime: sampleRuntime });
    const notify = vi.fn();

    await reg.execute("/swarm activate agent:worker", appStore, {
      swarmControl: () => controller,
      notify,
    });

    expect(controller.activate).toHaveBeenCalledTimes(1);
    expect(controller.activate).toHaveBeenCalledWith("agent:worker", {});
    expect(notify).toHaveBeenCalledWith("info", "activated agent:worker");
  });

  it("swarm activate reports failure through notify", async () => {
    const controller = mockController({
      activateResult: { ok: false, message: "not registered" },
    });
    const reg = registry();
    const appStore = createStore({ runtime: sampleRuntime });
    const notify = vi.fn();

    await reg.execute("/swarm activate agent:ghost", appStore, {
      swarmControl: () => controller,
      notify,
    });

    expect(notify).toHaveBeenCalledWith("warn", "activation failed: not registered");
  });

  it("swarm activate with no controller warns the user", async () => {
    const reg = registry();
    const appStore = createStore({ runtime: sampleRuntime });
    const notify = vi.fn();

    await reg.execute("/swarm activate agent:worker", appStore, { notify });

    expect(notify).toHaveBeenCalledWith("warn", "no runtime connected");
  });

  it("swarm wait drives waitForCompletion and notifies the summary", async () => {
    const controller = mockController({
      waitResult: {
        ok: true,
        summary: "all agents done",
        agentResults: new Map(),
        totalElapsedMs: 42,
        totalTurns: 3,
      },
    });
    const reg = registry();
    const appStore = createStore({ runtime: sampleRuntime });
    const notify = vi.fn();

    await reg.execute("/swarm wait", appStore, { swarmControl: () => controller, notify });

    expect(controller.waitForCompletion).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith("info", "swarm complete — all agents done");
  });

  it("swarm wait reports incomplete through notify", async () => {
    const controller = mockController({
      waitResult: {
        ok: false,
        summary: "agent crashed",
        agentResults: new Map(),
        totalElapsedMs: 10,
        totalTurns: 1,
      },
    });
    const reg = registry();
    const appStore = createStore({ runtime: sampleRuntime });
    const notify = vi.fn();

    await reg.execute("/swarm wait", appStore, { swarmControl: () => controller, notify });

    expect(notify).toHaveBeenCalledWith("warn", "swarm incomplete — agent crashed");
  });

  it("swarm wait with no controller warns the user", async () => {
    const reg = registry();
    const appStore = createStore({ runtime: sampleRuntime });
    const notify = vi.fn();

    await reg.execute("/swarm wait", appStore, { notify });

    expect(notify).toHaveBeenCalledWith("warn", "no runtime connected");
  });

  it("the overview renders the swarm running line from prefetched status", () => {
    const appStore = createStore({ runtime: sampleRuntime });
    appStore.viewArgs = {
      swarmStatus: { running: true, agents: new Map(), events: [] } as SwarmControllerStatus,
    };
    const output = renderSwarmViewOutput("swarm", appStore, appStore.viewArgs);
    expect(output).toContain("Swarm: running");
  });

  it("the status view renders captured swarm events", () => {
    const appStore = createStore({ runtime: sampleRuntime });
    appStore.viewArgs = {
      swarmStatus: {
        running: false,
        agents: new Map(),
        events: [
          { kind: "agent_started", actorId: "agent:worker", timestamp: 0 },
          { kind: "agent_done", actorId: "agent:worker", summary: "ok", timestamp: 1 },
        ],
      } as SwarmControllerStatus,
    };
    const output = renderSwarmViewOutput("swarm-status", appStore, appStore.viewArgs);
    expect(output).toContain("Swarm events (2)");
    expect(output).toContain("agent_started agent:worker");
    expect(output).toContain("agent_done agent:worker — ok");
  });

  it("the overview with no controller shows the not-connected line", () => {
    const appStore = createStore({ runtime: sampleRuntime });
    const output = renderSwarmViewOutput("swarm", appStore, undefined);
    expect(output).toContain("Swarm: not connected");
  });
});
