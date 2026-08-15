import { describe, expect, it } from "vitest";
import {
  actorRef,
  compositionIntent,
  deriveDiagnosticSummary,
  footprint,
  operationTypeId,
  targetRef,
} from "@cantilune/core";
import { buildTestRuntime } from "../support/buildTestRuntime.js";
import { buildConfigT0, storyActorIds } from "../support/fixtures/config-t0.js";
import { storyEntityIds } from "../support/fixtures/story-entities.js";

describe("composition structure landing", () => {
  it("fork composition commits parallel_with links across footprint peers", () => {
    const { runtime } = buildTestRuntime({
      snapshotRefs: ["snap-S1"],
      changeIds: ["chg-fork"],
      linkIds: ["link-parallel-1"],
    });

    const composition = compositionIntent(
      "fork",
      actorRef(storyActorIds.planner, "agent"),
      footprint({
        participantIds: [storyActorIds.planner, storyActorIds.coder],
      }),
      [
        targetRef("participant", storyActorIds.planner),
        targetRef("participant", storyActorIds.coder),
      ],
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
    expect(committed.change.operationTypeId).toBe(operationTypeId("fork_branch"));

    const parallelLinks = [...committed.after.links.values()].filter(
      (link) => link.kind === "parallel_with",
    );
    expect(parallelLinks.length).toBe(1);
  });

  it("nest pair creates session and nested_in links without explicit session target", () => {
    const { runtime } = buildTestRuntime({
      snapshotRefs: ["snap-S1"],
      changeIds: ["chg-nest"],
      sessionIds: [storyEntityIds.session],
    });

    const composition = compositionIntent(
      "nest",
      actorRef(storyActorIds.planner, "agent"),
      footprint({ participantIds: [storyActorIds.planner, storyActorIds.coder] }),
      [
        targetRef("participant", storyActorIds.planner),
        targetRef("participant", storyActorIds.coder),
      ],
    );

    const admitted = runtime.admitComposition(composition);
    expect(admitted.ok).toBe(true);
    if (!admitted.ok) {
      return;
    }

    const result = runtime.commit(admitted.ticket);
    expect("change" in result).toBe(true);
    if (!("change" in result)) {
      return;
    }

    expect(result.after.sessions.size).toBe(1);
    expect([...result.after.links.values()].some((link) => link.kind === "nested_in")).toBe(true);
  });

  it("derive reflects nest and fork structure from committed history", () => {
    const t0 = buildConfigT0();
    const { runtime } = buildTestRuntime({
      initial: t0,
      snapshotRefs: ["snap-S1", "snap-S2"],
      changeIds: ["chg-nest", "chg-fork"],
      sessionIds: [storyEntityIds.session],
    });

    const nest = compositionIntent(
      "nest",
      actorRef(storyActorIds.planner, "agent"),
      footprint({ participantIds: [storyActorIds.planner, storyActorIds.coder] }),
      [
        targetRef("participant", storyActorIds.planner),
        targetRef("participant", storyActorIds.coder),
      ],
    );
    const nestAdmitted = runtime.admitComposition(nest);
    expect(nestAdmitted.ok).toBe(true);
    if (!nestAdmitted.ok) {
      return;
    }
    runtime.commit(nestAdmitted.ticket);

    const forkComposition = compositionIntent(
      "fork",
      actorRef(storyActorIds.human, "human"),
      footprint({ participantIds: [storyActorIds.human] }),
      [targetRef("participant", storyActorIds.human)],
    );
    const forkAdmitted = runtime.admitComposition(forkComposition);
    expect(forkAdmitted.ok).toBe(true);
    if (!forkAdmitted.ok) {
      return;
    }
    runtime.commit(forkAdmitted.ticket);

    const history = runtime.getRunHistory();
    const head = runtime.getHead();
    expect(history).toBeDefined();
    expect(head).toBeDefined();
    if (history === undefined || head === undefined) {
      return;
    }

    const view = deriveDiagnosticSummary(head, history);
    expect(view.kind).toBe("serial");
    if (view.kind !== "serial") {
      return;
    }
    expect(view.parts.some((part) => part.kind === "nest")).toBe(true);
    expect(view.parts.some((part) => part.kind === "parallel")).toBe(true);
  });
});
