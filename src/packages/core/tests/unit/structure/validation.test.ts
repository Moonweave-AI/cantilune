import { describe, expect, it } from "vitest";
import { actorId, artifactId } from "../../../src/primitives/ids.js";
import { targetRef } from "../../../src/primitives/refs.js";
import { footprint, emptyFootprint } from "../../../src/structure/boundary.js";
import { footprintCovers, footprintCoversTargets } from "../../../src/structure/validation.js";

describe("footprintCovers", () => {
  it("returns true when outer is a superset", () => {
    const outer = footprint({
      participantIds: [actorId("A"), actorId("B")],
      artifactIds: [artifactId("task-T")],
    });
    const inner = footprint({ participantIds: [actorId("A")] });
    expect(footprintCovers(outer, inner)).toBe(true);
  });

  it("returns false when outer misses an inner id", () => {
    const outer = emptyFootprint();
    const inner = footprint({ artifactIds: [artifactId("task-T")] });
    expect(footprintCovers(outer, inner)).toBe(false);
  });
});

describe("footprintCoversTargets", () => {
  it("derives minimum coverage from targets", () => {
    const fp = footprint({ participantIds: [actorId("coder-c")] });
    expect(footprintCoversTargets(fp, [targetRef("participant", "coder-c")])).toBe(true);
    expect(
      footprintCoversTargets(fp, [
        targetRef("participant", "coder-c"),
        targetRef("artifact", "task-T"),
      ]),
    ).toBe(false);
  });
});
