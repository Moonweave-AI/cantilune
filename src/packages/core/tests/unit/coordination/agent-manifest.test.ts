/**
 * AgentManifest: content-addressed round trip and dispatch priority.
 *
 * A manifest is stored as bytes in the content store and read back by the
 * supervisor at activation, so the round trip is an authority boundary: a field
 * lost in serialization is a field the agent runs without.
 */
import { describe, expect, it } from "vitest";
import { actorId } from "../../../src/primitives/ids.js";
import {
  DEFAULT_AGENT_PRIORITY,
  deserializeManifest,
  manifestPriority,
  serializeManifest,
  type AgentManifest,
} from "../../../src/coordination/agentManifest.js";
import {
  ALWAYS_CONDITION,
  conditionAnd,
  conditionAtom,
} from "../../../src/coordination/startCondition.js";

function manifest(overrides: Partial<AgentManifest> = {}): AgentManifest {
  return {
    agentId: "worker",
    kind: "agent",
    systemPrompt: "you coordinate",
    assignedTask: "close the loop",
    startCondition: ALWAYS_CONDITION,
    heartbeatIntervalMs: 60_000,
    designedBy: actorId("initiator"),
    ...overrides,
  };
}

describe("manifest serialization", () => {
  it("round-trips every required field", () => {
    const original = manifest();
    expect(deserializeManifest(serializeManifest(original))).toEqual(original);
  });

  it("round-trips optional fields when present", () => {
    const original = manifest({
      model: "some-model",
      provider: "some-provider",
      maxTurns: 12,
      maxTimeMs: 5_000,
      priority: 7,
      footprintHint: { artifactIds: ["a"], participantIds: ["p"], sessionIds: ["s"] },
    });
    expect(deserializeManifest(serializeManifest(original))).toEqual(original);
  });

  it("round-trips a nested start-condition tree", () => {
    const original = manifest({
      startCondition: conditionAnd(
        conditionAtom("agentsDone", { agents: ["a", "b"] }),
        conditionAtom("artifactPublished", { artifactId: "report" }),
      ),
    });
    const restored = deserializeManifest(serializeManifest(original));
    expect(restored.startCondition).toEqual(original.startCondition);
  });

  it("omits absent optional fields rather than materializing them as null", () => {
    const restored = deserializeManifest(serializeManifest(manifest()));
    expect("priority" in restored).toBe(false);
    expect("maxTurns" in restored).toBe(false);
  });
});

describe("manifestPriority", () => {
  it("reads a declared priority", () => {
    expect(manifestPriority(manifest({ priority: 5 }))).toBe(5);
    expect(manifestPriority(manifest({ priority: -3 }))).toBe(-3);
  });

  it("defaults a manifest that declares none, so pre-priority manifests are unchanged", () => {
    expect(manifestPriority(manifest())).toBe(DEFAULT_AGENT_PRIORITY);
  });

  it("falls back to the default for a non-finite priority", () => {
    // A NaN or Infinity priority would poison the comparator and make dispatch
    // order arbitrary, so it is treated as undeclared.
    expect(manifestPriority(manifest({ priority: Number.NaN }))).toBe(DEFAULT_AGENT_PRIORITY);
    expect(manifestPriority(manifest({ priority: Number.POSITIVE_INFINITY }))).toBe(
      DEFAULT_AGENT_PRIORITY,
    );
  });

  it("treats zero as a declared priority, not as absent", () => {
    expect(manifestPriority(manifest({ priority: 0 }))).toBe(0);
  });
});

describe("deserializeManifest startCondition", () => {
  it("canonicalizes LLM prose and empty strings at the content-store boundary", () => {
    const prose = deserializeManifest(
      JSON.stringify({
        agentId: "worker",
        kind: "agent",
        systemPrompt: "build",
        assignedTask: "build",
        startCondition: "artifacts/report.md exists",
        heartbeatIntervalMs: 5_000,
        designedBy: "initiator",
      }),
    );
    expect(prose.startCondition).toEqual(ALWAYS_CONDITION);
    const empty = deserializeManifest(
      JSON.stringify({
        agentId: "worker",
        kind: "agent",
        systemPrompt: "build",
        assignedTask: "build",
        startCondition: "",
        heartbeatIntervalMs: 5_000,
        designedBy: "initiator",
      }),
    );
    expect(empty.startCondition).toEqual(ALWAYS_CONDITION);
  });
});
