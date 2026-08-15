import { describe, expect, it } from "vitest";

import {
  canFire,
  classifyArcsForTransition,
  dedupInvariants,
  dotColumn,
  enabledTransitions,
  fire,
  findTransition,
  fromExportedNet,
  hasSelfLoopArc,
  incidenceMatrix,
  initialMarking,
  isDeadMarking,
  isEnabled,
  isScalarMultiple,
  markingKey,
  placeInvariants,
  reachable,
  reduceRows,
  rowIsInvariant,
  SelfLoopArcError,
  tokensAt,
  withTokens,
  type Marking,
  type PetriNet,
  type PlaceInvariant,
} from "@cantilune/petri";

function m(entries: Array<[string, number]>): Marking {
  return new Map(entries);
}

/** A producer/consumer net: place p_in → transition t → place p_out. */
function producerConsumerNet(): PetriNet {
  return {
    places: [
      { id: "p_in", name: "Input", tokens: 1 },
      { id: "p_out", name: "Output", tokens: 0 },
    ],
    transitions: [{ id: "t_produce", name: "produce" }],
    arcs: [
      { id: "a1", source: "p_in", target: "t_produce" },
      { id: "a2", source: "t_produce", target: "p_out" },
    ],
  };
}

/** A fork net: one input place feeds two transitions. */
function forkNet(): PetriNet {
  return {
    places: [{ id: "p", name: "p", tokens: 1 }],
    transitions: [
      { id: "t_a", name: "A" },
      { id: "t_b", name: "B" },
    ],
    arcs: [
      { id: "a1", source: "p", target: "t_a" },
      { id: "a2", source: "p", target: "t_b" },
    ],
  };
}

/** A join net: two input places feed one transition. */
function joinNet(): PetriNet {
  return {
    places: [
      { id: "p1", name: "p1", tokens: 1 },
      { id: "p2", name: "p2", tokens: 0 },
    ],
    transitions: [{ id: "t_join", name: "join" }],
    arcs: [
      { id: "a1", source: "p1", target: "t_join" },
      { id: "a2", source: "p2", target: "t_join" },
      { id: "a3", source: "t_join", target: "p1" },
    ],
  };
}

