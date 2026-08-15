import { describe, expect, it } from "vitest";
import { coordinationIntent, matchBinding, operationTypeId } from "@cantilune/core";
import { actorRef } from "@cantilune/core";
import { buildTestRuntime } from "../../support/buildTestRuntime.js";
import {
  buildRuntimeLargeWorld,
  runtimeAgentIds,
  runtimeActors,
} from "../../support/scenario/largeWorld.js";
import { introduceIntent, commitOrThrow } from "../../support/scenario/scenarioRunner.js";

describe("concurrent admit reconcile", () => {
  it("allows disjoint admits on the same head, then requires re-admit after first commit", () => {
    const world = buildRuntimeLargeWorld(4);
    const agents = runtimeAgentIds(4);
    const { runtime } = buildTestRuntime({ initial: world, eventCount: 6 });

    const firstIntent = introduceIntent(0, runtimeActors.planner);
    const secondIntent = introduceIntent(1, agents[1]!);

    const firstAdmitted = runtime.admit(firstIntent);
    const secondAdmitted = runtime.admit(secondIntent);
    expect(firstAdmitted.ok).toBe(true);
    expect(secondAdmitted.ok).toBe(true);

    if (!firstAdmitted.ok || !secondAdmitted.ok) {
      return;
    }

    commitOrThrow(runtime, firstAdmitted.ticket);

    const staleCommit = runtime.commit(secondAdmitted.ticket);
    expect("change" in staleCommit).toBe(false);
    if ("change" in staleCommit) {
      return;
    }
    expect(staleCommit.code).toBe("admission_rejected");

    const readmit = runtime.admit(secondIntent);
    expect(readmit.ok).toBe(true);
    if (!readmit.ok) {
      return;
    }
    const secondCommit = commitOrThrow(runtime, readmit.ticket);
    expect(secondCommit.after.artifacts.size).toBe(2);
  });

  it("rejects overlapping concurrent admits on the same capability footprint", () => {
    const { runtime } = buildTestRuntime({ eventCount: 4 });
    const duplicate = coordinationIntent(
      actorRef(runtimeActors.planner, "agent"),
      operationTypeId("introduce_artifact"),
      [
        matchBinding("task", "task-0"),
        matchBinding("from", runtimeActors.planner),
        matchBinding("capability", "write-lock-0"),
      ],
    );

    const first = runtime.admit(duplicate);
    const second = runtime.admit(duplicate);
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(false);
  });
});
