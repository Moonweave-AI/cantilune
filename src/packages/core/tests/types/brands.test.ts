import { describe, expect, it, expectTypeOf } from "vitest";
import { actorId, artifactId } from "../../src/primitives/ids.js";
import type { CoordinationChange } from "../../src/coordination/coordinationChange.js";

describe("compile-time contracts", () => {
  it("keeps actor and artifact ids as distinct brands", () => {
    expectTypeOf(actorId("x")).not.toEqualTypeOf(artifactId("x"));
  });

  it("excludes payload from CoordinationChange", () => {
    expectTypeOf<keyof CoordinationChange>().not.toMatchTypeOf<"payload">();
  });
});
