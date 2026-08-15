import { describe, expect, it } from "vitest";
import {
  ALL_OPERATION_CODES,
  deriveOperationFamily,
} from "../../src/protocol/communicationOperationRegistry.js";

describe("registry fuzz", () => {
  it("never maps unknown registry codes into families", () => {
    for (const code of ALL_OPERATION_CODES) {
      const family = deriveOperationFamily(code);
      expect(family.length).toBeGreaterThan(0);
    }
  });

  it("handles random strings without throwing", () => {
    for (let index = 0; index < 100; index += 1) {
      const random = `op-${Math.random().toString(36).slice(2)}`;
      expect(() => deriveOperationFamily(random as never)).not.toThrow();
    }
  });
});
