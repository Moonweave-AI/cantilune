import { describe, expect, it } from "vitest";
import {
  collaborationLink,
  collaborationSnapshot,
  epochId,
  linkId,
  snapshotRef,
  actorId,
} from "@cantilune/core";
import {
  addedLinks,
  filterLinksByKind,
  isDependencyLinkKind,
  isStructuralLinkKind,
  removedLinkIds,
  updatedLinks,
} from "../../../src/projection/linkFilters.js";

describe("linkFilters", () => {
  const snapS0 = snapshotRef("snap-S0");
  const snapS1 = snapshotRef("snap-S1");
  const reviewer = actorId("reviewer-r");
  const coder = actorId("coder-c");

  it("partitions dependency and structural link kinds", () => {
    expect(isDependencyLinkKind("waits_for")).toBe(true);
    expect(isDependencyLinkKind("nested_in")).toBe(false);
    expect(isStructuralLinkKind("nested_in")).toBe(true);
    expect(isStructuralLinkKind("depends_on")).toBe(false);
  });

  it("computes added and removed dependency links between snapshots", () => {
    const before = collaborationSnapshot({ snapshotRef: snapS0, epochId: epochId("42") });
    const depLink = collaborationLink(
      linkId("link-waits-1"),
      "waits_for",
      { kind: "participant", actorId: reviewer },
      { kind: "participant", actorId: coder },
    );
    const structLink = collaborationLink(
      linkId("link-nest-1"),
      "nested_in",
      { kind: "participant", actorId: reviewer },
      { kind: "participant", actorId: coder },
    );
    const after = collaborationSnapshot({
      snapshotRef: snapS1,
      epochId: epochId("42"),
      links: new Map([
        [depLink.linkId, depLink],
        [structLink.linkId, structLink],
      ]),
    });

    expect(addedLinks(before.links, after.links, isDependencyLinkKind)).toHaveLength(1);
    expect(addedLinks(before.links, after.links, isStructuralLinkKind)).toHaveLength(1);
    expect(removedLinkIds(after.links, before.links, isDependencyLinkKind)).toHaveLength(1);
    expect(filterLinksByKind(after.links, isDependencyLinkKind)).toHaveLength(1);
  });

  it("detects updated links when payload changes", () => {
    const depLink = collaborationLink(
      linkId("link-waits-1"),
      "waits_for",
      { kind: "participant", actorId: reviewer },
      { kind: "participant", actorId: coder },
    );
    const afterLink = collaborationLink(
      linkId("link-waits-1"),
      "waits_for",
      { kind: "participant", actorId: reviewer },
      { kind: "participant", actorId: actorId("other") },
    );
    const beforeMap = new Map([[depLink.linkId, depLink]]);
    const afterMap = new Map([[afterLink.linkId, afterLink]]);
    expect(updatedLinks(beforeMap, afterMap, isDependencyLinkKind)).toHaveLength(1);
    expect(isDependencyLinkKind("depends_on")).toBe(true);
    expect(isStructuralLinkKind("parallel_with")).toBe(true);
  });
});
