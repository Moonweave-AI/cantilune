import { describe, expect, it } from "vitest";
import { actorRef } from "../../../src/nodes/participant.js";
import { observationEntry } from "../../../src/nodes/observationEntry.js";
import { contentRef } from "../../../src/primitives/refs.js";
import { timestamp } from "../../../src/primitives/time.js";
import {
  appendToObservationStream,
  emptyObservationStream,
  nextSequenceNo,
  observationStreamEntries,
} from "../../../src/coordination/observationStream.js";
import { actorId } from "../../../src/primitives/ids.js";

describe("observationStream", () => {
  it("starts empty with sequence number 1", () => {
    const stream = emptyObservationStream();
    expect(stream).toHaveLength(0);
    expect(nextSequenceNo(stream)).toBe(1);
  });

  it("appends entries in strict sequence order", () => {
    const first = observationEntry(
      1,
      actorRef(actorId("human-1"), "human"),
      contentRef("content://obs-1"),
      timestamp("2026-08-07T09:00:00Z"),
    );
    const stream = appendToObservationStream(emptyObservationStream(), first);
    expect(observationStreamEntries(stream)).toHaveLength(1);
    expect(nextSequenceNo(stream)).toBe(2);
  });

  it("throws when sequence number is out of order", () => {
    const bad = observationEntry(
      2,
      actorRef(actorId("human-1"), "human"),
      contentRef("content://obs-2"),
      timestamp("2026-08-07T09:01:00Z"),
    );
    expect(() => appendToObservationStream(emptyObservationStream(), bad)).toThrow(
      /sequence mismatch/,
    );
  });
});
