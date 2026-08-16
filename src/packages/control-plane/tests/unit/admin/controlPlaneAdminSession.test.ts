import { describe, expect, it } from "vitest";
import { runtimeInstanceId } from "@cantilune/core";
import {
  createControlPlaneAdminSession,
  decodeControlPlaneAdminEnvelope,
  encodeControlPlaneAdminEnvelope,
} from "../../../src/admin/controlPlaneAdminSession.js";
import { buildAdmissionHarness } from "../../support/buildAdmissionHarness.js";

describe("control-plane admin session", () => {
  it("denies unknown senders without mutating fleet state", async () => {
    const harness = buildAdmissionHarness();
    const session = createControlPlaneAdminSession({
      service: harness.service,
      adminAllowlist: ["admin-1"],
    });
    const denied = await session.handle({
      senderId: "intruder",
      operation: "rollout",
      payload: {
        domainId: harness.genesisBinding.activationDomainId,
        targetBinding: harness.genesisBinding,
        runtimeInstanceIds: [runtimeInstanceId("should-not-exist")],
      },
    });
    expect(denied.ok).toBe(false);
    if (!denied.ok) {
      expect(denied.error.code).toBe("authorization_denied");
    }
    expect(harness.service.listRuntimeBindings()).toHaveLength(0);
  });

  it("allowlisted sender can set fleet rollout", async () => {
    const harness = buildAdmissionHarness();
    const session = createControlPlaneAdminSession({
      service: harness.service,
      adminAllowlist: ["admin-1"],
    });
    const instance = runtimeInstanceId("admin-runtime");
    const allowed = await session.handle({
      senderId: "admin-1",
      operation: "rollout",
      payload: {
        domainId: harness.genesisBinding.activationDomainId,
        targetBinding: harness.genesisBinding,
        runtimeInstanceIds: [instance],
      },
    });
    expect(allowed.ok).toBe(true);
    expect(harness.service.rolloutReport().pending).toBe(1);
  });

  it("rejects allowlisted sender when admitted sessions are configured and missing", async () => {
    const harness = buildAdmissionHarness();
    const session = createControlPlaneAdminSession({
      service: harness.service,
      adminAllowlist: ["admin-1"],
      admittedSessionIds: ["session-admitted"],
    });
    const denied = await session.handle({
      senderId: "admin-1",
      sessionId: "session-other",
      operation: "rollout",
      payload: {
        domainId: harness.genesisBinding.activationDomainId,
        targetBinding: harness.genesisBinding,
        runtimeInstanceIds: [runtimeInstanceId("blocked")],
      },
    });
    expect(denied.ok).toBe(false);
    expect(harness.service.listRuntimeBindings()).toHaveLength(0);
  });

  it("decodes and rejects malformed admin envelopes", () => {
    expect(decodeControlPlaneAdminEnvelope(new TextEncoder().encode("not-json"))).toBeUndefined();
    expect(decodeControlPlaneAdminEnvelope(new TextEncoder().encode("null"))).toBeUndefined();
    expect(
      decodeControlPlaneAdminEnvelope(
        new TextEncoder().encode(JSON.stringify({ operation: "rollout" })),
      ),
    ).toBeUndefined();
    expect(
      decodeControlPlaneAdminEnvelope(
        new TextEncoder().encode(JSON.stringify({ senderId: "a", operation: "explode" })),
      ),
    ).toBeUndefined();
    const encoded = encodeControlPlaneAdminEnvelope({
      senderId: "admin-1",
      sessionId: "s1",
      operation: "acknowledge",
      payload: { runtimeInstanceId: "rt" },
    });
    expect(decodeControlPlaneAdminEnvelope(encoded)).toEqual({
      senderId: "admin-1",
      sessionId: "s1",
      operation: "acknowledge",
      payload: { runtimeInstanceId: "rt" },
    });
  });

  it("dispatches acknowledge, submit, prepare, and commit after authorize", async () => {
    const harness = buildAdmissionHarness();
    const session = createControlPlaneAdminSession({
      service: harness.service,
      adminAllowlist: ["admin-1"],
      admittedSessionIds: ["session-admitted"],
    });
    const instance = runtimeInstanceId("ack-runtime");
    const rolled = await session.handle({
      senderId: "admin-1",
      sessionId: "session-admitted",
      operation: "rollout",
      payload: {
        domainId: harness.genesisBinding.activationDomainId,
        targetBinding: harness.genesisBinding,
        runtimeInstanceIds: [instance],
      },
    });
    expect(rolled.ok).toBe(true);
    const acked = await session.handle({
      senderId: "admin-1",
      sessionId: "session-admitted",
      operation: "acknowledge",
      payload: { runtimeInstanceId: instance, observedBinding: harness.genesisBinding },
    });
    expect(acked.ok).toBe(true);
    expect(harness.service.rolloutReport().acknowledged).toBe(1);

    const badAck = await session.handle({
      senderId: "admin-1",
      sessionId: "session-admitted",
      operation: "acknowledge",
      payload: "nope",
    });
    expect(badAck.ok).toBe(false);

    const submit = await session.handle({
      senderId: "admin-1",
      sessionId: "session-admitted",
      operation: "submit",
      payload: {},
    });
    expect(submit.ok).toBe(false);

    const prepare = await session.handle({
      senderId: "admin-1",
      sessionId: "session-admitted",
      operation: "prepare",
      payload: "nope",
    });
    expect(prepare.ok).toBe(false);

    const prepareMissing = await session.handle({
      senderId: "admin-1",
      sessionId: "session-admitted",
      operation: "prepare",
      payload: { admissionId: "missing" },
    });
    expect(prepareMissing.ok).toBe(false);

    const commit = await session.handle({
      senderId: "admin-1",
      sessionId: "session-admitted",
      operation: "commit",
      payload: "nope",
    });
    expect(commit.ok).toBe(false);

    const commitMissing = await session.handle({
      senderId: "admin-1",
      sessionId: "session-admitted",
      operation: "commit",
      payload: { admissionId: "missing" },
    });
    expect(commitMissing.ok).toBe(false);
  });

  it("registers and lists namespaces over the existing admin session", async () => {
    const harness = buildAdmissionHarness();
    const session = createControlPlaneAdminSession({
      service: harness.service,
      adminAllowlist: ["admin-1"],
    });
    const registered = await session.handle({
      senderId: "admin-1",
      operation: "register_namespace",
      payload: { namespaceId: "tenant-a", displayName: "Tenant A", actorId: "admin-1" },
    });
    expect(registered.ok).toBe(true);
    const registeredDefaultActor = await session.handle({
      senderId: "admin-1",
      operation: "register_namespace",
      payload: { namespaceId: "tenant-b", displayName: "Tenant B" },
    });
    expect(registeredDefaultActor.ok).toBe(true);
    const listed = await session.handle({
      senderId: "admin-1",
      operation: "list_namespaces",
      payload: {},
    });
    expect(listed.ok).toBe(true);
    if (listed.ok) {
      const records = listed.value as readonly { namespace: { namespaceId: string } }[];
      expect(records.some((item) => item.namespace.namespaceId === "tenant-a")).toBe(true);
    }
    const assigned = await session.handle({
      senderId: "admin-1",
      operation: "assign_namespace_role",
      payload: {
        namespaceId: "tenant-a",
        actorId: "member-1",
        role: "member",
        assignedBy: "admin-1",
      },
    });
    expect(assigned.ok).toBe(true);
    const assignedDefaultBy = await session.handle({
      senderId: "admin-1",
      operation: "assign_namespace_role",
      payload: { namespaceId: "tenant-b", actorId: "observer-1", role: "observer" },
    });
    expect(assignedDefaultBy.ok).toBe(true);
    const badRegister = await session.handle({
      senderId: "admin-1",
      operation: "register_namespace",
      payload: "nope",
    });
    expect(badRegister.ok).toBe(false);
    const badAssign = await session.handle({
      senderId: "admin-1",
      operation: "assign_namespace_role",
      payload: { namespaceId: "tenant-a", actorId: "x", role: "owner" },
    });
    expect(badAssign.ok).toBe(false);
  });
});
