import { describe, expect, it } from "vitest";
import { compositionIntent, contentRef, operationTypeId } from "@cantilune/core";
import { actorRef, footprint, targetRef } from "@cantilune/core";
import { buildTestRuntime } from "../../support/buildTestRuntime.js";
import { buildRuntimeLargeWorld, runtimeActors } from "../../support/scenario/largeWorld.js";
import { lockId, taskId } from "../../support/scenario/largeWorld.js";

describe("admitComposition path", () => {
  it("admits attach composition with named roles via compositionBridge", () => {
    const world = buildRuntimeLargeWorld(4);
    const { runtime } = buildTestRuntime({ initial: world, eventCount: 4 });

    const composition = compositionIntent(
      "attach",
      actorRef(runtimeActors.planner, "agent"),
      footprint({
        participantIds: [runtimeActors.planner],
        artifactIds: [taskId(99)],
        capabilityIds: [lockId(99)],
      }),
      [
        targetRef("artifact", taskId(99)),
        targetRef("participant", runtimeActors.planner),
        targetRef("capability", lockId(99)),
      ],
      {
        inputContentRefs: [
          contentRef("sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"),
        ],
      },
    );

    const admitted = runtime.admitComposition(composition);
    expect(admitted.ok).toBe(true);
    if (!admitted.ok) {
      return;
    }

    const committed = runtime.commit(admitted.ticket);
    expect("change" in committed).toBe(true);
    if (!("change" in committed)) {
      return;
    }
    expect(committed.change.operationTypeId).toBe(operationTypeId("introduce_artifact"));
    expect(committed.change.matchBindings.some((binding) => binding.role === "task")).toBe(true);
  });
});
