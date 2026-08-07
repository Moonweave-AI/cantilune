import { describe, expect, it } from "vitest";
import { actorId } from "../../../src/primitives/ids.js";
import { targetRef } from "../../../src/primitives/refs.js";
import { actorRef } from "../../../src/nodes/participant.js";
import { footprint } from "../../../src/structure/boundary.js";
import {
  compatibleConcurrently,
  footprintFromTargets,
} from "../../../src/structure/isolation.js";
import {
  compositionIntent,
  operationTypeForOperator,
  toCoordinationIntent,
  type CompositionOperatorKind,
} from "../../../src/structure/operators.js";

const OPERATOR_MAPPINGS: Array<[CompositionOperatorKind, string]> = [
  ["attach", "introduce_artifact"],
  ["delegate", "delegate"],
  ["fork", "introduce_artifact"],
  ["nest", "create_session"],
  ["rewire", "transfer_session"],
  ["isolate", "introduce_artifact"],
  ["close", "publish_artifact"],
];

describe("operators", () => {
  it.each(OPERATOR_MAPPINGS)("maps %s to %s", (operator, operation) => {
    expect(operationTypeForOperator(operator)).toBe(operation);
  });
  it("maps delegate composition to coordination intent", () => {
    const intent = compositionIntent(
      "delegate",
      actorRef(actorId("planner-p"), "agent"),
      footprintFromTargets([targetRef("artifact", "task-T")]),
      [targetRef("artifact", "task-T"), targetRef("participant", "coder-c")],
    );
    const coordination = toCoordinationIntent(intent);
    expect(coordination.operationTypeId).toBe("delegate");
  });

  it("allows concurrent composition when footprints disjoint", () => {
    const ab = compositionIntent(
      "nest",
      actorRef(actorId("A"), "agent"),
      footprint({ participantIds: [actorId("A"), actorId("B")] }),
      [targetRef("participant", "A")],
    );
    const cde = compositionIntent(
      "fork",
      actorRef(actorId("C"), "agent"),
      footprint({ participantIds: [actorId("C"), actorId("D"), actorId("E")] }),
      [targetRef("participant", "C")],
    );
    expect(compatibleConcurrently(ab, cde)).toBe(true);
  });
});
