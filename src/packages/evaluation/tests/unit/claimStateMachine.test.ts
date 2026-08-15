import { describe, it, expect } from "vitest";
import {
  transitionClaim,
  isClaimTerminal,
  canClaimBePublished,
} from "../../src/claims/claimStateMachine.js";

describe("Claim state machine", () => {
  it("allows proposed → protocolFrozen", () => {
    const result = transitionClaim("proposed", "protocolFrozen");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe("protocolFrozen");
  });

  it("allows protocolFrozen → measured", () => {
    const result = transitionClaim("protocolFrozen", "measured");
    expect(result.ok).toBe(true);
  });

  it.each([
    ["supported", "supported"],
    ["notSupported", "notSupported"],
    ["inconclusive", "inconclusive"],
  ] as const)("allows measured → %s", (target, expected) => {
    const result = transitionClaim("measured", target);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(expected);
  });

  it("allows supported → independentlyReviewed", () => {
    const result = transitionClaim("supported", "independentlyReviewed");
    expect(result.ok).toBe(true);
  });

  it("allows independentlyReviewed → published", () => {
    const result = transitionClaim("independentlyReviewed", "published");
    expect(result.ok).toBe(true);
  });

  it("allows published → superseded", () => {
    const result = transitionClaim("published", "superseded");
    expect(result.ok).toBe(true);
  });

  it("allows published → retracted", () => {
    const result = transitionClaim("published", "retracted");
    expect(result.ok).toBe(true);
  });

  it("rejects proposed → published (skip)", () => {
    const result = transitionClaim("proposed", "published");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.violations[0]!.code).toBe("invalid_state_transition");
    }
  });

  it("rejects superseded → proposed (terminal)", () => {
    const result = transitionClaim("superseded", "proposed");
    expect(result.ok).toBe(false);
  });

  it("rejects retracted → proposed (terminal)", () => {
    const result = transitionClaim("retracted", "proposed");
    expect(result.ok).toBe(false);
  });

  it("identifies terminal states", () => {
    expect(isClaimTerminal("superseded")).toBe(true);
    expect(isClaimTerminal("retracted")).toBe(true);
    expect(isClaimTerminal("published")).toBe(false);
    expect(isClaimTerminal("proposed")).toBe(false);
  });

  it("identifies publishable state", () => {
    expect(canClaimBePublished("independentlyReviewed")).toBe(true);
    expect(canClaimBePublished("supported")).toBe(false);
    expect(canClaimBePublished("proposed")).toBe(false);
  });
});
