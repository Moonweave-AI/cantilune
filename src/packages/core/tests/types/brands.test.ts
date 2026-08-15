import { describe, expect, it } from "vitest";
import {
  actorId,
  artifactId,
  changeId,
  epochId,
  operationTypeId,
} from "../../src/primitives/ids.js";
import { testCoordinationChange } from "../support/fixtures/change-fixture.js";
import { snapshotRef, targetRef } from "../../src/primitives/refs.js";
import { timestamp } from "../../src/primitives/time.js";
import { actorRef } from "../../src/nodes/participant.js";

describe("compile-time contracts", () => {
  it("keeps actor and artifact ids as distinct brands at runtime", () => {
    expect(actorId("x")).toBe("x");
    expect(artifactId("x")).toBe("x");
    expect(typeof actorId("x")).toBe("string");
    expect(typeof artifactId("x")).toBe("string");
  });

  it("keeps CoordinationChange free of a payload property key", () => {
    const change = testCoordinationChange({
      changeId: changeId("chg-brand"),
      recordedAt: timestamp("2026-08-07T10:00:00Z"),
      epochId: epochId("42"),
      operationTypeId: operationTypeId("introduce_artifact"),
      beforeRef: snapshotRef("snap-before"),
      afterRef: snapshotRef("snap-after"),
      targets: [targetRef("artifact", "task-1")],
      initiator: actorRef(actorId("planner"), "agent"),
    });
    expect(Object.hasOwn(change, "payload")).toBe(false);
  });
});
