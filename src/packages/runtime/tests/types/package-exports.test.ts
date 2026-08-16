import { describe, expect, it } from "vitest";
import * as runtime from "../../src/index.js";
import * as memory from "../../src/memory/index.js";

describe("runtime package exports", () => {
  it("re-exports engine and execution entry points", () => {
    expect(typeof runtime.createCoordinationRuntime).toBe("function");
    expect(typeof runtime.createAdmissionGateway).toBe("function");
    expect(typeof runtime.createReplayVerifier).toBe("function");
    expect(typeof runtime.ingestObservation).toBe("function");
    expect(typeof runtime.validateCommitContentAvailability).toBe("function");
  });

  it("exposes memory subpath implementations", () => {
    expect(typeof memory.MemoryCollaborationStore).toBe("function");
    expect(typeof memory.MemoryChangeLog).toBe("function");
    expect(typeof memory.MemoryResourceLockTable).toBe("function");
    expect(typeof memory.readFileRuntimeIdentity).toBe("function");
    expect(typeof memory.readFileRuntimeActiveBinding).toBe("function");
    expect(typeof memory.createPostgresDurableCoordinator).toBe("function");
    expect(typeof memory.createDurableCoordinatorFromEnv).toBe("function");
    expect(typeof memory.resolveProductionDurable).toBe("function");
    expect(typeof memory.createPostgresSqlExecutor).toBe("function");
    expect(typeof memory.probePostgresHa).toBe("function");
    expect(typeof memory.assertPostgresHa).toBe("function");
    expect(typeof memory.createRaftDurableCoordinator).toBe("function");
    expect(typeof memory.createMemoryRaftKv).toBe("function");
    expect(typeof memory.createRaftDurableFromEnv).toBe("function");
    expect(typeof memory.probeRaftCluster).toBe("function");
    expect(typeof memory.assertRaftCluster).toBe("function");
  });
});
