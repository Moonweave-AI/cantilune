import { describe, expect, it } from "vitest";
import { compositionIntent, contentRef, footprint, targetRef } from "@cantilune/core";
import { actorRef } from "@cantilune/core";
import { coordinationIntentFromComposition } from "../../../src/admission/compositionBridge.js";
import { storyActorIds } from "../../support/fixtures/config-t0.js";
import { storyEntityIds } from "../../support/fixtures/story-entities.js";

describe("coordinationIntentFromComposition", () => {
  it("maps attach targets to task/from/capability roles", () => {
    const ref = contentRef(
      "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    );
    const composition = compositionIntent(
      "attach",
      actorRef(storyActorIds.planner, "agent"),
      footprint({ artifactIds: [storyEntityIds.task], participantIds: [storyActorIds.planner] }),
      [
        targetRef("artifact", storyEntityIds.task),
        targetRef("participant", storyActorIds.planner),
        targetRef("capability", storyEntityIds.writeLock),
      ],
      { inputContentRefs: [ref] },
    );

    const intent = coordinationIntentFromComposition(composition);
    expect(intent.matchBindings.some((binding) => binding.role === "task")).toBe(true);
    expect(intent.matchBindings.some((binding) => binding.role === "from")).toBe(true);
    expect(intent.matchBindings.some((binding) => binding.role === "capability")).toBe(true);
    expect(intent.inputContentRefs).toEqual([ref]);
  });

  it("maps delegate targets to task/from/to/capability roles", () => {
    const composition = compositionIntent(
      "delegate",
      actorRef(storyActorIds.planner, "agent"),
      footprint({
        artifactIds: [storyEntityIds.task],
        participantIds: [storyActorIds.planner, storyActorIds.coder],
      }),
      [
        targetRef("artifact", storyEntityIds.task),
        targetRef("participant", storyActorIds.planner),
        targetRef("participant", storyActorIds.coder),
        targetRef("capability", storyEntityIds.writeLock),
      ],
    );

    const intent = coordinationIntentFromComposition(composition);
    const roles = intent.matchBindings.map((binding) => binding.role);
    expect(roles).toContain("task");
    expect(roles).toContain("from");
    expect(roles).toContain("to");
    expect(roles).toContain("capability");
  });

  it("maps nest/rewire/close to create_session/transfer/publish roles", () => {
    const nest = compositionIntent(
      "nest",
      actorRef(storyActorIds.planner, "agent"),
      footprint({ participantIds: [storyActorIds.planner] }),
      [
        targetRef("session", storyEntityIds.session),
        targetRef("participant", storyActorIds.planner),
      ],
    );
    expect(
      coordinationIntentFromComposition(nest).matchBindings.some(
        (binding) => binding.role === "from",
      ),
    ).toBe(true);

    const fork = compositionIntent(
      "fork",
      actorRef(storyActorIds.planner, "agent"),
      footprint({ participantIds: [storyActorIds.planner, storyActorIds.coder] }),
      [
        targetRef("participant", storyActorIds.planner),
        targetRef("participant", storyActorIds.coder),
      ],
    );
    const forkIntent = coordinationIntentFromComposition(fork);
    expect(forkIntent.matchBindings.some((binding) => binding.role === "from")).toBe(true);
    expect(forkIntent.matchBindings.some((binding) => binding.role === "participant")).toBe(true);

    const rewire = compositionIntent(
      "rewire",
      actorRef(storyActorIds.planner, "agent"),
      footprint({ participantIds: [storyActorIds.planner, storyActorIds.coder] }),
      [
        targetRef("session", storyEntityIds.session),
        targetRef("participant", storyActorIds.planner),
        targetRef("participant", storyActorIds.coder),
      ],
    );
    const rewireRoles = coordinationIntentFromComposition(rewire).matchBindings.map((b) => b.role);
    expect(rewireRoles).toContain("session");
    expect(rewireRoles).toContain("to");

    const close = compositionIntent(
      "close",
      actorRef(storyActorIds.planner, "agent"),
      footprint({ artifactIds: [storyEntityIds.task], participantIds: [storyActorIds.planner] }),
      [targetRef("artifact", storyEntityIds.task), targetRef("participant", storyActorIds.planner)],
    );
    expect(
      coordinationIntentFromComposition(close).matchBindings.some(
        (binding) => binding.role === "task",
      ),
    ).toBe(true);
  });
});
