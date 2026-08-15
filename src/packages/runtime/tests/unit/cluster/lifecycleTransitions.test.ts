import { describe, it, expect } from "vitest";
import {
  validateTransition,
  validTransitionsFrom,
} from "../../../src/cluster/lifecycleTransitions.js";

describe("LifecycleTransitions", () => {
  describe("validateTransition", () => {
    it("allows registered → active", () => {
      expect(validateTransition("registered", "active")).toBe(true);
    });

    it("allows active → done", () => {
      expect(validateTransition("active", "done")).toBe(true);
    });

    it("allows active → retired", () => {
      expect(validateTransition("active", "retired")).toBe(true);
    });

    it("allows active → waiting", () => {
      expect(validateTransition("active", "waiting")).toBe(true);
    });

    it("allows active → blocked", () => {
      expect(validateTransition("active", "blocked")).toBe(true);
    });

    it("allows done → retired", () => {
      expect(validateTransition("done", "retired")).toBe(true);
    });

    it("allows waiting → active", () => {
      expect(validateTransition("waiting", "active")).toBe(true);
    });

    it("allows blocked → active", () => {
      expect(validateTransition("blocked", "active")).toBe(true);
    });

    it("rejects registered → done (must go through active)", () => {
      expect(validateTransition("registered", "done")).toBe(false);
    });

    it("rejects done → active (terminal state)", () => {
      expect(validateTransition("done", "active")).toBe(false);
    });

    it("rejects retired → active (terminal state)", () => {
      expect(validateTransition("retired", "active")).toBe(false);
    });

    it("rejects retired → done", () => {
      expect(validateTransition("retired", "done")).toBe(false);
    });

    it("rejects active → registered (cannot go backwards)", () => {
      expect(validateTransition("active", "registered")).toBe(false);
    });

    it("rejects registered → retired (must go through active)", () => {
      expect(validateTransition("registered", "retired")).toBe(false);
    });
  });

  describe("validTransitionsFrom", () => {
    it("returns [active] for registered", () => {
      expect(validTransitionsFrom("registered")).toEqual(["active"]);
    });

    it("returns multiple targets for active", () => {
      const transitions = validTransitionsFrom("active");
      expect(transitions).toContain("done");
      expect(transitions).toContain("retired");
      expect(transitions).toContain("waiting");
      expect(transitions).toContain("blocked");
    });

    it("returns [retired] for done", () => {
      expect(validTransitionsFrom("done")).toEqual(["retired"]);
    });

    it("returns [] for retired (terminal)", () => {
      expect(validTransitionsFrom("retired")).toEqual([]);
    });
  });
});
