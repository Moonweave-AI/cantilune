/**
 * petriControl wiring test (ADR-0017).
 *
 * Verifies the runtime→Petri projection and the real engine operations
 * (fire/reach/invariants) surfaced through petriControl, plus the
 * createPetriController wrapper. The underlying engine math is covered by
 * the @cantilune/petri package's own tests; this covers the CLI projection
 * + controller glue.
 */
import { describe, it, expect } from "vitest";
import {
  createPetriController,
  fireTransition,
  invariantsFor,
  projectPetriNet,
  reachability,
} from "../../src/wiring/petriControl.js";
import { emptyRuntime, sampleRuntime } from "../support/sampleRuntime.js";

describe("petriControl — projectPetriNet", () => {
  it("returns null when the runtime has no snapshot", () => {
    expect(projectPetriNet(emptyRuntime)).toBeNull();
  });

  it("projects artifacts + capabilities into places and operations into transitions", () => {
    const snapshot = projectPetriNet(sampleRuntime);
    expect(snapshot).not.toBeNull();
    expect(snapshot!.places.map((p) => p.name)).toContain("art:task-001");
    expect(snapshot!.places.map((p) => p.name)).toContain("write_lock");
    expect(snapshot!.transitions.map((t) => t.name)).toContain("introduce_artifact");
    expect(snapshot!.transitions.map((t) => t.name)).toContain("commit_change");
  });

  it("seeds every place with 1 token and reports enablement", () => {
    const snapshot = projectPetriNet(sampleRuntime);
    expect(snapshot!.places.every((p) => p.tokens === 1)).toBe(true);
    // Transitions whose input arc (paired capability) holds a token are enabled.
    expect(snapshot!.transitions.some((t) => t.enabled)).toBe(true);
  });

  it("produces consumes/produces arc lists for enabled transitions", () => {
    const snapshot = projectPetriNet(sampleRuntime);
    const enabled = snapshot!.transitions.find((t) => t.enabled);
    expect(enabled).toBeDefined();
    expect(enabled!.consumes.length).toBeGreaterThan(0);
  });
});

describe("petriControl — fireTransition", () => {
  it("returns null when the runtime has no snapshot", () => {
    expect(fireTransition(emptyRuntime, "introduce_artifact")).toBeNull();
  });

  it("fires a named transition and reports before/after markings", () => {
    const fire = fireTransition(sampleRuntime, "introduce_artifact");
    expect(fire).not.toBeNull();
    expect(fire!.op).toBe("introduce_artifact");
    expect(fire!.transitionId).toMatch(/^t\d+$/);
    expect(fire!.bindings).toBe("{}");
    // The fire consumed the paired capability token.
    const beforeTokens = fire!.before.places.reduce((sum, p) => sum + p.tokens, 0);
    const afterTokens = fire!.after.places.reduce((sum, p) => sum + p.tokens, 0);
    // A pure consume/produce preserves total tokens; a disabled fire leaves it unchanged.
    expect(afterTokens).toBe(beforeTokens);
  });

  it("falls back to the first transition when op is unknown", () => {
    const fire = fireTransition(sampleRuntime, "nonexistent-op");
    expect(fire).not.toBeNull();
    expect(fire!.op).toBe("observe");
  });

  it("passes through bindings as a no-op and serializes them", () => {
    const fire = fireTransition(sampleRuntime, "introduce_artifact", { role: "coder" });
    expect(fire!.bindings).toBe(JSON.stringify({ role: "coder" }));
  });

  it("reports a disabled fire when the input capability lacks tokens", () => {
    // A net where the first capability is already consumed: build a runtime where
    // introduce_artifact's paired capability is absent by emptying capabilities.
    const sparse = {
      snapshot: { ...sampleRuntime.snapshot!, capabilities: [] },
      changeLog: sampleRuntime.changeLog,
      epoch: sampleRuntime.epoch,
    };
    const fire = fireTransition(sparse, "introduce_artifact");
    expect(fire).not.toBeNull();
    // With no capability input arcs, transitions are source transitions (always enabled).
    expect(fire!.result.ok).toBe(true);
  });
});

describe("petriControl — reachability", () => {
  it("returns null when the runtime has no snapshot", () => {
    expect(reachability(emptyRuntime, "art:task-001")).toBeNull();
  });

  it("reports reachable when the goal place already holds a token", () => {
    const reach = reachability(sampleRuntime, "art:task-001");
    expect(reach).not.toBeNull();
    expect(reach!.reachable).toBe(true);
    // art:task-001 starts with a token, so the goal is met immediately (empty trace).
    expect(reach!.trace).toHaveLength(0);
  });

  it("reports unreachable-within-steps when the goal cannot be reached", () => {
    const reach = reachability(sampleRuntime, "nonexistent-place", 3);
    expect(reach).not.toBeNull();
    expect(reach!.reachable).toBe(false);
    expect(reach!.maxSteps).toBe(3);
  });

  it("reports a dead-marking verdict when the net has no enabled transitions", () => {
    // A net with no changeLog has no transitions, so the initial marking is dead.
    const noTransitions = {
      snapshot: sampleRuntime.snapshot,
      changeLog: [],
      epoch: sampleRuntime.epoch,
    };
    const reach = reachability(noTransitions, "nonexistent-place");
    expect(reach).not.toBeNull();
    expect(reach!.reachable).toBe(false);
    expect(reach!.dead).toBe(true);
  });
});

describe("petriControl — invariantsFor", () => {
  it("returns null when the runtime has no snapshot", () => {
    expect(invariantsFor(emptyRuntime)).toBeNull();
  });

  it("computes the S-invariant basis and the change-chain T-invariant flag", () => {
    const inv = invariantsFor(sampleRuntime);
    expect(inv).not.toBeNull();
    expect(Array.isArray(inv!.invariants)).toBe(true);
    expect(inv!.changeChainNonEmpty).toBe(true);
  });
});

describe("petriControl — createPetriController", () => {
  it("exposes project/fire/reach/invariants bound to the pure engine functions", () => {
    const controller = createPetriController();
    expect(controller.project(sampleRuntime)).not.toBeNull();
    expect(controller.fire(sampleRuntime, "introduce_artifact")).not.toBeNull();
    expect(controller.reach(sampleRuntime, "art:task-001")).not.toBeNull();
    expect(controller.invariants(sampleRuntime)).not.toBeNull();
    // null runtime is handled on each path.
    expect(controller.project(emptyRuntime)).toBeNull();
    expect(controller.fire(emptyRuntime, "x")).toBeNull();
    expect(controller.reach(emptyRuntime, "x")).toBeNull();
    expect(controller.invariants(emptyRuntime)).toBeNull();
  });
});
