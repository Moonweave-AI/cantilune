import type { ObservationEntry } from "../nodes/observationEntry.js";
import { coreViolation, throwCore } from "../primitives/violation.js";
import type { SequenceNo } from "../primitives/time.js";

/**
 * Append-only ordered stream semantics for CollaborationSnapshot.auditTail.
 * Separated from ObservationEntry shape to enforce: append ≠ graph rewrite.
 */
export type ObservationStream = readonly ObservationEntry[];

export function emptyObservationStream(): ObservationStream {
  return [];
}

export function appendToObservationStream(
  stream: ObservationStream,
  entry: ObservationEntry,
): ObservationStream {
  assertAppendOnlyOrder(stream, entry);
  return [...stream, entry];
}

export function nextSequenceNo(stream: ObservationStream): SequenceNo {
  if (stream.length === 0) {
    return 1;
  }
  const last = stream.at(-1);
  if (last === undefined) {
    return 1;
  }
  return last.sequenceNo + 1;
}

function assertAppendOnlyOrder(stream: ObservationStream, entry: ObservationEntry): void {
  const expected = nextSequenceNo(stream);
  if (entry.sequenceNo !== expected) {
    throwCore(
      coreViolation(
        "observation_sequence_invalid",
        `Observation sequence mismatch: expected ${expected}, got ${entry.sequenceNo}`,
        {
          path: "auditTail.sequenceNo",
          expected: String(expected),
          actual: String(entry.sequenceNo),
        },
      ),
    );
  }
}

/** Read-only iteration helper. */
export function observationStreamEntries(stream: ObservationStream): readonly ObservationEntry[] {
  return stream;
}
