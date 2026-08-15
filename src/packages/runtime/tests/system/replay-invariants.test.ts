import { describe, expect, it } from "vitest";
import {
  coordinationIntent,
  matchBinding,
  operationTypeId,
  validateAuditTailMatchesHistory,
} from "@cantilune/core";
import { actorRef, contentRef, evidenceRef, evidenceId } from "@cantilune/core";
import { appendObservationSegment, appendRewriteSegment, emptyRunHistory } from "@cantilune/core";
import { buildTestRuntime } from "../support/buildTestRuntime.js";
import { replayChainStart } from "../support/scenario/scenarioRunner.js";
import { storyActorIds } from "../support/fixtures/config-t0.js";
import { storyEntityIds } from "../support/fixtures/story-entities.js";

describe("runtime replay invariants", () => {
  it("replays T0→delegate without reading afterRef and preserves audit/history alignment", () => {
    const { runtime, t0, changelog } = buildTestRuntime({
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
    history = appendObservationSegment(history, observeResult.entry);

    const introduceAdmitted = runtime.admit(
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
    expect(introduceAdmitted.ok).toBe(true);
    if (!introduceAdmitted.ok) {
      return;
    }
    const introduceCommit = runtime.commit(introduceAdmitted.ticket);
    expect("change" in introduceCommit).toBe(true);
    if (!("change" in introduceCommit)) {
      return;
    }
    history = appendRewriteSegment(history, introduceCommit.change);

    const delegateAdmitted = runtime.admit(
      coordinationIntent(
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
      ),
    );
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

    const replay = runtime.replay({ fromRef: replayChainStart(changelog, t0) });
    expect(replay.ok).toBe(true);
    if (!replay.ok) {
      return;
    }
    expect(replay.terminalRef).toBe("snap-S2");

    expect(() => validateAuditTailMatchesHistory(observeResult.snapshot, history)).not.toThrow();
  });
});
