import { describe, expect, it } from "vitest";
import { parseChangeWire, parseSnapshotWire } from "../../../src/codec/wireValidation.js";

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
    participants: [{ actorId: "planner-p", kind: "agent", status: "active" }],
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

describe("wireValidation extended branches", () => {
  it("rejects non-object change wire and missing required strings", () => {
    expect(parseChangeWire(null).ok).toBe(false);
    expect(parseChangeWire(validChangeWire({ changeId: 1 })).ok).toBe(false);
    expect(parseChangeWire(validChangeWire({ recordedAt: "" })).ok).toBe(false);
    expect(parseChangeWire(validChangeWire({ epochId: null })).ok).toBe(false);
    expect(parseChangeWire(validChangeWire({ operationTypeId: undefined })).ok).toBe(false);
    expect(parseChangeWire(validChangeWire({ beforeRef: 0 })).ok).toBe(false);
    expect(parseChangeWire(validChangeWire({ afterRef: false })).ok).toBe(false);
  });

  it("rejects duplicate binding roles and target derivation mismatch", () => {
    expect(
      parseChangeWire(
        validChangeWire({
          matchBindings: [
            { role: "task", id: "task-0" },
            { role: "task", id: "task-1" },
          ],
          targets: [{ kind: "artifact", id: "task-0" }],
        }),
      ).ok,
    ).toBe(false);
    expect(
      parseChangeWire(
        validChangeWire({
          matchBindings: [{ role: "task", id: "task-0" }],
          targets: [{ kind: "participant", id: "planner-p" }],
        }),
      ).ok,
    ).toBe(false);
  });

  it("rejects malformed involved actors and string arrays", () => {
    expect(parseChangeWire(validChangeWire({ involved: "bad" })).ok).toBe(false);
    expect(parseChangeWire(validChangeWire({ involved: [{ actorId: "p" }] })).ok).toBe(false);
    expect(parseChangeWire(validChangeWire({ createdSessionRefs: "bad" })).ok).toBe(false);
    expect(parseChangeWire(validChangeWire({ createdSessionRefs: [1] })).ok).toBe(false);
    expect(parseChangeWire(validChangeWire({ freshLinkRefs: [123] })).ok).toBe(false);
    expect(parseChangeWire(validChangeWire({ inputContentRefs: [null] })).ok).toBe(false);
    expect(parseChangeWire(validChangeWire({ scalarInputs: [] })).ok).toBe(false);
    expect(parseChangeWire(validChangeWire({ scalarInputs: { turnCount: Number.NaN } })).ok).toBe(
      false,
    );
    expect(parseChangeWire(validChangeWire({ scalarInputs: { lastAction: "" } })).ok).toBe(false);
    expect(
      parseChangeWire(
        validChangeWire({ scalarInputs: { turnCount: 3, lastAction: "write_content" } }),
      ).ok,
    ).toBe(true);
  });

  it("rejects malformed templateRef revision and matchWitness embedding", () => {
    expect(
      parseChangeWire(
        validChangeWire({
          templateRef: { operationTypeId: "introduce_artifact", revision: 1 },
        }),
      ).ok,
    ).toBe(false);
    expect(
      parseChangeWire(
        validChangeWire({
          matchWitness: { domainSize: 1, codomainSize: 1, embedding: ["x"] },
        }),
      ).ok,
    ).toBe(false);
    expect(parseChangeWire(validChangeWire({ matchWitness: { domainSize: 1 } })).ok).toBe(false);
  });

  it("rejects non-object snapshot wire and missing top-level strings", () => {
    expect(parseSnapshotWire([]).ok).toBe(false);
    expect(parseSnapshotWire(validSnapshotWire({ snapshotRef: 1 })).ok).toBe(false);
    expect(parseSnapshotWire(validSnapshotWire({ epochId: "" })).ok).toBe(false);
  });

  it("validates participant artifact link session capability nested fields", () => {
    expect(
      parseSnapshotWire(
        validSnapshotWire({
          participants: [{ actorId: "p", kind: "invalid", status: "active" }],
        }),
      ).ok,
    ).toBe(false);
    expect(
      parseSnapshotWire(
        validSnapshotWire({
          participants: [{ actorId: "p", kind: "agent", status: "gone" }],
        }),
      ).ok,
    ).toBe(false);
    expect(
      parseSnapshotWire(
        validSnapshotWire({
          artifacts: [
            {
              artifactId: "task-T",
              kind: "Task",
              contentRef: "content://t",
              owner: { actorId: "planner-p", kind: "agent" },
              lifecycle: "invalid",
            },
          ],
        }),
      ).ok,
    ).toBe(false);
    expect(
      parseSnapshotWire(
        validSnapshotWire({
          links: [
            {
              linkId: "link-1",
              kind: "depends_on",
              from: { kind: "participant", actorId: "planner-p" },
              to: { kind: "artifact", artifactId: "task-T" },
            },
          ],
        }),
      ).ok,
    ).toBe(true);
    expect(
      parseSnapshotWire(
        validSnapshotWire({
          links: [
            {
              linkId: "link-1",
              kind: "depends_on",
              from: { kind: "bad", actorId: "p" },
              to: { kind: "artifact", artifactId: "task-T" },
            },
          ],
        }),
      ).ok,
    ).toBe(false);
    expect(
      parseSnapshotWire(
        validSnapshotWire({
          sessions: [
            {
              sessionId: "session-s",
              controller: "planner-p",
              participants: ["planner-p"],
              visibility: "invalid",
            },
          ],
        }),
      ).ok,
    ).toBe(false);
    expect(
      parseSnapshotWire(
        validSnapshotWire({
          capabilities: [
            {
              capabilityId: "cap-1",
              kind: "write_lock",
              holder: "planner-p",
              scope: { kind: "artifact", artifactId: "task-T" },
            },
          ],
        }),
      ).ok,
    ).toBe(true);
    expect(
      parseSnapshotWire(
        validSnapshotWire({
          capabilities: [
            {
              capabilityId: "cap-1",
              kind: "write_lock",
              holder: "planner-p",
              scope: { kind: "artifact" },
            },
          ],
        }),
      ).ok,
    ).toBe(false);
  });

  it("validates observation policyContext and tombstone reasonRef", () => {
    expect(
      parseSnapshotWire(
        validSnapshotWire({
          auditTail: [
            {
              sequenceNo: 1,
              source: { actorId: "planner-p", kind: "invalid" },
              payloadRef: "content://obs",
              receivedAt: "2026-08-07T10:00:00Z",
            },
          ],
        }),
      ).ok,
    ).toBe(false);
    expect(
      parseSnapshotWire(
        validSnapshotWire({
          policyContext: { approvalState: { kind: "none" }, retryState: { kind: 1 } },
        }),
      ).ok,
    ).toBe(false);
    expect(
      parseSnapshotWire(
        validSnapshotWire({
          retiredEntities: [
            {
              entityId: "task-T",
              entityKind: "artifact",
              retiredAt: "2026-08-07T10:00:00Z",
              reasonRef: 123,
            },
          ],
        }),
      ).ok,
    ).toBe(false);
    expect(
      parseSnapshotWire(
        validSnapshotWire({
          retiredEntities: [
            {
              entityId: "task-T",
              entityKind: "artifact",
              retiredAt: "2026-08-07T10:00:00Z",
              reasonRef: "content://reason",
            },
          ],
        }),
      ).ok,
    ).toBe(true);
  });
});
