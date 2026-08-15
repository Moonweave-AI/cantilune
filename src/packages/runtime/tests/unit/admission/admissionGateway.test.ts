import { describe, expect, it } from "vitest";
import {
  contentRef,
  coordinationIntent,
  evidenceId,
  evidenceRef,
  matchBinding,
  operationTypeId,
} from "@cantilune/core";
import { actorRef } from "@cantilune/core";
import { buildConfigT0, storyActorIds } from "../../support/fixtures/config-t0.js";
import { storyEntityIds } from "../../support/fixtures/story-entities.js";
import { createTestAdmissionGateway } from "../../support/testAdmissionGateway.js";

describe("admission gateway", () => {
  it("rejects delegate when task missing", () => {
    const { gateway } = createTestAdmissionGateway(buildConfigT0());
    const principal = actorRef(storyActorIds.planner, "agent");

    const result = gateway.admit({
      intent: coordinationIntent(principal, operationTypeId("delegate"), [
        matchBinding("task", storyEntityIds.task),
        matchBinding("from", storyActorIds.planner),
        matchBinding("to", storyActorIds.coder),
        matchBinding("capability", storyEntityIds.writeLock),
      ]),
      principal,
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.reason.kind).toBe("requires_failed");
  });

  it("admits content inputs independently from external evidence", () => {
    const { gateway, registry, store } = createTestAdmissionGateway(buildConfigT0());
    const principal = actorRef(storyActorIds.planner, "agent");
    const inputRef = contentRef(
      "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    );
    const evidenceContentRef = contentRef(
      "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    );

    const result = gateway.admit({
      intent: coordinationIntent(
        principal,
        operationTypeId("introduce_artifact"),
        [matchBinding("task", storyEntityIds.task), matchBinding("from", storyActorIds.planner)],
        [evidenceRef(evidenceId("ev-input-separation"), "observation", evidenceContentRef)],
        [inputRef],
        { priority: 2, acknowledged: true },
      ),
      principal,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    const record = registry.resolveForCommit(result.ticket, store.head());
    expect(record.ok).toBe(true);
    if (!record.ok) {
      return;
    }
    expect(record.record.intent.inputContentRefs).toEqual([inputRef]);
    expect(record.record.recipe.inputContentRefs).toEqual([inputRef]);
    expect(record.record.recipe.scalarInputs).toEqual({ priority: 2, acknowledged: true });
    expect(record.record.recipe.external.map((item) => item.contentRef)).toEqual([
      evidenceContentRef,
    ]);
    gateway.cancel(result.ticket);
  });
});
