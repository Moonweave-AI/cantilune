import { describe, expect, it } from "vitest";
import {
  appendObservationSegment,
  emptyRunHistory,
  validateObservationSequence,
  validateRunHistory,
} from "../../../src/structure/trace.js";
import { observationEntry } from "../../../src/nodes/observationEntry.js";
import { actorRef, participant } from "../../../src/nodes/participant.js";
import { actorId } from "../../../src/primitives/ids.js";
import { contentRef } from "../../../src/primitives/refs.js";
import { timestamp } from "../../../src/primitives/time.js";
import { CoreError } from "../../../src/primitives/violation.js";

describe("validateObservationSequence", () => {
  it("accepts monotonic observation sequence", () => {
    const planner = participant(actorId("planner-p"), "agent");
    const history = appendObservationSegment(
      emptyRunHistory(),
      observationEntry(
        1,
        actorRef(planner.actorId, planner.kind),
        contentRef("content://obs-1"),
        timestamp("2026-08-07T10:00:00Z"),
      ),
    );
    expect(() => validateObservationSequence(history)).not.toThrow();
    expect(validateRunHistory(history).kind).toBe("validated");
  });

  it("throws on sequence gap", () => {
    const planner = participant(actorId("planner-p"), "agent");
    const history = appendObservationSegment(
      emptyRunHistory(),
      observationEntry(
        2,
        actorRef(planner.actorId, planner.kind),
        contentRef("content://obs-1"),
        timestamp("2026-08-07T10:00:00Z"),
      ),
    );
    expect(() => validateObservationSequence(history)).toThrow(CoreError);
  });
});
