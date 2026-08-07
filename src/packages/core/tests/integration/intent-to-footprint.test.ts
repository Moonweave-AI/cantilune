import { describe, expect, it } from "vitest";
import { actorId, artifactId, operationTypeId } from "../../src/primitives/ids.js";
import { targetRef } from "../../src/primitives/refs.js";
import { actorRef } from "../../src/nodes/participant.js";
import {
  footprintFromTargets,
  footprintOfCoordinationIntent,
} from "../../src/structure/isolation.js";
import { compositionIntent, toCoordinationIntent } from "../../src/structure/operators.js";
import { footprint } from "../../src/structure/boundary.js";

describe("intent to footprint", () => {
  it("maps composition intent through coordination intent to a footprint", () => {
    const composition = compositionIntent(
      "delegate",
      actorRef(actorId("planner-p"), "agent"),
      footprintFromTargets([
        targetRef("artifact", "task-T"),
        targetRef("participant", "coder-c"),
      ]),
      [
        targetRef("artifact", "task-T"),
        targetRef("participant", "coder-c"),
      ],
    );
    const coordination = toCoordinationIntent(composition);
    const fp = footprintOfCoordinationIntent(coordination);

    expect(coordination.operationTypeId).toBe(operationTypeId("delegate"));
    expect(fp.artifactIds.has(artifactId("task-T"))).toBe(true);
    expect(fp.participantIds.has(actorId("coder-c"))).toBe(true);
    expect(composition.footprint.artifactIds.has(artifactId("task-T"))).toBe(true);
  });
});
