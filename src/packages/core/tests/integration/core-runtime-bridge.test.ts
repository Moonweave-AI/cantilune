import { describe, expect, it } from "vitest";
import {
  actorRef,
  contentRef,
  coordinationIntent,
  evidenceId,
  evidenceRef,
  matchBinding,
  operationTypeId,
  timestamp,
  validateAuditTailMatchesHistory,
} from "@cantilune/core";
import { buildConfigT0, storyActorIds, storyEntityIds } from "@cantilune/test-fixtures";
import {
  RunHistoryTracker,
  createCoordinationRuntime,
  createDefaultHandlers,
  createDefaultSchema,
  templateAwarePolicyEvaluator,
  runtimeDependenciesWithStaticSchema,
} from "@cantilune/runtime";
import { createMemoryRuntimePersistence, MemoryResourceLockTable } from "@cantilune/runtime/memory";
import type { IdGenerator } from "@cantilune/runtime";
import type { ChangeId, EvidenceId, LinkId, SessionId, SnapshotRef } from "@cantilune/core";

function bridgeIdGenerator(): IdGenerator {
  let snapshotIndex = 0;
  let changeIndex = 0;
  const snapshotRefs = ["snap-S-obs", "snap-S1", "snap-S2"] as const;
  const changeIds = ["chg-001", "chg-7f3a"] as const;
  return {
    snapshotRef: () => snapshotRefs[snapshotIndex++]! as SnapshotRef,
    changeId: () => changeIds[changeIndex++]! as ChangeId,
    sessionId: () => storyEntityIds.session as SessionId,
    linkId: () => "link-waits-1" as LinkId,
    artifactId: () => storyEntityIds.task,
    capabilityId: () => storyEntityIds.writeLock,
    evidenceId: () => "ev-bridge" as EvidenceId,
  };
}

describe("core ↔ runtime bridge", () => {
  it("runs canonical story through runtime without simulateCommit", () => {
    const t0 = buildConfigT0();
    const { durable } = createMemoryRuntimePersistence({ initial: t0 });
    const runHistory = new RunHistoryTracker();
    const runtime = createCoordinationRuntime(
      runtimeDependenciesWithStaticSchema({
        durable,
        clock: { now: () => timestamp("2026-08-07T10:00:00Z") },
        idGen: bridgeIdGenerator(),
        schema: createDefaultSchema(),
        activeEpochId: t0.epochId,
        policy: templateAwarePolicyEvaluator(),
        handlers: createDefaultHandlers(),
        locks: new MemoryResourceLockTable(),
        runHistory,
        contentRefAuthority: { isAvailable: () => true },
      }),
    );

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

    const introduce = runtime.proposeAndCommit(
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
    expect("change" in introduce).toBe(true);

    const delegate = runtime.proposeAndCommit(
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
    expect("change" in delegate).toBe(true);
    if (!("change" in delegate)) {
      return;
    }

    const replay = runtime.replay({ fromRef: observeResult.snapshot.snapshotRef });
    expect(replay.ok).toBe(true);
    if (replay.ok) {
      expect(replay.terminalRef).toBe("snap-S2");
    }

    const history = runtime.getRunHistory();
    expect(history).toBeDefined();
    if (history === undefined) {
      return;
    }
    expect(() => validateAuditTailMatchesHistory(observeResult.snapshot, history)).not.toThrow();
  });
});
