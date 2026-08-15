import type { ActorId, ArtifactId, CapabilityId, EvidenceId, LinkId, SessionId } from "./ids.js";
import type { Brand } from "./ids.js";

export type RefBrand<T extends string> = Brand<string, T>;

export type SnapshotRef = RefBrand<"SnapshotRef">;
export type ContentRef = RefBrand<"ContentRef">;

export const snapshotRef = (value: string): SnapshotRef => value as SnapshotRef;
export const contentRef = (value: string): ContentRef => value as ContentRef;

/** What kind of entity a legacy target list entry refers to. */
export type TargetKind = "artifact" | "participant" | "session" | "capability" | "link";

/**
 * Legacy flat target reference. Prefer {@link MatchBinding} for replay recipes
 * where role semantics matter (e.g. delegate from/to).
 */
export interface TargetRef {
  readonly kind: TargetKind;
  readonly id: string;
}

export function targetRef(kind: TargetKind, id: string): TargetRef {
  return { kind, id };
}

/**
 * Named, typed match binding for admission and replay.
 * Carries operation-specific roles so delegate from/to are not ambiguous.
 */
export type MatchBinding =
  | { readonly role: "task"; readonly artifactId: ArtifactId }
  | { readonly role: "artifact"; readonly artifactId: ArtifactId }
  | { readonly role: "from"; readonly actorId: ActorId }
  | { readonly role: "to"; readonly actorId: ActorId }
  | { readonly role: "delegator"; readonly actorId: ActorId }
  | { readonly role: "delegatee"; readonly actorId: ActorId }
  | { readonly role: "participant"; readonly actorId: ActorId }
  | { readonly role: "capability"; readonly capabilityId: CapabilityId }
  | { readonly role: "session"; readonly sessionId: SessionId }
  | { readonly role: "link"; readonly linkId: LinkId };

/**
 * Every role {@link MatchBinding} admits, as a value list consumers can iterate.
 *
 * The union carries a different payload per role and so cannot be derived from
 * this array; the assertion below instead makes the two fail to compile if they
 * ever disagree. Hand-copied role lists in other packages silently dropped
 * bindings whose role had been added only to the union.
 */
export const MATCH_BINDING_ROLES = [
  "task",
  "artifact",
  "from",
  "to",
  "delegator",
  "delegatee",
  "participant",
  "capability",
  "session",
  "link",
] as const;

export type MatchBindingRole = (typeof MATCH_BINDING_ROLES)[number];

type Assert<T extends true> = T;
type _RolesCoverTheUnion = Assert<
  [Exclude<MatchBinding["role"], MatchBindingRole>] extends [never] ? true : false
>;
type _UnionCoversTheRoles = Assert<
  [Exclude<MatchBindingRole, MatchBinding["role"]>] extends [never] ? true : false
>;

export function matchBinding(role: MatchBinding["role"], id: string): MatchBinding {
  switch (role) {
    case "task":
    case "artifact":
      return { role, artifactId: id as ArtifactId };
    case "from":
    case "to":
    case "delegator":
    case "delegatee":
    case "participant":
      return { role, actorId: id as ActorId };
    case "capability":
      return { role, capabilityId: id as CapabilityId };
    case "session":
      return { role, sessionId: id as SessionId };
    case "link":
      return { role, linkId: id as LinkId };
  }
}

/** Derive legacy targets from named bindings (order preserved). */
export function targetsFromMatchBindings(bindings: readonly MatchBinding[]): TargetRef[] {
  return bindings.map(bindingToTargetRef);
}

function bindingToTargetRef(binding: MatchBinding): TargetRef {
  switch (binding.role) {
    case "task":
    case "artifact":
      return targetRef("artifact", binding.artifactId);
    case "from":
    case "to":
    case "delegator":
    case "delegatee":
    case "participant":
      return targetRef("participant", binding.actorId);
    case "capability":
      return targetRef("capability", binding.capabilityId);
    case "session":
      return targetRef("session", binding.sessionId);
    case "link":
      return targetRef("link", binding.linkId);
  }
}

/** Lossy fallback when only legacy targets exist. */
export function matchBindingsFromTargets(targets: readonly TargetRef[]): MatchBinding[] {
  return targets.map((target) => {
    switch (target.kind) {
      case "artifact":
        return { role: "artifact", artifactId: target.id as ArtifactId };
      case "participant":
        return { role: "participant", actorId: target.id as ActorId };
      case "capability":
        return { role: "capability", capabilityId: target.id as CapabilityId };
      case "session":
        return { role: "session", sessionId: target.id as SessionId };
      case "link":
        return { role: "link", linkId: target.id as LinkId };
    }
  });
}

/** Kind of evidence attached to authorization or external proof. */
export type EvidenceKind = "policy" | "approval" | "observation" | "receipt";

/** Pointer to auditable evidence; often references an ObservationEntry in auditTail. */
export interface EvidenceRef {
  readonly evidenceId: EvidenceId;
  readonly kind: EvidenceKind;
  readonly contentRef: ContentRef;
}

export function evidenceRef(
  evidenceId: EvidenceId,
  kind: EvidenceKind,
  contentRefValue: ContentRef,
): EvidenceRef {
  return {
    evidenceId,
    kind,
    contentRef: contentRefValue,
  };
}

/** Versioned pointer to an operation template declaration (runtime registry). */
export interface OperationTemplateRef {
  readonly operationTypeId: string;
  readonly revision: string;
}

export function operationTemplateRef(
  operationTypeId: string,
  revision: string,
): OperationTemplateRef {
  return { operationTypeId, revision };
}
