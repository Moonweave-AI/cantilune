import { describe, expect, it } from "vitest";
import { encodeChange } from "../../../src/codec/changeCodec.js";
import { decodeChangeFromUnknown, parseChangeWireDto } from "../../../src/codec/changeCodec.js";
import { parseChangeWire, parseSnapshotWire } from "../../../src/codec/wireValidation.js";
import {
  changeId,
  coordinationChange,
  epochId,
  matchBinding,
  operationTypeId,
  snapshotRef,
} from "@cantilune/core";
import { actorRef, actorId } from "@cantilune/core";
import { timestamp } from "@cantilune/core";

function validChangeWire(overrides: Record<string, unknown> = {}) {
  return {
    changeId: "chg-1",
    recordedAt: "2026-08-07T10:05:00Z",
    epochId: "42",
    operationTypeId: "introduce_artifact",
    beforeRef: "snap-S0",
    afterRef: "snap-S1",
    matchBindings: [{ role: "task", id: "task-0" }],
    targets: [{ kind: "artifact", id: "task-0" }],
    initiator: { actorId: "planner-p", kind: "agent" },
    involved: [],
    authorization: [],
    external: [],
    createdSessionRefs: [],
    visibility: "external",
    ...overrides,
  };
}

function validSnapshotWire(overrides: Record<string, unknown> = {}) {
  return {
    snapshotRef: "snap-S0",
    epochId: "42",
    participants: [],
    artifacts: [],
    links: [],
    sessions: [],
    capabilities: [],
    policyContext: { approvalState: { kind: "none" }, retryState: { kind: "idle" } },
    auditTail: [],
    retiredEntities: [],
    ...overrides,
  };
}

describe("wireValidation", () => {
  it("rejects non-object change wire input", () => {
    expect(parseChangeWire(null).ok).toBe(false);
    expect(parseChangeWire("not-an-object").ok).toBe(false);
    expect(parseChangeWire(validChangeWire({ changeId: "" })).ok).toBe(false);
    expect(parseChangeWire(validChangeWire({ matchBindings: "bad" })).ok).toBe(false);
    expect(parseChangeWire(validChangeWire({ involved: [{}] })).ok).toBe(false);
    expect(parseSnapshotWire(null).ok).toBe(false);
    expect(parseSnapshotWire(validSnapshotWire({ snapshotRef: "" })).ok).toBe(false);
  });

  it("accepts a valid participant manifestRef and rejects invalid ones (ADR-0015)", () => {
    const validParticipant = {
      actorId: "agent-1",
      kind: "agent",
      status: "active",
      manifestRef: "sha256:manifest-agent-1",
    };
    const okWire = parseSnapshotWire(
      validSnapshotWire({ participants: [validParticipant] }),
    );
    expect(okWire.ok).toBe(true);
    if (!okWire.ok) return;
    expect(okWire.value.participants[0]!.manifestRef).toBe("sha256:manifest-agent-1");

    // empty manifestRef rejected
    const emptyRef = parseSnapshotWire(
      validSnapshotWire({ participants: [{ ...validParticipant, manifestRef: "" }] }),
    );
    expect(emptyRef.ok).toBe(false);

    // non-string manifestRef rejected
    const nonStringRef = parseSnapshotWire(
      validSnapshotWire({ participants: [{ ...validParticipant, manifestRef: 42 }] }),
    );
    expect(nonStringRef.ok).toBe(false);

    // absent manifestRef accepted (non-agent / pre-activation)
    const absentRef = parseSnapshotWire(
      validSnapshotWire({
        participants: [{ actorId: "agent-1", kind: "agent", status: "registered" }],
      }),
    );
    expect(absentRef.ok).toBe(true);
    if (!absentRef.ok) return;
    expect(absentRef.value.participants[0]!.manifestRef).toBeUndefined();
  });

  it("rejects targets that diverge from matchBindings", () => {
    const result = parseChangeWireDto({
      changeId: "chg-1",
      recordedAt: "2026-08-07T10:05:00Z",
      epochId: "42",
      operationTypeId: "introduce_artifact",
      beforeRef: "snap-S0",
      afterRef: "snap-S1",
      matchBindings: [{ role: "task", id: "task-0" }],
      targets: [{ kind: "artifact", id: "task-OTHER" }],
      initiator: { actorId: "planner-p", kind: "agent" },
      involved: [],
      authorization: [],
      external: [],
      createdSessionRefs: [],
      visibility: "external",
    });
    expect(result.ok).toBe(false);
  });

  it("round-trips valid change through unknown decode", () => {
    const original = coordinationChange({
      changeId: changeId("chg-001"),
      recordedAt: timestamp("2026-08-07T10:05:00Z"),
      epochId: epochId("42"),
      operationTypeId: operationTypeId("introduce_artifact"),
      beforeRef: snapshotRef("snap-S0"),
      afterRef: snapshotRef("snap-S1"),
      matchBindings: [matchBinding("task", "task-T"), matchBinding("from", "planner-p")],
      initiator: actorRef(actorId("planner-p"), "agent"),
      visibility: "external",
    });

    const wire = encodeChange(original);
    const decoded = decodeChangeFromUnknown(JSON.parse(JSON.stringify(wire)));
    expect("code" in decoded).toBe(false);
    if ("code" in decoded) {
      return;
    }
    expect(decoded.change.changeId).toBe(original.changeId);
  });
});
