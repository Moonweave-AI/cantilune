import { describe, expect, it } from "vitest";
import { admittedId, committedChangeId } from "../../../src/foundation/brands.js";
import { changeId } from "@cantilune/core";

describe("runtime brands", () => {
  it("constructs admitted and committed ids", () => {
    expect(admittedId("adm-001")).toBe("adm-001");
    expect(committedChangeId(changeId("chg-001"))).toBe("chg-001");
  });
});
