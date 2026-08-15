import { type CollaborationSnapshot } from "@cantilune/core";
import { type EventTag } from "../../foundation/eventTag.js";
import { type DependencyDelta } from "../../spine/projectionSlice.js";
import { addedLinks, isDependencyLinkKind, removedLinkIds, updatedLinks } from "../linkFilters.js";

export function interpretDependencyDelta(
  eventTag: EventTag,
  before: CollaborationSnapshot,
  after: CollaborationSnapshot,
): DependencyDelta {
  return {
    eventTag,
    addedLinks: addedLinks(before.links, after.links, isDependencyLinkKind),
    updatedLinks: updatedLinks(before.links, after.links, isDependencyLinkKind),
    removedLinkIds: removedLinkIds(before.links, after.links, isDependencyLinkKind),
  };
}
