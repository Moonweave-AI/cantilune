import { describe, it, expect } from "vitest";
import { actorId } from "@cantilune/core";
import {
  createLoopbackMeshRouter,
  createNetMeshRouter,
  allocateLoopbackTransport,
} from "../../../src/cluster/commsIntegration.js";
import { createSharedResources, commsStorePath } from "../../../src/cluster/sharedResources.js";

describe("commsIntegration", () => {
  describe("createLoopbackMeshRouter", () => {
    it("creates a router with LoopbackTransport factory", () => {
      const router = createLoopbackMeshRouter();
      expect(router).toBeDefined();
      expect(router.size).toBe(0);
    });

    it("allocates a mesh-hub endpoint (not a discarded pair half)", () => {
      const router = createLoopbackMeshRouter();
      const transport = router.allocate(actorId("agent-a"));
      expect(transport).toBeDefined();
      expect(transport.transportId).toBe("mesh-hub");
    });

    it("creates distinct transports for multiple agents", () => {
      const router = createLoopbackMeshRouter();
      const tA = router.allocate(actorId("agent-a"));
      const tB = router.allocate(actorId("agent-b"));
      expect(tA).not.toBe(tB);
      expect(router.size).toBe(2);
    });
  });

  describe("allocateLoopbackTransport", () => {
    it("allocates via the router", () => {
      const router = createLoopbackMeshRouter();
      const transport = allocateLoopbackTransport(actorId("agent-x"), router);
      expect(transport).toBeDefined();
      expect(router.getTransport(actorId("agent-x"))).toBe(transport);
    });

    it("returns same transport on repeated calls", () => {
      const router = createLoopbackMeshRouter();
      const t1 = allocateLoopbackTransport(actorId("agent-x"), router);
      const t2 = allocateLoopbackTransport(actorId("agent-x"), router);
      expect(t1).toBe(t2);
    });
  });

  describe("createNetMeshRouter", () => {
    it("allocates a hub endpoint with a NetTransport physical backend", async () => {
      const router = createNetMeshRouter();
      const transport = router.allocate(actorId("agent-net"));
      expect(transport.transportId).toBe("mesh-hub");
      expect(router.getPhysicalTransport(actorId("agent-net"))?.transportId).toBe("net");
      router.deallocate(actorId("agent-net"));
      expect(router.size).toBe(0);
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
  });

  describe("commsStorePath", () => {
    it("constructs path from shared storagePath and agentId", () => {
      const shared = createSharedResources({
        runtime: { getHead: () => undefined } as never,
        contentStore: {} as never,
        storagePath: "/data/cluster",
      });
      const path = commsStorePath(shared, actorId("agent-42"));
      expect(path).toBe("/data/cluster/comms/agent-42");
    });
  });
});
