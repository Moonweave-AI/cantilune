import { describe, expect, it } from "vitest";
import {
  CONTROL_PLANE_ADMIN_OPERATIONS,
  NAMESPACE_RBAC_ROLES,
  createNamespaceRegistry,
  createTranscriptAccessWorkflow,
  decideTranscriptAccess,
  fleetVisibleTranscript,
  isNamespaceRbacRole,
  namespaceRoleAtLeast,
  projectFleetConsole,
  requestTranscriptAccess,
} from "../../src/index.js";

describe("control-plane namespace export surface", () => {
  it("exports ADR-0022 registry, workflow, and fleet projection", () => {
    expect(NAMESPACE_RBAC_ROLES).toContain("admin");
    expect(isNamespaceRbacRole("member")).toBe(true);
    expect(namespaceRoleAtLeast("observer", "admin")).toBe(false);
    expect(typeof createNamespaceRegistry).toBe("function");
    expect(typeof createTranscriptAccessWorkflow).toBe("function");
    expect(typeof requestTranscriptAccess).toBe("function");
    expect(typeof decideTranscriptAccess).toBe("function");
    expect(typeof projectFleetConsole).toBe("function");
    expect(typeof fleetVisibleTranscript).toBe("function");
    expect(CONTROL_PLANE_ADMIN_OPERATIONS).toContain("register_namespace");
    expect(CONTROL_PLANE_ADMIN_OPERATIONS).toContain("list_namespaces");
    expect(CONTROL_PLANE_ADMIN_OPERATIONS).toContain("assign_namespace_role");
  });
});
