import { describe, expect, it } from "vitest";
import { actorId } from "../../../src/primitives/ids.js";
import { contentRef } from "../../../src/primitives/refs.js";
import { timestamp } from "../../../src/primitives/time.js";
import { actorRef } from "../../../src/nodes/participant.js";
import { formatObservationLabel, observationEntry } from "../../../src/nodes/observationEntry.js";

describe("observationEntry", () => {
  it("records a single external observation", () => {
    const entry = observationEntry(
      1,
      actorRef(actorId("human-1"), "human"),
      contentRef("content://req-login"),
      timestamp("2026-08-07T10:00:00Z"),
    );
    expect(entry.sequenceNo).toBe(1);
    expect(entry.payloadRef).toBe("content://req-login");
  });

  it("formats human-readable observation labels", () => {
    expect(formatObservationLabel(1)).toBe("Obs#001");
    expect(formatObservationLabel(42)).toBe("Obs#042");
  });
});
