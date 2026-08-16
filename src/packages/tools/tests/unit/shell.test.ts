import { describe, expect, it, vi } from "vitest";
import { checkCommand } from "../../src/shell/commandSandbox.js";
import { createShellExecutor } from "../../src/shell/shellExecutor.js";

vi.mock("../../src/shell/runCommand.js", () => ({
  runCommand: vi.fn(),
  runCommandSchema: { name: "shell_run_command" },
}));

import { runCommand } from "../../src/shell/runCommand.js";

describe("shell tools", () => {
  it("runCommand executes echo hello via mocked spawn pipeline", async () => {
    vi.mocked(runCommand).mockResolvedValue("hello");
    const executor = createShellExecutor({
      enabled: true,
      workingDirectory: process.cwd(),
    });

    const result = await executor.execute("shell_run_command", {
      command: "echo hello",
    });

    expect(result.ok).toBe(true);
    expect(result.output.toLowerCase()).toContain("hello");
  });

  it("commandSandbox denies dangerous commands", () => {
    const check = checkCommand("rm -rf /", { enabled: true });
    expect(check.allowed).toBe(false);
    expect(check.reason).toContain("denyList");
  });

  it("returns skipped when aborted before dispatch", async () => {
    const executor = createShellExecutor({
      enabled: true,
      workingDirectory: process.cwd(),
    });
    const controller = new AbortController();
    controller.abort();
    const result = await executor.execute(
      "shell_run_command",
      { command: "echo hello" },
      { signal: controller.signal },
    );
    expect(result.ok).toBe(false);
    expect(result.output).toContain("skipped: aborted");
  });

  it("commandSandbox enforces allowList", async () => {
    vi.mocked(runCommand).mockRejectedValue(new Error("Command not in allowList"));
    const executor = createShellExecutor({
      enabled: true,
      workingDirectory: process.cwd(),
      allowList: ["node "],
    });

    const denied = await executor.execute("shell_run_command", {
      command: "echo blocked",
    });
    expect(denied.ok).toBe(false);
    expect(denied.output).toContain("allowList");
  });
});
