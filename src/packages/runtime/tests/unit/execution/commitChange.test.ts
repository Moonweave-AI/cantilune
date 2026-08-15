import { describe, expect, it } from "vitest";
import { operationTypeId, actorId, actorRef } from "@cantilune/core";
import { changeId, coordinationChange, epochId, snapshotRef, timestamp } from "@cantilune/core";
import { createCommitter } from "../../../src/execution/commitChange.js";
import {
  createDefaultHandlers,
  introduceArtifactHandler,
} from "../../../src/execution/handlers/index.js";
import { InMemoryHandlerRegistry } from "../../../src/execution/handlerRegistry.js";
import { AdmissionRegistry } from "../../../src/admission/admissionRegistry.js";
import { createMemoryRuntimePersistence } from "../../../src/memory/memoryDurableCoordinator.js";
import { MemoryResourceLockTable } from "../../../src/memory/memoryLockTable.js";
import { RunHistoryTracker } from "../../../src/engine/runHistoryTracker.js";
import { createDefaultSchema } from "../../../src/schema/defaultSchema.js";
import { runtimeDependenciesWithStaticSchema } from "../../../src/engine/runtimeDependenciesCompat.js";
import { createCoordinationRuntime } from "../../../src/engine/coordinationRuntime.js";
import { buildConfigT0 } from "../../support/fixtures/config-t0.js";
import { createDeterministicIdGenerator } from "../../support/deterministicIds.js";
import { createFixedClock } from "../../support/fixedClock.js";
import { allowAllPolicyEvaluator } from "../../support/testPolicy.js";
import { introduceIntent, proposeAndCommitOrThrow } from "../../support/scenario/scenarioRunner.js";
import { admittedId } from "../../../src/foundation/brands.js";
import { admissionTicket } from "../../../src/admission/admissionTicket.js";
import type { ContentRefAuthority } from "../../../src/ports/contentRefAuthority.js";

const AVAILABLE_CONTENT: ContentRefAuthority = { isAvailable: () => true };

