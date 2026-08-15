import { describe, expect, it } from "vitest";
import { actorId, artifactId } from "../../../src/primitives/ids.js";
import { targetRef } from "../../../src/primitives/refs.js";
import { actorRef } from "../../../src/nodes/participant.js";
import { footprint } from "../../../src/structure/boundary.js";
import { compositionIntent } from "../../../src/structure/operators.js";
import { validateCompositionIntentFootprint } from "../../../src/structure/validation.js";

describe("N2 footprint must cover targets", () => {
  it("rejects when declared footprint is narrower than targets", () => {
    const intent = compositionIntent(
      "delegate",
      actorRef(actorId("planner-p"), "agent"),
      footprint({ participantIds: [actorId("planner-p")] }),
      [targetRef("artifact", "task-T"), targetRef("participant", "coder-c")],
    );

    expect(() => validateCompositionIntentFootprint(intent)).toThrow(/does not cover all targets/);
  });

  it("accepts when footprint is a superset of targets", () => {
    const intent = compositionIntent(
      "delegate",
      actorRef(actorId("planner-p"), "agent"),
      footprint({
        participantIds: [actorId("planner-p"), actorId("coder-c")],
        artifactIds: [artifactId("task-T")],
      }),
      [targetRef("artifact", "task-T"), targetRef("participant", "coder-c")],
    );

    expect(() => validateCompositionIntentFootprint(intent)).not.toThrow();
  });
});
