import { describe, expect, it } from "vitest";
import { contentRef, coordinationIntent, matchBinding, operationTypeId } from "@cantilune/core";
import { actorRef } from "@cantilune/core";
import { admissionTicket } from "../../../src/admission/admissionTicket.js";
import { admittedId } from "../../../src/foundation/brands.js";
import { buildTestRuntime } from "../../support/buildTestRuntime.js";
import { buildConfigT0, storyActorIds } from "../../support/fixtures/config-t0.js";
import { storyEntityIds } from "../../support/fixtures/story-entities.js";

describe("N-R2 admission ticket security", () => {
  it("rejects commit with forged ticket not issued by gateway", () => {
    const { runtime, changelog } = buildTestRuntime({ initial: buildConfigT0() });
    const forged = admissionTicket(admittedId("forged-ticket"));

    const result = runtime.commit(forged);
    expect("change" in result).toBe(false);
    expect(changelog.all()).toHaveLength(0);
  });

  it("rejects principal impersonation on delegate", () => {
    const { runtime } = buildTestRuntime({ initial: buildConfigT0() });

    runtime.proposeAndCommit(
      coordinationIntent(
        actorRef(storyActorIds.planner, "agent"),
        operationTypeId("introduce_artifact"),
        [
          matchBinding("task", storyEntityIds.task),
          matchBinding("from", storyActorIds.planner),
          matchBinding("capability", storyEntityIds.writeLock),
        ],
        undefined,
        [contentRef("sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")],
      ),
    );

    const admitted = runtime.admit(
      coordinationIntent(actorRef(storyActorIds.coder, "agent"), operationTypeId("delegate"), [
        matchBinding("task", storyEntityIds.task),
        matchBinding("from", storyActorIds.planner),
        matchBinding("to", storyActorIds.coder),
        matchBinding("capability", storyEntityIds.writeLock),
      ]),
    );

    expect(admitted.ok).toBe(false);
    if (admitted.ok) {
      return;
    }
    expect(admitted.reason.kind).toBe("principal_invalid");
  });
});
