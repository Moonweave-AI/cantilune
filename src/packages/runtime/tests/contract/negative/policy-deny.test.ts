import { describe, expect, it } from "vitest";
import { coordinationIntent, matchBinding, operationTypeId } from "@cantilune/core";
import { actorRef } from "@cantilune/core";
import { createCoordinationRuntime } from "../../../src/engine/coordinationRuntime.js";
import { runtimeDependenciesWithStaticSchema } from "../../../src/engine/runtimeDependenciesCompat.js";
import { createDefaultHandlers } from "../../../src/execution/handlers/index.js";
import { MemoryResourceLockTable } from "../../../src/memory/index.js";
import { denyByDefaultPolicyEvaluator } from "../../../src/ports/policyEvaluator.js";
import { createMemoryRuntimePersistence } from "../../../src/memory/memoryDurableCoordinator.js";
import { createDefaultSchema } from "../../../src/schema/defaultSchema.js";
import { buildConfigT0, storyActorIds } from "../../support/fixtures/config-t0.js";
import { storyEntityIds } from "../../support/fixtures/story-entities.js";
import { createDeterministicIdGenerator } from "../../support/deterministicIds.js";
import { createFixedClock } from "../../support/fixedClock.js";

const denyAll = {
  evaluate() {
    return { kind: "deny" as const, reason: "stress-policy-deny" };
  },
};

function testRuntime(policy?: typeof denyAll) {
  const t0 = buildConfigT0();
  const { durable } = createMemoryRuntimePersistence({ initial: t0 });
  return createCoordinationRuntime(
    runtimeDependenciesWithStaticSchema({
      durable,
      clock: createFixedClock(),
      idGen: createDeterministicIdGenerator(),
      schema: createDefaultSchema(),
      activeEpochId: t0.epochId,
      ...(policy !== undefined ? { policy } : {}),
      handlers: createDefaultHandlers(),
      locks: new MemoryResourceLockTable(),
    }),
  );
}

describe("policy deny path", () => {
  it("rejects admission when policy denies even if schema passes", () => {
    const runtime = testRuntime(denyAll);

    const result = runtime.admit(
      coordinationIntent(
        actorRef(storyActorIds.planner, "agent"),
        operationTypeId("introduce_artifact"),
        [
          matchBinding("task", storyEntityIds.task),
          matchBinding("from", storyActorIds.planner),
          matchBinding("capability", storyEntityIds.writeLock),
        ],
      ),
    );

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.reason.kind).toBe("policy_denied");
  });

  it("defaults to denyByDefaultPolicyEvaluator when policy omitted", () => {
    const runtime = testRuntime();

    const result = runtime.admit(
      coordinationIntent(
        actorRef(storyActorIds.planner, "agent"),
        operationTypeId("introduce_artifact"),
        [
          matchBinding("task", storyEntityIds.task),
          matchBinding("from", storyActorIds.planner),
          matchBinding("capability", storyEntityIds.writeLock),
        ],
      ),
    );

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.reason.kind).toBe("policy_denied");
    expect(denyByDefaultPolicyEvaluator().evaluate).toBeDefined();
  });
});
