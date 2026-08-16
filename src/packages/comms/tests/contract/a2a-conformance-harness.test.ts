/**
 * ADR-0018 T4 — pinned a2a/0.1 conformance harness as a CI gate.
 *
 * Runs the same case matrix against LoopbackTransport, FileTransport, and
 * NetTransport. A failure here is a release blocker for the transport; it is
 * not an independent Security/Threat-Model sign-off.
 */
import { describe, expect, it, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LoopbackTransport } from "../../src/memory/loopbackTransport.js";
import { connectFileTransportPair } from "../../src/transports/file/fileTransport.js";
import { connectNetTransportPair } from "../../src/transports/net/netTransport.js";
import {
  runA2AConformanceHarness,
  A2A_CONFORMANCE_CASE_IDS,
  type A2AConformancePair,
} from "../../src/conformance/a2aConformanceHarness.js";
import { A2A_PROFILE_PINNED } from "../../src/foundation/commsLimits.js";

const dirs: string[] = [];

afterEach(() => {
  for (const dir of dirs.splice(0, dirs.length)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function filePair(options?: { eStopGate?: A2AConformancePair["eStopGate"] }): A2AConformancePair {
  const dir = mkdtempSync(join(tmpdir(), "cantilune-a2a-file-"));
  dirs.push(dir);
  const pairOpts = options?.eStopGate !== undefined ? { eStopGate: options.eStopGate } : undefined;
  const [local, remote] = connectFileTransportPair(dir, pairOpts);
  return {
    local,
    remote,
    ...(options?.eStopGate !== undefined ? { eStopGate: options.eStopGate } : {}),
  };
}

function loopbackPair(options?: {
  eStopGate?: A2AConformancePair["eStopGate"];
}): A2AConformancePair {
  const pairOpts = options?.eStopGate !== undefined ? { eStopGate: options.eStopGate } : undefined;
  const [local, remote] = LoopbackTransport.connectPair(pairOpts);
  return {
    local,
    remote,
    ...(options?.eStopGate !== undefined ? { eStopGate: options.eStopGate } : {}),
  };
}

async function netPair(options?: {
  eStopGate?: A2AConformancePair["eStopGate"];
}): Promise<A2AConformancePair> {
  const [local, remote] = await connectNetTransportPair({
    ...(options?.eStopGate !== undefined ? { eStopGate: options.eStopGate } : {}),
    readyTimeoutMs: 8_000,
  });
  return {
    local,
    remote,
    close: async () => {
      await local.close();
    },
  };
}

describe("a2a/0.1 conformance harness (ADR-0018 T4)", () => {
  it("pins the profile string", () => {
    expect(A2A_PROFILE_PINNED).toBe("a2a/0.1");
    expect(A2A_CONFORMANCE_CASE_IDS).toContain("registry-60-codes");
    expect(A2A_CONFORMANCE_CASE_IDS).toContain("admission-reconnect");
    expect(A2A_CONFORMANCE_CASE_IDS).toContain("e-stop-handshake");
  });

  it("is green on LoopbackTransport", async () => {
    const report = await runA2AConformanceHarness({
      transportId: "loopback",
      createPair: (options) => loopbackPair(options),
    });
    expect(report.profile).toBe("a2a/0.1");
    expect(report.passed).toBe(true);
    expect(report.results).toHaveLength(A2A_CONFORMANCE_CASE_IDS.length);
  });

  it("is green on FileTransport", async () => {
    const report = await runA2AConformanceHarness({
      transportId: "file",
      createPair: (options) => filePair(options),
    });
    expect(report.passed).toBe(true);
  });

  it("is green on NetTransport (CI gate)", async () => {
    const report = await runA2AConformanceHarness({
      transportId: "net",
      createPair: (options) => netPair(options),
    });
    expect(report.transportId).toBe("net");
    const failed = report.results.filter((result) => !result.passed);
    expect(failed).toEqual([]);
    expect(report.passed).toBe(true);
  });
});
