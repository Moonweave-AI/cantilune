import type {
  ArtifactId,
  CapabilityId,
  ChangeId,
  EvidenceId,
  LinkId,
  SessionId,
  SnapshotRef,
} from "@cantilune/core";

export interface IdGenerator {
  changeId(): ChangeId;
  snapshotRef(): SnapshotRef;
  sessionId(): SessionId;
  linkId(): LinkId;
  artifactId(): ArtifactId;
  capabilityId(): CapabilityId;
  evidenceId(): EvidenceId;
}
