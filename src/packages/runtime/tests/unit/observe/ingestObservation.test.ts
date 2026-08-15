import { describe, expect, it } from "vitest";
import { actorRef, contentRef } from "@cantilune/core";
import { ingestObservation } from "../../../src/observe/ingestObservation.js";
import type { DurableCoordinator } from "../../../src/ports/durableCoordinator.js";
import { createMemoryRuntimePersistence } from "../../../src/memory/memoryDurableCoordinator.js";
import { buildConfigT0, storyActorIds } from "../../support/fixtures/config-t0.js";
import { createFixedClock } from "../../support/fixedClock.js";
import { createDeterministicIdGenerator } from "../../support/deterministicIds.js";

describe("ingestObservation", () => {
  it("appends auditTail without changing collaboration graph", () => {
    const initial = buildConfigT0();
    const { durable } = createMemoryRuntimePersistence({ initial });
    const source = actorRef(storyActorIds.human, "human");
    const result = ingestObservation(
      durable,
      createDeterministicIdGenerator({ snapshotRefs: ["snap-S-obs"] }),
      createFixedClock(),
      {
        source,
        payloadRef: contentRef("content://req-login"),
      },
      source,
      { isAvailable: () => true },
    );

    expect("snapshot" in result).toBe(true);
    if (!("snapshot" in result)) {
      return;
    }

    expect(result.snapshot.auditTail).toHaveLength(1);
    expect(result.snapshot.participants.size).toBe(initial.participants.size);
    expect(result.snapshot.artifacts.size).toBe(0);
    expect(result.snapshot.snapshotRef).toBe("snap-S-obs");
    expect(durable.get(initial.snapshotRef)?.auditTail).toHaveLength(0);
  });

  it("rejects when head snapshot is missing", () => {
    const { durable } = createMemoryRuntimePersistence();
    const source = actorRef(storyActorIds.human, "human");
    const result = ingestObservation(
      durable,
      createDeterministicIdGenerator(),
      createFixedClock(),
      {
        source,
        payloadRef: contentRef("content://req-login"),
      },
      source,
      { isAvailable: () => true },
    );

    expect("code" in result).toBe(true);
    if (!("code" in result)) {
      return;
    }
    expect(result.code).toBe("observe_invalid");
  });

  it("rejects principal mismatch and head race", () => {
    const initial = buildConfigT0();
    const { durable } = createMemoryRuntimePersistence({ initial });
    const source = actorRef(storyActorIds.human, "human");
    const principal = actorRef(storyActorIds.planner, "agent");
    const mismatch = ingestObservation(
      durable,
      createDeterministicIdGenerator(),
      createFixedClock(),
      { source, payloadRef: contentRef("content://req-login") },
      principal,
      { isAvailable: () => true },
    );
    expect("code" in mismatch).toBe(true);

    const racingDurable: DurableCoordinator = {
      head: () => initial.snapshotRef,
      get: () => initial,
      activeBinding: () => undefined,
      compareAndSwapHead: () => false,
      compareAndSwapHeadWithBinding: () => false,
      commit: () => ({ ok: false, reason: "stub" }),
      changes: () => [],
      since: () => [],
      recipeForChange: () => undefined,
    };
    const race = ingestObservation(
      racingDurable,
      createDeterministicIdGenerator({ snapshotRefs: ["snap-S-obs"] }),
      createFixedClock(),
      { source, payloadRef: contentRef("content://req-login") },
      source,
      { isAvailable: () => true },
    );
    expect("code" in race).toBe(true);
    if (!("code" in race)) {
      return;
    }
    expect(race.message).toContain("head changed");
  });

  it("rejects when head snapshot record is missing", () => {
    const initial = buildConfigT0();
    const missingHead: DurableCoordinator = {
      head: () => initial.snapshotRef,
      get: () => undefined,
      activeBinding: () => undefined,
      compareAndSwapHead: () => true,
      compareAndSwapHeadWithBinding: () => true,
      commit: () => ({ ok: false, reason: "stub" }),
      changes: () => [],
      since: () => [],
      recipeForChange: () => undefined,
    };
    const source = actorRef(storyActorIds.human, "human");
    const result = ingestObservation(
      missingHead,
      createDeterministicIdGenerator(),
      createFixedClock(),
      { source, payloadRef: contentRef("content://req-login") },
      source,
      { isAvailable: () => true },
    );
    expect("code" in result).toBe(true);
    if (!("code" in result)) {
      return;
    }
    expect(result.message).toContain("head snapshot missing");
  });
});
