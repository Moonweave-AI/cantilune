import { describe, it, expect } from "vitest";
import { actorId } from "@cantilune/core";
import { MeshTransportRouter } from "../../../src/cluster/meshTransportRouter.js";

describe("MeshTransportRouter", () => {
  describe("allocate", () => {
    it("allocates a placeholder transport without factory", () => {
      const router = new MeshTransportRouter();
      const transport = router.allocate(actorId("agent-a"));
      expect(transport).toBeDefined();
      expect(transport.transportId).toBe("mesh-agent-a");
    });

    it("placeholder dispatch/receive/handshake return {ok:false}", async () => {
      const router = new MeshTransportRouter();
      const transport = router.allocate(actorId("agent-placeholder"));
      const dispatchResult = await transport.dispatch({} as never);
      expect(dispatchResult).toEqual({ ok: false, value: undefined });
      const receiveResult = await transport.receive();
      expect(receiveResult).toEqual({ ok: false, value: undefined });
      const handshakeResult = await transport.handshake({} as never);
      expect(handshakeResult).toEqual({ ok: false, value: undefined });
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

    it("uses factory when set", () => {
      const router = new MeshTransportRouter();
      let factoryCallCount = 0;
      router.setTransportFactory(() => {
        factoryCallCount++;
        const mock = {
          transportId: `factory-${factoryCallCount}`,
          async dispatch() {
            return { ok: true, value: undefined } as never;
          },
          async receive() {
            return { ok: true, value: undefined } as never;
          },
          async handshake() {
            return { ok: true, value: undefined } as never;
          },
        };
        return [mock, mock];
      });
      const transport = router.allocate(actorId("agent-a"));
      expect(transport.transportId).toBe("factory-1");
      expect(factoryCallCount).toBe(1);
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
      router.deallocate(actorId("ghost")); // should not throw
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
