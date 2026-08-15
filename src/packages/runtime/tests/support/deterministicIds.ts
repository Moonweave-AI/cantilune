import type {
  ArtifactId,
  CapabilityId,
  ChangeId,
  EvidenceId,
  LinkId,
  SessionId,
  SnapshotRef,
} from "@cantilune/core";
import type { IdGenerator } from "../../src/ports/idGenerator.js";

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

  function next(list: readonly string[] | undefined, key: keyof typeof counters, fallback: string) {
    const index = counters[key];
    counters[key] += 1;
    return (list?.[index] ?? `${fallback}-${index}`) as never;
  }

  return {
    snapshotRef: () => next(config.snapshotRefs, "snapshotRef", "snap-gen") as SnapshotRef,
    changeId: () => next(config.changeIds, "changeId", "chg-gen") as ChangeId,
    sessionId: () => next(config.sessionIds, "sessionId", "session-gen") as SessionId,
    linkId: () => next(config.linkIds, "linkId", "link-gen") as LinkId,
    artifactId: () => next(config.artifactIds, "artifactId", "artifact-gen") as ArtifactId,
    capabilityId: () => next(config.capabilityIds, "capabilityId", "cap-gen") as CapabilityId,
    evidenceId: () => next(config.evidenceIds, "evidenceId", "ev-gen") as EvidenceId,
  };
}
