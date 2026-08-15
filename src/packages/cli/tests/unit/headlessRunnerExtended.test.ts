import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { parseHeadlessArgs, runHeadless } from "../../src/headless/headlessRunner.js";
import type { RunResult } from "@cantilune/boot";
import { spyOnStdoutWrite, type StdoutWriteSpy } from "../support/stdoutSpy.js";

describe("headlessRunner extended", () => {
  let writeSpy: StdoutWriteSpy;

  beforeEach(() => {
    writeSpy = spyOnStdoutWrite();
  });

  afterEach(() => {
    writeSpy.mockRestore();
    vi.restoreAllMocks();
  });

  /**
   * Absent flags must stay absent so `headlessRunner` can fall back to the
   * persisted config; substituting a default here silently outranked whatever
   * `/provider` had last selected.
   */
  it("leaves provider and model unset when their flags are omitted", () => {
    const parsed = parseHeadlessArgs(["run", "task"]);
    expect(parsed.provider).toBeUndefined();
    expect(parsed.model).toBeUndefined();
    expect(parsed.json).toBe(false);
  });

  it("writes plain text summary when json disabled", async () => {
    const mockResult: RunResult = {
      ok: true,
      summary: "plain",
      turns: 1,
      elapsedMs: 5,
      producedRefs: [],
      operations: { committed: 0, rejected: 0 },
    };
    await runHeadless({
      instruction: "x",
      provider: "openai",
      model: "gpt-4o",
      json: false,
      boot: () => ({
        run: vi.fn(async () => mockResult),
        shutdown: vi.fn(async () => undefined),
      }),
    });
    expect(writeSpy).toHaveBeenCalledWith("plain\n");
  });
});
