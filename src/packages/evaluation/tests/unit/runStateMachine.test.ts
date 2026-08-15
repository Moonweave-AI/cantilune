import { describe, it, expect } from "vitest";
import {
  transitionRun,
  transitionAttempt,
  isRunTerminal,
  isAttemptTerminal,
} from "../../src/execution/runStateMachine.js";

describe("Run state machine", () => {
  it("allows planned → admitted", () => {
    const result = transitionRun("planned", "admitted");
    expect(result.ok).toBe(true);
  });

  it("follows full happy path", () => {
    const path = [
      "planned",
      "admitted",
      "queued",
      "leased",
      "running",
      "collecting",
      "scoring",
      "analyzing",
      "reviewPending",
      "accepted",
      "published",
    ] as const;
    for (let i = 0; i < path.length - 1; i++) {
      const result = transitionRun(path[i]!, path[i + 1]!);
      expect(result.ok).toBe(true);
    }
  });

  it.each(["failed", "budgetExhausted", "securityStopped"] as const)(
    "allows running → %s",
    (target) => {
      const result = transitionRun("running", target);
      expect(result.ok).toBe(true);
    },
  );

  it("allows queued → cancelled", () => {
    const result = transitionRun("queued", "cancelled");
    expect(result.ok).toBe(true);
  });

  it("allows reviewPending → rejected", () => {
    const result = transitionRun("reviewPending", "rejected");
    expect(result.ok).toBe(true);
  });

  it("rejects planned → running (skip)", () => {
    const result = transitionRun("planned", "running");
    expect(result.ok).toBe(false);
  });

  it("rejects published → planned (terminal)", () => {
    const result = transitionRun("published", "planned");
    expect(result.ok).toBe(false);
  });

  it("identifies all terminal states", () => {
    expect(isRunTerminal("published")).toBe(true);
    expect(isRunTerminal("failed")).toBe(true);
    expect(isRunTerminal("cancelled")).toBe(true);
    expect(isRunTerminal("budgetExhausted")).toBe(true);
    expect(isRunTerminal("rejected")).toBe(true);
    expect(isRunTerminal("running")).toBe(false);
    expect(isRunTerminal("planned")).toBe(false);
  });
});

describe("Attempt state machine", () => {
  it("allows queued → running", () => {
    const result = transitionAttempt("queued", "running");
    expect(result.ok).toBe(true);
  });

  it.each(["succeeded", "failed", "timedOut"] as const)("allows running → %s", (target) => {
    const result = transitionAttempt("running", target);
    expect(result.ok).toBe(true);
  });

  it("allows queued → cancelled", () => {
    const result = transitionAttempt("queued", "cancelled");
    expect(result.ok).toBe(true);
  });

  it("rejects succeeded → running (terminal)", () => {
    const result = transitionAttempt("succeeded", "running");
    expect(result.ok).toBe(false);
  });

  it("identifies terminal states", () => {
    expect(isAttemptTerminal("succeeded")).toBe(true);
    expect(isAttemptTerminal("failed")).toBe(true);
    expect(isAttemptTerminal("timedOut")).toBe(true);
    expect(isAttemptTerminal("cancelled")).toBe(true);
    expect(isAttemptTerminal("running")).toBe(false);
  });
});
