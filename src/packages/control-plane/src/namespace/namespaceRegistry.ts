import {
  collaborationNamespace,
  DEFAULT_NAMESPACE,
  DEFAULT_NAMESPACE_ID,
  err,
  ok,
  type ActorId,
  type CollaborationNamespace,
  type NamespaceId,
  type Result,
} from "@cantilune/core";
import {
  controlPlaneViolation,
  type ControlPlaneViolation,
} from "../errors/controlPlaneViolation.js";

/** Per-namespace RBAC (ADR-0022). Not a parallel tenant identity. */
export const NAMESPACE_RBAC_ROLES = ["admin", "member", "observer"] as const;

export type NamespaceRbacRole = (typeof NAMESPACE_RBAC_ROLES)[number];

const ROLE_RANK: Readonly<Record<NamespaceRbacRole, number>> = {
  observer: 0,
  member: 1,
  admin: 2,
};

export function isNamespaceRbacRole(value: string): value is NamespaceRbacRole {
  return (NAMESPACE_RBAC_ROLES as readonly string[]).includes(value);
}

export function namespaceRoleAtLeast(
  actual: NamespaceRbacRole | undefined,
  required: NamespaceRbacRole,
): boolean {
  return actual !== undefined && ROLE_RANK[actual] >= ROLE_RANK[required];
}

export interface NamespaceMembership {
  readonly actorId: ActorId;
  readonly role: NamespaceRbacRole;
}

export interface NamespaceRecord {
  readonly namespace: CollaborationNamespace;
  readonly memberships: readonly NamespaceMembership[];
}

export interface RegisterNamespaceInput {
  readonly namespaceId: NamespaceId;
  readonly displayName: string;
  readonly actorId: ActorId;
}

export interface AssignNamespaceRoleInput {
  readonly namespaceId: NamespaceId;
  readonly actorId: ActorId;
  readonly role: NamespaceRbacRole;
  readonly assignedBy: ActorId;
}

export interface NamespaceRegistry {
  registerNamespace(input: RegisterNamespaceInput): Result<NamespaceRecord, ControlPlaneViolation>;
  listNamespaces(): readonly NamespaceRecord[];
  getNamespace(namespaceId: NamespaceId): NamespaceRecord | undefined;
  assignRole(input: AssignNamespaceRoleInput): Result<NamespaceRecord, ControlPlaneViolation>;
  roleOf(namespaceId: NamespaceId, actorId: ActorId): NamespaceRbacRole | undefined;
  hasRole(namespaceId: NamespaceId, actorId: ActorId, role: NamespaceRbacRole): boolean;
}

interface StoredNamespace {
  displayName: string;
  readonly memberships: Map<ActorId, NamespaceRbacRole>;
}

function asActorKey(actorId: ActorId): string {
  return actorId as string;
}

function asNamespaceKey(namespaceId: NamespaceId): string {
  return namespaceId as string;
}

function snapshotRecord(namespaceId: NamespaceId, stored: StoredNamespace): NamespaceRecord {
  const memberships: NamespaceMembership[] = [...stored.memberships.entries()].map(
    ([actorId, role]) => ({ actorId, role }),
  );
  memberships.sort((left, right) =>
    asActorKey(left.actorId).localeCompare(asActorKey(right.actorId)),
  );
  const adminPrincipals = memberships
    .filter((membership) => membership.role === "admin")
    .map((membership) => membership.actorId);
  return {
    namespace: collaborationNamespace(namespaceId, stored.displayName, adminPrincipals),
    memberships,
  };
}

function rejectEmpty(value: string, path: string): Result<void, ControlPlaneViolation> {
  if (value.trim().length === 0) {
    return err(controlPlaneViolation("invalid_input", "register", `${path} is required`, { path }));
  }
  return ok(undefined);
}

export function createNamespaceRegistry(): NamespaceRegistry {
  const namespaces = new Map<string, StoredNamespace>();
  namespaces.set(asNamespaceKey(DEFAULT_NAMESPACE_ID), {
    displayName: DEFAULT_NAMESPACE.displayName,
    memberships: new Map(),
  });

  const storedOf = (namespaceId: NamespaceId): StoredNamespace | undefined =>
    namespaces.get(asNamespaceKey(namespaceId));

  return {
    registerNamespace(input) {
      const idCheck = rejectEmpty(asNamespaceKey(input.namespaceId), "namespaceId");
      if (!idCheck.ok) {
        return idCheck;
      }
      const nameCheck = rejectEmpty(input.displayName, "displayName");
      if (!nameCheck.ok) {
        return nameCheck;
      }
      const actorCheck = rejectEmpty(asActorKey(input.actorId), "actorId");
      if (!actorCheck.ok) {
        return actorCheck;
      }
      const existing = storedOf(input.namespaceId);
      if (existing !== undefined && existing.memberships.size > 0) {
        return err(
          controlPlaneViolation("revision_conflict", "register", "namespace already registered", {
            path: "namespaceId",
            actual: asNamespaceKey(input.namespaceId),
          }),
        );
      }
      const memberships = new Map<ActorId, NamespaceRbacRole>();
      memberships.set(input.actorId, "admin");
      const stored: StoredNamespace = {
        displayName: input.displayName.trim(),
        memberships,
      };
      namespaces.set(asNamespaceKey(input.namespaceId), stored);
      return ok(snapshotRecord(input.namespaceId, stored));
    },

    listNamespaces() {
      return [...namespaces.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([id, stored]) => snapshotRecord(id as NamespaceId, stored));
    },

    getNamespace(namespaceId) {
      const stored = storedOf(namespaceId);
      if (stored === undefined) {
        return undefined;
      }
      return snapshotRecord(namespaceId, stored);
    },

    assignRole(input) {
      if (!isNamespaceRbacRole(input.role)) {
        return err(
          controlPlaneViolation("invalid_input", "authorize", "unknown namespace RBAC role", {
            path: "role",
            actual: input.role,
          }),
        );
      }
      const stored = storedOf(input.namespaceId);
      if (stored === undefined) {
        return err(
          controlPlaneViolation("invalid_input", "authorize", "namespace not registered", {
            path: "namespaceId",
            actual: asNamespaceKey(input.namespaceId),
          }),
        );
      }
      const adminCount = [...stored.memberships.values()].filter((role) => role === "admin").length;
      const assignedByRole = stored.memberships.get(input.assignedBy);
      if (adminCount === 0) {
        if (input.role !== "admin") {
          return err(
            controlPlaneViolation(
              "authorization_denied",
              "authorize",
              "namespace has no admin; first assignment must be admin",
            ),
          );
        }
      } else if (assignedByRole !== "admin") {
        return err(
          controlPlaneViolation(
            "authorization_denied",
            "authorize",
            "only a namespace admin may assign roles",
          ),
        );
      }
      const current = stored.memberships.get(input.actorId);
      if (current === "admin" && input.role !== "admin" && adminCount === 1) {
        return err(
          controlPlaneViolation(
            "invalid_input",
            "authorize",
            "cannot demote the last namespace admin",
            { path: "actorId" },
          ),
        );
      }
      stored.memberships.set(input.actorId, input.role);
      return ok(snapshotRecord(input.namespaceId, stored));
    },

    roleOf(namespaceId, actorId) {
      return storedOf(namespaceId)?.memberships.get(actorId);
    },

    hasRole(namespaceId, actorId, role) {
      return namespaceRoleAtLeast(storedOf(namespaceId)?.memberships.get(actorId), role);
    },
  };
}
