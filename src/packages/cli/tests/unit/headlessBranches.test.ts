import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { parseHeadlessArgs } from "../../src/headless/headlessRunner.js";
import { parseInspectArgs, runInspect } from "../../src/headless/inspectRunner.js";
import type { RunResult } from "@cantilune/boot";
import { spyOnStdoutWrite, type StdoutWriteSpy } from "../support/stdoutSpy.js";

describe("headless branch coverage", () => {
  let writeSpy: StdoutWriteSpy;

  beforeEach(() => {
    writeSpy = spyOnStdoutWrite();
  });

  afterEach(() => {
    writeSpy.mockRestore();
  });

  it("leaves provider unset when --provider has no trailing value", () => {
    const parsed = parseHeadlessArgs(["run", "task", "--provider"]);
    expect(parsed.provider).toBeUndefined();
  });

  it("leaves model unset when --model has no trailing value", () => {
    const parsed = parseHeadlessArgs(["run", "task", "--model"]);
    expect(parsed.model).toBeUndefined();
  });

  it("keeps baseUrl undefined when --base-url has no trailing value", () => {
    const parsed = parseHeadlessArgs(["run", "task", "--base-url"]);
    expect(parsed.baseUrl).toBeUndefined();
  });

  it("uses default boot in inspect when boot omitted", async () => {
    await runInspect({ command: "/world", json: true });
    expect(writeSpy).toHaveBeenCalled();
    expect(parseInspectArgs(["graph"]).command).toBe("/graph");
  });

  it("uses default boot path in runHeadless", async () => {
    vi.doMock("@cantilune/adapter", () => ({
      createAdapter: vi.fn(() => ({})),
    }));
    vi.doMock("../../src/runtimeSync.js", () => ({
      buildLlmConfig: vi.fn(() => ({ provider: "openai", model: "gpt-4o" })),
      createCliRuntimeBoot: vi.fn(() => ({
        os: {
          run: vi.fn(async (): Promise<RunResult> => ({
            ok: true,
            summary: "booted",
            turns: 1,
            elapsedMs: 1,
            producedRefs: [],
            operations: { committed: 0, rejected: 0 },
          })),
          shutdown: vi.fn(async () => undefined),
        },
        syncRuntime: vi.fn(() => ({ snapshot: null, changeLog: [], epoch: null })),
        shutdown: vi.fn(async () => undefined),
      })),
    }));
    vi.resetModules();
    const mod = await import("../../src/headless/headlessRunner.js");
    await mod.runHeadless({
      instruction: "via default boot",
      provider: "openai",
      model: "gpt-4o",
      json: true,
    });
    expect(writeSpy).toHaveBeenCalled();
    vi.resetModules();
  });
});
