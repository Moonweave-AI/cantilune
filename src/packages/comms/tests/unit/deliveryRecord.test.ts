import { describe, expect, it } from "vitest";
import { defaultRetryPolicy } from "../../src/delivery/deliveryRecord.js";

describe("deliveryRecord", () => {
  it("defines default retry policy constants", () => {
    expect(defaultRetryPolicy.maxAttempts).toBe(16);
    expect(defaultRetryPolicy.baseDelayMs).toBe(100);
    expect(defaultRetryPolicy.maxDelayMs).toBe(60_000);
    expect(defaultRetryPolicy.jitterRatio).toBe(0.2);
  });
});
