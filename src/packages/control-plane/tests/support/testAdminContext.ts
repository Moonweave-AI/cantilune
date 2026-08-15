import type { AdministrationContext } from "../../src/administration/administrationContext.js";
import { actorId, actorRef } from "@cantilune/core";

export function testAdminContext(
  roles: readonly string[],
  actor = "test-operator",
): AdministrationContext {
  return {
    principal: {
      actorRef: actorRef(actorId(actor), "reviewer"),
      roles,
      scopes: ["control-plane"],
    },
    issuedAt: new Date().toISOString(),
    sessionId: `session-${actor}`,
  };
}

export const qualifierContext = (): AdministrationContext =>
  testAdminContext(["schema-qualifier", "schema-proposer"], "qualifier");

export const proposerContext = (): AdministrationContext =>
  testAdminContext(["schema-qualifier", "schema-proposer", "schema-authorizer"], "proposer");

export const authorizerContext = (): AdministrationContext =>
  testAdminContext(["schema-authorizer"], "authorizer");

export const committerContext = (): AdministrationContext =>
  testAdminContext(["schema-authorizer", "schema-committer"], "committer");
