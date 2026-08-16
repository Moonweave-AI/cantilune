import { describe, expect, it } from "vitest";
import { actorId, namespaceId } from "@cantilune/core";
import {
  createNamespaceRegistry,
  isNamespaceRbacRole,
  namespaceRoleAtLeast,
  NAMESPACE_RBAC_ROLES,
  type NamespaceRbacRole,
} from "../../../src/namespace/namespaceRegistry.js";

describe("namespace registry RBAC", () => {
  const tenantA = namespaceId("tenant-a");
  const admin = actorId("ns-admin");
  const member = actorId("ns-member");
  const observer = actorId("ns-observer");
  const outsider = actorId("ns-outsider");

  function seeded() {
    const registry = createNamespaceRegistry();
    const registered = registry.registerNamespace({
      namespaceId: tenantA,
      displayName: "Tenant A",
      actorId: admin,
    });
    expect(registered.ok).toBe(true);
    return registry;
  }

  it("registers and lists CollaborationNamespace records without a parallel tenant id", () => {
    const registry = seeded();
    const listed = registry.listNamespaces();
    const record = listed.find((item) => item.namespace.namespaceId === tenantA);
    expect(record?.namespace.displayName).toBe("Tenant A");
    expect(record?.namespace.adminPrincipals).toEqual([admin]);
    expect(record?.memberships).toEqual([{ actorId: admin, role: "admin" }]);
    expect(NAMESPACE_RBAC_ROLES).toEqual(["admin", "member", "observer"]);
  });

  it("denies member, observer, and outsider role assignment", () => {
    const registry = seeded();
    expect(
      registry.assignRole({
        namespaceId: tenantA,
        actorId: member,
        role: "member",
        assignedBy: admin,
      }).ok,
    ).toBe(true);
    expect(
      registry.assignRole({
        namespaceId: tenantA,
        actorId: observer,
        role: "observer",
        assignedBy: admin,
      }).ok,
    ).toBe(true);

    const memberDenied = registry.assignRole({
      namespaceId: tenantA,
      actorId: outsider,
      role: "observer",
      assignedBy: member,
    });
    expect(memberDenied.ok).toBe(false);
    if (!memberDenied.ok) {
      expect(memberDenied.error.code).toBe("authorization_denied");
    }

    const observerDenied = registry.assignRole({
      namespaceId: tenantA,
      actorId: outsider,
      role: "member",
      assignedBy: observer,
    });
    expect(observerDenied.ok).toBe(false);
    if (!observerDenied.ok) {
      expect(observerDenied.error.code).toBe("authorization_denied");
    }

    const outsiderDenied = registry.assignRole({
      namespaceId: tenantA,
      actorId: outsider,
      role: "member",
      assignedBy: outsider,
    });
    expect(outsiderDenied.ok).toBe(false);
    if (!outsiderDenied.ok) {
      expect(outsiderDenied.error.code).toBe("authorization_denied");
    }
    expect(registry.roleOf(tenantA, outsider)).toBeUndefined();
  });

  it("rejects duplicate register, empty fields, and unknown namespace assign", () => {
    const registry = seeded();
    const conflict = registry.registerNamespace({
      namespaceId: tenantA,
      displayName: "Again",
      actorId: admin,
    });
    expect(conflict.ok).toBe(false);
    if (!conflict.ok) {
      expect(conflict.error.code).toBe("revision_conflict");
    }
    expect(
      registry.registerNamespace({
        namespaceId: namespaceId("   "),
        displayName: "Blank",
        actorId: admin,
      }).ok,
    ).toBe(false);
    expect(
      registry.registerNamespace({
        namespaceId: namespaceId("tenant-b"),
        displayName: "  ",
        actorId: admin,
      }).ok,
    ).toBe(false);
    expect(
      registry.registerNamespace({
        namespaceId: namespaceId("tenant-b"),
        displayName: "B",
        actorId: actorId(" "),
      }).ok,
    ).toBe(false);
    const missing = registry.assignRole({
      namespaceId: namespaceId("missing"),
      actorId: member,
      role: "member",
      assignedBy: admin,
    });
    expect(missing.ok).toBe(false);
    if (!missing.ok) {
      expect(missing.error.code).toBe("invalid_input");
    }
    expect(registry.getNamespace(namespaceId("missing"))).toBeUndefined();
  });

  it("lets the first actor claim an empty default namespace as admin only", () => {
    const registry = createNamespaceRegistry();
    const memberFirst = registry.assignRole({
      namespaceId: namespaceId("default"),
      actorId: member,
      role: "member",
      assignedBy: member,
    });
    expect(memberFirst.ok).toBe(false);
    if (!memberFirst.ok) {
      expect(memberFirst.error.code).toBe("authorization_denied");
    }
    const claimed = registry.assignRole({
      namespaceId: namespaceId("default"),
      actorId: admin,
      role: "admin",
      assignedBy: admin,
    });
    expect(claimed.ok).toBe(true);
    if (claimed.ok) {
      expect(claimed.value.namespace.adminPrincipals).toEqual([admin]);
    }
    const renamed = registry.registerNamespace({
      namespaceId: namespaceId("default"),
      displayName: "Default claimed",
      actorId: admin,
    });
    expect(renamed.ok).toBe(false);
  });

  it("claims an empty seeded default via registerNamespace", () => {
    const registry = createNamespaceRegistry();
    const claimed = registry.registerNamespace({
      namespaceId: namespaceId("default"),
      displayName: "Default claimed",
      actorId: admin,
    });
    expect(claimed.ok).toBe(true);
    if (claimed.ok) {
      expect(claimed.value.namespace.displayName).toBe("Default claimed");
      expect(claimed.value.namespace.adminPrincipals).toEqual([admin]);
    }
  });

  it("refuses to demote the last admin and keeps adminPrincipals in sync", () => {
    const registry = seeded();
    const last = registry.assignRole({
      namespaceId: tenantA,
      actorId: admin,
      role: "member",
      assignedBy: admin,
    });
    expect(last.ok).toBe(false);
    if (!last.ok) {
      expect(last.error.code).toBe("invalid_input");
    }
    expect(
      registry.assignRole({
        namespaceId: tenantA,
        actorId: member,
        role: "admin",
        assignedBy: admin,
      }).ok,
    ).toBe(true);
    expect(
      registry.assignRole({
        namespaceId: tenantA,
        actorId: admin,
        role: "member",
        assignedBy: member,
      }).ok,
    ).toBe(true);
    const record = registry.getNamespace(tenantA);
    expect(record?.namespace.adminPrincipals).toEqual([member]);
    expect(registry.hasRole(tenantA, member, "admin")).toBe(true);
    expect(registry.hasRole(tenantA, admin, "member")).toBe(true);
    expect(registry.hasRole(tenantA, admin, "admin")).toBe(false);
  });

  it("validates role names and rank", () => {
    expect(isNamespaceRbacRole("admin")).toBe(true);
    expect(isNamespaceRbacRole("owner")).toBe(false);
    expect(namespaceRoleAtLeast("admin", "observer")).toBe(true);
    expect(namespaceRoleAtLeast("observer", "member")).toBe(false);
    expect(namespaceRoleAtLeast(undefined, "observer")).toBe(false);
    const registry = seeded();
    const invalid = registry.assignRole({
      namespaceId: tenantA,
      actorId: member,
      role: "owner" as NamespaceRbacRole,
      assignedBy: admin,
    });
    expect(invalid.ok).toBe(false);
    if (!invalid.ok) {
      expect(invalid.error.code).toBe("invalid_input");
    }
  });
});
