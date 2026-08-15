import type {
  ArtifactId,
  CapabilityId,
  ChangeId,
  EvidenceId,
  LinkId,
  SessionId,
  SnapshotRef,
} from "@cantilune/core";
import type { IdGenerator } from "@cantilune/runtime";

export interface DeterministicIdConfig {
  readonly snapshotRefs?: readonly string[];
  readonly changeIds?: readonly string[];
  readonly sessionIds?: readonly string[];
  readonly linkIds?: readonly string[];
  readonly artifactIds?: readonly string[];
  readonly capabilityIds?: readonly string[];
  readonly evidenceIds?: readonly string[];
}

export function createDeterministicIdGenerator(config: DeterministicIdConfig = {}): IdGenerator {
  const counters = {
    snapshotRef: 0,
    changeId: 0,
    sessionId: 0,
    linkId: 0,
    artifactId: 0,
    capabilityId: 0,
    evidenceId: 0,
  };

  const next = <T extends keyof typeof counters>(pool: readonly string[] | undefined, key: T) => {
    const value = pool?.[counters[key]];
    counters[key] += 1;
    return value ?? `${key}-${String(counters[key])}`;
  };

  return {
    snapshotRef: () => next(config.snapshotRefs, "snapshotRef") as SnapshotRef,
    changeId: () => next(config.changeIds, "changeId") as ChangeId,
    sessionId: () => next(config.sessionIds, "sessionId") as SessionId,
    linkId: () => next(config.linkIds, "linkId") as LinkId,
    artifactId: () => next(config.artifactIds, "artifactId") as ArtifactId,
    capabilityId: () => next(config.capabilityIds, "capabilityId") as CapabilityId,
    evidenceId: () => next(config.evidenceIds, "evidenceId") as EvidenceId,
  };
}
