import { describe, expect, it } from "vitest";
import { actorId, artifactId, capabilityId } from "../../../src/primitives/ids.js";
import { contentRef } from "../../../src/primitives/refs.js";
import { actorRef } from "../../../src/nodes/participant.js";
import {
  withArtifactLifecycle,
  withArtifactOwner,
  workArtifact,
} from "../../../src/nodes/workArtifact.js";
import { scopedCapability } from "../../../src/nodes/scopedCapability.js";

describe("workArtifact", () => {
  it("stores body at contentRef, not inline", () => {
    const owner = actorRef(actorId("planner-p"), "agent");
    const artifact = workArtifact(
      artifactId("task-T"),
      "Task",
      contentRef("content://task-T"),
      owner,
    );
    expect(artifact.contentRef).toBe("content://task-T");
    expect(artifact.lifecycle).toBe("proposed");
    expect(artifact.owner).toBe(owner);
  });

  it("updates lifecycle and owner immutably", () => {
    const owner = actorRef(actorId("planner-p"), "agent");
    const coder = actorRef(actorId("coder-c"), "agent");
    const artifact = workArtifact(
      artifactId("task-T"),
      "Task",
      contentRef("content://task-T"),
      owner,
    );
    const active = withArtifactLifecycle(artifact, "active");
    const delegated = withArtifactOwner(active, coder);
    expect(artifact.lifecycle).toBe("proposed");
    expect(delegated.owner).toBe(coder);
    expect(delegated.lifecycle).toBe("active");
  });

  it("remains distinct from scoped capabilities", () => {
    const cap = scopedCapability(capabilityId("write-lock-w"), "write_lock", actorId("planner-p"), {
      kind: "artifact",
      artifactId: artifactId("task-T"),
    });
    const artifact = workArtifact(
      artifactId("task-T"),
      "Task",
      contentRef("content://task-T"),
      actorRef(actorId("planner-p"), "agent"),
    );
    expect(cap).not.toHaveProperty("contentRef");
    expect(artifact).not.toHaveProperty("holder");
  });
});
