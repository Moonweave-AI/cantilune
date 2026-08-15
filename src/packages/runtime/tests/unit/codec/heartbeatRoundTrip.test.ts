import { describe, expect, it } from "vitest";
import {
  actorId,
  appendHeartbeat,
  collaborationSnapshot,
  epochId,
  participant,
  snapshotRef,
} from "@cantilune/core";
import { decodeSnapshot, encodeSnapshot } from "../../../src/codec/snapshotCodec.js";
import { snapshotsCanonicallyEqual } from "../../../src/codec/canonicalSnapshot.js";
import { parseSnapshotWire } from "../../../src/codec/wireValidation.js";

const AID = actorId("beating-agent");

/** The stored form, so a test can drop or corrupt a field the way an old bundle would. */
function stored(snapshot: Parameters<typeof encodeSnapshot>[0]): Record<string, unknown> {
  return JSON.parse(JSON.stringify(encodeSnapshot(snapshot)));
}

function snapshotWithHeartbeat() {
  const base = collaborationSnapshot({
    snapshotRef: snapshotRef("snap-hb"),
    epochId: epochId("e-1"),
    participants: new Map([[AID, participant(AID, "agent")]]),
  });
  return appendHeartbeat(base, {
    agentId: AID,
    sequenceNo: 1,
    emittedAt: "2026-08-13T09:00:00Z",
    turnCount: 3,
    lastAction: "introduce_artifact",
  });
}

describe("heartbeat log survives the wire format", () => {
  it("round-trips heartbeats through encode/decode", () => {
    const before = snapshotWithHeartbeat();
    expect(before.heartbeatLog).toHaveLength(1);

    const after = decodeSnapshot(encodeSnapshot(before));
    expect(after.heartbeatLog).toEqual(before.heartbeatLog);
  });

  it("survives a JSON round-trip through the wire validator", () => {
    const before = snapshotWithHeartbeat();
    const parsed = parseSnapshotWire(JSON.parse(JSON.stringify(encodeSnapshot(before))));

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(decodeSnapshot(parsed.value).heartbeatLog).toEqual(before.heartbeatLog);
  });

  it("treats a dropped heartbeat log as a canonical difference", () => {
    const withBeat = snapshotWithHeartbeat();
    const withoutBeat = collaborationSnapshot({
      snapshotRef: withBeat.snapshotRef,
      epochId: withBeat.epochId,
      participants: withBeat.participants,
    });
    expect(snapshotsCanonicallyEqual(withBeat, withoutBeat)).toBe(false);
  });

  it("accepts a stored snapshot written before the field existed", () => {
    const legacy = stored(snapshotWithHeartbeat());
    delete legacy.heartbeatLog;

    const parsed = parseSnapshotWire(legacy);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(decodeSnapshot(parsed.value).heartbeatLog).toEqual([]);
  });

  it("rejects a heartbeat entry missing its emitting agent", () => {
    const parsed = parseSnapshotWire({
      ...stored(snapshotWithHeartbeat()),
      heartbeatLog: [{ sequenceNo: 1, emittedAt: "t", turnCount: 0, lastAction: "x" }],
    });

    expect(parsed.ok).toBe(false);
  });
});
