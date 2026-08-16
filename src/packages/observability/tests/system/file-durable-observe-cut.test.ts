/**
 * L7 file-durable observe-cut: persist via createFileRuntimePersistence,
 * observeCommitted with ObservationAccessContext, then reopen the same dir.
 * Fail-closed if dist is missing (no skipIf / silent existsSync skip).
 */
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  actorId,
  actorRef,
  appendRewriteSegment,
  coordinationIntent,
  emptyFootprint,
  emptyRunHistory,
  matchBinding,
  operationTypeId,
  type CoordinationChange,
  type SnapshotRef,
  type UnvalidatedTrace,
} from "@cantilune/core";
import {
  createCoordinationRuntime,
  createDefaultHandlers,
  createDefaultSchema,
  runtimeDependenciesWithStaticSchema,
  templateAwarePolicyEvaluator,
  type CoordinationRuntime,
} from "@cantilune/runtime";
import { createFileRuntimePersistence } from "@cantilune/runtime/memory";
import { buildConfigT0, storyActorIds, storyEntityIds } from "@cantilune/test-fixtures";
import { createObservabilityService } from "../../src/engine/observabilityService.js";
import {
  EXTERNAL_AND_INTERNAL_LTS_POLICY,
  type ObservationAccessContext,
} from "../../src/input/observationAccessContext.js";
import type { ObservationReadPorts } from "../../src/input/observationInput.js";
import { createDeterministicIdGenerator } from "../support/deterministicIds.js";
import { createFixedClock } from "../support/fixedClock.js";
import { testArtifactContentRef } from "../support/contentRefs.js";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");

const REQUIRED_DIST = [
  join(packageRoot, "dist", "index.js"),
  join(packageRoot, "..", "runtime", "dist", "index.js"),
  join(packageRoot, "..", "runtime", "dist", "memory", "index.js"),
] as const;

function rewriteHistoryForWindow(changes: readonly CoordinationChange[]): UnvalidatedTrace {
  let history = emptyRunHistory();
  for (const change of changes) {
    history = appendRewriteSegment(history, change);
  }
  return history;
}

function operatorAccess(): ObservationAccessContext {
  return {
    principal: actorRef(actorId("obs-l7-operator"), "human"),
    scope: emptyFootprint(),
    visibilityPolicy: EXTERNAL_AND_INTERNAL_LTS_POLICY,
  };
}

function commitOrThrow(
  runtime: CoordinationRuntime,
  intent: Parameters<CoordinationRuntime["proposeAndCommit"]>[0],
) {
  const result = runtime.proposeAndCommit(intent);
  if (!("change" in result)) {
    throw new Error(`proposeAndCommit failed: ${JSON.stringify(result)}`);
  }
  return result;
}

function portsFromDurable(
  persistence: ReturnType<typeof createFileRuntimePersistence>,
  sinceRef: SnapshotRef,
): ObservationReadPorts {
  const window = persistence.durable.since(sinceRef);
  const runHistory = window.length === 0 ? undefined : rewriteHistoryForWindow(window);
  return {
    head: () => persistence.durable.head(),
    getSnapshot: (ref) => persistence.durable.get(ref),
    changesSince: (cursor) => persistence.durable.since(cursor),
    ...(runHistory !== undefined ? { runHistory: () => runHistory } : {}),
  };
}

