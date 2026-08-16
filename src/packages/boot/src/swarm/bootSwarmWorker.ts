/**
 * Remote worker entry (ADR-0019 S4): LLM loop + NetTransport listen.
 * Intents commit via saga ports back to the supervisor host — no second mutator.
 */
import type { ActorId, AgentManifest } from "@cantilune/core";
import type { LlmAdapter } from "../types.js";
import type { MeshHostDirectory } from "../cluster/meshHostDirectory.js";
import { createDirectoryNetMeshRouter } from "../cluster/directoryNetMesh.js";

export interface BootSwarmWorkerConfig {
  readonly actorId: ActorId;
  readonly manifest: AgentManifest;
  readonly llmAdapter: LlmAdapter;
  readonly directory: MeshHostDirectory;
  readonly listenHost: string;
  readonly listenPort: number;
  readonly fingerprint?: string;
  /** Supervisor host entry actor id for routing commit intents. */
  readonly supervisorActorId: ActorId;
}

export interface SwarmWorkerHandle {
  readonly actorId: ActorId;
  readonly mesh: ReturnType<typeof createDirectoryNetMeshRouter>;
  start(): Promise<void>;
  stop(): Promise<void>;
}

/**
 * Boot a remote worker: publish listen coordinates into the mesh directory and
 * allocate a directory-backed Net mesh. The worker process never owns the
 * SyscallRuntime mutator — commits return through saga ports on the supervisor.
 */
export function bootSwarmWorker(config: BootSwarmWorkerConfig): SwarmWorkerHandle {
  let running = false;
  const mesh = createDirectoryNetMeshRouter({
    directory: config.directory,
    localActorId: config.actorId,
    listenHost: config.listenHost,
    listenPort: config.listenPort,
    role: "worker",
  });

  return {
    actorId: config.actorId,
    mesh,
    async start() {
      if (running) return;
      // Allocate so listen + directory publish runs.
      mesh.allocate(config.actorId);
      running = true;
    },
    async stop() {
      if (!running) return;
      mesh.deallocate(config.actorId);
      config.directory.remove(config.actorId);
      running = false;
    },
  };
}
