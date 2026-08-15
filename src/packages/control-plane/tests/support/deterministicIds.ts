import type { SnapshotRef } from "@cantilune/core";

interface TestIdGenerator {
  snapshotRef(): SnapshotRef;
  changeId(): never;
  sessionId(): never;
  linkId(): never;
  artifactId(): never;
  capabilityId(): never;
  evidenceId(): never;
}

export function createDeterministicIdGenerator(config?: {
  readonly snapshotRefs?: readonly string[];
}): TestIdGenerator {
  let snapshotIndex = 0;
  return {
    snapshotRef: () =>
      (config?.snapshotRefs?.[snapshotIndex++] ?? `snap-gen-${snapshotIndex}`) as SnapshotRef,
    changeId: () => `chg-gen-${snapshotIndex}` as never,
    sessionId: () => `session-gen-${snapshotIndex}` as never,
    linkId: () => `link-gen-${snapshotIndex}` as never,
    artifactId: () => `artifact-gen-${snapshotIndex}` as never,
    capabilityId: () => `capability-gen-${snapshotIndex}` as never,
    evidenceId: () => `evidence-gen-${snapshotIndex}` as never,
  };
}
