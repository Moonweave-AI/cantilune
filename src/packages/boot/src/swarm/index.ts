/**
 * Multi-agent swarm boot surface (ADR-0019 D2).
 */
export {
  bootSwarm,
  createCantiluneOsAgent,
  type BootSwarmDeps,
  type CantiluneSwarm,
  type SwarmStatus,
} from "./bootSwarm.js";
export {
  bootSwarmWorker,
  type BootSwarmWorkerConfig,
  type SwarmWorkerHandle,
} from "./bootSwarmWorker.js";
