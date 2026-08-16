import { describe, expect, it } from "vitest";
import {
  assertSandboxIsolation,
  hyperVSkuSupported,
  probeSandboxHost,
  sandboxIsolationRequired,
  type HostCommandRunner,
} from "../../src/sandbox/sandboxHostProbe.js";
import {
  createOsSandbox,
  type DockerRunner,
  type DockerRunResult,
} from "../../src/sandbox/osSandbox.js";

function result(stdout: string, extras: Partial<DockerRunResult> = {}): DockerRunResult {
  return { stdout, stderr: "", exitCode: 0, ...extras };
}

function dockerRunner(handler: (argv: readonly string[]) => DockerRunResult): DockerRunner {
  return {
    async run(argv) {
      return handler(argv);
    },
  };
}

function availableWin32Docker(): DockerRunner {
  return dockerRunner((argv) => {
    if (argv[0] === "info" && argv.includes("--format")) return result("hyperv");
    if (argv[0] === "info") return result("Isolation: hyperv");
    return result("ok");
  });
}

function availableLinuxDocker(): DockerRunner {
  return dockerRunner((argv) => {
    if (argv[0] === "info" && argv.includes("--format")) {
      return result('{"runsc":{"path":"/usr/bin/runsc"}}');
    }
    if (argv[0] === "info") return result("Runtimes: runc runsc");
    return result("ok");
  });
}

function downDocker(): DockerRunner {
  return dockerRunner(() => result("", { exitCode: 1, stderr: "daemon down" }));
}

function scriptRunner(
  scripts: Record<string, { stdout: string; exitCode?: number }>,
): HostCommandRunner {
  return {
    async run(command, args) {
      const key = [command, ...args].join(" ");
      const hit = Object.entries(scripts).find(([pattern]) => key.includes(pattern));
      if (hit === undefined) {
        throw new Error(`unexpected host command: ${key}`);
      }
      return { stdout: hit[1].stdout, stderr: "", exitCode: hit[1].exitCode ?? 0 };
    },
  };
}

