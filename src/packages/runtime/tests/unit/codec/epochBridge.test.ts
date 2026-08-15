import { describe, expect, it } from "vitest";
import {
  actorId,
  actorRef,
  collaborationSnapshot,
  contentRef,
  epochId,
  participant,
  snapshotRef,
} from "@cantilune/core";
import {
  isEpochOnlyAdvance,
  isObservationAndEpochOnlyAdvance,
} from "../../../src/codec/observationBridge.js";
import { buildConfigT0 } from "@cantilune/test-fixtures";

describe("isEpochOnlyAdvance", () => {
  it("accepts a new ref and epoch when the complete world is unchanged", () => {
    const before = buildConfigT0();
    const after = collaborationSnapshot({
      ...before,
      snapshotRef: snapshotRef("snap-E1"),
      epochId: epochId("43"),
    });

    expect(isEpochOnlyAdvance(before, after)).toBe(true);
  });

  it("requires a non-empty heartbeat log to survive the epoch-only bridge", () => {
    const before = collaborationSnapshot({
      ...buildConfigT0(),
      heartbeatLog: [
        {
          agentId: actorId("planner-p"),
          sequenceNo: 1,
          emittedAt: "2026-08-13T00:00:00Z",
          turnCount: 7,
          lastAction: "write_content",
        },
      ],
    });
    const after = collaborationSnapshot({
      ...before,
      snapshotRef: snapshotRef("snap-E1"),
      epochId: epochId("43"),
    });

    expect(isEpochOnlyAdvance(before, after)).toBe(true);
    expect(isEpochOnlyAdvance(before, collaborationSnapshot({ ...after, heartbeatLog: [] }))).toBe(
      false,
    );
  });

  it("requires both snapshot identity and epoch to advance", () => {
    const before = buildConfigT0();
    const sameRef = collaborationSnapshot({ ...before, epochId: epochId("43") });
    const sameEpoch = collaborationSnapshot({
      ...before,
      snapshotRef: snapshotRef("snap-E1"),
    });

    expect(isEpochOnlyAdvance(before, sameRef)).toBe(false);
    expect(isEpochOnlyAdvance(before, sameEpoch)).toBe(false);
  });

  it("rejects a cross-epoch hop that also changes world content", () => {
    const before = buildConfigT0();
    const intruder = participant(actorId("intruder"), "agent");
    const after = collaborationSnapshot({
      ...before,
      snapshotRef: snapshotRef("snap-E1"),
      epochId: epochId("43"),
      participants: new Map([...before.participants, [intruder.actorId, intruder]]),
    });

    expect(isEpochOnlyAdvance(before, after)).toBe(false);
  });

  it("accepts only the explicit composition of appended observations and epoch advance", () => {
    const before = buildConfigT0();
    const after = collaborationSnapshot({
      ...before,
      snapshotRef: snapshotRef("snap-E-observed"),
      epochId: epochId("43"),
      auditTail: [
        {
          sequenceNo: 1,
          source: actorRef(actorId("human-1"), "human"),
          payloadRef: contentRef("content://observation"),
          receivedAt: "2026-08-13T00:00:00Z" as never,
        },
      ],
    });
    expect(isObservationAndEpochOnlyAdvance(before, after)).toBe(true);

    const changed = collaborationSnapshot({ ...after, participants: new Map() });
    expect(isObservationAndEpochOnlyAdvance(before, changed)).toBe(false);
  });
});
