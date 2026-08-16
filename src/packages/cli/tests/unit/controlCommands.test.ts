import { describe, it, expect, vi } from "vitest";
import { registerControlCommands } from "../../src/commands/controlCommands.js";
import type { CommandServices, SlashCommand } from "../../src/commands/registry.js";
import type { CliConfigPatch } from "../../src/config.js";
import { createStore, type AppStore } from "../../src/store.js";

const COMMANDS = registerControlCommands();

function commandNamed(name: string): SlashCommand {
  const found = COMMANDS.find((command) => command.name === name);
  if (found === undefined) throw new Error(`No such control command: ${name}`);
  return found;
}

interface Harness {
  readonly store: AppStore;
  readonly services: CommandServices;
  readonly persisted: CliConfigPatch[];
  readonly notices: { level: string; text: string }[];
  readonly resetRuntime: ReturnType<typeof vi.fn>;
}

/** Build a store plus recording services so handlers can be asserted end to end. */
function harness(options?: { pick?: string | null; store?: Partial<AppStore> }): Harness {
  const persisted: CliConfigPatch[] = [];
  const notices: { level: string; text: string }[] = [];
  const resetRuntime = vi.fn(async () => undefined);

  return {
    store: createStore(options?.store),
    persisted,
    notices,
    resetRuntime,
    services: {
      persistConfig: async (patch) => {
        persisted.push(patch);
      },
      resetRuntime,
      notify: (level, text) => {
        notices.push({ level, text });
      },
      pick: async () => options?.pick ?? null,
    },
  };
}

describe("/theme", () => {
  it("applies and persists a named theme", async () => {
    const h = harness();
    await commandNamed("/theme").handler({ name: "daylight" }, h.store, h.services);

    expect(h.store.theme).toBe("daylight");
    expect(h.persisted).toEqual([{ theme: "daylight" }]);
    expect(h.notices).toEqual([{ level: "info", text: "Theme set to daylight" }]);
  });

  it("rejects an unknown theme without changing state", async () => {
    const h = harness();
    await commandNamed("/theme").handler({ name: "solarized" }, h.store, h.services);

    expect(h.store.theme).toBeNull();
    expect(h.persisted).toHaveLength(0);
    expect(h.notices[0]?.level).toBe("warn");
    expect(h.notices[0]?.text).toContain("solarized");
  });

  it("applies the theme chosen from the interactive picker", async () => {
    const h = harness({ pick: "mono" });
    await commandNamed("/theme").handler({}, h.store, h.services);

    expect(h.store.theme).toBe("mono");
    expect(h.persisted).toEqual([{ theme: "mono" }]);
  });

  it("reports the current theme when the picker is cancelled", async () => {
    const h = harness({ pick: null });
    await commandNamed("/theme").handler({}, h.store, h.services);

    expect(h.store.theme).toBeNull();
    expect(h.notices[0]?.text).toBe("theme=auto");
  });

  it("reports the current theme when no picker is available", async () => {
    const h = harness({ store: { theme: "ansi" } });
    const services: CommandServices = { notify: h.services.notify! };
    await commandNamed("/theme").handler({}, h.store, services);

    expect(h.notices[0]?.text).toBe("theme=ansi");
  });
});

