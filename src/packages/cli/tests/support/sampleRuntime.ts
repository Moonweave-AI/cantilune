import type { RuntimeState } from "../../src/store.js";

export const sampleRuntime: RuntimeState = {
  snapshot: {
    snapshotRef: "snap:t1",
    epochId: "epoch:e1",
    participants: [
      { id: "actor:planner", kind: "agent", status: "active" },
      { id: "actor:coder", kind: "agent", status: "active" },
      { id: "actor:reviewer", kind: "agent", status: "idle" },
      { id: "actor:user", kind: "human", status: "observing" },
    ],
    artifacts: [
      { id: "art:task-001", kind: "task", lifecycle: "in_progress" },
      { id: "art:spec-002", kind: "spec", lifecycle: "published" },
      { id: "art:patch-003", kind: "patch", lifecycle: "draft" },
    ],
    sessions: [
      { id: "sess:main", initiator: "actor:planner", status: "private" },
      { id: "sess:fork-a", initiator: "actor:coder", status: "private" },
    ],
    capabilities: [
      { id: "cap:write_lock", kind: "write_lock", holder: "actor:coder" },
      { id: "cap:read_spec", kind: "read", holder: "actor:planner" },
      { id: "cap:commit", kind: "commit", holder: "actor:planner" },
    ],
    links: [
      { from: "art:task-001", to: "art:spec-002", kind: "depends_on" },
      { from: "art:patch-003", to: "art:task-001", kind: "implements" },
      { from: "actor:planner", to: "sess:main", kind: "delegates_to" },
    ],
    auditTail: [
      {
        source: "actor:user",
        payloadRef: "sha256:abc",
        timestamp: new Date(Date.now() - 50_000).toISOString(),
      },
      {
        source: "actor:planner",
        payloadRef: "sha256:def",
        timestamp: new Date(Date.now() - 40_000).toISOString(),
      },
    ],
    retired: [
      { id: "actor:scout", kind: "participant", retiredAt: "2026-08-10T14:22:00Z" },
      { id: "art:task-000", kind: "artifact", retiredAt: "2026-08-09T09:15:00Z" },
    ],
  },
  changeLog: [
    {
      changeId: "chg:obs-001",
      operationTypeId: "observe",
      initiator: "actor:user",
      beforeRef: "snap:t0",
      afterRef: "snap:t1",
      timestamp: new Date(Date.now() - 45_000).toISOString(),
    },
    {
      changeId: "chg:plan-002",
      operationTypeId: "introduce_artifact",
      initiator: "actor:planner",
      beforeRef: "snap:t1",
      afterRef: "snap:t2",
      timestamp: new Date(Date.now() - 30_000).toISOString(),
    },
    {
      changeId: "chg:code-003",
      operationTypeId: "publish_artifact",
      initiator: "actor:coder",
      beforeRef: "snap:t2",
      afterRef: "snap:t3",
      timestamp: new Date(Date.now() - 15_000).toISOString(),
    },
    {
      changeId: "chg:commit-004",
      operationTypeId: "commit_change",
      initiator: "actor:planner",
      beforeRef: "snap:t3",
      afterRef: "snap:t4",
      timestamp: new Date(Date.now() - 5_000).toISOString(),
    },
  ],
  epoch: {
    epochId: "epoch:e1",
    ordinal: 1,
    schemaId: "orch-schema-v1",
  },
};

export const emptyRuntime: RuntimeState = {
  snapshot: null,
  changeLog: [],
  epoch: null,
};
