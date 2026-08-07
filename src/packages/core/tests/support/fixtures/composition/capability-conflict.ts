import { actorId, capabilityId } from "../../../../src/primitives/ids.js";
import { targetRef } from "../../../../src/primitives/refs.js";
import { actorRef } from "../../../../src/nodes/participant.js";
import { footprint } from "../../../../src/structure/boundary.js";
import { compositionIntent } from "../../../../src/structure/operators.js";

const writeLock = capabilityId("write-lock-w");

/** Two intents contending for the same scoped capability. */
export function buildCapabilityConflictIntents() {
  const planner = compositionIntent(
    "delegate",
    actorRef(actorId("planner-p"), "agent"),
    footprint({ capabilityIds: [writeLock], participantIds: [actorId("planner-p")] }),
    [targetRef("capability", "write-lock-w"), targetRef("participant", "planner-p")],
  );
  const coder = compositionIntent(
    "delegate",
    actorRef(actorId("coder-c"), "agent"),
    footprint({ capabilityIds: [writeLock], participantIds: [actorId("coder-c")] }),
    [targetRef("capability", "write-lock-w"), targetRef("participant", "coder-c")],
  );
  return { planner, coder, writeLock };
}
