import { describe, it, expect } from "vitest";
import { transitionSuite, isSuiteTerminal } from "../../src/benchmarks/suiteStateMachine.js";

describe("Suite state machine", () => {
  it("allows draft → reviewPending", () => {
    const result = transitionSuite("draft", "reviewPending");
    expect(result.ok).toBe(true);
  });

  it("allows reviewPending → approved", () => {
    const result = transitionSuite("reviewPending", "approved");
    expect(result.ok).toBe(true);
  });

  it("allows reviewPending → draft (send back)", () => {
    const result = transitionSuite("reviewPending", "draft");
    expect(result.ok).toBe(true);
  });

  it("allows approved → frozen", () => {
    const result = transitionSuite("approved", "frozen");
    expect(result.ok).toBe(true);
  });

  it("allows frozen → deprecated", () => {
    const result = transitionSuite("frozen", "deprecated");
    expect(result.ok).toBe(true);
  });

  it("allows frozen → revoked", () => {
    const result = transitionSuite("frozen", "revoked");
    expect(result.ok).toBe(true);
  });

  it("rejects draft → frozen (skip)", () => {
    const result = transitionSuite("draft", "frozen");
    expect(result.ok).toBe(false);
  });

  it("rejects deprecated → draft (terminal)", () => {
    const result = transitionSuite("deprecated", "draft");
    expect(result.ok).toBe(false);
  });

  it("identifies terminal states", () => {
    expect(isSuiteTerminal("deprecated")).toBe(true);
    expect(isSuiteTerminal("revoked")).toBe(true);
    expect(isSuiteTerminal("frozen")).toBe(false);
  });
});
