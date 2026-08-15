import { describe, expect, it } from "vitest";
import {
  actorId,
  actorRef,
  changeId,
  contentRef,
  coordinationChange,
  epochId,
  evidenceId,
  evidenceRef,
  linkId,
  matchBinding,
  operationTypeId,
  operationTemplateRef,
  sessionId,
  snapshotRef,
  timestamp,
  type MatchBinding,
} from "@cantilune/core";
import { RecipeSidecar } from "../../../src/replay/recipeSidecar.js";
import { replayRecipe } from "../../../src/replay/recipe.js";

describe("RecipeSidecar", () => {
  it("falls back to replayRecipeFromChange when recipe not stored", () => {
    const sidecar = new RecipeSidecar();
    const change = coordinationChange({
      changeId: changeId("chg-1"),
      recordedAt: timestamp("2026-08-07T10:00:00Z"),
      epochId: epochId("42"),
      operationTypeId: operationTypeId("introduce_artifact"),
      beforeRef: snapshotRef("snap-S0"),
      afterRef: snapshotRef("snap-S1"),
      matchBindings: [matchBinding("task", "task-T")],
      initiator: actorRef(actorId("planner-p"), "agent"),
      visibility: "external",
    });
    const recipe = sidecar.recipeForChange(change);
    expect(recipe.operationTypeId).toBe("introduce_artifact");
  });

  it("returns stored recipe when present", () => {
    const sidecar = new RecipeSidecar();
    const stored = replayRecipe({
      epochId: epochId("42"),
      operationTypeId: operationTypeId("delegate"),
      matchBindings: [],
      visibility: "external",
    });
    sidecar.put(changeId("chg-2"), stored);
    const change = coordinationChange({
      changeId: changeId("chg-2"),
      recordedAt: timestamp("2026-08-07T10:00:00Z"),
      epochId: epochId("42"),
      operationTypeId: operationTypeId("introduce_artifact"),
      beforeRef: snapshotRef("snap-S0"),
      afterRef: snapshotRef("snap-S1"),
      matchBindings: [],
      initiator: actorRef(actorId("planner-p"), "agent"),
      visibility: "external",
    });
    expect(sidecar.recipeForChange(change).operationTypeId).toBe("delegate");
  });

  it("deeply detaches put ingress including heartbeat scalar and time authority", () => {
    const binding = matchBinding("from", "agent-a");
    const templateRef = operationTemplateRef("emit_heartbeat", "1");
    const witness = { domainSize: 1, codomainSize: 1, embedding: [0] };
    const authorization = evidenceRef(
      evidenceId("approval-heartbeat"),
      "approval",
      contentRef("sha256:approval-heartbeat"),
    );
    const stored = replayRecipe({
      epochId: epochId("42"),
      operationTypeId: operationTypeId("emit_heartbeat"),
      templateRef,
      matchBindings: [binding],
      matchWitness: witness,
      authorization: [authorization],
      external: [],
      createdSessionRefs: [sessionId("session-heartbeat")],
      freshLinkRefs: [linkId("link-heartbeat")],
      inputContentRefs: [contentRef("sha256:heartbeat-input")],
      scalarInputs: { turnCount: 37, lastAction: "write_content" },
      emittedAt: timestamp("2026-08-13T10:00:00Z"),
      visibility: "external",
    });
    const sidecar = new RecipeSidecar();

    sidecar.put(changeId("chg-heartbeat"), stored);
    (stored as unknown as { emittedAt: string }).emittedAt = "2099-01-01T00:00:00Z";
    (templateRef as unknown as { revision: string }).revision = "poisoned";
    (binding as unknown as { actorId: string }).actorId = "agent-poisoned";
    witness.embedding.push(99);
    (authorization as unknown as { contentRef: string }).contentRef = "sha256:poisoned";
    (stored.scalarInputs as Record<string, string | number | boolean>).turnCount = 999;
    (stored.matchBindings as MatchBinding[]).push(matchBinding("from", "agent-extra"));

    expect(sidecar.get(changeId("chg-heartbeat"))).toMatchObject({
      templateRef: { operationTypeId: "emit_heartbeat", revision: "1" },
      matchBindings: [{ role: "from", actorId: "agent-a" }],
      matchWitness: { domainSize: 1, codomainSize: 1, embedding: [0] },
      authorization: [{ contentRef: "sha256:approval-heartbeat" }],
      scalarInputs: { turnCount: 37, lastAction: "write_content" },
      emittedAt: "2026-08-13T10:00:00Z",
    });
  });

  it("returns independent, deeply frozen get and recipeForChange egress", () => {
    const sidecar = new RecipeSidecar();
    const stored = replayRecipe({
      epochId: epochId("42"),
      operationTypeId: operationTypeId("emit_heartbeat"),
      templateRef: operationTemplateRef("emit_heartbeat", "1"),
      matchBindings: [matchBinding("from", "agent-a")],
      authorization: [],
      external: [],
      createdSessionRefs: [],
      freshLinkRefs: [],
      inputContentRefs: [],
      scalarInputs: { turnCount: 37, lastAction: "write_content" },
      emittedAt: timestamp("2026-08-13T10:00:00Z"),
      visibility: "external",
    });
    const id = changeId("chg-frozen-heartbeat");
    sidecar.put(id, stored);

    const first = sidecar.get(id)!;
    const second = sidecar.get(id)!;
    expect(first).not.toBe(second);
    expect(first.matchBindings).not.toBe(second.matchBindings);
    expect(first.matchWitness).not.toBe(second.matchWitness);
    expect(first.scalarInputs).not.toBe(second.scalarInputs);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.matchBindings)).toBe(true);
    expect(Object.isFrozen(first.matchBindings[0])).toBe(true);
    expect(Object.isFrozen(first.matchWitness)).toBe(true);
    expect(Object.isFrozen(first.matchWitness.embedding)).toBe(true);
    expect(Object.isFrozen(first.scalarInputs)).toBe(true);
    expect(() => {
      (first as unknown as { emittedAt: string }).emittedAt = "2099-01-01T00:00:00Z";
    }).toThrow(TypeError);
    expect(() => {
      (first.scalarInputs as Record<string, string | number | boolean>).turnCount = 999;
    }).toThrow(TypeError);
    expect(() => {
      (first.matchWitness.embedding as number[]).push(99);
    }).toThrow(TypeError);

    const change = coordinationChange({
      changeId: id,
      recordedAt: timestamp("2026-08-13T10:00:00Z"),
      epochId: epochId("42"),
      operationTypeId: operationTypeId("emit_heartbeat"),
      beforeRef: snapshotRef("snap-before"),
      afterRef: snapshotRef("snap-after"),
      matchBindings: [],
      initiator: actorRef(actorId("agent-a"), "agent"),
      visibility: "external",
    });
    const forChange = sidecar.recipeForChange(change);
    expect(forChange).not.toBe(first);
    expect(Object.isFrozen(forChange)).toBe(true);
    expect(forChange.scalarInputs).toEqual({ turnCount: 37, lastAction: "write_content" });
    expect(forChange.emittedAt).toBe("2026-08-13T10:00:00Z");
    expect(second.scalarInputs).toEqual({ turnCount: 37, lastAction: "write_content" });
  });

  it("deeply freezes fallback recipes derived from caller-owned changes", () => {
    const binding = matchBinding("from", "agent-a");
    const change = coordinationChange({
      changeId: changeId("chg-fallback-frozen"),
      recordedAt: timestamp("2026-08-13T10:00:00Z"),
      epochId: epochId("42"),
      operationTypeId: operationTypeId("signal_done"),
      beforeRef: snapshotRef("snap-before"),
      afterRef: snapshotRef("snap-after"),
      matchBindings: [binding],
      initiator: actorRef(actorId("agent-a"), "agent"),
      visibility: "external",
    });

    const recipe = new RecipeSidecar().recipeForChange(change);
    (binding as unknown as { actorId: string }).actorId = "agent-poisoned";

    expect(recipe.matchBindings).toEqual([{ role: "from", actorId: "agent-a" }]);
    expect(Object.isFrozen(recipe)).toBe(true);
    expect(Object.isFrozen(recipe.matchBindings[0])).toBe(true);
  });
});
