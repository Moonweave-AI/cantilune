import { EventEmitter } from "node:events";
import { afterEach, describe, expect, it, vi } from "vitest";

const spawnMock = vi.fn();
vi.mock("node:child_process", () => ({
  spawn: (...args: unknown[]) => spawnMock(...args),
}));

import {
  createOsSandbox,
  createProcessDockerRunner,
  createWslDockerRunner,
  defaultSandboxImage,
  isolationArgs,
  isolationForPlatform,
  type DockerRunResult,
  type DockerRunner,
} from "../../src/sandbox/osSandbox.js";

function result(stdout: string, extras: Partial<DockerRunResult> = {}): DockerRunResult {
  return { stdout, stderr: "", exitCode: 0, ...extras };
}

function recordingRunner(
  handler: (argv: readonly string[]) => DockerRunResult | Promise<DockerRunResult>,
): DockerRunner & { readonly calls: readonly string[][] } {
  const calls: string[][] = [];
  return {
    get calls() {
      return calls;
    },
    async run(argv) {
      calls.push([...argv]);
      return handler(argv);
    },
  };
}

function availableLinuxHandler(argv: readonly string[]): DockerRunResult {
  if (argv[0] === "info" && argv.includes("--format")) {
    return result('{"runsc":{"path":"/usr/bin/runsc"}}');
  }
  if (argv[0] === "info") {
    return result("Runtimes: runc runsc");
  }
  return result("sandboxed-ok");
}

function availableWin32Handler(argv: readonly string[]): DockerRunResult {
  if (argv[0] === "info" && argv.includes("--format")) {
    return result("hyperv");
  }
  if (argv[0] === "info") {
    return result("Isolation: hyperv");
  }
  return result("sandboxed-ok");
}

type MockChild = EventEmitter & {
  stdout: EventEmitter;
  stderr: EventEmitter;
  stdin: { write: ReturnType<typeof vi.fn>; end: ReturnType<typeof vi.fn> };
  kill: ReturnType<typeof vi.fn>;
};

function createMockChild(): MockChild {
  const child = new EventEmitter() as MockChild;
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.stdin = { write: vi.fn(), end: vi.fn() };
  child.kill = vi.fn();
  return child;
}

describe("isolation helpers", () => {
  it("maps win32 to hyperv and linux to runsc", () => {
    expect(isolationForPlatform("win32")).toBe("hyperv");
    expect(isolationForPlatform("linux")).toBe("runsc");
    expect(isolationForPlatform("darwin")).toBe("unsupported");
    expect(isolationArgs("hyperv")).toEqual(["--isolation=hyperv"]);
    expect(isolationArgs("runsc")).toEqual(["--runtime=runsc"]);
    expect(isolationArgs("unsupported")).toEqual([]);
    expect(defaultSandboxImage("win32")).toContain("nanoserver");
    expect(defaultSandboxImage("linux")).toContain("alpine");
    expect(isolationForPlatform("win32", "runsc")).toBe("runsc");
    expect(isolationForPlatform("linux", "hyperv")).toBe("hyperv");
    expect(isolationForPlatform("win32", "unsupported")).toBe("unsupported");
  });
});

