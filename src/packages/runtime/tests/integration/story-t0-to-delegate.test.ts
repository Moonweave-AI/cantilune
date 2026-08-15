import { describe, expect, it } from "vitest";
import { coordinationIntent, matchBinding, operationTypeId } from "@cantilune/core";
import { actorRef } from "@cantilune/core";
import { contentRef, evidenceRef, evidenceId } from "@cantilune/core";
import { validateAuditTailMatchesHistory } from "@cantilune/core";
import { appendObservationSegment, appendRewriteSegment, emptyRunHistory } from "@cantilune/core";
import { buildConfigT0, storyActorIds } from "../support/fixtures/config-t0.js";
import { storyEntityIds } from "../support/fixtures/story-entities.js";
import { buildTestRuntime } from "../support/buildTestRuntime.js";

describe("story T0 to delegate via runtime", () => {
  it("replaces simulateCommit with admit/commit/replay", () => {
    const t0 = buildConfigT0();
    const { runtime } = buildTestRuntime({
      initial: t0,
      snapshotRefs: ["snap-S-obs", "snap-S1", "snap-S2"],
      changeIds: ["chg-001", "chg-7f3a"],
      sessionIds: [storyEntityIds.session],
      linkIds: ["link-waits-1"],
    });

    let history = emptyRunHistory();

    const observeSource = actorRef(storyActorIds.human, "human");
    const observeResult = runtime.observe(
      {
        source: observeSource,
        payloadRef: contentRef("content://req-login"),
      },
      { principal: observeSource },
    );
    expect("snapshot" in observeResult).toBe(true);
    if (!("snapshot" in observeResult)) {
      return;
    }
    expect(observeResult.snapshot.auditTail).toHaveLength(1);
    expect(observeResult.snapshot.snapshotRef).not.toBe(t0.snapshotRef);
    history = appendObservationSegment(history, observeResult.entry);

    const introduceIntent = coordinationIntent(
      actorRef(storyActorIds.planner, "agent"),
      operationTypeId("introduce_artifact"),
      [
        matchBinding("task", storyEntityIds.task),
        matchBinding("from", storyActorIds.planner),
        matchBinding("capability", storyEntityIds.writeLock),
      ],
      undefined,
      [contentRef("sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")],
    );

    const introduceAdmitted = runtime.admit(introduceIntent);
    expect(introduceAdmitted.ok).toBe(true);
    if (!introduceAdmitted.ok) {
      return;
    }

    const introduceCommit = runtime.commit(introduceAdmitted.ticket);
    expect("change" in introduceCommit).toBe(true);
    if (!("change" in introduceCommit)) {
      return;
    }

    expect(introduceCommit.after.snapshotRef).toBe("snap-S1");
    expect(introduceCommit.after.artifacts.has(storyEntityIds.task)).toBe(true);
    expect(introduceCommit.after.capabilities.get(storyEntityIds.writeLock)?.holder).toBe(
      storyActorIds.planner,
    );
    history = appendRewriteSegment(history, introduceCommit.change);

    const delegateIntent = coordinationIntent(
      actorRef(storyActorIds.planner, "agent"),
      operationTypeId("delegate"),
      [
        matchBinding("task", storyEntityIds.task),
        matchBinding("from", storyActorIds.planner),
        matchBinding("to", storyActorIds.coder),
        matchBinding("capability", storyEntityIds.writeLock),
        matchBinding("participant", "reviewer-r" as typeof storyActorIds.planner),
      ],
      [
        evidenceRef(
          evidenceId("planner-authorized-delegation"),
          "policy",
          contentRef("content://auth/delegate-planner"),
        ),
      ],
    );

    const delegateAdmitted = runtime.admit(delegateIntent);
    expect(delegateAdmitted.ok).toBe(true);
    if (!delegateAdmitted.ok) {
      return;
    }

    const delegateCommit = runtime.commit(delegateAdmitted.ticket);
    expect("change" in delegateCommit).toBe(true);
    if (!("change" in delegateCommit)) {
      return;
    }

    history = appendRewriteSegment(history, delegateCommit.change);

    expect(delegateCommit.after.snapshotRef).toBe("snap-S2");
    expect(delegateCommit.after.artifacts.get(storyEntityIds.task)?.owner.actorId).toBe(
      storyActorIds.coder,
    );
    expect(delegateCommit.after.capabilities.get(storyEntityIds.writeLock)?.holder).toBe(
      storyActorIds.coder,
    );
    expect(delegateCommit.after.sessions.has(storyEntityIds.session)).toBe(true);
    expect(delegateCommit.after.links.size).toBe(1);
    expect(delegateCommit.change.createdSessionRefs).toContain(storyEntityIds.session);

    const replay = runtime.replay({ fromRef: observeResult.snapshot.snapshotRef });
    expect(replay.ok).toBe(true);
    if (!replay.ok) {
      return;
    }
    expect(replay.terminalRef).toBe("snap-S2");
    expect(replay.steps).toHaveLength(2);

    expect(() => validateAuditTailMatchesHistory(observeResult.snapshot, history)).not.toThrow();
  });
});
