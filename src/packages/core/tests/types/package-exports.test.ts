import { describe, expect, it } from "vitest";
import * as core from "../../src/index.js";
import * as coordination from "../../src/coordination/index.js";
import * as nodes from "../../src/nodes/index.js";
import * as structure from "../../src/structure/index.js";

describe("package exports", () => {
  it("re-exports core pillars from the root entry", () => {
    expect(typeof core.collaborationSnapshot).toBe("function");
    expect(typeof core.participant).toBe("function");
    expect(typeof core.compositionIntent).toBe("function");
    expect(typeof core.disjoint).toBe("function");
  });

  it("exposes subpath entry points", () => {
    expect(typeof nodes.workArtifact).toBe("function");
    expect(typeof coordination.coordinationChange).toBe("function");
    expect(typeof structure.deriveCompositionView).toBe("function");
  });
});