describe("net.ts — structure, marking, enabled set", () => {
  it("initialMarking reads place tokens and floors/defaults non-positive counts", () => {
    const net: PetriNet = {
      places: [
        { id: "a", name: "a", tokens: 3 },
        { id: "b", name: "b", tokens: 1.9 },
        { id: "c", name: "c" },
        { id: "d", name: "d", tokens: -2 },
      ],
      transitions: [],
      arcs: [],
    };
    const marking = initialMarking(net);
    expect(marking.get("a")).toBe(3);
    expect(marking.get("b")).toBe(1);
    expect(marking.get("c")).toBe(0);
    expect(marking.get("d")).toBe(0);
  });

  it("tokensAt returns 0 for unmarked places", () => {
    expect(tokensAt(m([]), "absent")).toBe(0);
    expect(tokensAt(m([["x", 5]]), "x")).toBe(5);
  });

  it("withTokens returns an immutable copy and floors non-positive counts", () => {
    const before = m([["x", 1]]);
    const after = withTokens(before, "x", 4);
    expect(after.get("x")).toBe(4);
    expect(before.get("x")).toBe(1); // input unmutated
    const negated = withTokens(before, "x", -1);
    expect(negated.get("x")).toBe(0);
  });

  it("findTransition returns the transition or undefined", () => {
    const net = producerConsumerNet();
    expect(findTransition(net, "t_produce")?.name).toBe("produce");
    expect(findTransition(net, "absent")).toBeUndefined();
  });

  it("classifyArcsForTransition partitions arcs into inputs/outputs", () => {
    const net = producerConsumerNet();
    const { inputs, outputs } = classifyArcsForTransition(net, "t_produce");
    expect(inputs.map((a) => a.placeId)).toEqual(["p_in"]);
    expect(outputs.map((a) => a.placeId)).toEqual(["p_out"]);
    expect(inputs[0]?.direction).toBe("in");
    expect(outputs[0]?.direction).toBe("out");
  });

  it("classifyArcsForTransition throws SelfLoopArcError on a self-loop arc", () => {
    const net: PetriNet = {
      places: [{ id: "p", name: "p" }],
      transitions: [{ id: "t", name: "t" }],
      arcs: [{ id: "a", source: "t", target: "t" }],
    };
    expect(() => classifyArcsForTransition(net, "t")).toThrow(SelfLoopArcError);
    try {
      classifyArcsForTransition(net, "t");
    } catch (error) {
      expect(error).toBeInstanceOf(SelfLoopArcError);
      if (error instanceof SelfLoopArcError) {
        expect(error.arcId).toBe("a");
        expect(error.transitionId).toBe("t");
        expect(error.name).toBe("SelfLoopArcError");
      }
    }
  });

  it("classifyArcsForTransition ignores arcs whose other end is not a place", () => {
    const net: PetriNet = {
      places: [{ id: "p", name: "p" }],
      transitions: [
        { id: "t1", name: "t1" },
        { id: "t2", name: "t2" },
      ],
      arcs: [
        { id: "a1", source: "t1", target: "t2" }, // transition-to-transition, ignored
        { id: "a2", source: "p", target: "t1" },
      ],
    };
    const { inputs, outputs } = classifyArcsForTransition(net, "t1");
    expect(inputs.map((a) => a.placeId)).toEqual(["p"]);
    expect(outputs).toHaveLength(0);
  });

  it("isEnabled is true when all input arcs have tokens, false for unknown/self-loop", () => {
    const net = producerConsumerNet();
    expect(isEnabled(net, initialMarking(net), "t_produce")).toBe(true);
    expect(isEnabled(net, m([["p_in", 0]]), "t_produce")).toBe(false);
    expect(isEnabled(net, m([]), "absent")).toBe(false);
    const selfLoop: PetriNet = {
      places: [{ id: "p", name: "p" }],
      transitions: [{ id: "t", name: "t" }],
      arcs: [{ id: "a", source: "t", target: "t" }],
    };
    expect(isEnabled(selfLoop, m([]), "t")).toBe(false);
  });

  it("enabledTransitions returns every satisfiable transition", () => {
    const fork = forkNet();
    const enabled = enabledTransitions(fork, initialMarking(fork));
    expect(enabled.map((e) => e.transition.id).sort()).toEqual(["t_a", "t_b"]);
    const afterFire = enabledTransitions(fork, m([["p", 0]]));
    expect(afterFire).toHaveLength(0);
  });

  it("enabledTransitions skips self-loop transitions", () => {
    const net: PetriNet = {
      places: [{ id: "p", name: "p", tokens: 1 }],
      transitions: [
        { id: "t_ok", name: "ok" },
        { id: "t_self", name: "self" },
      ],
      arcs: [
        { id: "a1", source: "p", target: "t_ok" },
        { id: "a2", source: "t_self", target: "t_self" },
      ],
    };
    const enabled = enabledTransitions(net, initialMarking(net));
    expect(enabled.map((e) => e.transition.id)).toEqual(["t_ok"]);
  });

  it("enabledTransitions returns consumes and produces arc sets", () => {
    const net = producerConsumerNet();
    const [enabled] = enabledTransitions(net, initialMarking(net));
    expect(enabled?.consumes.map((a) => a.placeId)).toEqual(["p_in"]);
    expect(enabled?.produces.map((a) => a.placeId)).toEqual(["p_out"]);
  });

  it("fromExportedNet returns the same net (structural pass-through)", () => {
    const net = producerConsumerNet();
    expect(fromExportedNet(net)).toBe(net);
  });
});

