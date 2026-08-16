import { describe, expect, it } from "vitest";
import {
  assertTargetsDerivedFromBindings,
  parseChangeWire,
  parseSnapshotWire,
} from "../../../src/codec/wireValidation.js";
import { matchBinding } from "@cantilune/core";

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
    matchWitness: { domainSize: 1, codomainSize: 1, embedding: [0] },
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

describe("wireValidation branches", () => {
  it("rejects invalid actor kind and binding role", () => {
    expect(
      parseChangeWire(validChangeWire({ initiator: { actorId: "p", kind: "invalid" } })).ok,
    ).toBe(false);
    expect(
      parseChangeWire(
        validChangeWire({
          matchBindings: [{ role: "unknown", id: "x" }],
          targets: [],
        }),
      ).ok,
    ).toBe(false);
  });

  it("rejects invalid target kind and visibility", () => {
    expect(
      parseChangeWire(
        validChangeWire({
          targets: [{ kind: "unknown", id: "task-0" }],
        }),
      ).ok,
    ).toBe(false);
    expect(parseChangeWire(validChangeWire({ visibility: "secret" })).ok).toBe(false);
  });

  it("parses optional templateRef matchWitness and complementTag", () => {
    const result = parseChangeWire(
      validChangeWire({
        templateRef: { operationTypeId: "introduce_artifact", revision: "1" },
        matchWitness: { domainSize: 1, codomainSize: 1, embedding: [0] },
        complementTag: 7,
        freshLinkRefs: ["link-1"],
        inputContentRefs: ["content://x"],
      }),
    );
    expect(result.ok).toBe(true);
  });

  it("rejects malformed optional fields", () => {
    expect(parseChangeWire(validChangeWire({ templateRef: "bad" })).ok).toBe(false);
    expect(parseChangeWire(validChangeWire({ matchWitness: { domainSize: "x" } })).ok).toBe(false);
    expect(parseChangeWire(validChangeWire({ complementTag: "x" })).ok).toBe(false);
    expect(parseChangeWire(validChangeWire({ freshLinkRefs: [""] })).ok).toBe(false);
  });

  it("rejects invalid evidence arrays", () => {
    expect(parseChangeWire(validChangeWire({ authorization: [{}] })).ok).toBe(false);
    expect(
      parseChangeWire(
        validChangeWire({
          authorization: [{ evidenceId: "e1", kind: "bad", contentRef: "c1" }],
        }),
      ).ok,
    ).toBe(false);
  });

  it("validates snapshot entity wires", () => {
    expect(parseSnapshotWire(validSnapshotWire()).ok).toBe(true);
    expect(parseSnapshotWire(validSnapshotWire({ participants: "bad" })).ok).toBe(false);
    expect(
      parseSnapshotWire(
        validSnapshotWire({
          artifacts: [
            {
              artifactId: "task-T",
              kind: "Task",
              contentRef: "content://t",
              owner: { actorId: "planner-p", kind: "agent" },
              lifecycle: "active",
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
              kind: "parallel_with",
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
          sessions: [
            {
              sessionId: "session-s",
              controller: "planner-p",
              participants: ["planner-p"],
              visibility: "shared",
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
              capabilityId: "cap-2",
              kind: "write_lock",
              holder: "planner-p",
              scope: { kind: "session", sessionId: "session-s" },
            },
          ],
        }),
      ).ok,
    ).toBe(true);
    expect(
      parseSnapshotWire(
        validSnapshotWire({
          auditTail: [
            {
              sequenceNo: 1,
              source: { actorId: "planner-p", kind: "agent" },
              payloadRef: "content://obs",
              receivedAt: "2026-08-07T10:00:00Z",
            },
          ],
        }),
      ).ok,
    ).toBe(true);
    expect(
      parseSnapshotWire(
        validSnapshotWire({
          retiredEntities: [
            { entityId: "task-T", entityKind: "artifact", retiredAt: "2026-08-07T10:00:00Z" },
          ],
        }),
      ).ok,
    ).toBe(true);
  });

  it("rejects invalid snapshot nested fields", () => {
    expect(parseSnapshotWire(validSnapshotWire({ policyContext: {} })).ok).toBe(false);
    expect(parseSnapshotWire(validSnapshotWire({ participants: [{}] })).ok).toBe(false);
    expect(parseSnapshotWire(validSnapshotWire({ artifacts: [{}] })).ok).toBe(false);
    expect(parseSnapshotWire(validSnapshotWire({ links: [{}] })).ok).toBe(false);
    expect(parseSnapshotWire(validSnapshotWire({ sessions: [{}] })).ok).toBe(false);
    expect(parseSnapshotWire(validSnapshotWire({ auditTail: [{}] })).ok).toBe(false);
    expect(parseSnapshotWire(validSnapshotWire({ retiredEntities: [{}] })).ok).toBe(false);
    expect(
      parseSnapshotWire(
        validSnapshotWire({
          capabilities: [{ capabilityId: "c", kind: "bad", holder: "p", scope: { kind: "bad" } }],
        }),
      ).ok,
    ).toBe(false);
    expect(
      parseSnapshotWire(
        validSnapshotWire({
          auditTail: [{ sequenceNo: -1, source: {}, payloadRef: "", receivedAt: "" }],
        }),
      ).ok,
    ).toBe(false);
    expect(
      parseSnapshotWire(
        validSnapshotWire({
          links: [
            {
              linkId: "link-1",
              kind: "bad-kind",
              from: { kind: "participant", actorId: "p" },
              to: { kind: "participant", actorId: "q" },
            },
          ],
        }),
      ).ok,
    ).toBe(false);
    expect(
      parseSnapshotWire(
        validSnapshotWire({
          retiredEntities: [{ entityId: "x", entityKind: "bad", retiredAt: "t" }],
        }),
      ).ok,
    ).toBe(false);
  });

  it("assertTargetsDerivedFromBindings compares binding-derived targets", () => {
    const bindings = [matchBinding("task", "task-T"), matchBinding("from", "planner-p")];
    expect(
      assertTargetsDerivedFromBindings(bindings, [
        { kind: "artifact", id: "task-T" },
        { kind: "participant", id: "planner-p" },
      ]),
    ).toBe(true);
    expect(assertTargetsDerivedFromBindings(bindings, [{ kind: "artifact", id: "task-T" }])).toBe(
      false,
    );
  });
});
