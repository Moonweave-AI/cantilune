import { describe, expect, it } from "vitest";
import { actorRef, coordinationIntent, matchBinding, operationTypeId } from "@cantilune/core";
import { buildConfigT0, storyActorIds } from "../../support/fixtures/config-t0.js";
import { createTestAdmissionGateway } from "../../support/testAdmissionGateway.js";

/** Admits one legal operation and returns the ticket's admitted id. */
function admitOnce(): string {
  const { gateway } = createTestAdmissionGateway(buildConfigT0());
  const principal = actorRef(storyActorIds.planner, "agent");
  const result = gateway.admit({
    intent: coordinationIntent(principal, operationTypeId("introduce_artifact"), [
      matchBinding("from", storyActorIds.planner),
      matchBinding("task", "task-fresh"),
    ]),
    principal,
  });
  if (!result.ok) {
    throw new Error(`expected admission to succeed, got ${JSON.stringify(result.reason)}`);
  }
  return result.ticket.ticketId as string;
}

/**
 * Admitted ids key the cross-process resource lock table, so two gateways must
 * never mint the same one.
 *
 * Every gateway used to count from 1, so a second process holding a disjoint
 * footprint under "adm-1" released the first process's lock when it finished —
 * two writers on one footprint, with no error raised anywhere.
 */
describe("admitted ids are unique across gateway instances", () => {
  it("does not repeat the first id in a second gateway", () => {
    expect(admitOnce()).not.toBe(admitOnce());
  });

  it("keeps ids distinct across many gateways", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 25; i++) {
      seen.add(admitOnce());
    }
    expect(seen.size).toBe(25);
  });
});
