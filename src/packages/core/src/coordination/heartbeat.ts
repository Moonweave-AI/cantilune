/**
 * Heartbeat entries — active liveness proof emitted by agents.
 *
 * Each HeartbeatEntry represents a single heartbeat signal committed
 * to the coordination world via the `emit_heartbeat` operation.
 * The Supervisor uses these to track agent liveness.
 */
import type { ActorId } from "../primitives/ids.js";

export interface HeartbeatEntry {
  readonly agentId: ActorId;
  readonly sequenceNo: number;
  readonly emittedAt: string;
  readonly turnCount: number;
  readonly lastAction: string;
}

/** Append-only log of heartbeat entries on a CollaborationSnapshot. */
export type HeartbeatLog = readonly HeartbeatEntry[];

/** Get the next heartbeat sequence number for a given agent. */
export function nextHeartbeatSeq(log: HeartbeatLog, agentId: ActorId): number {
  let max = 0;
  for (const entry of log) {
    if (entry.agentId === agentId && entry.sequenceNo > max) {
      max = entry.sequenceNo;
    }
  }
  return max + 1;
}

/** Filter heartbeat log for a specific agent. */
export function heartbeatsForAgent(log: HeartbeatLog, agentId: ActorId): HeartbeatLog {
  return log.filter((entry) => entry.agentId === agentId);
}

/** Get the latest heartbeat entry for a specific agent. */
export function latestHeartbeat(log: HeartbeatLog, agentId: ActorId): HeartbeatEntry | undefined {
  let latest: HeartbeatEntry | undefined;
  for (const entry of log) {
    if (entry.agentId === agentId) {
      if (latest === undefined || entry.sequenceNo > latest.sequenceNo) {
        latest = entry;
      }
    }
  }
  return latest;
}
