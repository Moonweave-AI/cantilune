import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  parseInspectArgs,
  runInspect,
  inspectRunner,
  snapshotRuntime,
} from "../../src/headless/inspectRunner.js";
import { createStore } from "../../src/store.js";
import { spyOnStdoutWrite, type StdoutWriteSpy } from "../support/stdoutSpy.js";

describe("inspectRunner", () => {
  let writeSpy: StdoutWriteSpy;

  beforeEach(() => {
    writeSpy = spyOnStdoutWrite();
  });

  afterEach(() => {
    writeSpy.mockRestore();
  });

  it("parses inspect arguments", () => {
    expect(parseInspectArgs(["world", "--no-json"]).command).toBe("/world");
    expect(parseInspectArgs(["--json", "graph"]).json).toBe(true);
  });

  it("snapshots runtime store fields", () => {
    const store = createStore({ activeView: "graph", connected: true });
    const snap = snapshotRuntime(store);
    expect(snap.activeView).toBe("graph");
    expect(snap.connected).toBe(true);
  });

  it("runs inspect with mocked boot", async () => {
    const shutdown = vi.fn(async () => undefined);
    const boot = vi.fn(() => ({
      os: {
        run: vi.fn(async () => ({
          ok: true,
          summary: "",
          turns: 0,
          elapsedMs: 0,
          producedRefs: [],
          operations: { committed: 0, rejected: 0 },
        })),
        shutdown,
      },
      syncRuntime: vi.fn(() => ({ snapshot: null, changeLog: [], epoch: null })),
    }));

    const payload = await runInspect({ command: "/graph", json: true, boot });
    expect(payload.command).toBe("/graph");
    expect(payload.runtime.activeView).toBe("graph");
    expect(shutdown).toHaveBeenCalled();
    expect(writeSpy).toHaveBeenCalled();
  });

  it("runs inspect without json flag branch", async () => {
    const shutdown = vi.fn(async () => undefined);
    await runInspect({
      command: "/petri",
      json: false,
      boot: () => ({
        os: {
          run: vi.fn(async () => ({
            ok: true,
            summary: "",
            turns: 0,
            elapsedMs: 0,
            producedRefs: [],
            operations: { committed: 0, rejected: 0 },
          })),
          shutdown,
        },
        syncRuntime: vi.fn(() => ({ snapshot: null, changeLog: [], epoch: null })),
      }),
    });
    expect(writeSpy).toHaveBeenCalled();
  });

  it("returns zero from inspectRunner", async () => {
    const _shutdown = vi.fn(async () => undefined);
    vi.spyOn(await import("../../src/headless/inspectRunner.js"), "runInspect").mockResolvedValue({
      command: "/world",
      runtime: snapshotRuntime(createStore()),
      osReady: true,
    });
    const code = await inspectRunner(["world"]);
    expect(code).toBe(0);
  });

  it("uses default boot when boot option omitted", async () => {
    const shutdown = vi.fn(async () => undefined);
    const createCliRuntimeBoot = vi.fn(() => ({
      os: {
        run: vi.fn(async () => ({
          ok: true,
          summary: "",
          turns: 0,
          elapsedMs: 0,
          producedRefs: [],
        })),
        shutdown,
      },
      syncRuntime: vi.fn(() => ({ snapshot: null, changeLog: [], epoch: null })),
      shutdown,
    }));
    vi.doMock("../../src/runtimeSync.js", () => ({
      createCliRuntimeBoot,
      INSPECT_ONLY_ADAPTER: {},
      INSPECT_ONLY_LLM_CONFIG: { provider: "inspect", model: "none" },
    }));
    vi.resetModules();
    const { runInspect: runInspectFresh } = await import("../../src/headless/inspectRunner.js");
    await runInspectFresh({ command: "/world", json: true });
    expect(createCliRuntimeBoot).toHaveBeenCalled();
    vi.doUnmock("../../src/runtimeSync.js");
    vi.resetModules();
  });
});
