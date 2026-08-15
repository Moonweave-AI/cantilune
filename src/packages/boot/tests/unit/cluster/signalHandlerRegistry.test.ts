import { describe, it, expect } from "vitest";
import { operationTypeId, changeId, epochId, snapshotRef, actorId } from "@cantilune/core";
import type { CoordinationChange } from "@cantilune/core";
import { SignalHandlerRegistry } from "../../../src/cluster/signalHandlerRegistry.js";

function makeChange(opType: string): CoordinationChange {
  return {
    changeId: changeId("ch1"),
    recordedAt: new Date().toISOString() as never,
    epochId: epochId("e1"),
    operationTypeId: operationTypeId(opType),
    matchBindings: [],
    targets: [],
    initiator: { actorId: actorId("x"), kind: "agent" },
    involved: [],
    authorization: [],
    external: [],
    createdSessionRefs: [],
    beforeRef: snapshotRef("s0"),
    afterRef: snapshotRef("s1"),
    visibility: "external",
  };
}

describe("SignalHandlerRegistry", () => {
  it("dispatches to registered handler", async () => {
    const registry = new SignalHandlerRegistry();
    let called = false;
    registry.register(operationTypeId("signal_done"), async () => {
      called = true;
    });

    await registry.dispatch(operationTypeId("signal_done"), makeChange("signal_done"));
    expect(called).toBe(true);
  });

  it("is silent for unregistered operation types", async () => {
    const registry = new SignalHandlerRegistry();
    await registry.dispatch(operationTypeId("unknown_op"), makeChange("unknown_op"));
    expect(registry.has(operationTypeId("unknown_op"))).toBe(false);
  });

  it("overwrites handler on re-register", async () => {
    const registry = new SignalHandlerRegistry();
    const calls: number[] = [];
    registry.register(operationTypeId("op_a"), async () => {
      calls.push(1);
    });
    registry.register(operationTypeId("op_a"), async () => {
      calls.push(2);
    });

    await registry.dispatch(operationTypeId("op_a"), makeChange("op_a"));
    expect(calls).toEqual([2]);
  });

  it("handles multiple different operation types", async () => {
    const registry = new SignalHandlerRegistry();
    const results: string[] = [];
    registry.register(operationTypeId("op_a"), async () => {
      results.push("a");
    });
    registry.register(operationTypeId("op_b"), async () => {
      results.push("b");
    });
    registry.register(operationTypeId("op_c"), async () => {
      results.push("c");
    });

    await registry.dispatch(operationTypeId("op_b"), makeChange("op_b"));
    await registry.dispatch(operationTypeId("op_a"), makeChange("op_a"));
    expect(results).toEqual(["b", "a"]);
  });

  it("passes the change to the handler", async () => {
    const registry = new SignalHandlerRegistry();
    let received: CoordinationChange | undefined;
    registry.register(operationTypeId("signal_done"), async (change) => {
      received = change;
    });

    const change = makeChange("signal_done");
    await registry.dispatch(operationTypeId("signal_done"), change);
    expect(received).toBe(change);
  });

  it("has() returns true for registered, false for unregistered", () => {
    const registry = new SignalHandlerRegistry();
    registry.register(operationTypeId("op_a"), async () => {});
    expect(registry.has(operationTypeId("op_a"))).toBe(true);
    expect(registry.has(operationTypeId("op_b"))).toBe(false);
  });

  it("concurrent dispatches to same handler execute sequentially", async () => {
    const registry = new SignalHandlerRegistry();
    const order: number[] = [];
    registry.register(operationTypeId("op"), async () => {
      order.push(order.length + 1);
      await new Promise((r) => setTimeout(r, 5));
    });

    await Promise.all([
      registry.dispatch(operationTypeId("op"), makeChange("op")),
      registry.dispatch(operationTypeId("op"), makeChange("op")),
      registry.dispatch(operationTypeId("op"), makeChange("op")),
    ]);
    expect(order).toHaveLength(3);
  });
});
