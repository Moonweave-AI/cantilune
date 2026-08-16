import { afterEach, describe, expect, it } from "vitest";
import { ok } from "@cantilune/core";
import { connectNetTransportPair, type NetTransport } from "@cantilune/comms";
import {
  encodeControlPlaneAdminEnvelope,
  type ControlPlaneAdminEnvelope,
  type ControlPlaneAdminHandler,
} from "@cantilune/control-plane";
import { startControlPlaneAdminListener } from "../../../src/cluster/controlPlaneAdminListener.js";

const open: NetTransport[] = [];

afterEach(async () => {
  const closing = open.splice(0, open.length);
  await Promise.all(closing.map((transport) => transport.close().catch(() => undefined)));
});

describe("control-plane admin listener", () => {
  it("forwards allowlisted envelopes and drops undecodable frames", async () => {
    const handled: ControlPlaneAdminEnvelope[] = [];
    const session: ControlPlaneAdminHandler = {
      handle: async (envelope) => {
        handled.push(envelope);
        return ok(undefined);
      },
    };
    const [operator, supervisor] = await connectNetTransportPair();
    open.push(operator, supervisor);
    const listener = startControlPlaneAdminListener({
      transport: supervisor,
      session,
      pollIntervalMs: 10,
    });

    const envelope: ControlPlaneAdminEnvelope = {
      senderId: "mesh-admin",
      operation: "rollout",
      payload: { ok: true },
    };
    expect((await operator.sendRawFrame(encodeControlPlaneAdminEnvelope(envelope))).ok).toBe(true);
    expect((await operator.sendRawFrame(new TextEncoder().encode("not-an-envelope"))).ok).toBe(
      true,
    );

    const deadline = Date.now() + 2_000;
    while (handled.length === 0 && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    expect(handled).toEqual([envelope]);
    await listener.stop();
  });

  it("keeps listening when handle throws", async () => {
    let calls = 0;
    const session: ControlPlaneAdminHandler = {
      handle: async () => {
        calls += 1;
        throw new Error("handler failed");
      },
    };
    const [operator, supervisor] = await connectNetTransportPair();
    open.push(operator, supervisor);
    const listener = startControlPlaneAdminListener({
      transport: supervisor,
      session,
      pollIntervalMs: 10,
    });
    expect(
      (
        await operator.sendRawFrame(
          encodeControlPlaneAdminEnvelope({
            senderId: "mesh-admin",
            operation: "acknowledge",
            payload: {},
          }),
        )
      ).ok,
    ).toBe(true);
    const deadline = Date.now() + 2_000;
    while (calls === 0 && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    expect(calls).toBe(1);
    await listener.stop();
  });
});
