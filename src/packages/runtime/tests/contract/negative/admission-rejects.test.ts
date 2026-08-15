import { describe, expect, it } from "vitest";
import { coordinationIntent, matchBinding, operationTypeId } from "@cantilune/core";
import { actorRef } from "@cantilune/core";
import { buildConfigT0, storyActorIds } from "../../support/fixtures/config-t0.js";
import { storyEntityIds } from "../../support/fixtures/story-entities.js";
import { createTestAdmissionGateway } from "../../support/testAdmissionGateway.js";

describe("N-R1 admission rejects invalid intents", () => {
  it("rejects unknown operation templates", () => {
    const { gateway } = createTestAdmissionGateway(buildConfigT0());
    const principal = actorRef(storyActorIds.planner, "agent");

    const result = gateway.admit({
      intent: coordinationIntent(principal, operationTypeId("unknown_op"), [
        matchBinding("task", storyEntityIds.task),
      ]),
      principal,
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.reason.kind).toBe("template_not_found");
  });

  it("rejects delegate when task.not_exists fails", () => {
    const { gateway } = createTestAdmissionGateway(buildConfigT0());
    const principal = actorRef(storyActorIds.planner, "agent");

    const result = gateway.admit({
      intent: coordinationIntent(principal, operationTypeId("delegate"), [
        matchBinding("task", storyEntityIds.task),
        matchBinding("from", storyActorIds.planner),
        matchBinding("to", storyActorIds.coder),
        matchBinding("capability", storyEntityIds.writeLock),
      ]),
      principal,
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.reason.kind).toBe("requires_failed");
  });
});
