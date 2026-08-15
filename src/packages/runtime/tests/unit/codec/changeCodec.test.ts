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
import {
  decodeChange,
  decodeChangeFromUnknown,
  encodeChange,
  encodeChangeWithRecipe,
} from "../../../src/codec/changeCodec.js";
import { replayRecipe } from "../../../src/replay/recipe.js";

describe("changeCodec", () => {
  it("round-trips coordination changes through wire DTO", () => {
    const original = coordinationChange({
      changeId: changeId("chg-001"),
      recordedAt: timestamp("2026-08-07T10:05:00Z"),
      epochId: epochId("42"),
      operationTypeId: operationTypeId("delegate"),
      beforeRef: snapshotRef("snap-S1"),
      afterRef: snapshotRef("snap-S2"),
      matchBindings: [
        matchBinding("task", "task-T"),
        matchBinding("from", "planner-p"),
        matchBinding("to", "coder-c"),
      ],
      initiator: actorRef(actorId("planner-p"), "agent"),
      visibility: "external",
    });

    const decoded = decodeChange(encodeChange(original));
    expect(decoded.changeId).toBe(original.changeId);
    expect(decoded.operationTypeId).toBe(original.operationTypeId);
    expect(decoded.matchBindings).toEqual(original.matchBindings);
    expect("payload" in decoded).toBe(false);
  });

  it("preserves extended recipe fields through decode", () => {
    const original = coordinationChange({
      changeId: changeId("chg-002"),
      recordedAt: timestamp("2026-08-07T10:05:00Z"),
      epochId: epochId("42"),
      operationTypeId: operationTypeId("fork_branch"),
      beforeRef: snapshotRef("snap-S1"),
      afterRef: snapshotRef("snap-S2"),
      matchBindings: [matchBinding("from", "planner-p")],
      initiator: actorRef(actorId("planner-p"), "agent"),
      visibility: "external",
    });
    const wire = encodeChange(original);
    const extended = {
      ...wire,
      matchWitness: { domainSize: 1, codomainSize: 1, embedding: [0] },
      complementTag: 3,
      freshLinkRefs: ["link-1"],
      inputContentRefs: ["content://task-T"],
      scalarInputs: { attempt: 3, mode: "parallel", acknowledged: true },
    };
    const decoded = decodeChangeFromUnknown(extended);
    expect("code" in decoded).toBe(false);
    if ("code" in decoded) {
      return;
    }
    expect(decoded.recipe.complementTag).toBe(3);
    expect(decoded.recipe.freshLinkRefs).toEqual(["link-1"]);
    expect(decoded.recipe.scalarInputs).toEqual({
      attempt: 3,
      mode: "parallel",
      acknowledged: true,
    });
  });

  it("returns violation for invalid unknown wire", () => {
    const decoded = decodeChangeFromUnknown({ bad: true });
    expect("code" in decoded).toBe(true);
  });

  it("decodes change without extended recipe fields on wire", () => {
    const original = coordinationChange({
      changeId: changeId("chg-plain"),
      recordedAt: timestamp("2026-08-07T10:05:00Z"),
      epochId: epochId("42"),
      operationTypeId: operationTypeId("introduce_artifact"),
      beforeRef: snapshotRef("snap-S1"),
      afterRef: snapshotRef("snap-S2"),
      matchBindings: [matchBinding("task", "task-T"), matchBinding("from", "planner-p")],
      initiator: actorRef(actorId("planner-p"), "agent"),
      visibility: "external",
    });
    const wire = encodeChange(original);
    const {
      matchWitness: _mw,
      complementTag: _ct,
      freshLinkRefs: _fl,
      inputContentRefs: _ic,
      scalarInputs: _si,
      ...minimal
    } = wire as Record<string, unknown> & typeof wire;
    const decoded = decodeChangeFromUnknown(minimal);
    expect("code" in decoded).toBe(false);
  });

  it("persists heartbeat emittedAt and rejects legacy heartbeat wire without it", () => {
    const original = coordinationChange({
      changeId: changeId("chg-heartbeat"),
      recordedAt: timestamp("2026-08-13T09:00:00Z"),
      epochId: epochId("42"),
      operationTypeId: operationTypeId("emit_heartbeat"),
      beforeRef: snapshotRef("snap-S1"),
      afterRef: snapshotRef("snap-S2"),
      matchBindings: [matchBinding("from", "planner-p")],
      initiator: actorRef(actorId("planner-p"), "agent"),
      visibility: "internal",
    });
    const recipe = replayRecipe({
      epochId: original.epochId,
      operationTypeId: original.operationTypeId,
      matchBindings: original.matchBindings,
      scalarInputs: { turnCount: 17, lastAction: "write_content" },
      emittedAt: timestamp("2026-08-13T09:00:00Z"),
      visibility: "internal",
    });
    expect(() => encodeChange(original)).toThrow(/emittedAt/);
    const wire = encodeChangeWithRecipe(original, recipe);

    const decoded = decodeChangeFromUnknown(wire);
    expect("code" in decoded).toBe(false);
    if (!("code" in decoded)) {
      expect(decoded.recipe.emittedAt).toBe("2026-08-13T09:00:00Z");
      expect(decoded.recipe.scalarInputs).toEqual({
        turnCount: 17,
        lastAction: "write_content",
      });
    }

    const { emittedAt: _emittedAt, ...legacyWire } = wire;
    const rejected = decodeChangeFromUnknown(legacyWire);
    expect("code" in rejected).toBe(true);
    if ("code" in rejected) {
      expect(rejected.path).toBe("change.emittedAt");
    }
  });
});
