import { afterEach, describe, expect, it, vi } from "vitest";
import { createShellExecutor } from "../../src/shell/shellExecutor.js";

vi.mock("../../src/shell/runCommand.js", () => ({
  runCommand: vi.fn(),
  runCommandSchema: { name: "shell_run_command" },
}));

import { runCommand } from "../../src/shell/runCommand.js";

describe("createShellExecutor", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("lists shell tool schema", async () => {
    const executor = createShellExecutor({ enabled: true, workingDirectory: "/work" });
    const tools = await executor.listTools();
    expect(tools[0]?.name).toBe("shell_run_command");
  });

  it("rejects unknown shell tool", async () => {
    const executor = createShellExecutor({ enabled: true, workingDirectory: "/work" });
    const result = await executor.execute("shell_other", {});
    expect(result.ok).toBe(false);
    expect(result.output).toContain("Unknown shell tool");
  });

  it("delegates run_command with optional cwd, env, timeoutMs", async () => {
    vi.mocked(runCommand).mockResolvedValue("command output");
    const executor = createShellExecutor({ enabled: true, workingDirectory: "/work" });

    const result = await executor.execute("shell_run_command", {
      command: "node -v",
      cwd: "/tmp",
      env: { FOO: "bar" },
      timeoutMs: 1000,
    });

    expect(result.ok).toBe(true);
    expect(result.output).toBe("command output");
    expect(runCommand).toHaveBeenCalledWith(
      { command: "node -v", cwd: "/tmp", env: { FOO: "bar" }, timeoutMs: 1000 },
      expect.objectContaining({ enabled: true, workingDirectory: "/work", sandbox: "required" }),
      "/work",
    );
  });

  it("validates command argument type", async () => {
    const executor = createShellExecutor({ enabled: true, workingDirectory: "/work" });
    const result = await executor.execute("shell_run_command", { command: 42 });
    expect(result.ok).toBe(false);
    expect(result.output).toContain("Expected string argument: command");
  });

  it("validates cwd, env, and timeoutMs types", async () => {
    const executor = createShellExecutor({ enabled: true, workingDirectory: "/work" });

    const badCwd = await executor.execute("shell_run_command", { command: "echo", cwd: 1 });
    expect(badCwd.output).toContain("Expected string argument: cwd");

    const badEnv = await executor.execute("shell_run_command", { command: "echo", env: "x" });
    expect(badEnv.output).toContain("Expected object argument: env");

    const badEnvValue = await executor.execute("shell_run_command", {
      command: "echo",
      env: { NUM: 1 },
    });
    expect(badEnvValue.output).toContain("Expected string values in env");

    const badTimeout = await executor.execute("shell_run_command", {
      command: "echo",
      timeoutMs: "slow",
    });
    expect(badTimeout.output).toContain("Expected number argument: timeoutMs");
  });

  it("returns runCommand errors as failed execution", async () => {
    vi.mocked(runCommand).mockRejectedValue(new Error("sandbox blocked"));
    const executor = createShellExecutor({ enabled: true, workingDirectory: "/work" });
    const result = await executor.execute("shell_run_command", { command: "bad" });
    expect(result.ok).toBe(false);
    expect(result.output).toBe("sandbox blocked");
  });

  it("stringifies non-Error rejections", async () => {
    vi.mocked(runCommand).mockRejectedValue("plain failure");
    const executor = createShellExecutor({ enabled: true, workingDirectory: "/work" });
    const result = await executor.execute("shell_run_command", { command: "bad" });
    expect(result.ok).toBe(false);
    expect(result.output).toBe("plain failure");
  });
});
