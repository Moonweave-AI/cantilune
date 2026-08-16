import { describe, expect, it } from "vitest";
import { actorId, actorRef } from "@cantilune/core";
import type { Footprint } from "@cantilune/core";
import {
  EXTERNAL_AND_INTERNAL_LTS_POLICY,
  EXTERNAL_ONLY_LTS_POLICY,
  allowsVisibility,
  requireAccessContext,
} from "../../../src/input/observationAccessContext.js";

describe("ObservationAccessContext", () => {
  it("allows only listed visibilities", () => {
    expect(allowsVisibility(EXTERNAL_ONLY_LTS_POLICY, "external")).toBe(true);
    expect(allowsVisibility(EXTERNAL_ONLY_LTS_POLICY, "internal")).toBe(false);
    expect(allowsVisibility(EXTERNAL_AND_INTERNAL_LTS_POLICY, "internal")).toBe(true);
  });

  it("requires a principal and scope", () => {
    expect(() => requireAccessContext(undefined)).toThrow(/ObservationAccessContext is required/);
    expect(
      requireAccessContext({
        principal: actorRef(actorId("operator"), "reviewer"),
        scope: {
          artifactIds: new Set(),
          participantIds: new Set(),
          sessionIds: new Set(),
          capabilityIds: new Set(),
          linkIds: new Set(),
        } satisfies Footprint,
        visibilityPolicy: EXTERNAL_ONLY_LTS_POLICY,
      }).principal.actorId,
    ).toBe(actorId("operator"));
  });
});
