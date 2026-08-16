import { describe, expect, it } from "vitest";
import { err, ok } from "@cantilune/core";
import { commsViolation } from "../../src/foundation/commsViolation.js";
import type { CommunicationTransport } from "../../src/ports/communicationTransport.js";
import {
  receiveSoon,
  runA2AConformanceHarness,
  type A2AConformancePair,
} from "../../src/conformance/a2aConformanceHarness.js";
import { encodeCommunicationWireFrame } from "../../src/codec/strictWireCodec.js";
import { buildTestEnvelope } from "../support/envelopeFixtures.js";

function stubTransport(overrides: Partial<CommunicationTransport> = {}): CommunicationTransport {
  return {
    transportId: "stub",
    dispatch: async () =>
      err(commsViolation("transport_failed", "send", "stub dispatch", { retryable: false })),
    receive: async () =>
      err(commsViolation("transport_failed", "receive", "stub receive", { retryable: true })),
    handshake: async () =>
      err(commsViolation("transport_failed", "session", "stub handshake", { retryable: false })),
    ...overrides,
  };
}

describe("a2a conformance harness — fail branches", () => {
  it("receiveSoon returns a non-retryable error immediately", async () => {
    const transport = stubTransport({
      receive: async () =>
        err(commsViolation("transport_failed", "receive", "hard fail", { retryable: false })),
    });
    const result = await receiveSoon(transport, 3, 1);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toBe("hard fail");
    }
  });

  it("receiveSoon exhausts retryable attempts", async () => {
    const transport = stubTransport();
    const result = await receiveSoon(transport, 2, 1);
    expect(result.ok).toBe(false);
  });

  it("receiveSoon retries then succeeds", async () => {
    let calls = 0;
    const transport = stubTransport({
      receive: async () => {
        calls += 1;
        if (calls < 2) {
          return err(commsViolation("transport_failed", "receive", "empty", { retryable: true }));
        }
        return ok(new Uint8Array([1, 2, 3]));
      },
    });
    const result = await receiveSoon(transport, 5, 1);
    expect(result.ok).toBe(true);
  });

  it("records dispatch/receive/handshake failures from a stub pair", async () => {
    const report = await runA2AConformanceHarness({
      transportId: "stub",
      createPair: () => ({ local: stubTransport(), remote: stubTransport() }),
    });
    expect(report.passed).toBe(false);
    expect(report.results.find((r) => r.id === "wire-versions")?.passed).toBe(false);
    expect(report.results.find((r) => r.id === "unknown-field-rejected")?.detail).toContain(
      "sendRawFrame",
    );
    expect(report.results.find((r) => r.id === "a2a-adapter-round-trip")?.detail).toContain(
      "sendRawFrame",
    );
  });

  it("fails unknown-field when sendRawFrame or receive fails", async () => {
    const local = stubTransport({
      sendRawFrame: async () =>
        err(commsViolation("transport_failed", "send", "raw failed", { retryable: false })),
    } as never);
    const report = await runA2AConformanceHarness({
      transportId: "stub-raw",
      createPair: () => ({ local, remote: stubTransport() }),
    });
    expect(report.results.find((r) => r.id === "unknown-field-rejected")?.detail).toContain(
      "raw failed",
    );
  });

  it("fails unknown-field when the codec unexpectedly accepts the frame", async () => {
    const envelope = buildTestEnvelope();
    const bytes = encodeCommunicationWireFrame(envelope);
    const local = stubTransport({
      sendRawFrame: async () => ok(undefined),
    } as never);
    const remote = stubTransport({
      receive: async () => ok(bytes),
    });
    const report = await runA2AConformanceHarness({
      transportId: "stub-accept",
      createPair: () => ({ local, remote }),
    });
    expect(report.results.find((r) => r.id === "unknown-field-rejected")?.detail).toContain(
      "unknown field",
    );
  });

  it("fails E-Stop cases when the stub ignores the frozen gate", async () => {
    const local = stubTransport({
      dispatch: async () => ok({ attemptRef: "x" }),
      handshake: async () => ok({ ackDigest: "x" }),
    });
    const remote = stubTransport({
      receive: async () => ok(new Uint8Array([1])),
    });
    const report = await runA2AConformanceHarness({
      transportId: "stub-estop",
      createPair: () => ({ local, remote }),
    });
    expect(report.results.find((r) => r.id === "e-stop-dispatch")?.detail).toContain("succeeded");
    expect(report.results.find((r) => r.id === "e-stop-receive")?.detail).toContain("succeeded");
    expect(report.results.find((r) => r.id === "e-stop-handshake")?.detail).toContain("succeeded");
  });

  it("fails E-Stop cases when the error is not an E-Stop message", async () => {
    const report = await runA2AConformanceHarness({
      transportId: "stub-other",
      createPair: () => ({ local: stubTransport(), remote: stubTransport() }),
    });
    expect(report.results.find((r) => r.id === "e-stop-dispatch")?.passed).toBe(false);
    expect(report.results.find((r) => r.id === "e-stop-receive")?.passed).toBe(false);
    expect(report.results.find((r) => r.id === "e-stop-handshake")?.passed).toBe(false);
  });

  it("closes transports that expose close() when the pair does not", async () => {
    let closed = 0;
    const local = Object.assign(stubTransport(), {
      close: async () => {
        closed += 1;
      },
    });
    const remote = Object.assign(stubTransport(), {
      close: async () => {
        closed += 1;
      },
    });
    await runA2AConformanceHarness({
      transportId: "closable-sides",
      createPair: () => ({ local, remote }),
    });
    expect(closed).toBeGreaterThan(0);
  });

  it("closes a pair that exposes close()", async () => {
    let closed = 0;
    const pair: A2AConformancePair = {
      local: stubTransport(),
      remote: stubTransport(),
      close: async () => {
        closed += 1;
      },
    };
    await runA2AConformanceHarness({
      transportId: "closable",
      createPair: () => pair,
    });
    expect(closed).toBeGreaterThan(0);
  });

  it("fails the A2A adapter case when sendRawFrame or receive fails", async () => {
    const failingRaw = {
      ...stubTransport(),
      sendRawFrame: async () =>
        err(commsViolation("transport_failed", "send", "a2a send failed", { retryable: false })),
    };
    const report = await runA2AConformanceHarness({
      transportId: "stub-a2a",
      createPair: () => ({ local: failingRaw, remote: stubTransport() }),
    });
    expect(report.results.find((r) => r.id === "a2a-adapter-round-trip")?.detail).toContain(
      "a2a send failed",
    );
  });

  it("fails the A2A adapter case when the received bytes are not an A2A frame", async () => {
    const local = {
      ...stubTransport(),
      sendRawFrame: async () => ok(undefined),
    };
    const remote = stubTransport({
      receive: async () => ok(new TextEncoder().encode("not-an-a2a-frame")),
    });
    const report = await runA2AConformanceHarness({
      transportId: "stub-a2a-decode",
      createPair: () => ({ local, remote }),
    });
    expect(report.results.find((r) => r.id === "a2a-adapter-round-trip")?.passed).toBe(false);
  });

  it("fails wire-versions when receive returns non-JSON", async () => {
    const local = stubTransport({
      dispatch: async () => ok({ attemptRef: "x" }),
    });
    const remote = stubTransport({
      receive: async () => ok(new TextEncoder().encode("not-json")),
    });
    const report = await runA2AConformanceHarness({
      transportId: "stub-parse",
      createPair: () => ({ local, remote }),
    });
    expect(report.results.find((r) => r.id === "wire-versions")?.passed).toBe(false);
    expect(report.results.find((r) => r.id === "integrity-digest")?.passed).toBe(false);
  });

  it("records a non-Error throw from the pair factory", async () => {
    const report = await runA2AConformanceHarness({
      transportId: "throw-string",
      createPair: () => {
        throw "boom";
      },
    });
    expect(report.results.some((r) => r.detail === "unknown error")).toBe(true);
  });
});
