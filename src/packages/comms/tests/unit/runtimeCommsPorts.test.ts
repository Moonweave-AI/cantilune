import { describe, expect, it } from "vitest";
import { buildCommsRuntimeHarness } from "../support/buildCommsRuntimeHarness.js";
import { createRuntimeCommsPorts } from "../../src/integration/runtimeCommsPorts.js";
import { actorRef } from "@cantilune/core";

describe("runtimeCommsPorts", () => {
  it("observes into runtime and commits message receipt", async () => {
    const harness = buildCommsRuntimeHarness({
      availableContentRefs: ["content://test" as never],
    });
    const ports = createRuntimeCommsPorts({ runtime: harness.runtime });
    const observed = await ports.observation.observe({
      source: actorRef("human-1" as never, "human"),
      payloadRef: "content://test" as never,
      principal: actorRef("human-1" as never, "human"),
    });
    expect(observed.ok).toBe(true);
    if (!observed.ok) {
      return;
    }
    const head = harness.runtime.getHead();
    const committed = await ports.runtimeCommit.commitMessage({
      messageId: "msg-ports-001",
      envelopeDigest: "digest-001",
      snapshotRef: head!.snapshotRef,
    });
    expect(committed.ok).toBe(true);
  });

  it("commitReconnect requires epoch administration", async () => {
    const harness = buildCommsRuntimeHarness();
    const ports = createRuntimeCommsPorts({ runtime: harness.runtime });
    const result = await ports.runtimeCommit.commitReconnect({
      planDigest: "plan-digest",
      admissionId: "adm-missing",
    });
    expect(result.ok).toBe(false);
  });

  it("commitMessage rejects stale snapshot ref", async () => {
    const harness = buildCommsRuntimeHarness();
    const ports = createRuntimeCommsPorts({ runtime: harness.runtime });
    const result = await ports.runtimeCommit.commitMessage({
      messageId: "msg-stale",
      envelopeDigest: "digest",
      snapshotRef: "snap-stale" as never,
    });
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error.retryable).toBe(true);
  });
});