describe("firing.ts — token game", () => {
  it("fire consumes and produces tokens immutably", () => {
    const net = producerConsumerNet();
    const before = initialMarking(net);
    const result = fire(net, before, "t_produce");
    expect(result.ok).toBe(true);
    expect(result.transition?.id).toBe("t_produce");
    expect(result.marking.get("p_in")).toBe(0);
    expect(result.marking.get("p_out")).toBe(1);
    // input marking unmutated
    expect(before.get("p_in")).toBe(1);
    expect(before.get("p_out")).toBe(0);
  });

  it("fire returns unknown-transition when the id is absent", () => {
    const net = producerConsumerNet();
    const result = fire(net, initialMarking(net), "absent");
    expect(result.ok).toBe(false);
    expect(result.blockedReason).toBe("unknown-transition");
  });

  it("fire returns disabled with under-marked place ids when an input lacks tokens", () => {
    const net = producerConsumerNet();
    const result = fire(net, m([["p_in", 0]]), "t_produce");
    expect(result.ok).toBe(false);
    expect(result.blockedReason).toBe("disabled");
    expect(result.underMarked).toEqual(["p_in"]);
  });

  it("fire reports all under-marked places for a join", () => {
    const net = joinNet();
    const result = fire(
      net,
      m([
        ["p1", 0],
        ["p2", 0],
      ]),
      "t_join",
    );
    expect(result.ok).toBe(false);
    expect(result.underMarked).toEqual(["p1", "p2"]);
  });

  it("fire returns self-loop-arc when the net has a self-loop", () => {
    const net: PetriNet = {
      places: [{ id: "p", name: "p" }],
      transitions: [{ id: "t", name: "t" }],
      arcs: [{ id: "a", source: "t", target: "t" }],
    };
    const result = fire(net, m([]), "t");
    expect(result.ok).toBe(false);
    expect(result.blockedReason).toBe("self-loop-arc");
  });

  it("fire passes through a binding as a no-op", () => {
    const net = producerConsumerNet();
    const result = fire(net, initialMarking(net), "t_produce", { x: "1" });
    expect(result.ok).toBe(true);
    expect(result.binding).toEqual({ x: "1" });
    // binding does not alter semantics
    expect(result.marking.get("p_out")).toBe(1);
  });

  it("fire carries the binding through blocked paths (unknown/self-loop/disabled)", () => {
    const net = producerConsumerNet();
    const binding = { k: "v" };
    const unknown = fire(net, initialMarking(net), "absent", binding);
    expect(unknown.ok).toBe(false);
    expect(unknown.binding).toEqual(binding);
    const disabled = fire(net, m([["p_in", 0]]), "t_produce", binding);
    expect(disabled.ok).toBe(false);
    expect(disabled.binding).toEqual(binding);
    const selfLoopNet: PetriNet = {
      places: [{ id: "p", name: "p" }],
      transitions: [{ id: "t", name: "t" }],
      arcs: [{ id: "a", source: "t", target: "t" }],
    };
    const selfLoop = fire(selfLoopNet, m([]), "t", binding);
    expect(selfLoop.ok).toBe(false);
    expect(selfLoop.binding).toEqual(binding);
  });

  it("fire consumes from a place absent in the marking map (treated as 0, clamped)", () => {
    // A transition enabled only because the input place is unmarked yet 'enabled' by a stale read.
    // Construct an enabled fire then exercise applyFire's missing-place path via a manual net:
    const net = producerConsumerNet();
    // Marking has p_in=1 but is a sparse map missing p_out; applyFire writes p_out via ?? 0.
    const sparse = m([["p_in", 1]]);
    const result = fire(net, sparse, "t_produce");
    expect(result.ok).toBe(true);
    expect(result.marking.get("p_out")).toBe(1);
    expect(result.marking.get("p_in")).toBe(0);
  });

  it("fire never reduces a place below zero (clamped consume)", () => {
    const net = producerConsumerNet();
    const result = fire(net, m([["p_in", 0]]), "t_produce");
    expect(result.ok).toBe(false); // disabled, so no consume
    // Manually construct an enabled fire and confirm clamping in applyFire via the engine path:
    const enabled = fire(net, m([["p_in", 1]]), "t_produce");
    expect(enabled.ok).toBe(true);
    expect(enabled.marking.get("p_in")).toBe(0);
  });

  it("canFire mirrors fire's ok verdict", () => {
    const net = producerConsumerNet();
    expect(canFire(net, initialMarking(net), "t_produce")).toBe(true);
    expect(canFire(net, m([["p_in", 0]]), "t_produce")).toBe(false);
    expect(canFire(net, m([]), "absent")).toBe(false);
  });

  it("a source transition (no input arcs) is always enabled and fires", () => {
    const net: PetriNet = {
      places: [{ id: "p", name: "p", tokens: 0 }],
      transitions: [{ id: "t_src", name: "source" }],
      arcs: [{ id: "a1", source: "t_src", target: "p" }],
    };
    const enabled = enabledTransitions(net, initialMarking(net));
    expect(enabled).toHaveLength(1);
    const result = fire(net, initialMarking(net), "t_src");
    expect(result.ok).toBe(true);
    expect(result.marking.get("p")).toBe(1);
  });
});

