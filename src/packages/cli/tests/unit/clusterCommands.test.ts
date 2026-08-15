import { describe, it, expect, vi } from "vitest";
import { createCommandRegistry } from "../../src/commands/registry.js";
import { registerClusterCommands } from "../../src/commands/clusterCommands.js";
import { createStore } from "../../src/store.js";
import { renderClusterViewOutput } from "../../src/views/ClusterView.js";
import { sampleRuntime } from "../support/sampleRuntime.js";
import type { ClusterController, ClusterStatus } from "../../src/wiring/clusterControl.js";

/** Build a controllable mock ClusterController. */
function mockController(opts: {
  startResult?: { ok: boolean; message?: string };
  activateResult?: { ok: boolean; message?: string };
  running?: boolean;
  events?: ClusterStatus["events"];
}): ClusterController {
  const state = { running: opts.running ?? false };
  const events = opts.events ?? [];
  return {
    start: vi.fn(() => {
      const r = opts.startResult ?? { ok: true };
      if (r.ok) state.running = true;
      return r;
    }),
    stop: vi.fn(() => {
      state.running = false;
    }),
    status: vi.fn(() => ({ running: state.running, events: [...events] })),
    activate: vi.fn(async () => opts.activateResult ?? { ok: true }),
  } as unknown as ClusterController;
}

function servicesWith(controller: ClusterController | undefined) {
  return controller === undefined ? {} : { clusterControl: () => controller };
}

function registry() {
  const r = createCommandRegistry();
  for (const c of registerClusterCommands()) r.register(c);
  return r;
}

describe("cluster command wiring", () => {
  it("cluster view prefetches supervisor status and stashes it", () => {
    const controller = mockController({ running: true, events: [] });
    const reg = registry();
    const appStore = createStore({ runtime: sampleRuntime });

    reg.execute("/cluster", appStore, servicesWith(controller));

    expect(appStore.activeView).toBe("cluster");
    expect((appStore.viewArgs.clusterStatus as ClusterStatus).running).toBe(true);
    expect(controller.status).toHaveBeenCalled();
  });

  it("cluster start drives the controller start and records status", () => {
    const controller = mockController({ startResult: { ok: true } });
    const reg = registry();
    const appStore = createStore({ runtime: sampleRuntime });

    reg.execute("/cluster start", appStore, servicesWith(controller));

    expect(controller.start).toHaveBeenCalledTimes(1);
    expect((appStore.viewArgs.clusterStatus as ClusterStatus).running).toBe(true);
  });

  it("cluster start reports failure through notify", () => {
    const controller = mockController({
      startResult: { ok: false, message: "no runtime connected" },
    });
    const reg = registry();
    const appStore = createStore({ runtime: sampleRuntime });
    const notify = vi.fn();
    const services = { clusterControl: () => controller, notify };

    reg.execute("/cluster start", appStore, services);

    expect(controller.start).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith("warn", "no runtime connected");
  });

  it("cluster start with no controller warns the user", () => {
    const reg = registry();
    const appStore = createStore({ runtime: sampleRuntime });
    const notify = vi.fn();

    reg.execute("/cluster start", appStore, { notify });

    expect(notify).toHaveBeenCalledWith("warn", "no runtime connected — start an agent loop first");
  });

  it("cluster stop calls controller.stop", () => {
    const controller = mockController({ running: true });
    const reg = registry();
    const appStore = createStore({ runtime: sampleRuntime });
    const notify = vi.fn();

    reg.execute("/cluster stop", appStore, { clusterControl: () => controller, notify });

    expect(controller.stop).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith("info", "supervisor stopped");
  });

  it("cluster activate stores manifest and commits activate_participant", async () => {
    const controller = mockController({ activateResult: { ok: true } });
    const reg = registry();
    const appStore = createStore({ runtime: sampleRuntime });
    const notify = vi.fn();

    await reg.execute("/cluster activate agent:worker", appStore, {
      clusterControl: () => controller,
      notify,
    });

    expect(controller.activate).toHaveBeenCalledTimes(1);
    expect(controller.activate).toHaveBeenCalledWith("agent:worker", {});
    expect(notify).toHaveBeenCalledWith("info", "activated agent:worker");
  });

  it("cluster activate reports failure through notify", async () => {
    const controller = mockController({
      activateResult: { ok: false, message: "not registered" },
    });
    const reg = registry();
    const appStore = createStore({ runtime: sampleRuntime });
    const notify = vi.fn();

    await reg.execute("/cluster activate agent:ghost", appStore, {
      clusterControl: () => controller,
      notify,
    });

    expect(notify).toHaveBeenCalledWith("warn", "activation failed: not registered");
  });

  it("the overview renders the supervisor running line from prefetched status", () => {
    const appStore = createStore({ runtime: sampleRuntime });
    appStore.viewArgs = {
      clusterStatus: { running: true, events: [] } as ClusterStatus,
    };
    const output = renderClusterViewOutput("cluster", appStore, appStore.viewArgs);
    expect(output).toContain("Supervisor: running");
  });

  it("the status view renders captured supervisor events", () => {
    const appStore = createStore({ runtime: sampleRuntime });
    appStore.viewArgs = {
      clusterStatus: {
        running: false,
        events: [
          { kind: "agent_started", actorId: "agent:worker", timestamp: 0 },
          { kind: "agent_done", actorId: "agent:worker", summary: "ok", timestamp: 1 },
        ],
      } as ClusterStatus,
    };
    const output = renderClusterViewOutput("cluster-status", appStore, appStore.viewArgs);
    expect(output).toContain("Supervisor events (2)");
    expect(output).toContain("agent_started agent:worker");
    expect(output).toContain("agent_done agent:worker — ok");
  });

  it("the overview with no controller shows the not-connected line", () => {
    const appStore = createStore({ runtime: sampleRuntime });
    const output = renderClusterViewOutput("cluster", appStore, undefined);
    expect(output).toContain("Supervisor: not connected");
  });
});
