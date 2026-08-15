import { describe, expect, it } from "vitest";
import {
  actorId,
  actorRef,
  communicationSession,
  contentRef,
  matchBinding,
  scopedCapability,
  sessionId,
  withArtifact,
  withCapability,
  withSession,
  workArtifact,
} from "@cantilune/core";
import {
  evaluateCondition,
  evaluateEnsures,
  evaluateRequires,
} from "../../../src/schema/conditionEvaluator.js";
import { buildConfigT0, storyActorIds } from "../../support/fixtures/config-t0.js";
import { storyEntityIds } from "../../support/fixtures/story-entities.js";

describe("conditionEvaluator branches", () => {
  it("evaluates session and participant predicates", () => {
    let snapshot = withSession(
      buildConfigT0(),
      communicationSession(
        sessionId("session-s"),
        actorId("planner-p"),
        [actorId("planner-p"), actorId("coder-c")],
        "shared",
      ),
    );
    const bindings = [
      matchBinding("session", "session-s"),
      matchBinding("from", "planner-p"),
      matchBinding("to", "coder-c"),
    ];
    expect(evaluateCondition(snapshot, bindings, { kind: "session.exists", bindings: {} })).toBe(
      true,
    );
    expect(
      evaluateCondition(snapshot, bindings, {
        kind: "session.controller_matches",
        bindings: {},
      }),
    ).toBe(true);
    expect(
      evaluateCondition(snapshot, bindings, { kind: "delegatee.can_accept", bindings: {} }),
    ).toBe(true);
    expect(
      evaluateCondition(snapshot, bindings, { kind: "participant.registered", bindings: {} }),
    ).toBe(true);

    snapshot = buildConfigT0();
    expect(
      evaluateCondition(snapshot, bindings, { kind: "session.controller_matches", bindings: {} }),
    ).toBe(false);
  });

  it("evaluates delegator.holds via scoped capability", () => {
    let snapshot = buildConfigT0();
    snapshot = withCapability(
      snapshot,
      scopedCapability(storyEntityIds.writeLock, "write_lock", storyActorIds.planner, {
        kind: "artifact",
        artifactId: storyEntityIds.task,
      }),
    );
    expect(
      evaluateCondition(
        snapshot,
        [
          matchBinding("task", storyEntityIds.task),
          matchBinding("from", storyActorIds.planner),
          matchBinding("capability", storyEntityIds.writeLock),
        ],
        { kind: "delegator.holds", bindings: {} },
      ),
    ).toBe(true);

    snapshot = withCapability(
      buildConfigT0(),
      scopedCapability(storyEntityIds.writeLock, "write_lock", storyActorIds.coder, {
        kind: "artifact",
        artifactId: storyEntityIds.task,
      }),
    );
    expect(
      evaluateEnsures(
        snapshot,
        [
          matchBinding("task", storyEntityIds.task),
          matchBinding("from", storyActorIds.planner),
          matchBinding("capability", storyEntityIds.writeLock),
        ],
        [{ kind: "delegator.holds", bindings: {} }],
      )?.kind,
    ).toBe("delegator.holds");
  });

  it("evaluates task.not_exists", () => {
    const snapshot = buildConfigT0();
    expect(
      evaluateCondition(snapshot, [matchBinding("task", storyEntityIds.task)], {
        kind: "task.not_exists",
        bindings: {},
      }),
    ).toBe(true);
  });

  it("evaluates task.exists and delegator owner path", () => {
    let snapshot = withArtifact(
      buildConfigT0(),
      workArtifact(
        storyEntityIds.task,
        "Task",
        contentRef("content://task-T"),
        actorRef(storyActorIds.planner, "agent"),
        "active",
      ),
    );
    const bindings = [
      matchBinding("task", storyEntityIds.task),
      matchBinding("from", storyActorIds.planner),
    ];
    expect(evaluateCondition(snapshot, bindings, { kind: "task.exists", bindings: {} })).toBe(true);
    expect(evaluateCondition(snapshot, bindings, { kind: "delegator.holds", bindings: {} })).toBe(
      true,
    );

    snapshot = buildConfigT0();
    expect(evaluateCondition(snapshot, bindings, { kind: "task.exists", bindings: {} })).toBe(
      false,
    );
  });

  it("evaluates delegator.holds with missing capability record", () => {
    const snapshot = buildConfigT0();
    expect(
      evaluateCondition(
        snapshot,
        [
          matchBinding("task", storyEntityIds.task),
          matchBinding("from", storyActorIds.planner),
          matchBinding("capability", storyEntityIds.writeLock),
        ],
        { kind: "delegator.holds", bindings: {} },
      ),
    ).toBe(false);
  });

  it("evaluates evaluateRequires for failing condition", () => {
    const snapshot = buildConfigT0();
    const failed = evaluateRequires(
      snapshot,
      [matchBinding("from", "unknown-agent")],
      [{ kind: "participant.registered", bindings: {} }],
    );
    expect(failed?.kind).toBe("participant.registered");
  });

  it("returns false when session or actor binding missing for controller check", () => {
    const snapshot = withSession(
      buildConfigT0(),
      communicationSession(
        sessionId("session-s"),
        actorId("planner-p"),
        [actorId("planner-p")],
        "shared",
      ),
    );
    expect(
      evaluateCondition(snapshot, [matchBinding("session", "session-s")], {
        kind: "session.controller_matches",
        bindings: {},
      }),
    ).toBe(false);
    expect(
      evaluateCondition(snapshot, [matchBinding("from", "planner-p")], {
        kind: "session.controller_matches",
        bindings: {},
      }),
    ).toBe(false);
  });

  it("returns false when delegator binding lacks task or actor", () => {
    const snapshot = buildConfigT0();
    expect(
      evaluateCondition(snapshot, [matchBinding("from", storyActorIds.planner)], {
        kind: "delegator.holds",
        bindings: {},
      }),
    ).toBe(false);
  });
});
