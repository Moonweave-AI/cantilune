import { describe, expect, it } from "vitest";
import { actorId, actorRef } from "@cantilune/core";
import {
  administrationActor,
  administrationActorId,
  actorIdsEqual,
  hasRole,
  hasScope,
} from "../../../src/administration/administrationContext.js";
import { testAdminContext } from "../../support/testAdminContext.js";

describe("administration context helpers", () => {
  const context = testAdminContext(["schema-qualifier", "schema-authorizer"], "operator");

  it("extracts actor ref and id", () => {
    expect(administrationActor(context).actorId).toBe(actorId("operator"));
    expect(administrationActorId(context)).toBe("operator");
  });

  it("checks roles and scopes", () => {
    expect(hasRole(context, "schema-qualifier")).toBe(true);
    expect(hasRole(context, "policy-admin")).toBe(false);
    expect(hasScope(context, "control-plane")).toBe(true);
    expect(hasScope(context, "other")).toBe(false);
  });

  it("compares actor ids from ref or string", () => {
    const ref = actorRef(actorId("operator"), "reviewer");
    expect(actorIdsEqual(ref, "operator")).toBe(true);
    expect(actorIdsEqual("operator", ref)).toBe(true);
    expect(actorIdsEqual("other", ref)).toBe(false);
  });
});