describe("createOsSandbox with injected DockerRunner", () => {
  it("probes linux runsc and builds docker run --runtime=runsc", async () => {
    const runner = recordingRunner(availableLinuxHandler);
    const sandbox = createOsSandbox({ platform: "linux", runner, image: "alpine:3.20" });
    const probed = await sandbox.probe();
    expect(probed.isAvailable).toBe(true);
    expect(probed.isolation).toBe("runsc");
    expect(sandbox.isAvailable).toBe(true);

    const output = await sandbox.run("echo", ["hello"], { cwd: "/work", env: { FOO: "bar" } });
    expect(output.stdout).toBe("sandboxed-ok");
    const runArgv = runner.calls.find((argv) => argv[0] === "run");
    expect(runArgv).toEqual(
      expect.arrayContaining([
        "run",
        "--rm",
        "--runtime=runsc",
        "-w",
        "/work",
        "-e",
        "FOO=bar",
        "alpine:3.20",
        "echo",
        "hello",
      ]),
    );
    expect(runArgv).not.toContain("--isolation=hyperv");
  });

  it("honors an explicit runsc override on win32 and prefixes WSL wrapSpawn", async () => {
    const runner = recordingRunner(availableLinuxHandler);
    const sandbox = createOsSandbox({
      platform: "win32",
      isolation: "runsc",
      wslDistro: "Ubuntu-24.04",
      runner,
    });
    const probed = await sandbox.probe();
    expect(probed.isolation).toBe("runsc");
    expect(sandbox.isolation).toBe("runsc");
    await sandbox.run("echo", ["hi"]);
    const runArgv = runner.calls.find((argv) => argv[0] === "run");
    expect(runArgv).toEqual(expect.arrayContaining(["--runtime=runsc"]));
    expect(runArgv).not.toContain("--isolation=hyperv");
    const invocation = sandbox.wrapSpawn("node", ["mcp.js"]);
    expect(invocation.command).toBe("wsl");
    expect(invocation.args).toEqual(
      expect.arrayContaining([
        "-d",
        "Ubuntu-24.04",
        "-u",
        "root",
        "--",
        "docker",
        "--runtime=runsc",
      ]),
    );
  });

  it("probes win32 hyperv and builds docker run --isolation=hyperv", async () => {
    const runner = recordingRunner(availableWin32Handler);
    const sandbox = createOsSandbox({ platform: "win32", runner });
    await sandbox.probe();
    await sandbox.run("cmd.exe", ["/c", "echo hi"]);
    const runArgv = runner.calls.find((argv) => argv[0] === "run");
    expect(runArgv).toEqual(expect.arrayContaining(["--isolation=hyperv"]));
    expect(runArgv).not.toContain("--runtime=runsc");
  });

  it("prefixes an injected runner with the Windows docker context", async () => {
    const runner = recordingRunner(availableWin32Handler);
    const sandbox = createOsSandbox({
      platform: "win32",
      runner,
      dockerContext: "desktop-windows",
    });
    await sandbox.probe();
    expect(runner.calls[0]).toEqual(["-c", "desktop-windows", "info"]);
  });

  it("is fail-closed when probe reports docker missing", async () => {
    const runner = recordingRunner(() => {
      throw new Error("spawn docker ENOENT");
    });
    const sandbox = createOsSandbox({ platform: "linux", runner });
    expect(sandbox.isAvailable).toBe(false);
    const probed = await sandbox.probe();
    expect(probed.isAvailable).toBe(false);
    expect(probed.reason).toContain("ENOENT");
    await expect(sandbox.run("echo", ["hi"])).rejects.toThrow(/fail-closed/);
    expect(() => sandbox.wrapSpawn("node", ["server.js"])).toThrow(/fail-closed/);
  });

  it("is fail-closed when docker info exits non-zero", async () => {
    const runner = recordingRunner(() => result("", { exitCode: 1, stderr: "daemon down" }));
    const sandbox = createOsSandbox({ platform: "linux", runner });
    const probed = await sandbox.probe();
    expect(probed.isAvailable).toBe(false);
    expect(probed.reason).toContain("daemon down");
    await expect(sandbox.run("echo", ["hi"])).rejects.toThrow(/fail-closed/);
  });

  it("uses stdout when docker info fails without stderr", async () => {
    const runner = recordingRunner(() => result("cannot connect", { exitCode: 1 }));
    const sandbox = createOsSandbox({ platform: "linux", runner });
    const probed = await sandbox.probe();
    expect(probed.reason).toContain("cannot connect");
  });

  it("is fail-closed when the required runtime is absent", async () => {
    const runner = recordingRunner((argv) => {
      if (argv[0] === "info") return result("Runtimes: runc");
      return result("should-not-run");
    });
    const sandbox = createOsSandbox({ platform: "linux", runner });
    const probed = await sandbox.probe();
    expect(probed.isAvailable).toBe(false);
    expect(probed.reason).toContain("runsc");
    await expect(sandbox.run("echo", ["hi"])).rejects.toThrow(/fail-closed/);
  });

  it("treats non-linux/non-win32 as unsupported without host fallback", async () => {
    const runner = recordingRunner(() => result("docker is fine"));
    const sandbox = createOsSandbox({ platform: "darwin", runner });
    const probed = await sandbox.probe();
    expect(probed.isAvailable).toBe(false);
    expect(probed.isolation).toBe("unsupported");
    await expect(sandbox.run("echo", ["hi"])).rejects.toThrow(/fail-closed/);
    expect(runner.calls).toHaveLength(0);
  });

  it("auto-probes on run and still refuses when unavailable", async () => {
    const runner = recordingRunner(() => {
      throw new Error("no docker");
    });
    const sandbox = createOsSandbox({ platform: "linux", runner });
    await expect(sandbox.run("echo", ["hi"])).rejects.toThrow(/fail-closed/);
  });

  it("wrapSpawn returns docker -i argv after a successful probe", async () => {
    const runner = recordingRunner(availableLinuxHandler);
    const sandbox = createOsSandbox({ platform: "linux", runner, image: "alpine:3.20" });
    await sandbox.probe();
    const invocation = sandbox.wrapSpawn("node", ["mcp.js"]);
    expect(invocation.command).toBe("docker");
    expect(invocation.args).toEqual(
      expect.arrayContaining([
        "run",
        "--rm",
        "-i",
        "--runtime=runsc",
        "alpine:3.20",
        "node",
        "mcp.js",
      ]),
    );
  });

  it("survives a failed isolation format probe when info text already names the runtime", async () => {
    const runner = recordingRunner((argv) => {
      if (argv.includes("--format")) {
        throw new Error("format unsupported");
      }
      if (argv[0] === "info") return result("Default Isolation: hyperv");
      return result("ok");
    });
    const sandbox = createOsSandbox({ platform: "win32", runner });
    const probed = await sandbox.probe();
    expect(probed.isAvailable).toBe(true);
  });

  it("passes timeout, signal, and stdin through to the runner", async () => {
    const controller = new AbortController();
    const seen: Array<{ argv: readonly string[]; timeoutMs?: number; stdin?: string }> = [];
    const runner: DockerRunner = {
      async run(argv, options) {
        seen.push({
          argv,
          ...(options?.timeoutMs !== undefined ? { timeoutMs: options.timeoutMs } : {}),
          ...(options?.stdin !== undefined ? { stdin: options.stdin } : {}),
        });
        if (argv[0] === "info") {
          return argv.includes("--format") ? result('{"runsc":{}}') : result("runsc");
        }
        return result("from-stdin");
      },
    };
    const sandbox = createOsSandbox({ platform: "linux", runner });
    await sandbox.probe();
    const output = await sandbox.run("cat", [], {
      stdin: "payload",
      timeoutMs: 12,
      signal: controller.signal,
    });
    expect(output.stdout).toBe("from-stdin");
    const run = seen.find((entry) => entry.argv[0] === "run");
    expect(run?.stdin).toBe("payload");
    expect(run?.timeoutMs).toBe(12);
    expect(run?.argv).toContain("-i");
  });

  it("uses a generic reason when docker info fails with empty output", async () => {
    const runner = recordingRunner(() => result("", { exitCode: 1 }));
    const sandbox = createOsSandbox({ platform: "linux", runner });
    const probed = await sandbox.probe();
    expect(probed.reason).toBe("docker info failed");
  });

  it("wrapSpawn without a successful probe is fail-closed", () => {
    const sandbox = createOsSandbox({
      platform: "linux",
      runner: recordingRunner(availableLinuxHandler),
    });
    expect(() => sandbox.wrapSpawn("node")).toThrow(/fail-closed/);
  });

  it("stringifies non-Error probe failures", async () => {
    const runner = recordingRunner(() => {
      throw "docker exploded";
    });
    const sandbox = createOsSandbox({ platform: "linux", runner });
    const probed = await sandbox.probe();
    expect(probed.reason).toBe("docker exploded");
  });
});

