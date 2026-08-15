import { describe, it, expect } from "vitest";
import { actorId } from "@cantilune/core";
import {
  createLoopbackMeshRouter,
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

    it("allocates transport via factory (not placeholder)", () => {
      const router = createLoopbackMeshRouter();
      const transport = router.allocate(actorId("agent-a"));
      expect(transport).toBeDefined();
      // Factory-created transports have "loopback" in their ID (from LoopbackTransport)
      expect(transport.transportId).toBeDefined();
      expect(transport.transportId).not.toBe("mesh-agent-a");
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
