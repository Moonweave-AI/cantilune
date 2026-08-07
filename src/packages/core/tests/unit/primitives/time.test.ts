import { describe, expect, it } from "vitest";
import { sequenceNo, timestamp } from "../../../src/primitives/time.js";

describe("time primitives", () => {
  it("wraps timestamp strings", () => {
    expect(timestamp("2026-08-07T10:00:00Z")).toBe("2026-08-07T10:00:00Z");
  });

  it("wraps sequence numbers", () => {
    expect(sequenceNo(1)).toBe(1);
    expect(sequenceNo(42)).toBe(42);
  });
});
