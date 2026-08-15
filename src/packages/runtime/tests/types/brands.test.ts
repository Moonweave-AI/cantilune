import { describe, it, expectTypeOf } from "vitest";
import type { AdmittedId, CommittedChangeId } from "../../src/foundation/brands.js";
import { admittedId, committedChangeId } from "../../src/foundation/brands.js";
import { changeId } from "@cantilune/core";

describe("runtime brand types", () => {
  it("keeps admitted and committed ids distinct from core change ids", () => {
    expectTypeOf(admittedId("adm-1")).not.toEqualTypeOf(changeId("chg-1"));
    expectTypeOf(committedChangeId(changeId("chg-1"))).not.toEqualTypeOf<AdmittedId>();
    expectTypeOf(admittedId("adm-1")).toEqualTypeOf<AdmittedId>();
    expectTypeOf(committedChangeId(changeId("chg-1"))).toEqualTypeOf<CommittedChangeId>();
  });
});
