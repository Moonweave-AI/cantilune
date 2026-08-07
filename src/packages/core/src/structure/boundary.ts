import type {
  ActorId,
  ArtifactId,
  CapabilityId,
  LinkId,
  SessionId,
} from "../primitives/ids.js";

/** Typed port on an open composition boundary. */
export interface Port {
  readonly name: string;
  readonly typeTag: string;
}

export function port(name: string, typeTag: string): Port {
  return { name, typeTag };
}

/** Exposed ports of an open sub-composition (DPO interface J). */
export interface Interface {
  readonly ports: readonly Port[];
}

export function interfacePorts(ports: readonly Port[]): Interface {
  return { ports };
}

/** Set of entity ids touched by one intent or change — used for isolation checks. */
export interface Footprint {
  readonly artifactIds: ReadonlySet<ArtifactId>;
  readonly participantIds: ReadonlySet<ActorId>;
  readonly sessionIds: ReadonlySet<SessionId>;
  readonly capabilityIds: ReadonlySet<CapabilityId>;
  readonly linkIds: ReadonlySet<LinkId>;
}

export function emptyFootprint(): Footprint {
  return {
    artifactIds: new Set(),
    participantIds: new Set(),
    sessionIds: new Set(),
    capabilityIds: new Set(),
    linkIds: new Set(),
  };
}

export function footprint(init: Partial<{
  artifactIds: Iterable<ArtifactId>;
  participantIds: Iterable<ActorId>;
  sessionIds: Iterable<SessionId>;
  capabilityIds: Iterable<CapabilityId>;
  linkIds: Iterable<LinkId>;
}>): Footprint {
  return {
    artifactIds: new Set(init.artifactIds ?? []),
    participantIds: new Set(init.participantIds ?? []),
    sessionIds: new Set(init.sessionIds ?? []),
    capabilityIds: new Set(init.capabilityIds ?? []),
    linkIds: new Set(init.linkIds ?? []),
  };
}

export function mergeFootprints(a: Footprint, b: Footprint): Footprint {
  return footprint({
    artifactIds: [...a.artifactIds, ...b.artifactIds],
    participantIds: [...a.participantIds, ...b.participantIds],
    sessionIds: [...a.sessionIds, ...b.sessionIds],
    capabilityIds: [...a.capabilityIds, ...b.capabilityIds],
    linkIds: [...a.linkIds, ...b.linkIds],
  });
}

/** Input-side boundary binding for an open composition. */
export interface Goal {
  readonly bindings: readonly PortBinding[];
}

/** Output-side boundary binding for an open composition. */
export interface Outcome {
  readonly bindings: readonly PortBinding[];
}

export interface PortBinding {
  readonly port: Port;
  readonly ref: string;
}

export function portBinding(portValue: Port, ref: string): PortBinding {
  return { port: portValue, ref };
}

export function goal(bindings: readonly PortBinding[]): Goal {
  return { bindings };
}

export function outcome(bindings: readonly PortBinding[]): Outcome {
  return { bindings };
}
