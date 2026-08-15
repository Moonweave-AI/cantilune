import { describe, expect, it } from "vitest";
import {
  changeId,
  coordinationChange,
  epochId,
  operationTypeId,
  snapshotRef,
  timestamp,
  actorRef,
  actorId,
} from "@cantilune/core";
import {
  changeIdsInOrder,
  createObservationReadPorts,
} from "../../../src/input/observationInput.js";

describe("observationInput", () => {
  it("createObservationReadPorts returns injected deps", () => {
    const ports = createObservationReadPorts({
      head: () => snapshotRef("snap-S1"),
      getSnapshot: () => undefined,
      changesSince: () => [],
    });
    expect(ports.head()).toBe(snapshotRef("snap-S1"));
    expect(ports.changesSince(snapshotRef("snap-S0"))).toEqual([]);
  });

  it("changeIdsInOrder preserves commit order", () => {
    const changes = [0, 1].map((index) =>
      coordinationChange({
        changeId: changeId(`chg-${index}`),
        recordedAt: timestamp(`2026-08-07T10:0${index}:00Z`),
        epochId: epochId("42"),
        operationTypeId: operationTypeId("introduce_artifact"),
        beforeRef: snapshotRef(`snap-S${index}`),
        afterRef: snapshotRef(`snap-S${index + 1}`),
        matchBindings: [],
        initiator: actorRef(actorId("planner"), "agent"),
        visibility: "external",
      }),
    );
    expect(changeIdsInOrder(changes)).toEqual([changeId("chg-0"), changeId("chg-1")]);
  });
});
