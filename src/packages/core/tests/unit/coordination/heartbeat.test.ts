/**
 * Heartbeat log queries.
 *
 * The supervisor's liveness decision reads these, so an off-by-one in the
 * sequence or a cross-agent leak in the filter would retire a live agent or
 * keep a dead one.
 */
import { describe, expect, it } from "vitest";
import { actorId } from "../../../src/primitives/ids.js";
import {
  heartbeatsForAgent,
  latestHeartbeat,
  nextHeartbeatSeq,
  type HeartbeatEntry,
  type HeartbeatLog,
} from "../../../src/coordination/heartbeat.js";

function beat(agent: string, sequenceNo: number): HeartbeatEntry {
  return {
    agentId: actorId(agent),
    sequenceNo,
    emittedAt: `2026-08-15T00:00:${String(sequenceNo).padStart(2, "0")}Z`,
    turnCount: sequenceNo,
    lastAction: "act",
  };
}

const LOG: HeartbeatLog = [beat("a", 1), beat("b", 1), beat("a", 2), beat("b", 5)];

describe("nextHeartbeatSeq", () => {
  it("continues an agent's own sequence, ignoring other agents", () => {
    expect(nextHeartbeatSeq(LOG, actorId("a"))).toBe(3);
    expect(nextHeartbeatSeq(LOG, actorId("b"))).toBe(6);
  });

  it("starts at 1 for an agent with no heartbeats", () => {
    expect(nextHeartbeatSeq(LOG, actorId("unknown"))).toBe(1);
    expect(nextHeartbeatSeq([], actorId("a"))).toBe(1);
  });

  it("uses the maximum rather than the last entry, so out-of-order arrival is safe", () => {
    const outOfOrder: HeartbeatLog = [beat("a", 7), beat("a", 2)];
    expect(nextHeartbeatSeq(outOfOrder, actorId("a"))).toBe(8);
  });
});

describe("heartbeatsForAgent", () => {
  it("returns only that agent's entries, in log order", () => {
    expect(heartbeatsForAgent(LOG, actorId("a")).map((e) => e.sequenceNo)).toEqual([1, 2]);
  });

  it("returns nothing for an agent with no heartbeats", () => {
    expect(heartbeatsForAgent(LOG, actorId("unknown"))).toEqual([]);
  });
});

describe("latestHeartbeat", () => {
  it("returns the highest-sequence entry for the agent", () => {
    expect(latestHeartbeat(LOG, actorId("b"))?.sequenceNo).toBe(5);
  });

  it("prefers the highest sequence over the last logged entry", () => {
    const outOfOrder: HeartbeatLog = [beat("a", 9), beat("a", 3)];
    expect(latestHeartbeat(outOfOrder, actorId("a"))?.sequenceNo).toBe(9);
  });

  it("returns undefined for an agent with no heartbeats", () => {
    expect(latestHeartbeat(LOG, actorId("unknown"))).toBeUndefined();
    expect(latestHeartbeat([], actorId("a"))).toBeUndefined();
  });
});