describe("createCommitter", () => {
  it("returns admission_rejected for invalid ticket", () => {
    const t0 = buildConfigT0();
    const { durable } = createMemoryRuntimePersistence({ initial: t0 });
    const locks = new MemoryResourceLockTable();
    const registry = new AdmissionRegistry(locks);
    const committer = createCommitter({
      durable,
      registry,
      clock: createFixedClock(),
      idGen: createDeterministicIdGenerator(),
      handlers: createDefaultHandlers(),
      locks,
    });
    const result = committer.commit({ ticket: admissionTicket(admittedId("invalid-ticket")) });
    expect("code" in result).toBe(true);
    if (!("code" in result)) {
      return;
    }
    expect(result.code).toBe("admission_rejected");
  });

  it("commits valid admission end-to-end", () => {
    const runtime = buildRuntimeForCommit();
    const committed = proposeAndCommitOrThrow(runtime, introduceIntent(0));
    expect(committed.change.changeId).toBeDefined();
    expect(committed.after.artifacts.size).toBe(1);
  });

  it("rejects direct introduce_artifact when no content authority is configured", () => {
    const runtime = buildRuntimeForCommit(undefined, undefined, null);
    const beforeRef = runtime.getHead()?.snapshotRef;

    const result = runtime.proposeAndCommit(introduceIntent(0));

    expect(result).toMatchObject({
      code: "content_ref_unavailable",
      path: "artifacts.contentRef",
    });
    expect(runtime.getHead()?.snapshotRef).toBe(beforeRef);
  });

  it("rejects a dangling ref denied by the authoritative store", () => {
    const runtime = buildRuntimeForCommit(undefined, undefined, { isAvailable: () => false });

    const result = runtime.proposeAndCommit(introduceIntent(0));

    expect(result).toMatchObject({
      code: "content_ref_unavailable",
      path: "artifacts.contentRef",
    });
  });

  it("fails closed when the content authority cannot answer", () => {
    const runtime = buildRuntimeForCommit(undefined, undefined, {
      isAvailable() {
        throw new Error("store unavailable");
      },
    });

    const result = runtime.proposeAndCommit(introduceIntent(0));

    expect(result).toMatchObject({ code: "content_ref_unavailable" });
  });

  it("rejects an async authority Promise instead of treating it as truthy evidence", () => {
    const asyncAuthority = {
      async isAvailable() {
        return true;
      },
    } as unknown as ContentRefAuthority;
    const runtime = buildRuntimeForCommit(undefined, undefined, asyncAuthority);
    const beforeRef = runtime.getHead()?.snapshotRef;

    const result = runtime.proposeAndCommit(introduceIntent(0));

    expect(result).toMatchObject({ code: "content_ref_unavailable" });
    expect(runtime.getHead()?.snapshotRef).toBe(beforeRef);
  });

  it("returns apply_failed when handler rejects", () => {
    const handlers = new InMemoryHandlerRegistry();
    handlers.register(operationTypeId("introduce_artifact"), () => ({
      ok: false as const,
      reason: "handler rejected",
    }));
    const runtime = buildRuntimeForCommit(handlers);
    const result = runtime.proposeAndCommit(introduceIntent(0));
    expect("code" in result).toBe(true);
    if (!("code" in result)) {
      return;
    }
    expect(result.code).toBe("apply_failed");
  });

  it("does not let a rejecting handler mutate its authoritative before snapshot", () => {
    const handlers = new InMemoryHandlerRegistry();
    let mapMutationRejected = false;
    let nestedMutationRejected = false;
    handlers.register(
      operationTypeId("introduce_artifact"),
      (before) => {
        try {
          (before.participants as unknown as Map<unknown, unknown>).clear();
        } catch (error) {
          mapMutationRejected = error instanceof TypeError;
        }
        const planner = before.participants.get(actorId("planner-p"));
        try {
          (planner as { status: string }).status = "retired";
        } catch (error) {
          nestedMutationRejected = error instanceof TypeError;
        }
        return { ok: false as const, reason: "handler rejected after mutation attempt" };
      },
      "1",
    );
    const runtime = buildRuntimeForCommit(handlers);
    const before = runtime.getHead()!;

    const result = runtime.proposeAndCommit(introduceIntent(0));

    expect(result).toMatchObject({ code: "apply_failed" });
    expect(mapMutationRejected).toBe(true);
    expect(nestedMutationRejected).toBe(true);
    expect(runtime.getHead()?.snapshotRef).toBe(before.snapshotRef);
    expect(runtime.getHead()?.participants.get(actorId("planner-p"))?.status).toBe("active");
  });

  it("returns apply_failed when template ensure fails after apply", () => {
    const handlers = new InMemoryHandlerRegistry();
    handlers.register(
      operationTypeId("introduce_artifact"),
      (before, recipe, ctx) => {
        const applied = introduceArtifactHandler(before, recipe, ctx);
        if (!applied.ok) {
          return applied;
        }
        return {
          ok: true as const,
          after: { ...applied.after, artifacts: new Map() },
          involved: applied.involved,
          createdSessionRefs: applied.createdSessionRefs,
        };
      },
      "1",
    );
    const runtime = buildRuntimeForCommit(handlers);
    const admitted = runtime.admit(introduceIntent(0));
    expect(admitted.ok).toBe(true);
    if (!admitted.ok) {
      return;
    }
    const result = runtime.commit(admitted.ticket);
    expect("code" in result).toBe(true);
    if (!("code" in result)) {
      return;
    }
    expect(result.code).toBe("apply_failed");
  });

  it("returns commit_atomic_failed when change chain validation fails", () => {
    const t0 = buildConfigT0();
    const { durable, changelog } = createMemoryRuntimePersistence({ initial: t0 });
    changelog.append(
      coordinationChange({
        changeId: changeId("chg-orphan"),
        recordedAt: timestamp("2026-08-07T09:00:00Z"),
        epochId: epochId("42"),
        operationTypeId: operationTypeId("introduce_artifact"),
        beforeRef: t0.snapshotRef,
        afterRef: snapshotRef("snap-orphan"),
        matchBindings: [],
        initiator: actorRef(actorId("planner-p"), "agent"),
        visibility: "external",
      }),
    );
    const locks = new MemoryResourceLockTable();
    const runtime = createCoordinationRuntime(
      runtimeDependenciesWithStaticSchema({
        durable,
        clock: createFixedClock(),
        idGen: createDeterministicIdGenerator({
          snapshotRefs: ["snap-S1"],
          changeIds: ["chg-new"],
        }),
        schema: createDefaultSchema(),
        activeEpochId: epochId("42"),
        policy: allowAllPolicyEvaluator(),
        handlers: createDefaultHandlers(),
        locks,
        registry: new AdmissionRegistry(locks),
        contentRefAuthority: AVAILABLE_CONTENT,
      }),
    );
    const admitted = runtime.admit(introduceIntent(0));
    expect(admitted.ok).toBe(true);
    if (!admitted.ok) {
      return;
    }
    const result = runtime.commit(admitted.ticket);
    expect("code" in result).toBe(true);
    if (!("code" in result)) {
      return;
    }
    expect(result.code).toBe("commit_atomic_failed");
  });

  it("returns commit_atomic_failed when durable rejects duplicate change id", () => {
    const t0 = buildConfigT0();
    const { durable, changelog } = createMemoryRuntimePersistence({ initial: t0 });
    const locks = new MemoryResourceLockTable();
    const registry = new AdmissionRegistry(locks);
    const idGen = createDeterministicIdGenerator({
      snapshotRefs: ["snap-S1"],
      changeIds: ["chg-dup"],
    });
    changelog.append(
      coordinationChange({
        changeId: changeId("chg-dup"),
        recordedAt: timestamp("2026-08-07T10:00:00Z"),
        epochId: epochId("42"),
        operationTypeId: operationTypeId("introduce_artifact"),
        beforeRef: t0.snapshotRef,
        afterRef: snapshotRef("snap-SX"),
        matchBindings: [],
        initiator: actorRef(actorId("planner-p"), "agent"),
        visibility: "external",
      }),
    );
    const runtime = createCoordinationRuntime(
      runtimeDependenciesWithStaticSchema({
        durable,
        clock: createFixedClock(),
        idGen,
        schema: createDefaultSchema(),
        activeEpochId: epochId("42"),
        policy: allowAllPolicyEvaluator(),
        handlers: createDefaultHandlers(),
        locks,
        registry,
        contentRefAuthority: AVAILABLE_CONTENT,
      }),
    );
    const admitted = runtime.admit(introduceIntent(0));
    expect(admitted.ok).toBe(true);
    if (!admitted.ok) {
      return;
    }
    const result = runtime.commit(admitted.ticket);
    expect("code" in result).toBe(true);
    if (!("code" in result)) {
      return;
    }
    expect(result.code).toBe("commit_atomic_failed");
  });

  it("returns apply_failed when post-apply snapshot integrity fails", () => {
    const handlers = new InMemoryHandlerRegistry();
    handlers.register(
      operationTypeId("introduce_artifact"),
      (before, recipe, ctx) => {
        const applied = introduceArtifactHandler(before, recipe, ctx);
        if (!applied.ok) {
          return applied;
        }
        const artifact = [...applied.after.artifacts.values()][0]!;
        const tampered = new Map([
          ["wrong-key" as never, { ...artifact, artifactId: artifact.artifactId }],
        ]);
        return {
          ok: true as const,
          after: { ...applied.after, artifacts: tampered },
          involved: applied.involved,
          createdSessionRefs: applied.createdSessionRefs,
        };
      },
      "1",
    );
    const runtime = buildRuntimeForCommit(handlers);
    const admitted = runtime.admit(introduceIntent(0));
    expect(admitted.ok).toBe(true);
    if (!admitted.ok) {
      return;
    }
    const result = runtime.commit(admitted.ticket);
    expect("code" in result).toBe(true);
    if (!("code" in result)) {
      return;
    }
    expect(result.code).toBe("apply_failed");
  });
});

function buildRuntimeForCommit(
  handlers = createDefaultHandlers(),
  runHistory = new RunHistoryTracker(),
  contentRefAuthority: ContentRefAuthority | null = AVAILABLE_CONTENT,
) {
  const t0 = buildConfigT0();
  const { durable } = createMemoryRuntimePersistence({ initial: t0 });
  const locks = new MemoryResourceLockTable();
  const runtime = createCoordinationRuntime(
    runtimeDependenciesWithStaticSchema({
      durable,
      clock: createFixedClock(),
      idGen: createDeterministicIdGenerator({
        snapshotRefs: ["snap-S1"],
        changeIds: ["chg-001"],
      }),
      schema: createDefaultSchema(),
      activeEpochId: epochId("42"),
      policy: allowAllPolicyEvaluator(),
      handlers,
      locks,
      runHistory,
      ...(contentRefAuthority === null ? {} : { contentRefAuthority }),
    }),
  );
  return runtime;
}
