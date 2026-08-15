import { describe, expect, it } from "vitest";
import {
  changeId,
  coordinationChange,
  epochId,
  matchBinding,
  operationTypeId,
  snapshotRef,
} from "@cantilune/core";
import { actorRef, actorId } from "@cantilune/core";
import { timestamp } from "@cantilune/core";
import { createReplayVerifier } from "../../../src/execution/replayVerifier.js";
import { createDefaultHandlers } from "../../../src/execution/handlers/index.js";
import { createMemoryRuntimePersistence } from "../../../src/memory/memoryDurableCoordinator.js";
import { createDefaultSchema } from "../../../src/schema/defaultSchema.js";
import { createActiveSchemaContext } from "../../../src/engine/activeSchemaContext.js";
import { buildConfigT0 } from "../../support/fixtures/config-t0.js";

describe("N-R2 replay chain violations", () => {
  it("rejects broken beforeRef chains during verification", () => {
    const t0 = buildConfigT0();
    const { durable } = createMemoryRuntimePersistence({ initial: t0 });
    const verifier = createReplayVerifier({
      durable,
      handlers: createDefaultHandlers(),
      schemaContext: createActiveSchemaContext(createDefaultSchema(), epochId("42")),
    });

    const first = coordinationChange({
      changeId: changeId("chg-001"),
      recordedAt: timestamp("2026-08-07T10:05:00Z"),
      epochId: epochId("42"),
      operationTypeId: operationTypeId("introduce_artifact"),
      beforeRef: snapshotRef("snap-S0"),
      afterRef: snapshotRef("snap-S1"),
      matchBindings: [matchBinding("task", "task-T")],
      initiator: actorRef(actorId("planner-p"), "agent"),
      visibility: "internal",
    });
    const broken = coordinationChange({
      changeId: changeId("chg-002"),
      recordedAt: timestamp("2026-08-07T10:10:00Z"),
      epochId: epochId("42"),
      operationTypeId: operationTypeId("delegate"),
      beforeRef: snapshotRef("snap-WRONG"),
      afterRef: snapshotRef("snap-S2"),
      matchBindings: [matchBinding("task", "task-T")],
      initiator: actorRef(actorId("planner-p"), "agent"),
      visibility: "internal",
    });

    const result = verifier.verify({
      fromRef: t0.snapshotRef,
      changes: [first, broken],
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.violation.code).toBe("replay_chain_broken");
  });
});
