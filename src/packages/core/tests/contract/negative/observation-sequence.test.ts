import { describe, expect, it } from "vitest";
import { actorRef } from "../../../src/nodes/participant.js";
import { observationEntry } from "../../../src/nodes/observationEntry.js";
import { actorId } from "../../../src/primitives/ids.js";
import { contentRef } from "../../../src/primitives/refs.js";
import { timestamp } from "../../../src/primitives/time.js";
import { appendToObservationStream, emptyObservationStream } from "../../../src/coordination/observationStream.js";

describe("N1 observation sequence violations", () => {
  it("rejects the first entry when sequenceNo is not 1", () => {
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

  it("rejects a gap after the first valid entry", () => {
    const first = observationEntry(
      1,
      actorRef(actorId("human-1"), "human"),
      contentRef("content://obs-1"),
      timestamp("2026-08-07T09:00:00Z"),
    );
    const stream = appendToObservationStream(emptyObservationStream(), first);
    const gap = observationEntry(
      3,
      actorRef(actorId("human-1"), "human"),
      contentRef("content://obs-3"),
      timestamp("2026-08-07T09:02:00Z"),
    );
    expect(() => appendToObservationStream(stream, gap)).toThrow(/sequence mismatch/);
  });
});