describe("sandboxHostProbe", () => {
  it("requires isolation only for multi-host or explicit flags", () => {
    expect(sandboxIsolationRequired({})).toBe(false);
    expect(sandboxIsolationRequired({ CANTILUNE_HOST_MODE: "multi" })).toBe(true);
    expect(sandboxIsolationRequired({ CANTILUNE_REQUIRE_SANDBOX: "1" })).toBe(true);
  });

  it("treats Windows Home as an unsupported Hyper-V SKU", () => {
    expect(hyperVSkuSupported("Windows 10 Home China", "CoreCountrySpecific")).toBe(false);
    expect(hyperVSkuSupported("Windows 11 Pro", "Professional")).toBe(true);
  });

  it("auto-selects WSL runsc on Windows Home when the distro is ready", async () => {
    const ready = await probeSandboxHost({
      platform: "win32",
      wslDistro: "Ubuntu-24.04",
      sandbox: createOsSandbox({ platform: "linux", runner: availableLinuxDocker() }),
      runner: {
        async run(command, args) {
          const key = [command, ...args].join(" ");
          if (key.includes("HypervisorPresent")) {
            return { stdout: "True", stderr: "", exitCode: 0 };
          }
          if (key.includes("vmms") || key.includes("Get-Service")) {
            return { stdout: "", stderr: "", exitCode: 0 };
          }
          if (key.includes("CurrentVersion") || key.includes("ProductName")) {
            return { stdout: "Windows 10 Home China|CoreCountrySpecific", stderr: "", exitCode: 0 };
          }
          if (key.includes("runsc")) {
            return { stdout: "runsc version release", stderr: "", exitCode: 0 };
          }
          if (command === "wsl" && args.includes("-l")) {
            return { stdout: "Ubuntu-24.04\n", stderr: "", exitCode: 0 };
          }
          throw new Error(`unexpected host command: ${key}`);
        },
      },
    });
    expect(ready.isolation).toBe("runsc");
    expect(ready.isolationReady).toBe(true);
    expect(ready.hyperVSkuSupported).toBe(false);
    expect(ready.wslDistro).toBe("Ubuntu-24.04");
    expect(ready.windowsEdition).toContain("Home");

    const detected = await probeSandboxHost({
      platform: "win32",
      env: {},
      sandbox: createOsSandbox({ platform: "linux", runner: availableLinuxDocker() }),
      runner: {
        async run(command, args) {
          const key = [command, ...args].join(" ");
          if (key.includes("HypervisorPresent")) {
            return { stdout: "True", stderr: "", exitCode: 0 };
          }
          if (key.includes("vmms") || key.includes("Get-Service")) {
            return { stdout: "", stderr: "", exitCode: 0 };
          }
          if (key.includes("CurrentVersion")) {
            return { stdout: "Windows 11 Home|CoreSingleLanguage", stderr: "", exitCode: 0 };
          }
          if (command === "wsl" && args.includes("-l")) {
            return { stdout: "* docker-desktop\nUbuntu-24.04\n", stderr: "", exitCode: 0 };
          }
          if (key.includes("runsc")) {
            return { stdout: "runsc version", stderr: "", exitCode: 0 };
          }
          throw new Error(`unexpected host command: ${key}`);
        },
      },
    });
    expect(detected.wslDistro).toBe("Ubuntu-24.04");
    expect(detected.isolation).toBe("runsc");
  });

  it("keeps explicit Hyper-V fail-closed on Windows Home", async () => {
    const forced = await probeSandboxHost({
      platform: "win32",
      isolation: "hyperv",
      sandbox: createOsSandbox({ platform: "win32", runner: availableWin32Docker() }),
      runner: scriptRunner({
        HypervisorPresent: { stdout: "True" },
        vmms: { stdout: "" },
        CurrentVersion: { stdout: "Windows 10 Home China|CoreCountrySpecific" },
      }),
    });
    expect(forced.isolation).toBe("hyperv");
    expect(forced.isolationReady).toBe(false);
    expect(forced.reason).toMatch(/Home/);
  });

  it("marks win32 ready only when Hypervisor, VMMS, and Hyper-V docker are present", async () => {
    const ready = await probeSandboxHost({
      platform: "win32",
      sandbox: createOsSandbox({ platform: "win32", runner: availableWin32Docker() }),
      runner: scriptRunner({
        HypervisorPresent: { stdout: "True" },
        vmms: { stdout: "Running" },
      }),
    });
    expect(ready.isolationReady).toBe(true);
    expect(ready.hypervisorPresent).toBe(true);
    expect(ready.vmmsRunning).toBe(true);
    expect(() => assertSandboxIsolation(ready, { CANTILUNE_REQUIRE_SANDBOX: "1" })).not.toThrow();

    const noHypervisor = await probeSandboxHost({
      platform: "win32",
      sandbox: createOsSandbox({ platform: "win32", runner: availableWin32Docker() }),
      runner: scriptRunner({
        HypervisorPresent: { stdout: "False" },
        vmms: { stdout: "Stopped" },
      }),
    });
    expect(noHypervisor.isolationReady).toBe(false);
    expect(noHypervisor.hypervisorPresent).toBe(false);

    const missingVmms = await probeSandboxHost({
      platform: "win32",
      sandbox: createOsSandbox({ platform: "win32", runner: availableWin32Docker() }),
      runner: scriptRunner({
        HypervisorPresent: { stdout: "True" },
        vmms: { stdout: "" },
      }),
    });
    expect(missingVmms.isolationReady).toBe(false);
    expect(missingVmms.reason).toMatch(/VMMS/);
    expect(() => assertSandboxIsolation(missingVmms, { CANTILUNE_HOST_MODE: "multi" })).toThrow(
      /fail-closed/,
    );
  });

  it("marks linux ready only when runsc and the docker runtime are present", async () => {
    const ready = await probeSandboxHost({
      platform: "linux",
      sandbox: createOsSandbox({ platform: "linux", runner: availableLinuxDocker() }),
      runner: scriptRunner({
        "runsc --version": { stdout: "runsc version" },
      }),
    });
    expect(ready.isolationReady).toBe(true);
    expect(ready.runscPresent).toBe(true);

    const viaWhich = await probeSandboxHost({
      platform: "linux",
      sandbox: createOsSandbox({ platform: "linux", runner: availableLinuxDocker() }),
      runner: {
        async run(command, args) {
          if (command === "runsc") {
            return { stdout: "", stderr: "bad", exitCode: 1 };
          }
          if (command === "sh" && args.includes("command -v runsc")) {
            return { stdout: "/usr/bin/runsc\n", stderr: "", exitCode: 0 };
          }
          throw new Error(`unexpected ${command}`);
        },
      },
    });
    expect(viaWhich.runscPresent).toBe(true);
    expect(viaWhich.isolationReady).toBe(true);

    const dockerConfirmed = await probeSandboxHost({
      platform: "linux",
      sandbox: createOsSandbox({ platform: "linux", runner: availableLinuxDocker() }),
      runner: {
        async run() {
          throw new Error("ENOENT");
        },
      },
    });
    expect(dockerConfirmed.runscPresent).toBe(true);
    expect(dockerConfirmed.isolationReady).toBe(true);

    const missing = await probeSandboxHost({
      platform: "linux",
      sandbox: createOsSandbox({
        platform: "linux",
        runner: dockerRunner((argv) =>
          argv[0] === "info" ? result("Runtimes: runc") : result("ok"),
        ),
      }),
      runner: {
        async run() {
          throw new Error("ENOENT");
        },
      },
    });
    expect(missing.isolationReady).toBe(false);
    expect(missing.runscPresent).toBe(false);
  });

  it("runs a real host command through the process runner", async () => {
    const { createProcessHostCommandRunner } =
      await import("../../src/sandbox/sandboxHostProbe.js");
    const result = await createProcessHostCommandRunner().run(process.execPath, [
      "-e",
      "process.stdout.write('ok')",
    ]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("ok");
  });

  it("fail-closes unsupported platforms and a down docker daemon", async () => {
    const darwin = await probeSandboxHost({ platform: "darwin" });
    expect(darwin.isolationReady).toBe(false);
    expect(darwin.isolation).toBe("unsupported");

    const down = await probeSandboxHost({
      platform: "win32",
      sandbox: createOsSandbox({ platform: "win32", runner: downDocker() }),
      runner: scriptRunner({
        HypervisorPresent: { stdout: "True" },
        vmms: { stdout: "Running" },
      }),
    });
    expect(down.dockerAvailable).toBe(false);
    expect(down.isolationReady).toBe(false);
    expect(() => assertSandboxIsolation(down, {})).not.toThrow();
  });
});