describe("L7 file durable observe-cut", () => {
  const dirs: string[] = [];

  beforeAll(() => {
    for (const distEntry of REQUIRED_DIST) {
      if (!existsSync(distEntry)) {
        throw new Error(
          `L7 observe-cut requires a built package: ${distEntry} is missing. ` +
            `Run \`pnpm --filter @cantilune/observability... build\` first.`,
        );
      }
    }
  });

  afterEach(() => {
    while (dirs.length > 0) {
      const dir = dirs.pop();
      if (dir !== undefined) {
        rmSync(dir, { recursive: true, force: true });
      }
    }
  });

  it("observe-cut validates after file-durable commit and same-dir reopen", () => {
    const dir = mkdtempSync(join(tmpdir(), "cantilune-obs-file-cut-"));
    dirs.push(dir);
    const t0 = buildConfigT0();
    const first = createFileRuntimePersistence({ dir, initial: t0 });
    const runtime = createCoordinationRuntime(
      runtimeDependenciesWithStaticSchema({
        durable: first.durable,
        clock: createFixedClock(),
        idGen: createDeterministicIdGenerator({
          snapshotRefs: ["snap-S1", "snap-S2", "snap-S3"],
          changeIds: ["chg-intro", "chg-session", "chg-fork"],
          sessionIds: [storyEntityIds.session],
          linkIds: ["link-nest-1", "link-parallel-1"],
        }),
        schema: createDefaultSchema(),
        activeEpochId: t0.epochId,
        policy: templateAwarePolicyEvaluator(),
        handlers: createDefaultHandlers(),
        locks: first.locks,
        contentRefAuthority: { isAvailable: () => true },
      }),
    );

    commitOrThrow(
      runtime,
      coordinationIntent(
        actorRef(storyActorIds.planner, "agent"),
        operationTypeId("introduce_artifact"),
        [
          matchBinding("task", storyEntityIds.task),
          matchBinding("from", storyActorIds.planner),
          matchBinding("capability", storyEntityIds.writeLock),
        ],
        undefined,
        [testArtifactContentRef],
      ),
    );
    commitOrThrow(
      runtime,
      coordinationIntent(
        actorRef(storyActorIds.planner, "agent"),
        operationTypeId("create_session"),
        [
          matchBinding("from", storyActorIds.planner),
          matchBinding("participant", storyActorIds.coder),
          matchBinding("session", storyEntityIds.session),
        ],
      ),
    );
    commitOrThrow(
      runtime,
      coordinationIntent(actorRef(storyActorIds.planner, "agent"), operationTypeId("fork_branch"), [
        matchBinding("from", storyActorIds.planner),
        matchBinding("participant", storyActorIds.coder),
      ]),
    );

    const sinceRef = first.durable.changes()[0]?.beforeRef ?? t0.snapshotRef;
    const service = createObservabilityService({ requireAccessContext: true });
    expect(() => service.observeCommitted(portsFromDurable(first, sinceRef), sinceRef)).toThrow(
      /ObservationAccessContext is required/,
    );

    const firstBundle = service.observeCommitted(
      portsFromDurable(first, sinceRef),
      sinceRef,
      { attachDiagnostic: true, validateInvariants: true },
      operatorAccess(),
    );
    expect(firstBundle.spine.events).toHaveLength(3);
    expect(
      firstBundle.communication.sessions.some(
        (session) => session.sessionId === storyEntityIds.session,
      ),
    ).toBe(true);
    const structureKinds = [...firstBundle.structure.byEvent.values()].map(
      (delta) => delta.step.kind,
    );
    expect(structureKinds).toContain("nest");
    expect(structureKinds).toContain("parallel");
    expect(firstBundle.structure.structuralLinks.map((link) => link.kind)).toEqual(
      expect.arrayContaining(["nested_in", "parallel_with"]),
    );
    expect(firstBundle.structure.composition.kind).toBe("serial");

    const restarted = createFileRuntimePersistence({ dir });
    expect(restarted.durable.head()).toEqual(first.durable.head());
    expect(restarted.durable.changes()).toHaveLength(3);

    const restartedBundle = service.observeCommitted(
      portsFromDurable(restarted, sinceRef),
      sinceRef,
      { attachDiagnostic: true, validateInvariants: true },
      operatorAccess(),
    );
    expect(restartedBundle.spine.events).toHaveLength(3);
    expect(restartedBundle.spine.events.map((event) => event.change.changeId)).toEqual(
      firstBundle.spine.events.map((event) => event.change.changeId),
    );
    expect(restartedBundle.structure.composition).toEqual(firstBundle.structure.composition);
    expect(restartedBundle.communication.sessions).toHaveLength(
      firstBundle.communication.sessions.length,
    );
    expect(restartedBundle.structure.structuralLinks.map((link) => link.kind)).toEqual(
      expect.arrayContaining(["nested_in", "parallel_with"]),
    );
  });
});