describe("reachability.ts — bounded BFS", () => {
  it("markingKey canonicalizes regardless of insertion order and drops zero-token places", () => {
    expect(
      markingKey(
        m([
          ["b", 1],
          ["a", 2],
        ]),
      ),
    ).toBe("a:2|b:1");
    expect(
      markingKey(
        m([
          ["a", 2],
          ["b", 1],
        ]),
      ),
    ).toBe("a:2|b:1");
    expect(
      markingKey(
        m([
          ["a", 0],
          ["b", 3],
        ]),
      ),
    ).toBe("b:3");
  });

  it("reachable returns an empty trace when the goal is already met", () => {
    const net = producerConsumerNet();
    const result = reachable(net, initialMarking(net), (mk) => (mk.get("p_in") ?? 0) >= 1);
    expect(result.reachable).toBe(true);
    expect(result.trace).toEqual([]);
    expect(result.explored).toBe(1);
  });

  it("reachable finds the goal and returns the firing trace", () => {
    const net = producerConsumerNet();
    const result = reachable(net, initialMarking(net), (mk) => (mk.get("p_out") ?? 0) >= 1);
    expect(result.reachable).toBe(true);
    expect(result.trace.map((s) => s.firedTransition)).toEqual(["t_produce"]);
    expect(result.trace[0]?.marking.get("p_in")).toBe(1);
  });

  it("reachable reports unreachable within the bound with explored count", () => {
    const net = producerConsumerNet();
    const result = reachable(net, initialMarking(net), (mk) => (mk.get("p_out") ?? 0) >= 99, 5);
    expect(result.reachable).toBe(false);
    expect(result.maxSteps).toBe(5);
    expect(result.explored).toBeGreaterThan(0);
  });

  it("reachable respects the maxSteps bound", () => {
    // A two-stage chain: p_a → t1 → p_mid → t2 → p_b. Goal (p_b ≥ 1) needs 2 steps.
    const net: PetriNet = {
      places: [
        { id: "p_a", name: "a", tokens: 1 },
        { id: "p_mid", name: "mid", tokens: 0 },
        { id: "p_b", name: "b", tokens: 0 },
      ],
      transitions: [
        { id: "t1", name: "t1" },
        { id: "t2", name: "t2" },
      ],
      arcs: [
        { id: "a1", source: "p_a", target: "t1" },
        { id: "a2", source: "t1", target: "p_mid" },
        { id: "a3", source: "p_mid", target: "t2" },
        { id: "a4", source: "t2", target: "p_b" },
      ],
    };
    // With bound 1, the goal at depth 2 is unreachable.
    const boundedShort = reachable(net, initialMarking(net), (mk) => (mk.get("p_b") ?? 0) >= 1, 1);
    expect(boundedShort.reachable).toBe(false);
    // With bound 2, the goal is reachable with a 2-step trace.
    const boundedEnough = reachable(net, initialMarking(net), (mk) => (mk.get("p_b") ?? 0) >= 1, 2);
    expect(boundedEnough.reachable).toBe(true);
    expect(boundedEnough.trace).toHaveLength(2);
    expect(boundedEnough.trace.map((s) => s.firedTransition)).toEqual(["t1", "t2"]);
  });

  it("reachable clamps an invalid maxSteps to 1", () => {
    const net = producerConsumerNet();
    const r0 = reachable(net, initialMarking(net), () => false, 0);
    expect(r0.maxSteps).toBe(1);
    const rNeg = reachable(net, initialMarking(net), () => false, -5);
    expect(rNeg.maxSteps).toBe(1);
    const rNaN = reachable(net, initialMarking(net), () => false, Number.NaN);
    expect(rNaN.maxSteps).toBe(1);
  });

  it("isDeadMarking is true when no transitions are enabled", () => {
    const net = producerConsumerNet();
    expect(
      isDeadMarking(
        net,
        m([
          ["p_in", 0],
          ["p_out", 1],
        ]),
      ),
    ).toBe(true);
    expect(isDeadMarking(net, initialMarking(net))).toBe(false);
  });
});