describe("/provider and /model", () => {
  it("switches provider, drops the cached runtime, and persists", async () => {
    const h = harness();
    await commandNamed("/provider").handler({ name: "anthropic" }, h.store, h.services);

    expect(h.store.provider).toBe("anthropic");
    expect(h.resetRuntime).toHaveBeenCalledOnce();
    expect(h.resetRuntime).toHaveBeenCalledWith("preserve");
    expect(h.persisted[0]).toMatchObject({ provider: "anthropic" });
  });

  it("uses the picker when no provider argument is given", async () => {
    const h = harness({ pick: "dashscope" });
    await commandNamed("/provider").handler({}, h.store, h.services);

    expect(h.store.provider).toBe("dashscope");
  });

  it("reports the current provider when the picker is cancelled", async () => {
    const h = harness({ pick: null });
    await commandNamed("/provider").handler({}, h.store, h.services);

    expect(h.notices[0]?.text).toBe("provider=openai");
    expect(h.resetRuntime).not.toHaveBeenCalled();
  });

  it("switches the model by explicit id", async () => {
    const h = harness();
    await commandNamed("/model").handler({ name: "o3" }, h.store, h.services);

    expect(h.store.model).toBe("o3");
    expect(h.resetRuntime).toHaveBeenCalledWith("preserve");
    expect(h.persisted[0]).toMatchObject({ model: "o3" });
  });

  it("keeps memory-world history loss visible after the settings notice", async () => {
    const h = harness();
    h.resetRuntime.mockResolvedValueOnce({
      history: "cleared",
      reason: "memory_world_replaced",
    });

    await commandNamed("/model").handler({ name: "o3" }, h.store, h.services);

    expect(h.notices.at(-1)).toMatchObject({ level: "warn" });
    expect(h.notices.at(-1)?.text).toContain("private and visible history were cleared");
  });

  it("awaits runtime reset before persisting and announcing replacement settings", async () => {
    const h = harness();
    let finishReset!: () => void;
    h.resetRuntime.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishReset = resolve;
        }),
    );

    const changing = commandNamed("/model").handler({ name: "o3" }, h.store, h.services);
    await Promise.resolve();
    expect(h.persisted).toEqual([]);
    expect(h.notices).toEqual([]);

    finishReset();
    await changing;
    expect(h.persisted[0]).toMatchObject({ model: "o3" });
    expect(h.notices).toHaveLength(1);
  });

  it("warns instead of opening an empty picker for an unknown provider", async () => {
    const h = harness({ store: { provider: "some-private-gateway" } });
    await commandNamed("/model").handler({}, h.store, h.services);

    expect(h.notices[0]?.level).toBe("warn");
    expect(h.notices[0]?.text).toContain("/model <id>");
  });

  it("offers curated suggestions for a known provider", async () => {
    const h = harness({ store: { provider: "dashscope" }, pick: "qwen-max" });
    await commandNamed("/model").handler({}, h.store, h.services);

    expect(h.store.model).toBe("qwen-max");
  });
});

describe("/base-url and /layout", () => {
  it("records a base URL override", async () => {
    const h = harness();
    await commandNamed("/base-url").handler(
      { url: "https://gateway.internal/v1" },
      h.store,
      h.services,
    );

    expect(h.store.baseUrl).toBe("https://gateway.internal/v1");
    expect(h.resetRuntime).toHaveBeenCalledWith("preserve");
    expect(h.persisted[0]).toMatchObject({ baseUrl: "https://gateway.internal/v1" });
  });

  it("toggles the layout when called without an argument", async () => {
    const h = harness();
    await commandNamed("/layout").handler({}, h.store, h.services);
    expect(h.store.layout).toBe("observe");

    await commandNamed("/layout").handler({}, h.store, h.services);
    expect(h.store.layout).toBe("focus");
  });

  it("sets an explicit layout and leaves any open view", async () => {
    const h = harness({ store: { activeView: "world", mode: "view" } });
    await commandNamed("/layout").handler({ mode: "observe" }, h.store, h.services);

    expect(h.store.layout).toBe("observe");
    expect(h.store.activeView).toBeNull();
    expect(h.store.mode).toBe("chat");
  });

  it("ignores an unrecognized layout name and toggles instead", async () => {
    const h = harness();
    await commandNamed("/layout").handler({ mode: "split" }, h.store, h.services);
    expect(h.store.layout).toBe("observe");
  });
});

describe("/config save", () => {
  it("persists every non-secret setting currently in the store", async () => {
    const h = harness({
      store: {
        provider: "dashscope",
        model: "qwen-max",
        layout: "observe",
        theme: "mono",
        baseUrl: "https://example.test/v1",
      },
    });
    await commandNamed("/config save").handler({}, h.store, h.services);

    expect(h.persisted[0]).toEqual({
      provider: "dashscope",
      model: "qwen-max",
      layout: "observe",
      theme: "mono",
      baseUrl: "https://example.test/v1",
    });
    expect(h.notices[0]?.text).toBe("Configuration saved");
  });

  it("omits the theme when it is still on auto-detect", async () => {
    const h = harness();
    await commandNamed("/config save").handler({}, h.store, h.services);

    expect(h.persisted[0]).not.toHaveProperty("theme");
    expect(h.persisted[0]).not.toHaveProperty("baseUrl");
  });
});

