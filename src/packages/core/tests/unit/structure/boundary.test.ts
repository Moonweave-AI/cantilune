import { describe, expect, it } from "vitest";
import { actorId, artifactId } from "../../../src/primitives/ids.js";
import {
  footprint,
  mergeFootprints,
  emptyFootprint,
  port,
  interfacePorts,
  goal,
  portBinding,
} from "../../../src/structure/boundary.js";

describe("mergeFootprints", () => {
  it("unions all id sets", () => {
    const a = footprint({ participantIds: [actorId("A")] });
    const b = footprint({ artifactIds: [artifactId("task-1")] });
    const merged = mergeFootprints(a, b);
    expect(merged.participantIds.has(actorId("A"))).toBe(true);
    expect(merged.artifactIds.has(artifactId("task-1"))).toBe(true);
  });
});

describe("boundary helpers", () => {
  it("starts from an empty footprint", () => {
    const fp = emptyFootprint();
    expect(fp.participantIds.size).toBe(0);
    expect(fp.artifactIds.size).toBe(0);
  });

  it("builds ports, interfaces, and goals", () => {
    const inputPort = port("task", "WorkArtifact");
    const iface = interfacePorts([inputPort]);
    const g = goal([portBinding(inputPort, "task-T")]);
    expect(iface.ports).toHaveLength(1);
    expect(g.bindings[0]?.ref).toBe("task-T");
  });
});
