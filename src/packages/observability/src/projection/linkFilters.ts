import { type CollaborationLink, type LinkId, type LinkKind } from "@cantilune/core";

export const DEPENDENCY_LINK_KINDS: readonly LinkKind[] = [
  "depends_on",
  "waits_for",
  "supplies",
  "reviews",
  "delegates_to",
];

export const STRUCTURAL_LINK_KINDS: readonly LinkKind[] = ["nested_in", "parallel_with"];

const dependencyKindSet = new Set<LinkKind>(DEPENDENCY_LINK_KINDS);
const structuralKindSet = new Set<LinkKind>(STRUCTURAL_LINK_KINDS);

export function isDependencyLinkKind(kind: LinkKind): boolean {
  return dependencyKindSet.has(kind);
}

export function isStructuralLinkKind(kind: LinkKind): boolean {
  return structuralKindSet.has(kind);
}

function linksEqual(left: CollaborationLink, right: CollaborationLink): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function addedLinks(
  before: ReadonlyMap<string, CollaborationLink>,
  after: ReadonlyMap<string, CollaborationLink>,
  kindFilter: (kind: LinkKind) => boolean,
): CollaborationLink[] {
  const added: CollaborationLink[] = [];
  for (const [linkId, link] of after) {
    if (!before.has(linkId) && kindFilter(link.kind)) {
      added.push(link);
    }
  }
  return added;
}

export function updatedLinks(
  before: ReadonlyMap<string, CollaborationLink>,
  after: ReadonlyMap<string, CollaborationLink>,
  kindFilter: (kind: LinkKind) => boolean,
): CollaborationLink[] {
  const updated: CollaborationLink[] = [];
  for (const [linkId, afterLink] of after) {
    const beforeLink = before.get(linkId);
    if (
      beforeLink !== undefined &&
      kindFilter(afterLink.kind) &&
      !linksEqual(beforeLink, afterLink)
    ) {
      updated.push(afterLink);
    }
  }
  return updated;
}

export function removedLinkIds(
  before: ReadonlyMap<string, CollaborationLink>,
  after: ReadonlyMap<string, CollaborationLink>,
  kindFilter: (kind: LinkKind) => boolean,
): LinkId[] {
  const removed: LinkId[] = [];
  for (const [linkIdKey, link] of before) {
    if (!after.has(linkIdKey) && kindFilter(link.kind)) {
      removed.push(linkIdKey as LinkId);
    }
  }
  return removed;
}

export function filterLinksByKind(
  links: ReadonlyMap<string, CollaborationLink>,
  kindFilter: (kind: LinkKind) => boolean,
): CollaborationLink[] {
  return [...links.values()]
    .filter((link) => kindFilter(link.kind))
    .sort((left, right) => left.linkId.localeCompare(right.linkId));
}
