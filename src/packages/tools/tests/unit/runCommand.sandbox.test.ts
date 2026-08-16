import { describe, expect, it } from "vitest";
import { createOsSandbox, type DockerRunner } from "../../src/sandbox/osSandbox.js";
import { runCommand } from "../../src/shell/runCommand.js";

function availableRunner(stdout = "sandboxed"): DockerRunner {
  return {
    async run(argv) {
      if (argv[0] === "info") {
        return argv.includes("--format")
          ? { stdout: '{"runsc":{}}', stderr: "", exitCode: 0 }
          : { stdout: "runsc", stderr: "", exitCode: 0 };
      }
      return { stdout, stderr: "", exitCode: 0 };
    },
  };
}

describe("runCommand OsSandbox wiring", () => {
  it("uses OsSandbox.run when sandbox is required", async () => {
    const sandbox = createOsSandbox({ platform: "linux", runner: availableRunner("hi") });
    const output = await runCommand(
      { command: "echo hi" },
      { enabled: true, sandbox: "required", osSandbox: sandbox },
      "/work",
    );
    expect(output).toBe("hi");
  });

  it("is fail-closed when the injected sandbox cannot probe", async () => {
    const sandbox = createOsSandbox({
      platform: "linux",
      runner: {
        async run() {
          throw new Error("no docker");
        },
      },
    });
    await expect(
      runCommand(
        { command: "echo hi" },
        { enabled: true, sandbox: "required", osSandbox: sandbox },
        "/work",
      ),
    ).rejects.toThrow(/fail-closed/);
  });

  it("rejects a non-zero sandboxed exit", async () => {
    const sandbox = createOsSandbox({
      platform: "linux",
      runner: {
        async run(argv) {
          if (argv[0] === "info") {
            return { stdout: "runsc", stderr: "", exitCode: 0 };
          }
          return { stdout: "", stderr: "boom", exitCode: 2 };
        },
      },
    });
    await expect(
      runCommand(
        { command: "false" },
        { enabled: true, sandbox: "required", osSandbox: sandbox },
        "/work",
      ),
    ).rejects.toThrow(/stderr|exit code/);
  });

  it("skips sandboxed dispatch when already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    const sandbox = createOsSandbox({ platform: "linux", runner: availableRunner() });
    await expect(
      runCommand(
        { command: "echo hi", signal: controller.signal },
        { enabled: true, sandbox: "required", osSandbox: sandbox },
        "/work",
      ),
    ).rejects.toThrow(/aborted before shell dispatch/);
  });

  it("rejects a sandboxed failure with no captured output", async () => {
    const sandbox = createOsSandbox({
      platform: "linux",
      runner: {
        async run(argv) {
          if (argv[0] === "info") {
            return { stdout: "runsc", stderr: "", exitCode: 0 };
          }
          return { stdout: "", stderr: "", exitCode: 9 };
        },
      },
    });
    await expect(
      runCommand(
        { command: "false" },
        { enabled: true, sandbox: "required", osSandbox: sandbox },
        "/work",
      ),
    ).rejects.toThrow("[exit code: 9]");
  });

  it("uses cmd.exe inside a win32 sandbox", async () => {
    const seen: string[][] = [];
    const sandbox = createOsSandbox({
      platform: "win32",
      runner: {
        async run(argv) {
          seen.push([...argv]);
          if (argv[0] === "info") {
            return { stdout: "hyperv", stderr: "", exitCode: 0 };
          }
          return { stdout: "ok", stderr: "", exitCode: 0 };
        },
      },
    });
    await runCommand(
      { command: "echo hi", env: { A: "1" }, timeoutMs: 1000 },
      { enabled: true, sandbox: "required", osSandbox: sandbox },
      "C:\\work",
    );
    const runArgv = seen.find((argv) => argv[0] === "run");
    expect(runArgv).toEqual(expect.arrayContaining(["cmd.exe", "/c", "echo hi"]));
  });
});
