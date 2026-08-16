import { afterEach, describe, expect, it } from "vitest";
import { runtimeInstanceId } from "@cantilune/core";
import { connectNetTransportPair, type NetTransport } from "@cantilune/comms";
import {
  createControlPlaneAdminSession,
  decodeControlPlaneAdminEnvelope,
  encodeControlPlaneAdminEnvelope,
} from "../../src/admin/controlPlaneAdminSession.js";
import { buildAdmissionHarness } from "../support/buildAdmissionHarness.js";

const open: NetTransport[] = [];

afterEach(async () => {
  const closing = open.splice(0, open.length);
  await Promise.all(closing.map((transport) => transport.close().catch(() => undefined)));
});

async function receiveSoon(transport: NetTransport, attempts = 40): Promise<Uint8Array> {
  for (let i = 0; i < attempts; i += 1) {
    const received = await transport.receive();
    if (received.ok) {
      return received.value;
    }
    await new Promise((resolve) => setTimeout(resolve, 15));
  }
  throw new Error("admin envelope not received over NetTransport");
}

describe("control-plane admin over NetTransport", () => {
  it("accepts an already-admitted allowlisted envelope and rejects an unknown sender", async () => {
    const harness = buildAdmissionHarness();
    const session = createControlPlaneAdminSession({
      service: harness.service,
      adminAllowlist: ["mesh-admin"],
    });
    const [operator, supervisor] = await connectNetTransportPair();
    open.push(operator, supervisor);

    const instance = runtimeInstanceId("net-admin-runtime");
    const admitted = {
      senderId: "mesh-admin",
      operation: "rollout" as const,
      payload: {
        domainId: harness.genesisBinding.activationDomainId,
        targetBinding: harness.genesisBinding,
        runtimeInstanceIds: [instance],
      },
    };
    const sent = await operator.sendRawFrame(encodeControlPlaneAdminEnvelope(admitted));
    expect(sent.ok).toBe(true);
    const received = await receiveSoon(supervisor);
    const decoded = decodeControlPlaneAdminEnvelope(received);
    expect(decoded).toEqual(admitted);
    const handled = await session.handle(decoded!);
    expect(handled.ok).toBe(true);
    expect(harness.service.rolloutReport().pending).toBe(1);

    const beforeUnknown = harness.service.listRuntimeBindings().length;
    const unknown = {
      senderId: "stranger",
      operation: "rollout" as const,
      payload: {
        domainId: harness.genesisBinding.activationDomainId,
        targetBinding: harness.genesisBinding,
        runtimeInstanceIds: [runtimeInstanceId("should-not-land")],
      },
    };
    expect((await operator.sendRawFrame(encodeControlPlaneAdminEnvelope(unknown))).ok).toBe(true);
    const unknownReceived = await receiveSoon(supervisor);
    const unknownHandled = await session.handle(decodeControlPlaneAdminEnvelope(unknownReceived)!);
    expect(unknownHandled.ok).toBe(false);
    expect(harness.service.listRuntimeBindings()).toHaveLength(beforeUnknown);
  });
});
