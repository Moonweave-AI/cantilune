import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import {
  actorId,
  actorRef,
  correlationId,
  epochId,
  epochOrdinal,
  idempotencyKey,
  occurrenceId,
  operationTemplateRef,
  sessionId,
} from "@cantilune/core";
import {
  computeEnvelopeIntegrityDigest,
  messageId,
  channelId,
  parseCommunicationWireFrame,
  sealVerifiedEnvelope,
  type CommunicationEnvelope,
} from "@cantilune/comms";
import { MeshTransportRouter } from "../../../src/cluster/meshTransportRouter.js";
import {
  createFileMeshRouter,
  createLoopbackMeshRouter,
} from "../../../src/cluster/commsIntegration.js";

function mockPhysical(id: string): {
  transportId: string;
  dispatch: () => Promise<unknown>;
  receive: () => Promise<unknown>;
  handshake: () => Promise<unknown>;
  close: () => void;
} {
  return {
    transportId: id,
    async dispatch() {
      return { ok: true, value: { attemptRef: "a" } };
    },
    async receive() {
      return { ok: false, error: { code: "transport_failed" } };
    },
    async handshake() {
      return { ok: true, value: { ackDigest: "ack" } };
    },
    close() {
      return undefined;
    },
  };
}

function buildEnvelope(from: string, to: string): CommunicationEnvelope {
  const base: Omit<CommunicationEnvelope, "integrityDigest"> = {
    wireVersion: 1 as never,
    registryVersion: 1 as never,
    messageId: messageId(`msg-${from}-${to}`),
    operationCode: "send",
    metadata: {
      epochId: epochId("42"),
      epochOrdinal: epochOrdinal(1),
      operationTemplateRef: operationTemplateRef("send", "1"),
      sessionId: sessionId("session-test-001"),
      correlationId: correlationId("corr-test-001"),
      occurrenceId: occurrenceId("occ-test-001"),
      idempotencyKey: idempotencyKey("idem-test-001"),
    },
    sender: actorRef(actorId(from), "agent"),
    recipient: actorRef(actorId(to), "agent"),
    channelId: channelId("ch-1"),
    channelGeneration: 1 as never,
    sequence: 1,
    payload: {
      contentRef: "content://test" as never,
      contentDigest: "digest-abc" as never,
      mediaType: "application/json",
      byteLength: 10,
      classification: "internal",
    },
    ackMode: "durablyAccepted",
    issuedAt: "2026-08-11T16:00:00Z",
    expiresAt: "2099-01-01T00:00:00Z",
  };
  return { ...base, integrityDigest: computeEnvelopeIntegrityDigest(base) };
}

