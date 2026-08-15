import { describe, expect, it } from "vitest";
import { actorRef, contentRef } from "@cantilune/core";
import { buildTestRuntime } from "../support/buildTestRuntime.js";
import { storyActorIds } from "../support/fixtures/config-t0.js";

describe("observe boundary", () => {
  it("updates auditTail only through runtime.observe", () => {
    const { runtime, t0 } = buildTestRuntime();
    const before = runtime.getHead()!;

    const source = actorRef(storyActorIds.human, "human");
    const result = runtime.observe(
      {
        source,
        payloadRef: contentRef("content://req-login"),
      },
      { principal: source },
    );

    expect("snapshot" in result).toBe(true);
    if (!("snapshot" in result)) {
      return;
    }

    expect(result.snapshot.auditTail.length).toBe(before.auditTail.length + 1);
    expect(result.snapshot.participants.size).toBe(t0.participants.size);
    expect(result.snapshot.artifacts.size).toBe(t0.artifacts.size);
    expect(result.snapshot.links.size).toBe(t0.links.size);
  });
});
