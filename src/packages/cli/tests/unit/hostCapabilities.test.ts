import { describe, expect, it } from "vitest";
import {
  assertHostCapabilities,
  assertRequiredHostCapabilities,
  formatHostCapabilityReport,
  hostRequirementsFromEnv,
  isHostCapabilityReport,
  probeHostCapabilities,
} from "../../src/wiring/hostCapabilities.js";
import type { PostgresHaProbe, RaftClusterProbe } from "@cantilune/runtime/memory";
import type { SandboxHostProbe } from "@cantilune/tools";

function postgres(overrides: Partial<PostgresHaProbe> = {}): PostgresHaProbe {
  return {
    urlConfigured: false,
    host: "127.0.0.1",
    port: 5432,
    tcpReachable: false,
    haReady: false,
    reason: "CANTILUNE_DURABLE_DATABASE_URL unset",
    ...overrides,
  };
}

function raft(overrides: Partial<RaftClusterProbe> = {}): RaftClusterProbe {
  return {
    endpointsConfigured: false,
    embedRequested: false,
    endpoints: [],
    host: "127.0.0.1",
    port: 2379,
    tcpReachable: false,
    ready: false,
    reason: "CANTILUNE_RAFT_ENDPOINTS unset",
    ...overrides,
  };
}

function sandbox(overrides: Partial<SandboxHostProbe> = {}): SandboxHostProbe {
  return {
    platform: "win32",
    isolation: "hyperv",
    isolationReady: false,
    dockerAvailable: false,
    hypervisorPresent: true,
    vmmsRunning: false,
    reason: "Hyper-V VMMS service is not Running",
    ...overrides,
  };
}

describe("hostCapabilities", () => {
  it("treats daily mode as report-only and multi-host as required", () => {
    expect(hostRequirementsFromEnv({})).toEqual({
      postgresHa: false,
      raft: false,
      sandbox: false,
      multi: false,
    });
    expect(hostRequirementsFromEnv({ CANTILUNE_HOST_MODE: "multi" })).toEqual({
      postgresHa: false,
      raft: false,
      sandbox: true,
      multi: true,
    });
    expect(hostRequirementsFromEnv({ CANTILUNE_REQUIRE_RAFT: "1" })).toEqual({
      postgresHa: false,
      raft: true,
      sandbox: false,
      multi: false,
    });
  });

  it("probes injected ports and stays ok when nothing is required", async () => {
    const report = await probeHostCapabilities({
      env: {},
      postgres: {
        env: {},
        dialer: { connect: async () => false },
      },
      raft: {
        env: {},
        dialer: { connect: async () => false },
      },
      sandbox: {
        platform: "win32",
        sandbox: {
          isAvailable: false,
          platform: "win32",
          isolation: "hyperv",
          async probe() {
            return {
              isAvailable: false,
              platform: "win32",
              isolation: "hyperv",
              reason: "docker down",
            };
          },
          async run() {
            throw new Error("unused");
          },
          wrapSpawn() {
            throw new Error("unused");
          },
        },
        runner: {
          async run() {
            return { stdout: "False", stderr: "", exitCode: 0 };
          },
        },
      },
    });
    expect(report.ok).toBe(true);
    expect(report.postgres.haReady).toBe(false);
    expect(report.sandbox.isolationReady).toBe(false);
    expect(formatHostCapabilityReport(report)).toContain("postgres.ha:");
    expect(formatHostCapabilityReport(report)).toContain("raft:");
    expect(isHostCapabilityReport(report)).toBe(true);
    expect(isHostCapabilityReport({})).toBe(false);
    expect(() => assertHostCapabilities(report)).not.toThrow();
    await expect(assertRequiredHostCapabilities({ env: {} })).resolves.toBeUndefined();
  });

  it("fail-closes multi-host when HA or isolation is missing", async () => {
    const report = await probeHostCapabilities({
      env: { CANTILUNE_HOST_MODE: "multi" },
      postgres: {
        env: { CANTILUNE_HOST_MODE: "multi" },
        dialer: { connect: async () => false },
      },
      raft: {
        env: { CANTILUNE_HOST_MODE: "multi" },
        dialer: { connect: async () => false },
      },
      sandbox: {
        platform: "linux",
        sandbox: {
          isAvailable: false,
          platform: "linux",
          isolation: "runsc",
          async probe() {
            return {
              isAvailable: false,
              platform: "linux",
              isolation: "runsc",
              reason: "no runsc",
            };
          },
          async run() {
            throw new Error("unused");
          },
          wrapSpawn() {
            throw new Error("unused");
          },
        },
        runner: {
          async run() {
            throw new Error("ENOENT");
          },
        },
      },
    });
    expect(report.ok).toBe(false);
    expect(report.failClosedReasons.length).toBeGreaterThan(0);
    expect(() => assertHostCapabilities(report)).toThrow(/fail-closed/);
    await expect(
      assertRequiredHostCapabilities({
        env: { CANTILUNE_REQUIRE_SANDBOX: "1" },
        postgres: { env: {}, dialer: { connect: async () => false } },
        raft: { env: {}, dialer: { connect: async () => false } },
        sandbox: {
          platform: "darwin",
        },
      }),
    ).rejects.toThrow(/fail-closed/);
    expect(postgres().haReady).toBe(false);
    expect(sandbox().isolationReady).toBe(false);
    const readyText = formatHostCapabilityReport({
      platform: "linux",
      postgres: postgres({
        urlConfigured: true,
        tcpReachable: true,
        haReady: true,
        replicaCount: 1,
      }),
      raft: raft({ ready: true, endpointsConfigured: true, tcpReachable: true }),
      sandbox: {
        platform: "linux",
        isolation: "runsc",
        isolationReady: true,
        dockerAvailable: true,
        runscPresent: true,
      },
      required: { postgresHa: true, raft: false, sandbox: true, multi: true },
      ok: true,
      failClosedReasons: [],
    });
    expect(readyText).toContain("HA ready");
    expect(readyText).toContain("etcd ready");
    expect(readyText).toContain("runsc ready");
    expect(readyText).toContain("sandbox.runsc: present");
    expect(
      formatHostCapabilityReport({
        platform: "win32",
        postgres: postgres({ haReady: true, urlConfigured: true, tcpReachable: true }),
        raft: raft(),
        sandbox: {
          platform: "win32",
          isolation: "runsc",
          isolationReady: true,
          dockerAvailable: true,
          runscPresent: true,
          hyperVSkuSupported: false,
          windowsEdition: "Windows 10 Home China (CoreCountrySpecific)",
          wslDistro: "Ubuntu-24.04",
        },
        required: { postgresHa: false, raft: false, sandbox: false, multi: false },
        ok: true,
        failClosedReasons: [],
      }),
    ).toContain("sandbox.wslDistro: Ubuntu-24.04");
  });
});
