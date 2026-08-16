/**
 * Bridges shared SyscallRuntime into per-agent production CommsServices deps.
 */
import { mkdirSync } from "node:fs";
import type { ActorId, CommunicationSession } from "@cantilune/core";
import {
  createCommsServices,
  createRuntimeCommsPorts,
  createProcessEStopGate,
  createProcessEventSink,
  createProcessReplayProtector,
  createFilePeerDirectory,
  createFileFreshAllocator,
  type CommsServices,
  type CommunicationTransport,
  type SessionAuthority,
} from "@cantilune/comms";
import type { SharedResources } from "./sharedResources.js";
import { commsStorePath } from "./sharedResources.js";
import { createActorIdIdentityVerifier } from "./actorIdIdentityVerifier.js";
import { createSessionParticipantAuthorizer } from "./sessionParticipantAuthorizer.js";

export interface AgentCommsHandle {
  readonly services: CommsServices;
  readonly storeDir: string;
  stop(): void;
}

function createSessionAuthority(shared: SharedResources): SessionAuthority {
  return {
    isController(sessionId, actor) {
      const head = shared.runtime.getHead() as
        { readonly sessions: ReadonlyMap<string, CommunicationSession> } | undefined;
      const session = head?.sessions.get(sessionId as string);
      return session !== undefined && (session.controller as string) === (actor.actorId as string);
    },
    isMember(sessionId, actor) {
      const head = shared.runtime.getHead() as
        { readonly sessions: ReadonlyMap<string, CommunicationSession> } | undefined;
      const session = head?.sessions.get(sessionId as string);
      if (session === undefined) return false;
      const id = actor.actorId as string;
      if ((session.controller as string) === id) return true;
      return session.participants.some((p) => (p as string) === id);
    },
  };
}

export function createAgentCommsServices(input: {
  readonly shared: SharedResources;
  readonly agentId: ActorId;
  readonly transport: CommunicationTransport;
}): AgentCommsHandle {
  const storeDir = commsStorePath(input.shared, input.agentId);
  mkdirSync(storeDir, { recursive: true });

  const ports = createRuntimeCommsPorts({
    runtime: input.shared.runtime as never,
  });

  const eStop = createProcessEStopGate();
  const events = createProcessEventSink();
  const sessionAuthority = createSessionAuthority(input.shared);

  const services = createCommsServices({
    mode: "production",
    transport: input.transport,
    storeDir,
    identity: createActorIdIdentityVerifier(),
    authorizer: createSessionParticipantAuthorizer(sessionAuthority),
    observation: ports.observation,
    runtimeCommit: ports.runtimeCommit,
    eStop,
    events,
    peerDirectory: createFilePeerDirectory(storeDir),
    freshAllocator: createFileFreshAllocator(storeDir),
    replay: createProcessReplayProtector(),
    bindingResolver: {
      getActiveBinding: () => undefined,
    },
    sessionAuthority,
    quiescence: {
      async resourcesClear() {
        return true;
      },
      async sessionsQuiescent() {
        return true;
      },
    },
  });

  return {
    services,
    storeDir,
    stop() {
      eStop.setFrozen(true);
    },
  };
}
