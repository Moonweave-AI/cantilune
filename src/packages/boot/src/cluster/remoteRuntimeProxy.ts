/**
 * Remote runtime proxy: perceive/act/commit via comms saga ports on the
 * supervisor host. Does not invent a parallel RPC protocol.
 */
import type { ActorId } from "@cantilune/core";
import type { CoordinationRuntime } from "@cantilune/runtime";
import {
  createRuntimeCommsPorts,
  type RuntimeCommitPort,
  type RuntimeObservationPort,
} from "@cantilune/comms";

export interface RemoteRuntimeProxy {
  readonly actorId: ActorId;
  readonly observation: RuntimeObservationPort;
  readonly runtimeCommit: RuntimeCommitPort;
}

/**
 * Wrap supervisor-side runtime ports for a remote worker's actor. The worker
 * process never holds a SyscallRuntime mutator — all commits flow here.
 */
export function createRemoteRuntimeProxy(input: {
  readonly actorId: ActorId;
  readonly runtime: CoordinationRuntime;
}): RemoteRuntimeProxy {
  const ports = createRuntimeCommsPorts({ runtime: input.runtime });
  return {
    actorId: input.actorId,
    observation: ports.observation,
    runtimeCommit: ports.runtimeCommit,
  };
}
