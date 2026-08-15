import { describe, expect, it } from "vitest";
import { actorId, contentRef, participant, snapshotRef, epochId, collaborationSnapshot } from "@cantilune/core";
import {
  decodeSnapshot,
  decodeSnapshotFromUnknown,
  encodeSnapshot,
} from "../../../src/codec/snapshotCodec.js";
import { buildConfigT0 } from "../../support/fixtures/config-t0.js";

describe("snapshotCodec", () => {
  it("round-trips collaboration snapshots through wire DTO", () => {
    const original = buildConfigT0();
    const decoded = decodeSnapshot(encodeSnapshot(original));

    expect(decoded.snapshotRef).toBe(original.snapshotRef);
    expect(decoded.epochId).toBe(original.epochId);
    expect(decoded.participants.size).toBe(original.participants.size);
    expect(decoded.artifacts.size).toBe(original.artifacts.size);
    expect(decoded.auditTail).toHaveLength(0);
  });

  it("returns violation for invalid snapshot unknown input", () => {
    const decoded = decodeSnapshotFromUnknown(null);
    expect("code" in decoded).toBe(true);
  });

  it("round-trips a participant manifestRef bound at activation (ADR-0015)", () => {
    const manifestRef = contentRef("sha256:manifest-bound-at-activation");
    const agent = participant(actorId("agent-active"), "agent", "active", manifestRef);
    const snap = collaborationSnapshot({
      snapshotRef: snapshotRef("snap-S0"),
      epochId: epochId("42"),
      participants: new Map([[agent.actorId, agent]]),
    });
    const decoded = decodeSnapshot(encodeSnapshot(snap));
    expect(decoded.participants.get(agent.actorId)?.manifestRef).toBe(manifestRef);
  });

  it("round-trips a participant without a manifestRef (pre-activation / non-agent)", () => {
    const human = participant(actorId("human-1"), "human", "active");
    const snap = collaborationSnapshot({
      snapshotRef: snapshotRef("snap-S0"),
      epochId: epochId("42"),
      participants: new Map([[human.actorId, human]]),
    });
    const decoded = decodeSnapshot(encodeSnapshot(snap));
    expect(decoded.participants.get(human.actorId)?.manifestRef).toBeUndefined();
  });
});
