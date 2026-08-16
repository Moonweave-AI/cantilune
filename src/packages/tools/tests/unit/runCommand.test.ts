import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node:child_process", () => ({
  spawn: vi.fn(),
}));

import { spawn } from "node:child_process";
import { runCommand } from "../../src/shell/runCommand.js";

type MockChild = EventEmitter & {
  stdout: EventEmitter;
  stderr: EventEmitter;
  kill: ReturnType<typeof vi.fn>;
};

function createMockChild(): MockChild {
  const child = new EventEmitter() as MockChild;
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.kill = vi.fn();
  return child;
}

function mockSpawnLifecycle(setup: (child: MockChild) => void) {
  vi.mocked(spawn).mockImplementation(() => {
    const child = createMockChild();
    process.nextTick(() => setup(child));
    return child as never;
  });
}

describe("runCommand", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  beforeEach(() => {
    vi.mocked(spawn).mockReset();
  });

  it("rejects commands blocked by sandbox", async () => {
    await expect(
      runCommand({ command: "rm -rf /" }, { enabled: true, sandbox: "off" }, "/tmp"),
    ).rejects.toThrow("denyList");
    expect(spawn).not.toHaveBeenCalled();
  });

  it("resolves with stdout on success", async () => {
    mockSpawnLifecycle((child) => {
      child.stdout.emit("data", "hello\n");
      child.emit("close", 0);
    });

    const output = await runCommand(
      { command: "echo hello" },
      { enabled: true, sandbox: "off" },
      "/work",
    );
    expect(output).toBe("hello");
    expect(spawn).toHaveBeenCalledWith(
      "echo hello",
      expect.objectContaining({ cwd: "/work", shell: true, windowsHide: true }),
    );
  });

  it("includes stderr and exit code in rejected output", async () => {
    mockSpawnLifecycle((child) => {
      child.stderr.emit("data", "boom");
      child.emit("close", 2);
    });

    await expect(
      runCommand({ command: "fail cmd" }, { enabled: true, sandbox: "off" }, "/work"),
    ).rejects.toThrow("[stderr]");
  });

  it("merges custom env and cwd", async () => {
    mockSpawnLifecycle((child) => {
      child.stdout.emit("data", "ok");
      child.emit("close", 0);
    });

    await runCommand(
      { command: "printenv TEST", cwd: "/custom", env: { TEST: "value" } },
      { enabled: true, sandbox: "off" },
      "/default",
    );

    expect(spawn).toHaveBeenCalledWith(
      "printenv TEST",
      expect.objectContaining({
        cwd: "/custom",
        env: expect.objectContaining({ TEST: "value" }),
      }),
    );
  });

  it("truncates oversized stdout", async () => {
    mockSpawnLifecycle((child) => {
      child.stdout.emit("data", "a".repeat(20));
      child.emit("close", 0);
    });

    const output = await runCommand(
      { command: "big output" },
      { enabled: true, sandbox: "off", maxOutputSize: 10 },
      "/work",
    );
    expect(output).toContain("...(output truncated)");
  });

  it("rejects on spawn error", async () => {
    mockSpawnLifecycle((child) => {
      child.emit("error", new Error("spawn failed"));
    });

    await expect(
      runCommand({ command: "missing" }, { enabled: true, sandbox: "off" }, "/work"),
    ).rejects.toThrow("spawn failed");
  });

  it("rejects when command times out", async () => {
    vi.useFakeTimers();
    vi.mocked(spawn).mockImplementation(() => {
      const child = createMockChild();
      child.kill = vi.fn(() => {
        child.emit("close", null);
      });
      return child as never;
    });

    const pending = runCommand(
      { command: "sleep 999", timeoutMs: 50 },
      { enabled: true, sandbox: "off" },
      "/work",
    );
    const assertion = expect(pending).rejects.toThrow("timed out after 50ms");
    await vi.advanceTimersByTimeAsync(50);
    await assertion;
  });

  it("uses config defaults for timeout and output size", async () => {
    mockSpawnLifecycle((child) => {
      child.stdout.emit("data", "done");
      child.emit("close", 0);
    });

    await runCommand(
      { command: "ok" },
      { enabled: true, sandbox: "off", timeoutMs: 5000, maxOutputSize: 2048 },
      "/work",
    );
    expect(spawn).toHaveBeenCalled();
  });

  it("rejects host spawn when already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      runCommand(
        { command: "echo hello", signal: controller.signal },
        { enabled: true, sandbox: "off" },
        "/work",
      ),
    ).rejects.toThrow("aborted before shell dispatch");
    expect(spawn).not.toHaveBeenCalled();
  });

  it("rejects when the host process is aborted mid-run", async () => {
    const child = createMockChild();
    vi.mocked(spawn).mockReturnValue(child as never);
    const controller = new AbortController();
    const pending = runCommand(
      { command: "echo hello", signal: controller.signal },
      { enabled: true, sandbox: "off" },
      "/work",
    );
    controller.abort();
    child.emit("close", 1);
    await expect(pending).rejects.toThrow("shell aborted");
    expect(child.kill).toHaveBeenCalled();
  });

  it("formats output with only stderr", async () => {
    mockSpawnLifecycle((child) => {
      child.stderr.emit("data", "warn");
      child.emit("close", 1);
    });

    await expect(
      runCommand({ command: "warn cmd" }, { enabled: true, sandbox: "off" }, "/work"),
    ).rejects.toThrow("[exit code: 1]");
  });
});
