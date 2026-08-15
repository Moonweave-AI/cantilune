import { describe, it, expect } from "vitest";
import {
  actorId,
  contentRef,
  epochId,
  matchBinding,
  operationTypeId,
  collaborationSnapshot,
  participant,
  snapshotRef,
} from "@cantilune/core";
import { activateParticipantHandler } from "../../../../src/execution/handlers/activateParticipant.js";
import { replayRecipe } from "../../../../src/replay/recipe.js";

const INITIATOR = actorId("agent-0");
const TARGET = actorId("agent-1");
const MANIFEST_REF = contentRef("sha256:manifest-agent-1");

function snapshotWith(initiatorStatus: "active" | "registered", targetStatus: "registered" | "waiting" | "blocked" | "active" | "done" | "retired") {
  return collaborationSnapshot({
    snapshotRef: snapshotRef("s0"),
    epochId: epochId("e1"),
    participants: new Map([
      [INITIATOR, participant(INITIATOR, "agent", initiatorStatus)],
      [TARGET, participant(TARGET, "agent", targetStatus)],
    ]),
  });
}

function recipe(opts: { from?: string; target?: string; manifest?: string }) {
  return replayRecipe({
    epochId: epochId("e1"),
    operationTypeId: operationTypeId("activate_participant"),
    matchBindings: [
      matchBinding("from", opts.from ?? "agent-0"),
      matchBinding("participant", opts.target ?? "agent-1"),
    ],
    inputContentRefs: opts.manifest === undefined ? [] : [contentRef(opts.manifest)],
    visibility: "external",
  });
}

const ctx = { template: undefined as never };

describe("activateParticipantHandler (ADR-0015)", () => {
  it("activates a registered agent and binds its manifest ref", () => {
    const snap = snapshotWith("active", "registered");
    const result = activateParticipantHandler(snap, recipe({ manifest: "sha256:manifest-agent-1" }), ctx);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const activated = result.after.participants.get(TARGET);
    expect(activated?.status).toBe("active");
    expect(activated?.manifestRef).toBe(MANIFEST_REF);
  });

  it("activates a waiting agent", () => {
    const snap = snapshotWith("active", "waiting");
    const result = activateParticipantHandler(snap, recipe({ manifest: "sha256:manifest-agent-1" }), ctx);

    expect(result.ok).toBe(true);
  });

  it("activates a blocked agent", () => {
    const snap = snapshotWith("active", "blocked");
    const result = activateParticipantHandler(snap, recipe({ manifest: "sha256:manifest-agent-1" }), ctx);

    expect(result.ok).toBe(true);
  });

  it("rejects when 'from' binding is missing", () => {
    const snap = snapshotWith("active", "registered");
    const recipeNoFrom = replayRecipe({
      epochId: epochId("e1"),
      operationTypeId: operationTypeId("activate_participant"),
      matchBindings: [matchBinding("participant", "agent-1")],
      inputContentRefs: [MANIFEST_REF],
      visibility: "external",
    });
    const result = activateParticipantHandler(snap, recipeNoFrom, ctx);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toContain("from");
  });

  it("rejects when 'participant' binding is missing", () => {
    const snap = snapshotWith("active", "registered");
    const recipeNoTarget = replayRecipe({
      epochId: epochId("e1"),
      operationTypeId: operationTypeId("activate_participant"),
      matchBindings: [matchBinding("from", "agent-0")],
      inputContentRefs: [MANIFEST_REF],
      visibility: "external",
    });
    const result = activateParticipantHandler(snap, recipeNoTarget, ctx);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toContain("participant");
  });

  it("rejects when initiator is not found", () => {
    const snap = snapshotWith("active", "registered");
    const result = activateParticipantHandler(snap, recipe({ from: "ghost" }), ctx);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toContain("not found");
  });

  it("rejects when initiator is not active", () => {
    const snap = snapshotWith("registered", "registered");
    const result = activateParticipantHandler(snap, recipe({ manifest: "sha256:m" }), ctx);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toContain("active");
  });

  it("rejects when target is not found", () => {
    const snap = snapshotWith("active", "registered");
    const result = activateParticipantHandler(snap, recipe({ target: "ghost" }), ctx);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toContain("not found");
  });

  it("rejects an invalid lifecycle transition (done → active)", () => {
    const snap = snapshotWith("active", "done");
    const result = activateParticipantHandler(snap, recipe({ manifest: "sha256:m" }), ctx);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toContain("invalid lifecycle transition");
  });

  it("rejects activating an already-active participant", () => {
    const snap = snapshotWith("active", "active");
    const result = activateParticipantHandler(snap, recipe({ manifest: "sha256:m" }), ctx);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toContain("invalid lifecycle transition");
  });

  it("rejects an agent activation without a manifest ref", () => {
    const snap = snapshotWith("active", "registered");
    const result = activateParticipantHandler(snap, recipe({}), ctx);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toContain("manifest ref");
  });

  it("activates a non-agent (human) participant without a manifest ref", () => {
    const snap = collaborationSnapshot({
      snapshotRef: snapshotRef("s0"),
      epochId: epochId("e1"),
      participants: new Map([
        [INITIATOR, participant(INITIATOR, "agent", "active")],
        [TARGET, participant(TARGET, "human", "registered")],
      ]),
    });
    const result = activateParticipantHandler(snap, recipe({}), ctx);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const activated = result.after.participants.get(TARGET);
    expect(activated?.status).toBe("active");
    expect(activated?.manifestRef).toBeUndefined();
  });

  it("rejects a manifest ref supplied for a non-agent participant", () => {
    const snap = collaborationSnapshot({
      snapshotRef: snapshotRef("s0"),
      epochId: epochId("e1"),
      participants: new Map([
        [INITIATOR, participant(INITIATOR, "agent", "active")],
        [TARGET, participant(TARGET, "human", "registered")],
      ]),
    });
    const result = activateParticipantHandler(snap, recipe({ manifest: "sha256:m" }), ctx);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toContain("non-agent");
  });

  it("includes both initiator and target in involved refs", () => {
    const snap = snapshotWith("active", "registered");
    const result = activateParticipantHandler(snap, recipe({ manifest: "sha256:manifest-agent-1" }), ctx);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.involved).toHaveLength(2);
    expect(result.involved.map((r) => r.actorId)).toContain(INITIATOR);
    expect(result.involved.map((r) => r.actorId)).toContain(TARGET);
  });

  it("preserves the initiator and other participants in the after-snapshot", () => {
    const extra = actorId("agent-2");
    const snap = collaborationSnapshot({
      snapshotRef: snapshotRef("s0"),
      epochId: epochId("e1"),
      participants: new Map([
        [INITIATOR, participant(INITIATOR, "agent", "active")],
        [TARGET, participant(TARGET, "agent", "registered")],
        [extra, participant(extra, "agent", "registered")],
      ]),
    });
    const result = activateParticipantHandler(snap, recipe({ manifest: "sha256:manifest-agent-1" }), ctx);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.after.participants.get(INITIATOR)?.status).toBe("active");
    expect(result.after.participants.get(extra)?.status).toBe("registered");
    expect(result.after.participants.get(TARGET)?.status).toBe("active");
  });
});
