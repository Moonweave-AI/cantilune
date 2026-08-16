import { describe, expect, it } from "vitest";
import * as core from "../../src/index.js";
import * as coordination from "../../src/coordination/index.js";
import * as consistency from "../../src/consistency/index.js";
import * as nodes from "../../src/nodes/index.js";
import * as structure from "../../src/structure/index.js";

describe("package exports", () => {
  it("re-exports core pillars from the root entry", () => {
    expect(typeof core.collaborationSnapshot).toBe("function");
    expect(typeof core.participant).toBe("function");
    expect(typeof core.compositionIntent).toBe("function");
    expect(typeof core.disjoint).toBe("function");
    expect(typeof core.validateCollaborationWorld).toBe("function");
    expect(typeof core.matchBinding).toBe("function");
    expect(typeof core.visibleTranscript).toBe("function");
    expect(typeof core.participantTranscript).toBe("function");
    expect(typeof core.collaborationNamespace).toBe("function");
  });

  it("exposes subpath entry points", () => {
    expect(typeof nodes.workArtifact).toBe("function");
    expect(typeof coordination.coordinationChange).toBe("function");
    expect(typeof structure.deriveDiagnosticSummary).toBe("function");
    expect(typeof structure.deriveCompositionView).toBe("function");
    expect(typeof consistency.validateSnapshotIntegrity).toBe("function");
  });

  it("does not export the tests-only simulateCommit harness", () => {
    expect("simulateCommit" in core).toBe(false);
  });
});
