import { describe, expect, it } from "vitest";
import { parseChangeWire, parseSnapshotWire } from "../../../src/codec/wireValidation.js";

describe("codec invalid wire", () => {
  it("returns codec_invalid for duplicate binding roles", () => {
    const result = parseChangeWire({
      changeId: "chg-dup",
      recordedAt: "2026-08-07T10:05:00Z",
      epochId: "42",
      operationTypeId: "delegate",
      beforeRef: "snap-S0",
      afterRef: "snap-S1",
      matchBindings: [
        { role: "task", id: "task-0" },
        { role: "task", id: "task-1" },
      ],
      targets: [
        { kind: "artifact", id: "task-0" },
        { kind: "artifact", id: "task-1" },
      ],
      initiator: { actorId: "planner-p", kind: "agent" },
      involved: [],
      authorization: [],
      external: [],
      createdSessionRefs: [],
      visibility: "external",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.violation.code).toBe("codec_invalid");
    }
  });

  it("returns codec_invalid for malformed snapshot participant", () => {
    const result = parseSnapshotWire({
      snapshotRef: "snap-S0",
      epochId: "42",
      participants: [{ actorId: "p1", kind: "not-a-kind", status: "active" }],
      artifacts: [],
      links: [],
      sessions: [],
      capabilities: [],
      policyContext: { approvalState: { kind: "none" }, retryState: { kind: "idle" } },
      auditTail: [],
      retiredEntities: [],
    });
    expect(result.ok).toBe(false);
  });
});