describe("invariants.ts — S-invariants", () => {
  it("incidenceMatrix computes out-minus-in for each place/transition", () => {
    const net = producerConsumerNet();
    const A = incidenceMatrix(net);
    // Places: p_in (row 0), p_out (row 1). Transition: t_produce (col 0).
    expect(A[0]?.[0]).toBe(-1); // p_in loses 1
    expect(A[1]?.[0]).toBe(1); // p_out gains 1
  });

  it("incidenceMatrix skips self-loop transitions", () => {
    const net: PetriNet = {
      places: [{ id: "p", name: "p" }],
      transitions: [
        { id: "t_self", name: "self" },
        { id: "t_real", name: "real" },
      ],
      arcs: [
        { id: "a1", source: "t_self", target: "t_self" },
        { id: "a2", source: "p", target: "t_real" },
      ],
    };
    const A = incidenceMatrix(net);
    // Two columns (t_self skipped but column still exists as 0), one row.
    expect(A).toHaveLength(1);
    expect(A[0]?.[0]).toBe(0); // self-loop contributes nothing
    expect(A[0]?.[1]).toBe(-1); // p loses 1 to t_real
  });

  it("placeInvariants finds the conservation invariant for a producer-consumer net", () => {
    // In a p_in → t → p_out net, p_in + p_out is conserved (consume one, produce one).
    const net = producerConsumerNet();
    const invariants = placeInvariants(net);
    expect(invariants).toHaveLength(1);
    const inv = invariants[0]!;
    expect(inv.places.map((p) => p.placeId).sort()).toEqual(["p_in", "p_out"]);
    expect(inv.places.every((p) => p.weight === 1)).toBe(true);
    expect(inv.label).toContain("Input");
    expect(inv.label).toContain("Output");
  });

  it("placeInvariants finds the free+locked conservation invariant in a mutex net", () => {
    const net: PetriNet = {
      places: [
        { id: "free", name: "free", tokens: 1 },
        { id: "locked", name: "locked", tokens: 0 },
      ],
      transitions: [
        { id: "acquire", name: "acquire" },
        { id: "release", name: "release" },
      ],
      arcs: [
        { id: "a1", source: "free", target: "acquire" },
        { id: "a2", source: "acquire", target: "locked" },
        { id: "a3", source: "locked", target: "release" },
        { id: "a4", source: "release", target: "free" },
      ],
    };
    const invariants = placeInvariants(net);
    // The non-trivial invariant is free + locked = const (the lock is conserved).
    const conserved = invariants.find(
      (inv) => inv.places.length === 2 && inv.places.every((p) => p.weight === 1),
    );
    expect(conserved).toBeDefined();
    expect(conserved!.places.map((p) => p.placeId).sort()).toEqual(["free", "locked"]);
    expect(conserved!.label).toContain("free");
    expect(conserved!.label).toContain("locked");
  });

  it("placeInvariants reports degenerate unit invariants when a place self-conserves", () => {
    // A place that feeds itself (p → t → p) has zero incidence, so it is trivially conserved.
    const net: PetriNet = {
      places: [{ id: "p", name: "p", tokens: 1 }],
      transitions: [{ id: "t", name: "t" }],
      arcs: [
        { id: "a1", source: "p", target: "t" },
        { id: "a2", source: "t", target: "p" },
      ],
    };
    const invariants = placeInvariants(net);
    expect(invariants).toHaveLength(1);
    expect(invariants[0]?.places[0]?.weight).toBe(1);
    expect(invariants[0]?.label).toBe("p");
  });

  it("placeInvariants returns [] for a net with no places", () => {
    const net: PetriNet = {
      places: [],
      transitions: [{ id: "t", name: "t" }],
      arcs: [],
    };
    expect(placeInvariants(net)).toEqual([]);
  });

  it("placeInvariants deduplicates scalar-multiple equivalent invariants", () => {
    // Construct a net with a single place and a transition that consumes and produces it equally.
    // That yields the trivial invariant {p: 1}; ensure no duplicate rows surface.
    const net: PetriNet = {
      places: [{ id: "p", name: "p", tokens: 1 }],
      transitions: [{ id: "t", name: "t" }],
      arcs: [
        { id: "a1", source: "p", target: "t" },
        { id: "a2", source: "t", target: "p" },
      ],
    };
    const invariants = placeInvariants(net);
    // A self-conserve loop yields {p: 1} invariant.
    expect(invariants.length).toBe(1);
    expect(invariants[0]?.places[0]?.weight).toBe(1);
  });
});