describe("MeshTransportRouter", () => {
  describe("allocate", () => {
    it("allocates a mesh-hub endpoint without a factory", () => {
      const router = new MeshTransportRouter();
      const transport = router.allocate(actorId("agent-a"));
      expect(transport.transportId).toBe("mesh-hub");
    });

    it("returns same transport on repeated allocation", () => {
      const router = new MeshTransportRouter();
      const t1 = router.allocate(actorId("agent-a"));
      const t2 = router.allocate(actorId("agent-a"));
      expect(t1).toBe(t2);
    });

    it("allocates distinct transports for different agents", () => {
      const router = new MeshTransportRouter();
      const tA = router.allocate(actorId("agent-a"));
      const tB = router.allocate(actorId("agent-b"));
      expect(tA).not.toBe(tB);
    });

    it("retains a physical backend when a pair factory is set", () => {
      const router = new MeshTransportRouter();
      let n = 0;
      router.setTransportFactory(() => {
        n += 1;
        return [mockPhysical(`factory-${n}`), mockPhysical(`peer-${n}`)];
      });
      const transport = router.allocate(actorId("agent-a"));
      expect(transport.transportId).toBe("mesh-hub");
      expect(router.getPhysicalTransport(actorId("agent-a"))?.transportId).toBe("factory-1");
    });

    it("allocates 5 agents correctly", () => {
      const router = new MeshTransportRouter();
      for (let i = 0; i < 5; i++) {
        router.allocate(actorId(`agent-${i}`));
      }
      expect(router.size).toBe(5);
    });

    it("allocates 10 agents correctly", () => {
      const router = new MeshTransportRouter();
      for (let i = 0; i < 10; i++) {
        router.allocate(actorId(`agent-${i}`));
      }
      expect(router.size).toBe(10);
      expect(router.agentIds()).toHaveLength(10);
    });
  });

  describe("N-to-N routing", () => {
    it("delivers from A to B by recipient ActorRef", async () => {
      const router = createLoopbackMeshRouter();
      const a = router.allocate(actorId("agent-a"));
      const b = router.allocate(actorId("agent-b"));

      const verified = sealVerifiedEnvelope({
        envelope: buildEnvelope("agent-a", "agent-b"),
        verifiedAt: "2026-08-11T16:00:00Z",
      });
      const sent = await a.dispatch(verified);
      expect(sent.ok).toBe(true);

      const received = await b.receive();
      expect(received.ok).toBe(true);
      if (!received.ok) return;
      const parsed = parseCommunicationWireFrame(received.value);
      expect(parsed.ok).toBe(true);
      if (!parsed.ok) return;
      expect(parsed.value.recipient).toEqual(actorRef(actorId("agent-b"), "agent"));
      expect(parsed.value.sender).toEqual(actorRef(actorId("agent-a"), "agent"));
    });

    it("fails closed for unknown recipients", async () => {
      const router = createLoopbackMeshRouter();
      const a = router.allocate(actorId("agent-a"));
      const verified = sealVerifiedEnvelope({
        envelope: buildEnvelope("agent-a", "ghost"),
        verifiedAt: "2026-08-11T16:00:00Z",
      });
      const sent = await a.dispatch(verified);
      expect(sent.ok).toBe(false);
    });

    it("does not deliver into the sender inbox", async () => {
      const router = createLoopbackMeshRouter();
      const a = router.allocate(actorId("agent-a"));
      router.allocate(actorId("agent-b"));
      const verified = sealVerifiedEnvelope({
        envelope: buildEnvelope("agent-a", "agent-b"),
        verifiedAt: "2026-08-11T16:00:00Z",
      });
      await a.dispatch(verified);
      const self = await a.receive();
      expect(self.ok).toBe(false);
    });
  });

  describe("getTransport", () => {
    it("returns undefined for non-allocated agent", () => {
      const router = new MeshTransportRouter();
      expect(router.getTransport(actorId("ghost"))).toBeUndefined();
    });

    it("returns the allocated transport", () => {
      const router = new MeshTransportRouter();
      const allocated = router.allocate(actorId("agent-a"));
      expect(router.getTransport(actorId("agent-a"))).toBe(allocated);
    });
  });

  describe("deallocate", () => {
    it("removes transport from the router", () => {
      const router = new MeshTransportRouter();
      router.allocate(actorId("agent-a"));
      expect(router.size).toBe(1);

      router.deallocate(actorId("agent-a"));
      expect(router.size).toBe(0);
      expect(router.getTransport(actorId("agent-a"))).toBeUndefined();
    });

    it("allows re-allocation after deallocate", () => {
      const router = new MeshTransportRouter();
      router.allocate(actorId("agent-a"));
      router.deallocate(actorId("agent-a"));
      const t2 = router.allocate(actorId("agent-a"));
      expect(t2).toBeDefined();
      expect(router.size).toBe(1);
    });

    it("is a no-op for non-existent agent", () => {
      const router = new MeshTransportRouter();
      router.deallocate(actorId("ghost"));
      expect(router.size).toBe(0);
    });
  });

  describe("agentIds", () => {
    it("returns empty array when no agents allocated", () => {
      const router = new MeshTransportRouter();
      expect(router.agentIds()).toEqual([]);
    });

    it("returns all allocated agent IDs", () => {
      const router = new MeshTransportRouter();
      router.allocate(actorId("a"));
      router.allocate(actorId("b"));
      router.allocate(actorId("c"));
      const ids = router.agentIds() as string[];
      expect(ids).toContain("a");
      expect(ids).toContain("b");
      expect(ids).toContain("c");
    });
  });
});

describe("createFileMeshRouter", () => {
  it("allocates a hub endpoint with a FileTransport physical backend", () => {
    const dir = mkdtempSync(join(tmpdir(), "file-mesh-"));
    try {
      const router = createFileMeshRouter(dir);
      const transport = router.allocate(actorId("agent-a"));
      expect(transport.transportId).toBe("mesh-hub");
      expect(router.getPhysicalTransport(actorId("agent-a"))?.transportId).toBe("file");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