describe("createProcessDockerRunner", () => {
  afterEach(() => {
    spawnMock.mockReset();
    vi.useRealTimers();
  });

  it("collects docker stdout/stderr and exit code", async () => {
    spawnMock.mockImplementation(() => {
      const child = createMockChild();
      process.nextTick(() => {
        child.stdout.emit("data", "hello");
        child.stderr.emit("data", "warn");
        child.emit("close", 0);
      });
      return child;
    });
    const runner = createProcessDockerRunner();
    const output = await runner.run(["info"]);
    expect(output).toEqual({ stdout: "hello", stderr: "warn", exitCode: 0 });
    expect(spawnMock).toHaveBeenCalledWith(
      "docker",
      ["info"],
      expect.objectContaining({ windowsHide: true }),
    );
  });

  it("runs docker inside a WSL distro", async () => {
    spawnMock.mockImplementation(() => {
      const child = createMockChild();
      process.nextTick(() => child.emit("close", 0));
      return child;
    });
    const runner = createWslDockerRunner("Ubuntu-24.04");
    await runner.run(["info"]);
    expect(spawnMock).toHaveBeenCalledWith(
      "wsl",
      ["-d", "Ubuntu-24.04", "-u", "root", "--", "docker", "info"],
      expect.objectContaining({ windowsHide: true }),
    );
    expect(() => createWslDockerRunner("  ")).toThrow(/WSL distro/);
  });

  it("prefixes docker argv with -c when a context is configured", async () => {
    spawnMock.mockImplementation(() => {
      const child = createMockChild();
      process.nextTick(() => child.emit("close", 0));
      return child;
    });
    const runner = createProcessDockerRunner({ dockerContext: "desktop-windows" });
    await runner.run(["info"]);
    expect(spawnMock).toHaveBeenCalledWith(
      "docker",
      ["-c", "desktop-windows", "info"],
      expect.objectContaining({ windowsHide: true }),
    );
  });

  it("rejects when docker cannot be spawned", async () => {
    spawnMock.mockImplementation(() => {
      const child = createMockChild();
      process.nextTick(() => {
        child.emit("error", new Error("spawn docker ENOENT"));
      });
      return child;
    });
    const runner = createProcessDockerRunner();
    await expect(runner.run(["info"])).rejects.toThrow("ENOENT");
  });

  it("writes stdin and rejects when aborted", async () => {
    const child = createMockChild();
    spawnMock.mockReturnValue(child);
    const runner = createProcessDockerRunner();
    const controller = new AbortController();
    const pending = runner.run(["run", "--rm", "alpine"], {
      stdin: "in",
      signal: controller.signal,
      env: { EXTRA: "1" },
    });
    expect(child.stdin.write).toHaveBeenCalledWith("in");
    expect(child.stdin.end).toHaveBeenCalled();
    controller.abort();
    child.emit("close", 1);
    await expect(pending).rejects.toThrow(/aborted/);
  });

  it("rejects when the docker command times out", async () => {
    vi.useFakeTimers();
    const child = createMockChild();
    spawnMock.mockReturnValue(child);
    const runner = createProcessDockerRunner();
    const pending = runner.run(["info"], { timeoutMs: 20 });
    await vi.advanceTimersByTimeAsync(20);
    child.emit("close", 1);
    await expect(pending).rejects.toThrow(/timed out/);
  });

  it("treats a null close code as failure", async () => {
    spawnMock.mockImplementation(() => {
      const child = createMockChild();
      process.nextTick(() => child.emit("close", null));
      return child;
    });
    const runner = createProcessDockerRunner();
    const output = await runner.run(["info"]);
    expect(output.exitCode).toBe(1);
  });

  it("ignores a late error after the process has already closed", async () => {
    spawnMock.mockImplementation(() => {
      const child = createMockChild();
      process.nextTick(() => {
        child.emit("close", 0);
        child.emit("error", new Error("late"));
      });
      return child;
    });
    const runner = createProcessDockerRunner();
    await expect(runner.run(["info"])).resolves.toEqual({
      stdout: "",
      stderr: "",
      exitCode: 0,
    });
  });

  it("uses process.platform when no platform is injected", () => {
    const sandbox = createOsSandbox({
      runner: recordingRunner(availableLinuxHandler),
    });
    expect(sandbox.platform).toBe(process.platform);
    expect(["hyperv", "runsc", "unsupported"]).toContain(sandbox.isolation);
  });
});
