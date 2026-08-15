import { describe, expect, it } from "vitest";
import { actorId, artifactId } from "../../../src/primitives/ids.js";
import { targetRef } from "../../../src/primitives/refs.js";
import { actorRef } from "../../../src/nodes/participant.js";
import {
  footprint,
  goal,
  interfacePorts,
  port,
  portBinding,
} from "../../../src/structure/boundary.js";
import { validateCompositionIntentFootprint } from "../../../src/structure/validation.js";
import {
  compositionIntent,
  operationTypeForOperator,
  toCoordinationIntent,
  type CompositionOperatorKind,
} from "../../../src/structure/operators.js";
import { SCALE } from "../../support/scenario/largeWorld.js";

const ALL_OPERATORS: CompositionOperatorKind[] = [
  "attach",
  "delegate",
  "fork",
  "nest",
  "rewire",
  "isolate",
  "close",
];

describe("composition operators engineering coverage", () => {
  it.each(ALL_OPERATORS)("maps operator %s to coordination intent at scale", (operator) => {
    const intents = Array.from({ length: SCALE.medium }, (_, index) => {
      const agent = actorId(`agent-${index}`);
      const task = artifactId(`task-${index}`);
      return compositionIntent(
        operator,
        actorRef(agent, "agent"),
        footprint({ participantIds: [agent], artifactIds: [task] }),
        [targetRef("participant", agent), targetRef("artifact", task)],
        {
          interface: interfacePorts([port("in", "TaskRef"), port("out", "ResultRef")]),
          binds: goal([portBinding(port("in", "TaskRef"), task)]),
        },
      );
    });

    for (const intent of intents) {
      expect(() => validateCompositionIntentFootprint(intent)).not.toThrow();
      const coordination = toCoordinationIntent(intent);
      expect(coordination.operationTypeId).toBe(operationTypeForOperator(operator));
      expect(coordination.targets.length).toBeGreaterThan(0);
    }
  });
});
