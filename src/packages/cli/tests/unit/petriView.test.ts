import { describe, it, expect } from "vitest";
import { renderPetriViewOutput } from "../../src/views/PetriView.js";
import { emptyRuntime, sampleRuntime } from "../support/sampleRuntime.js";
import {
  fireTransition,
  projectPetriNet,
  reachability,
  invariantsFor,
} from "../../src/wiring/petriControl.js";

describe("PetriView", () => {
  it("renders marking table with places and tokens", () => {
    const petriData = projectPetriNet(sampleRuntime);
    expect(petriData).not.toBeNull();
    const output = renderPetriViewOutput("petri", { petriData }, sampleRuntime);

    expect(output).toContain("write_lock");
    expect(output).toContain("Place");
    expect(output).toContain("Tokens");
    expect(output).toContain("art:task-001");
  });

  it("shows empty state without runtime data", () => {
    const output = renderPetriViewOutput("petri", {}, emptyRuntime);
    expect(output).toContain("No runtime connected");
  });

  it("renders enabled transitions table", () => {
    const petriData = projectPetriNet(sampleRuntime);
    expect(petriData).not.toBeNull();
    const output = renderPetriViewOutput("petri-transitions", { petriData }, sampleRuntime);
    expect(output).toContain("introduce_artifact");
    expect(output).toContain("commit_change");
    expect(output).toContain("Enabled");
  });

  it("renders fire with real before/after markings", () => {
    const fireData = fireTransition(sampleRuntime, "introduce_artifact");
    expect(fireData).not.toBeNull();
    const output = renderPetriViewOutput(
      "petri-fire",
      { petriData: fireData, op: "introduce_artifact" },
      sampleRuntime,
    );
    expect(output).toContain("Fire: introduce_artifact");
    expect(output).toContain("Before:");
    // After label is either "After (fired)" or "After (disabled: ...)" — both are real verdicts.
    expect(output).toMatch(/After \(fired\)|After \(disabled/);
  });

  it("renders reachability verdict and trace", () => {
    const reachData = reachability(sampleRuntime, "art:task-001");
    expect(reachData).not.toBeNull();
    const output = renderPetriViewOutput(
      "petri-reach",
      { petriData: reachData, goal: "art:task-001" },
      sampleRuntime,
    );
    expect(output).toContain("Goal: art:task-001");
    expect(output).toContain("Verdict:");
  });

  it("renders invariants from the incidence matrix", () => {
    const invData = invariantsFor(sampleRuntime);
    expect(invData).not.toBeNull();
    const output = renderPetriViewOutput("petri-invariants", { petriData: invData }, sampleRuntime);
    expect(output).toContain("S-invariant");
    expect(output).toContain("T-invariant");
  });

  it("renders the empty-invariants row with a pending change chain", () => {
    // A net whose incidence matrix admits no positive place invariant (e.g. a
    // transition that consumes without producing) yields an empty basis; an empty
    // changeLog marks the change chain T-invariant "pending" rather than "ok".
    const output = renderPetriViewOutput(
      "petri-invariants",
      { petriData: { invariants: [], changeChainNonEmpty: false } },
      sampleRuntime,
    );
    expect(output).toContain("(none)");
    expect(output).toContain("pending");
  });

  it("renders the no-data fallback for petri-invariants when petriData is null", () => {
    // Headless path (no controller) stashes petriData:null; the view must prompt
    // to load rather than render an empty invariants table.
    const output = renderPetriViewOutput(
      "petri-invariants",
      { petriData: null, petriKind: "invariants" },
      sampleRuntime,
    );
    expect(output).toContain("No Petri data loaded");
  });
});
