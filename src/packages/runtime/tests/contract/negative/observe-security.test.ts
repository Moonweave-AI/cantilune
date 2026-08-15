import { describe, expect, it } from "vitest";
import { actorRef, contentRef } from "@cantilune/core";
import { buildTestRuntime } from "../../support/buildTestRuntime.js";
import { storyActorIds } from "../../support/fixtures/config-t0.js";

describe("observe security", () => {
  it("rejects forged source when principal does not match", () => {
    const { runtime } = buildTestRuntime();
    const result = runtime.observe(
      {
        source: actorRef(storyActorIds.planner, "agent"),
        payloadRef: contentRef("content://forged"),
      },
      { principal: actorRef(storyActorIds.human, "human") },
    );

    expect("code" in result).toBe(true);
    if (!("code" in result)) {
      return;
    }
    expect(result.code).toBe("observe_invalid");
  });

  it("requires explicit principal", () => {
    const { runtime } = buildTestRuntime();
    const result = runtime.observe({
      source: actorRef(storyActorIds.human, "human"),
      payloadRef: contentRef("content://no-principal"),
    });

    expect("code" in result).toBe(true);
    if (!("code" in result)) {
      return;
    }
    expect(result.code).toBe("observe_invalid");
  });

  it.each([
    { label: "missing", authority: null },
    { label: "negative", authority: { isAvailable: () => false } },
    {
      label: "throwing",
      authority: {
        isAvailable: () => {
          throw new Error("offline");
        },
      },
    },
    {
      label: "async",
      authority: { isAvailable: (() => Promise.resolve(true)) as unknown as () => boolean },
    },
  ])("rejects a dangling observation payload with a $label authority", ({ authority }) => {
    const { runtime, durable, t0 } = buildTestRuntime({ contentRefAuthority: authority });
    const result = runtime.observe(
      {
        source: actorRef(storyActorIds.human, "human"),
        payloadRef: contentRef(
          "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        ),
      },
      { principal: actorRef(storyActorIds.human, "human") },
    );

    expect(result).toMatchObject({ code: "content_ref_unavailable" });
    expect(durable.head()).toBe(t0.snapshotRef);
  });
});