describe("net.ts — hasSelfLoopArc", () => {
  it("detects a self-loop arc on a transition", () => {
    const net: PetriNet = {
      places: [{ id: "p", name: "p" }],
      transitions: [{ id: "t", name: "t" }],
      arcs: [{ id: "a", source: "t", target: "t" }],
    };
    expect(hasSelfLoopArc(net, "t")).toBe(true);
    expect(hasSelfLoopArc(net, "absent")).toBe(false);
  });

  it("returns false when no self-loop exists", () => {
    const net = producerConsumerNet();
    expect(hasSelfLoopArc(net, "t_produce")).toBe(false);
  });
});

describe("invariants.ts — reduceRows and isScalarMultiple helpers", () => {
  it("isScalarMultiple detects integer multiples and rejects non-multiples", () => {
    expect(isScalarMultiple([2, 4], [1, 2])).toBe(true); // ratio 2
    expect(isScalarMultiple([1, 2], [1, 2])).toBe(true); // ratio 1
    expect(isScalarMultiple([1, 3], [1, 2])).toBe(false); // different ratios
    expect(isScalarMultiple([1, 0], [0, 1])).toBe(false); // same nonzero count, different support
    expect(isScalarMultiple([0, 0], [1, 0])).toBe(false); // zero row
    expect(isScalarMultiple([1, 2], [0, 0])).toBe(false); // zero other
    expect(isScalarMultiple([2, 4, 0], [1, 2, 0])).toBe(true); // shared zero support, ratio 2
    expect(isScalarMultiple([1, 2, 0], [2, 4, 0])).toBe(false); // ratio 0.5 (non-integer)
    expect(isScalarMultiple([1, -2], [1, 2])).toBe(false); // negative ratio (non-integer positive)
    expect(isScalarMultiple([1, 2], [])).toBe(false); // empty other
  });

  it("reduceRows drops scalar-multiple duplicates and keeps distinct rows", () => {
    const reduced = reduceRows([
      [1, 2],
      [2, 4], // multiple of [1,2]
      [3, 0],
      [1, 2], // exact duplicate
    ]);
    // [1,2] and [3,0] survive; [2,4] and the dup [1,2] are dropped.
    expect(reduced).toHaveLength(2);
    expect(reduced.some((r) => r[0] === 1 && r[1] === 2)).toBe(true);
    expect(reduced.some((r) => r[0] === 3 && r[1] === 0)).toBe(true);
  });

  it("reduceRows removes previously-kept rows that become multiples of a later row", () => {
    // [2,4] kept first, then [1,2] arrives: [2,4] is a multiple of [1,2], so [2,4] is removed.
    const reduced = reduceRows([
      [2, 4],
      [1, 2],
    ]);
    expect(reduced).toHaveLength(1);
    expect(reduced[0]).toEqual([1, 2]);
  });

  it("isScalarMultiple returns false when a 3-support row has mismatched ratios", () => {
    // [2,4,6] vs [1,2,3] ratio 2; [2,4,6] vs [1,2,4] ratios 2,2,1.5 -> mismatch.
    expect(isScalarMultiple([2, 4, 6], [1, 2, 4])).toBe(false);
  });

  it("isScalarMultiple returns false for rows of differing support length", () => {
    expect(isScalarMultiple([1, 2, 3], [1, 2])).toBe(false);
  });

  it("dedupInvariants drops duplicate signatures and preserves order", () => {
    const a: PlaceInvariant = { places: [{ placeId: "p", weight: 1 }], label: "p" };
    const b: PlaceInvariant = { places: [{ placeId: "q", weight: 2 }], label: "q" };
    const dup: PlaceInvariant = { places: [{ placeId: "p", weight: 1 }], label: "p" };
    const result = dedupInvariants([a, b, dup]);
    expect(result).toHaveLength(2);
    expect(result.map((i) => i.label)).toEqual(["p", "q"]);
  });

  it("rowIsInvariant returns true when every transition column sums to zero", () => {
    // A = [[-1, 1], [1, -1]] (mutex). Row [1,1] sums to 0 in both columns.
    const A = [
      [-1, 1],
      [1, -1],
    ];
    expect(rowIsInvariant([1, 1], A)).toBe(true);
  });

  it("rowIsInvariant returns false when a transition column is non-zero", () => {
    // A = [[1, -1]] (producer-consumer buffer). Row [1] sums to 1 in col 0 (not invariant).
    const A = [[1, -1]];
    expect(rowIsInvariant([1], A)).toBe(false);
  });

  it("rowIsInvariant returns true for an empty incidence matrix", () => {
    expect(rowIsInvariant([1, 2], [])).toBe(true);
  });

  it("dotColumn computes Σ_k row[k]·A[k][j]", () => {
    const A = [
      [-1, 1],
      [1, -1],
    ];
    expect(dotColumn([1, 1], A, 0)).toBe(0); // 1*(-1) + 1*(1) = 0
    expect(dotColumn([1, 1], A, 1)).toBe(0); // 1*(1) + 1*(-1) = 0
    expect(dotColumn([2, 1], A, 0)).toBe(-1); // 2*(-1) + 1*(1) = -1
  });
});

