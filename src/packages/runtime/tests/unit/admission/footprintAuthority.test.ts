import { describe, expect, it } from "vitest";
import { coordinationIntent, matchBinding, operationTypeId } from "@cantilune/core";
import { actorRef } from "@cantilune/core";
import {
  effectiveFootprintForAdmission,
  requestedFootprintFromIntent,
} from "../../../src/admission/footprintAuthority.js";
import { defaultDelegateTemplate } from "../../../src/schema/defaultSchema.js";
import { storyActorIds } from "../../support/fixtures/config-t0.js";
import { storyEntityIds } from "../../support/fixtures/story-entities.js";

describe("footprintAuthority", () => {
  it("derives effective footprint from targets only (ADR-0002 C-prime)", () => {
    const intent = coordinationIntent(
      actorRef(storyActorIds.planner, "agent"),
      operationTypeId("delegate"),
      [
        matchBinding("task", storyEntityIds.task),
        matchBinding("from", storyActorIds.planner),
        matchBinding("to", storyActorIds.coder),
        matchBinding("capability", storyEntityIds.writeLock),
      ],
    );

    const effective = effectiveFootprintForAdmission(intent, defaultDelegateTemplate());
    const requested = requestedFootprintFromIntent(intent);

    expect(effective.artifactIds.has(storyEntityIds.task)).toBe(true);
    expect(effective.participantIds.has(storyActorIds.coder)).toBe(true);
    expect(effective.capabilityIds.has(storyEntityIds.writeLock)).toBe(true);
    expect(requested.artifactIds.has(storyEntityIds.task)).toBe(true);
  });
});
