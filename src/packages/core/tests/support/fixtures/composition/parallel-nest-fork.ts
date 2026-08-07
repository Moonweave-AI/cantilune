import { actorId } from "../../../../src/primitives/ids.js";
import { targetRef } from "../../../../src/primitives/refs.js";
import { actorRef } from "../../../../src/nodes/participant.js";
import { footprint } from "../../../../src/structure/boundary.js";
import { compositionIntent } from "../../../../src/structure/operators.js";

/** nest(A,B) intent for parallel composition scenarios. */
export function buildNestIntentAB() {
  return compositionIntent(
    "nest",
    actorRef(actorId("A"), "agent"),
    footprint({ participantIds: [actorId("A"), actorId("B")] }),
    [targetRef("participant", "A"), targetRef("participant", "B")],
  );
}

/** fork(C,D,E) intent — disjoint footprint from nest(A,B). */
export function buildForkIntentCDE() {
  return compositionIntent(
    "fork",
    actorRef(actorId("C"), "agent"),
    footprint({ participantIds: [actorId("C"), actorId("D"), actorId("E")] }),
    [targetRef("participant", "C")],
  );
}
