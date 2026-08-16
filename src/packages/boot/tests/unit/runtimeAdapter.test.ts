import { describe, it, expect, vi } from "vitest";
import { wrapCoordinationRuntime } from "../../src/runtimeAdapter.js";
import type { CoordinationRuntime } from "@cantilune/runtime";

function mockRuntime(overrides: Partial<CoordinationRuntime>): CoordinationRuntime {
  return {
    getHead: () => undefined,
    getRunHistory: () => undefined,
    observe: vi.fn(),
    admit: vi.fn(),
    commit: vi.fn(),
    proposeAndCommit: vi.fn(),
    replay: vi.fn(),
    admitComposition: vi.fn(),
    cancelAdmission: vi.fn(),
    ...overrides,
  } as CoordinationRuntime;
}

describe("wrapCoordinationRuntime", () => {
  it("delegates getHead to the underlying runtime", () => {
    const head = { snapshotRef: "snap-1" } as ReturnType<CoordinationRuntime["getHead"]>;
    const rt = mockRuntime({ getHead: () => head });
    const wrapped = wrapCoordinationRuntime(rt);
    expect(wrapped.getHead()).toBe(head);
  });

  it("maps successful observe to ok:true", () => {
    const rt = mockRuntime({
      observe: vi.fn().mockReturnValue({ snapshot: {}, entry: {} }),
    });
    const wrapped = wrapCoordinationRuntime(rt);
    expect(wrapped.observe({ source: {}, payloadRef: {} }, {})).toEqual({ ok: true });
  });

  it("maps observe runtime violation to ok:false with message", () => {
    const rt = mockRuntime({
      observe: vi.fn().mockReturnValue({ code: "observe_invalid", message: "principal required" }),
    });
    const wrapped = wrapCoordinationRuntime(rt);
    expect(wrapped.observe({ source: {}, payloadRef: {} })).toEqual({
      ok: false,
      message: "principal required",
    });
  });

  it("maps successful proposeAndCommit to ok:true", () => {
    const rt = mockRuntime({
      proposeAndCommit: vi.fn().mockReturnValue({ after: { snapshotRef: "snap-2" } }),
    });
    const wrapped = wrapCoordinationRuntime(rt);
    expect(wrapped.proposeAndCommit({}, {})).toEqual({ ok: true, newHeadRef: "snap-2" });
  });

  it("maps proposeAndCommit runtime violation to ok:false with message", () => {
    const rt = mockRuntime({
      proposeAndCommit: vi
        .fn()
        .mockReturnValue({ code: "commit_failed", message: "durable error" }),
    });
    const wrapped = wrapCoordinationRuntime(rt);
    expect(wrapped.proposeAndCommit({}, {})).toEqual({ ok: false, message: "durable error" });
  });

  /**
   * This boundary used to read `reason.message ?? reason.kind`, but no variant
   * of the reject union has a `message` field, so it always collapsed to the
   * bare tag and discarded the payload. The agent reads this string to correct
   * itself, so the detail has to survive.
   */
  it("renders an admission rejection with its payload, not just the kind", () => {
    const rt = mockRuntime({
      proposeAndCommit: vi.fn().mockReturnValue({
        ok: false,
        reason: { kind: "missing_role", role: "participant" },
      }),
    });
    const wrapped = wrapCoordinationRuntime(rt);
    const result = wrapped.proposeAndCommit({}, {});
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toContain("missing_role");
    expect(result.message).toContain("participant");
  });

  it("names both epochs when a rejection is an epoch mismatch", () => {
    const rt = mockRuntime({
      proposeAndCommit: vi.fn().mockReturnValue({
        ok: false,
        reason: {
          kind: "epoch_mismatch",
          headEpochId: "boot-epoch-1",
          activeEpochId: "42",
        },
      }),
    });
    const wrapped = wrapCoordinationRuntime(rt);
    const result = wrapped.proposeAndCommit({}, {});
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toContain("boot-epoch-1");
    expect(result.message).toContain("42");
  });

  it("still renders variants that carry no payload", () => {
    const rt = mockRuntime({
      proposeAndCommit: vi.fn().mockReturnValue({
        ok: false,
        reason: { kind: "resource_conflict" },
      }),
    });
    const wrapped = wrapCoordinationRuntime(rt);
    const result = wrapped.proposeAndCommit({}, {});
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toContain("resource_conflict");
  });

  it("fails closed when the runtime returns a committed result with no `after` receipt", () => {
    // A result that is neither a violation ({code}) nor an admission rejection
    // ({ok:false}) nor a committed ({after}) — the defensive guard surfaces it
    // rather than silently returning ok:true.
    const rt = mockRuntime({
      proposeAndCommit: vi.fn().mockReturnValue({ ok: true } as unknown as never),
    });
    const wrapped = wrapCoordinationRuntime(rt);
    const result = wrapped.proposeAndCommit({}, {});
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toContain("uncommitted");
  });

  it("fails closed when the commit receipt has an invalid snapshotRef (non-string / empty)", () => {
    const rt = mockRuntime({
      proposeAndCommit: vi.fn().mockReturnValue({ after: { snapshotRef: "" } }),
    });
    const wrapped = wrapCoordinationRuntime(rt);
    const result = wrapped.proposeAndCommit({}, {});
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toContain("invalid commit receipt");
  });

  it("fails closed when the commit receipt snapshotRef is not a string", () => {
    const rt = mockRuntime({
      proposeAndCommit: vi
        .fn()
        .mockReturnValue({ after: { snapshotRef: 123 as unknown as string } }),
    });
    const wrapped = wrapCoordinationRuntime(rt);
    const result = wrapped.proposeAndCommit({}, {});
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toContain("invalid commit receipt");
  });
});
