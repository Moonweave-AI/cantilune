import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { BootConfig, CantilunOS, RunResult } from "@cantilune/boot";
import type { HeadlessOptions } from "../../src/headless/headlessRunner.js";
import type { Mock } from "vitest";
import {
  headlessRunner,
  parseHeadlessArgs,
  runHeadless,
} from "../../src/headless/headlessRunner.js";
import { spyOnStdoutWrite, type StdoutWriteSpy } from "../support/stdoutSpy.js";

describe("headlessRunner", () => {
  let writeSpy: StdoutWriteSpy;

  beforeEach(() => {
    writeSpy = spyOnStdoutWrite();
  });

  afterEach(() => {
    writeSpy.mockRestore();
  });

  it("parses headless CLI arguments", () => {
    const parsed = parseHeadlessArgs([
      "run",
      "hello world",
      "--provider",
      "anthropic",
      "--model",
      "claude",
      "--json",
    ]);
    expect(parsed.instruction).toBe("run hello world");
    expect(parsed.provider).toBe("anthropic");
    expect(parsed.model).toBe("claude");
    expect(parsed.json).toBe(true);
    expect(parsed.ephemeral).toBe(false);
  });

  it("parses an explicit ephemeral runtime request", () => {
    expect(parseHeadlessArgs(["task", "--ephemeral"]).ephemeral).toBe(true);
  });

  it("parses the --swarm flag", () => {
    expect(parseHeadlessArgs(["task", "--swarm"]).swarm).toBe(true);
    expect(parseHeadlessArgs(["task"]).swarm).toBe(false);
  });

  it("runs with mocked OS and emits JSON", async () => {
    const mockResult: RunResult = {
      ok: true,
      summary: "done",
      turns: 2,
      elapsedMs: 42,
      producedRefs: [],
      operations: { committed: 0, rejected: 0 },
    };

    const shutdown = vi.fn(async () => undefined);
    const boot = vi.fn((): CantilunOS => ({
      run: vi.fn(async () => mockResult),
      shutdown,
    }));

    const result = await runHeadless({
      instruction: "test task",
      provider: "openai",
      model: "gpt-4o",
      json: true,
      boot,
    });

    expect(result).toEqual(mockResult);
    expect(boot).toHaveBeenCalledWith("openai", "gpt-4o", undefined);
    expect(shutdown).toHaveBeenCalled();
    expect(writeSpy).toHaveBeenCalledWith(`${JSON.stringify(mockResult, null, 2)}\n`);
  });

  it("passes durable runtime identity to boot", async () => {
    const mockResult: RunResult = {
      ok: true,
      summary: "done",
      turns: 1,
      elapsedMs: 1,
      producedRefs: [],
      operations: { committed: 0, rejected: 0 },
    };
    const boot = vi.fn((): CantilunOS => ({
      run: vi.fn(async () => mockResult),
      shutdown: vi.fn(async () => undefined),
    }));

    await runHeadless({
      instruction: "persistent task",
      provider: "openai",
      model: "gpt-4o",
      json: false,
      durable: "file",
      storagePath: ".cantilune/os",
      principalId: "cli-stable",
      boot,
    });

    expect(boot).toHaveBeenCalledWith(
      "openai",
      "gpt-4o",
      undefined,
      expect.objectContaining({
        durable: "file",
        storagePath: ".cantilune/os",
        principalId: "cli-stable",
      }),
    );
  });

  it("returns non-zero exit code when instruction missing", async () => {
    const code = await headlessRunner([]);
    expect(code).toBe(1);
  });

  it("runs the swarm path when --swarm is set, invoking swarmBoot", async () => {
    const mockResult: RunResult = {
      ok: true,
      summary: "swarm complete",
      turns: 3,
      elapsedMs: 99,
      producedRefs: [],
      operations: { committed: 0, rejected: 0 },
    };
    const swarmBoot = vi.fn(
      async (_rc: Partial<BootConfig>, _instr: string): Promise<RunResult> => mockResult,
    ) as unknown as Mock & HeadlessOptions["swarmBoot"];

    const result = await runHeadless({
      instruction: "drive the swarm",
      provider: "openai",
      model: "gpt-4o",
      json: true,
      swarm: true,
      swarmBoot,
    });

    expect(result).toEqual(mockResult);
    expect(swarmBoot).toHaveBeenCalledTimes(1);
    // swarmBoot receives the runtime config (with the llm built from provider/model)
    // and the instruction verbatim.
    const [runtimeConfig, instruction] = swarmBoot.mock.calls[0]!;
    expect(instruction).toBe("drive the swarm");
    expect(runtimeConfig).toMatchObject({
      llm: { provider: "openai", model: "gpt-4o" },
    });
    expect(writeSpy).toHaveBeenCalledWith(`${JSON.stringify(mockResult, null, 2)}\n`);
  });

  it("does not invoke swarmBoot when --swarm is absent", async () => {
    const mockResult: RunResult = {
      ok: true,
      summary: "done",
      turns: 1,
      elapsedMs: 1,
      producedRefs: [],
      operations: { committed: 0, rejected: 0 },
    };
    const swarmBoot = vi.fn(
      async (_rc: Partial<BootConfig>, _instr: string): Promise<RunResult> => mockResult,
    ) as unknown as Mock & HeadlessOptions["swarmBoot"];
    const boot = vi.fn((): CantilunOS => ({
      run: vi.fn(async () => mockResult),
      shutdown: vi.fn(async () => undefined),
    }));

    await runHeadless({
      instruction: "single agent task",
      provider: "openai",
      model: "gpt-4o",
      json: false,
      boot,
      swarmBoot,
    });

    expect(swarmBoot).not.toHaveBeenCalled();
    expect(boot).toHaveBeenCalled();
  });
});