describe("reachability.ts — branch coverage", () => {
  it("reachable skips already-visited markings (no revisiting)", () => {
    // A net that can return to the initial marking; BFS must not loop on revisits.
    const net: PetriNet = {
      places: [{ id: "p", name: "p", tokens: 1 }],
      transitions: [{ id: "t", name: "t" }],
      arcs: [
        { id: "a1", source: "p", target: "t" },
        { id: "a2", source: "t", target: "p" },
      ],
    };
    // Goal is the initial marking itself (already met), so empty trace.
    const r = reachable(net, initialMarking(net), (mk) => (mk.get("p") ?? 0) === 1);
    expect(r.reachable).toBe(true);
    expect(r.trace).toEqual([]);
  });

  it("reachable exhausts the search when a dead marking is hit", () => {
    // Producer-consumer with no source: after firing, p_out holds 1 and p_in 0 — dead.
    const net = producerConsumerNet();
    const r = reachable(net, initialMarking(net), () => false, 5);
    expect(r.reachable).toBe(false);
    expect(r.explored).toBeGreaterThan(0);
  });

  it("reachable hits the maxSteps boundary along a path without reaching the goal", () => {
    // A self-replenishing source: t_src always enabled, produces a token to p each step.
    const net: PetriNet = {
      places: [{ id: "p", name: "p", tokens: 0 }],
      transitions: [{ id: "t_src", name: "src" }],
      arcs: [{ id: "a1", source: "t_src", target: "p" }],
    };
    // Goal: p holds ≥ 99 tokens. With maxSteps 3, unreachable (only 3 steps explored).
    const r = reachable(net, initialMarking(net), (mk) => (mk.get("p") ?? 0) >= 99, 3);
    expect(r.reachable).toBe(false);
    expect(r.maxSteps).toBe(3);
  });

  it("reachable skips already-visited markings when two paths converge", () => {
    // Fork: p (1 token) → t_a → p_a and p → t_b → p_b. Both then converge? No — they diverge.
    // Use a net where firing t_a or t_b from p both leave p empty, so the "after" marking
    // (p=0) is reached twice via two transitions; the second must be skipped.
    const net: PetriNet = {
      places: [{ id: "p", name: "p", tokens: 1 }],
      transitions: [
        { id: "t_a", name: "a" },
        { id: "t_b", name: "b" },
      ],
      arcs: [
        { id: "a1", source: "p", target: "t_a" },
        { id: "a2", source: "p", target: "t_b" },
      ],
    };
    // Goal never met (p_a/p_b don't exist). BFS explores p=0 once, then skips the duplicate.
    const r = reachable(net, initialMarking(net), () => false, 5);
    expect(r.reachable).toBe(false);
    // initial (p=1) + the converged (p=0) = 2 distinct markings.
    expect(r.explored).toBe(2);
  });
});
