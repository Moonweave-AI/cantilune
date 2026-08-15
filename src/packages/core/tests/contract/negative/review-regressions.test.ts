import { describe, expect, it } from "vitest";
import { compositionIntent } from "../../../src/structure/operators.js";
import {
  compatibleConcurrently,
  effectiveFootprintOfCompositionIntent,
} from "../../../src/structure/isolation.js";
import {
  footprint,
  interfacePorts,
  port,
  goal,
  outcome,
  portBinding,
} from "../../../src/structure/boundary.js";
import { actorId, artifactId } from "../../../src/primitives/ids.js";
import { targetRef } from "../../../src/primitives/refs.js";
import { actorRef } from "../../../src/nodes/participant.js";

describe("compositionIntent field retention", () => {
  it("preserves both interface and binds when both are provided", () => {
    const iface = interfacePorts([port("in", "Task")]);
    const binds = goal([portBinding(port("in", "Task"), "task-T")]);
    const intent = compositionIntent(
      "attach",
      actorRef(actorId("planner-p"), "agent"),
      footprint({ artifactIds: [artifactId("task-T")] }),
      [targetRef("artifact", "task-T")],
      { interface: iface, binds },
    );
    expect(intent.interface).toEqual(iface);
    expect(intent.binds).toEqual(binds);
    expect(intent.binds?.kind).toBe("goal");
  });
});

describe("effective footprint concurrency", () => {
  it("rejects parallel intents that touch the same target despite empty declared footprint", () => {
    const target = targetRef("artifact", "task-T");
    const left = compositionIntent(
      "delegate",
      actorRef(actorId("planner-p"), "agent"),
      footprint({}),
      [target],
    );
    const right = compositionIntent(
      "attach",
      actorRef(actorId("coder-c"), "agent"),
      footprint({}),
      [target],
    );
    expect(effectiveFootprintOfCompositionIntent(left).artifactIds.has(artifactId("task-T"))).toBe(
      true,
    );
    expect(compatibleConcurrently(left, right)).toBe(false);
  });
});

describe("Goal vs Outcome discrimination", () => {
  it("tags goal and outcome bindings distinctly", () => {
    expect(goal([]).kind).toBe("goal");
    expect(outcome([]).kind).toBe("outcome");
  });
});
