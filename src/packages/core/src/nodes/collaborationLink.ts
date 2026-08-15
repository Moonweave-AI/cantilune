import type { ActorId, ArtifactId, LinkId } from "../primitives/ids.js";

/** Semantic kind of directed collaboration relationship. */
export const LINK_KINDS = [
  "depends_on",
  "waits_for",
  "supplies",
  "reviews",
  "delegates_to",
  "parallel_with",
  "nested_in",
] as const;

export type LinkKind = (typeof LINK_KINDS)[number];

/** Endpoint of a collaboration link — either an actor or an artifact. */
export type LinkEndpoint =
  | { readonly kind: "participant"; readonly actorId: ActorId }
  | { readonly kind: "artifact"; readonly artifactId: ArtifactId };

/** Directed edge in the collaboration dependency / coordination mesh. */
export interface CollaborationLink {
  readonly linkId: LinkId;
  readonly kind: LinkKind;
  readonly from: LinkEndpoint;
  readonly to: LinkEndpoint;
}

export function collaborationLink(
  linkId: LinkId,
  kind: LinkKind,
  from: LinkEndpoint,
  to: LinkEndpoint,
): CollaborationLink {
  return { linkId, kind, from, to };
}
