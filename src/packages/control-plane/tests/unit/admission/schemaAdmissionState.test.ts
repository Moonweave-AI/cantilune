import { describe, expect, it } from "vitest";
import {
  canTransitionAdmission,
  TERMINAL_ADMISSION_STATES,
} from "../../../src/admission/schemaAdmissionState.js";

describe("schema admission state transitions", () => {
  it("allows valid forward transitions", () => {
    expect(canTransitionAdmission("proposed", "validating")).toBe(true);
    expect(canTransitionAdmission("validating", "qualified")).toBe(true);
    expect(canTransitionAdmission("awaiting_authorization", "authorized")).toBe(true);
    expect(canTransitionAdmission("authorized", "preparing")).toBe(true);
    expect(canTransitionAdmission("preparing", "prepared")).toBe(true);
    expect(canTransitionAdmission("prepared", "committed")).toBe(true);
    expect(canTransitionAdmission("degraded", "acknowledged")).toBe(true);
  });

  it("rejects invalid transitions", () => {
    expect(canTransitionAdmission("committed", "prepared")).toBe(false);
    expect(canTransitionAdmission("rejected", "authorized")).toBe(false);
    expect(canTransitionAdmission("acknowledged", "preparing")).toBe(false);
    expect(canTransitionAdmission("invalid" as "proposed", "validating")).toBe(false);
  });

  it("marks terminal states", () => {
    expect(TERMINAL_ADMISSION_STATES.has("committed")).toBe(true);
    expect(TERMINAL_ADMISSION_STATES.has("rejected")).toBe(true);
    expect(TERMINAL_ADMISSION_STATES.has("preparing")).toBe(false);
  });
});
