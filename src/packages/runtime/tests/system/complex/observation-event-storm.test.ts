import { describe, expect, it } from "vitest";
import { contentRef } from "@cantilune/core";
import { actorRef } from "@cantilune/core";
import { buildTestRuntime } from "../../support/buildTestRuntime.js";
import { RUNTIME_SCALE, runtimeActors } from "../../support/scenario/largeWorld.js";

describe("observation event storm", () => {
  it("appends many observations without mutating coordination change count", () => {
    const { runtime } = buildTestRuntime({ eventCount: 4 });

    for (let index = 0; index < RUNTIME_SCALE.storm; index++) {
      const source = actorRef(runtimeActors.human, "human");
      const result = runtime.observe(
        {
          source,
          payloadRef: contentRef(`content://burst-${index}`),
        },
        { principal: source },
      );
      expect("snapshot" in result).toBe(true);
    }

    const head = runtime.getHead();
    expect(head?.auditTail).toHaveLength(RUNTIME_SCALE.storm);
  });
});
