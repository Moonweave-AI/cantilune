import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@cantilune/adapter", () => ({
  createAdapter: vi.fn(() => ({})),
}));

vi.mock("../../src/runtimeSync.js", () => ({
  buildLlmConfig: vi.fn(() => ({ provider: "openai", model: "gpt-4o" })),
  missingApiKeyVar: vi.fn(() => null),
  createCliRuntimeBoot: vi.fn(() => {
    return {
      os: {
        run: vi.fn(async () => ({
          ok: false,
          summary: "failed",
          turns: 0,
          elapsedMs: 0,
          producedRefs: [],
        })),
        shutdown: vi.fn(async () => undefined),
      },
      syncRuntime: vi.fn(() => ({ snapshot: null, changeLog: [], epoch: null })),
      shutdown: vi.fn(async () => undefined),
    };
  }),
}));

import { headlessRunner } from "../../src/headless/headlessRunner.js";
import { spyOnStdoutWrite, type StdoutWriteSpy } from "../support/stdoutSpy.js";

describe("headless exit code", () => {
  let writeSpy: StdoutWriteSpy;

  beforeEach(() => {
    writeSpy = spyOnStdoutWrite();
  });

  afterEach(() => {
    writeSpy.mockRestore();
  });

  it("returns 1 when runHeadless result is not ok", async () => {
    const code = await headlessRunner(["run", "task"]);
    expect(code).toBe(1);
  });
});