describe("view-opening control commands", () => {
  it.each([
    ["/tools", "tools"],
    ["/mcp", "mcp"],
    ["/config", "config"],
  ])("%s opens the %s view", async (name, view) => {
    const store = createStore();
    await commandNamed(name).handler({}, store);

    expect(store.mode).toBe("view");
    expect(store.activeView).toBe(view);
  });

  it("passes arguments through to the sub-views", async () => {
    const store = createStore();
    await commandNamed("/tools test").handler({ name: "read_content" }, store);
    expect(store.viewArgs).toEqual({ name: "read_content", injectedTools: [] });

    await commandNamed("/mcp connect").handler({ url: "http://localhost:3000" }, store);
    expect(store.viewArgs).toMatchObject({
      url: "http://localhost:3000",
      persisted: true,
      scheduled: true,
    });
  });
});

describe("/mcp connect and disconnect", () => {
  it("schedules epoch-bound attach without resetting the runtime", async () => {
    const h = harness();
    await commandNamed("/mcp connect").handler({ url: "docs=npx -y server" }, h.store, h.services);

    expect(h.store.mcpServers).toEqual(["docs=npx -y server"]);
    expect(h.store.pendingToolSurface).toMatchObject({
      action: "connect",
      servers: ["docs=npx -y server"],
    });
    expect(h.resetRuntime).not.toHaveBeenCalled();
    expect(h.persisted[0]).toEqual({ mcpServers: ["docs=npx -y server"] });
    expect(h.notices[0]?.text).toMatch(/next turn/);
  });

  it("submits schema admission when control-plane is available", async () => {
    const h = harness();
    const admitCandidate = vi.fn(async () => ({
      ok: true,
      message: "submitted",
      admissionId: "adm-mcp-1",
    }));
    const services = {
      ...h.services,
      controlPlane: () =>
        ({
          admitCandidate,
          genesisBinding: { epochId: "epoch-1" },
        }) as never,
    };
    await commandNamed("/mcp connect").handler({ url: "docs=npx server" }, h.store, services);
    expect(admitCandidate).toHaveBeenCalled();
    expect(h.store.pendingToolSurface?.admissionId).toBe("adm-mcp-1");
  });

  it("schedules disconnect and removes the named server", async () => {
    const h = harness({
      store: { mcpServers: ["docs=npx server", "other=node x.js"] },
    });
    await commandNamed("/mcp disconnect").handler({ name: "docs" }, h.store, h.services);
    expect(h.store.mcpServers).toEqual(["other=node x.js"]);
    expect(h.store.pendingToolSurface).toMatchObject({
      action: "disconnect",
      servers: ["other=node x.js"],
    });
    expect(h.resetRuntime).not.toHaveBeenCalled();
  });

  it("clears mcpServers when the last server is disconnected", async () => {
    const h = harness({ store: { mcpServers: ["docs=npx server"] } });
    await commandNamed("/mcp disconnect").handler({ name: "docs" }, h.store, h.services);
    expect(h.store.mcpServers).toBeUndefined();
    expect(h.store.pendingToolSurface?.servers).toEqual([]);
  });

  it("rejects disconnect of an unknown server", async () => {
    const h = harness();
    await commandNamed("/mcp disconnect").handler({ name: "missing" }, h.store, h.services);
    expect(h.store.viewArgs.error).toMatch(/not connected/);
    expect(h.store.pendingToolSurface).toBeNull();
  });
});

describe("handlers without services", () => {
  it("never throws when the side-effect channel is absent", async () => {
    for (const command of COMMANDS) {
      const store = createStore();
      // Handlers may be sync or async; normalise before asserting.
      await expect(
        Promise.resolve(command.handler({ url: "u", name: "n" }, store)),
      ).resolves.not.toThrow();
    }
  });
});
