import { describe, it, expect } from "vitest";
import { transitionDataset, isDatasetTerminal } from "../../src/datasets/datasetStateMachine.js";

describe("Dataset state machine", () => {
  it("allows proposed → provenanceChecked", () => {
    const result = transitionDataset("proposed", "provenanceChecked");
    expect(result.ok).toBe(true);
  });

  it("allows provenanceChecked → privacyReviewed", () => {
    const result = transitionDataset("provenanceChecked", "privacyReviewed");
    expect(result.ok).toBe(true);
  });

  it("allows privacyReviewed → approved", () => {
    const result = transitionDataset("privacyReviewed", "approved");
    expect(result.ok).toBe(true);
  });

  it("allows approved → frozen", () => {
    const result = transitionDataset("approved", "frozen");
    expect(result.ok).toBe(true);
  });

  it("allows frozen → active", () => {
    const result = transitionDataset("frozen", "active");
    expect(result.ok).toBe(true);
  });

  it("allows active → expired", () => {
    const result = transitionDataset("active", "expired");
    expect(result.ok).toBe(true);
  });

  it("allows active → quarantined", () => {
    const result = transitionDataset("active", "quarantined");
    expect(result.ok).toBe(true);
  });

  it("allows quarantined → active (re-activate)", () => {
    const result = transitionDataset("quarantined", "active");
    expect(result.ok).toBe(true);
  });

  it("allows quarantined → deleted", () => {
    const result = transitionDataset("quarantined", "deleted");
    expect(result.ok).toBe(true);
  });

  it("rejects proposed → active (skip)", () => {
    const result = transitionDataset("proposed", "active");
    expect(result.ok).toBe(false);
  });

  it("rejects deleted → proposed (terminal)", () => {
    const result = transitionDataset("deleted", "proposed");
    expect(result.ok).toBe(false);
  });

  it("identifies terminal states", () => {
    expect(isDatasetTerminal("expired")).toBe(true);
    expect(isDatasetTerminal("deleted")).toBe(true);
    expect(isDatasetTerminal("active")).toBe(false);
    expect(isDatasetTerminal("quarantined")).toBe(false);
  });
});
