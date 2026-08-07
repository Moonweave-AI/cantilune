import type { ContentRef } from "../primitives/refs.js";
import type { SequenceNo, Timestamp } from "../primitives/time.js";
import type { ActorRef } from "./participant.js";

/**
 * A single external observation appended to auditTail.
 * Records what the outside world said — does not by itself rewrite the collaboration graph.
 */
export interface ObservationEntry {
  readonly sequenceNo: SequenceNo;
  readonly source: ActorRef;
  readonly payloadRef: ContentRef;
  readonly receivedAt: Timestamp;
}

export function observationEntry(
  sequenceNo: SequenceNo,
  source: ActorRef,
  payloadRef: ContentRef,
  receivedAt: Timestamp,
): ObservationEntry {
  return { sequenceNo, source, payloadRef, receivedAt };
}

/** Human-readable observation label (Obs#001). */
export function formatObservationLabel(sequenceNo: SequenceNo): string {
  return `Obs#${String(sequenceNo).padStart(3, "0")}`;
}
