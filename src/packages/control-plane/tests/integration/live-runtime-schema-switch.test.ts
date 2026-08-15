import { describe, expect, it } from "vitest";
import {
  actorRef,
  coordinationIntent,
  idempotencyKey,
  matchBinding,
  operationTemplateRef,
  operationTypeId,
  schemaAdmissionId,
  schemaRevisionId,
} from "@cantilune/core";
import {
  buildOrchestrationSchema,
  createCoordinationRuntime,
  createDefaultHandlers,
  introduceArtifactHandler,
  templateAwarePolicyEvaluator,
} from "@cantilune/runtime";
import { storyActorIds } from "@cantilune/test-fixtures";
import { buildAdmissionHarness, createSchemaRevision } from "../support/buildAdmissionHarness.js";
import { createDeterministicIdGenerator } from "../support/deterministicIds.js";

function createFixedClock(iso = "2026-08-07T10:00:00Z") {
  return { now: () => iso };
}

describe("L6 live runtime schema switch", () => {
  it("admits a new operation type only after epoch commit activates extended schema", async () => {
    const harness = buildAdmissionHarness();
    const { genesisBinding, genesisRevision } = harness;
    const holder = storyActorIds.planner;
    const newOperation = operationTypeId("archive_artifact");

    const extended = buildOrchestrationSchema("default-v1", [
      ...genesisRevision.schema.templates,
      {
        ...genesisRevision.schema.templates[0]!,
        operationTypeId: newOperation,
        templateRef: operationTemplateRef("archive_artifact", "1"),
        description: "archive",
        requiredRoles: ["task", "from"],
        requires: [],
        ensures: [],
      },
    ]);
    const candidate = createSchemaRevision({
      schema: extended,
      revisionId: schemaRevisionId("rev-live-001"),
      parentRef: genesisRevision.schemaRef,
      createdBy: "author",
      createdAt: "2026-08-11T12:00:00Z",
    });
    harness.registerRevision(candidate);

    const handlers = createDefaultHandlers();
    handlers.register(newOperation, introduceArtifactHandler, "1");

    const beforeRuntime = createCoordinationRuntime({
      durable: harness.durable,
      locks: harness.locks,
      clock: createFixedClock(),
      idGen: createDeterministicIdGenerator({ snapshotRefs: ["snap-pre"] }),
      schemaContext: harness.schemaHolder,
      policy: templateAwarePolicyEvaluator(),
      handlers,
    });
    const beforeAdmit = beforeRuntime.admit(
      coordinationIntent(actorRef(holder, "agent"), newOperation, [
        matchBinding("task", "task-live-001"),
        matchBinding("from", holder),
        matchBinding("capability", "cap-live-001"),
      ]),
    );
    expect(beforeAdmit.ok).toBe(false);

    const committed = await harness.runAdmissionPipeline({
      admissionId: schemaAdmissionId("adm-live-001"),
      candidate,
      idempotencyKey: idempotencyKey("idem-live-001"),
      requestedAt: "2026-08-11T12:01:00Z",
    });
    expect(committed.ok).toBe(true);
    if (!committed.ok) {
      return;
    }

    const afterRuntime = createCoordinationRuntime({
      durable: harness.durable,
      locks: harness.locks,
      clock: createFixedClock(),
      idGen: createDeterministicIdGenerator({ snapshotRefs: ["snap-post"] }),
      schemaContext: harness.schemaHolder,
      policy: harness.policyHolder.get(),
      handlers,
    });
    const afterAdmit = afterRuntime.admit(
      coordinationIntent(actorRef(holder, "agent"), newOperation, [
        matchBinding("task", "task-live-002"),
        matchBinding("from", holder),
        matchBinding("capability", "cap-live-002"),
      ]),
    );
    expect(afterAdmit.ok).toBe(true);
    expect(
      harness.schemaHolder.get().schema.templates.some((t) => t.operationTypeId === newOperation),
    ).toBe(true);
    expect(harness.bindingHolder.get().schemaRef.revisionId).toBe(candidate.schemaRef.revisionId);
    expect(
      (harness.bindingHolder.get().epochOrdinal as number) >
        (genesisBinding.epochOrdinal as number),
    ).toBe(true);
  });
});
