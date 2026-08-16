import type { CliObserveProjection } from "../../src/wiring/observeControl.js";
import type { CliReplayProjection } from "../../src/wiring/replayControl.js";

export const sampleObserveProjection: CliObserveProjection = {
  headRef: "snap:t1",
  sinceRef: "snap:t0",
  summary: [
    { lens: "dependency", nodes: 2, edges: 1 },
    { lens: "resource", nodes: 1, edges: 1 },
    { lens: "communication", nodes: 2, edges: 1 },
    { lens: "structure", nodes: 2, edges: 1 },
  ],
  dependency: {
    nodes: [
      { id: "art:task-001", label: "task" },
      { id: "art:spec-002", label: "spec" },
    ],
    edges: [{ from: "art:task-001", to: "art:spec-002", label: "depends_on" }],
  },
  resources: [{ resource: "write_lock", actor: "actor:coder", mode: "artifact" }],
  communication: {
    nodes: [
      { id: "sess:main", label: "private" },
      { id: "actor:planner", label: "controller" },
    ],
    edges: [{ from: "actor:planner", to: "sess:main", label: "private" }],
  },
  structure: {
    nodes: [
      { id: "art:task-001", label: "task" },
      { id: "art:spec-002", label: "spec" },
    ],
    edges: [{ from: "art:task-001", to: "art:spec-002", label: "depends_on" }],
  },
  spine: [
    {
      timestamp: Date.now() - 1000,
      label: "EventSpine[0] observe",
      kind: "spine",
    },
  ],
  diagnostic: "Diagnostics: participants=2 artifacts=1 sessions=1 capabilities=1 links=1 spine=1",
};

export const sampleReplayProjection: CliReplayProjection = {
  fromRef: "snap:t0",
  toRef: "snap:t4",
  ok: true,
  message: "replay verified → snap:t4 (4 steps)",
  steps: [
    {
      step: "1",
      op: "chg:obs-001",
      bindings: "before=snap:t0 after=snap:t1",
      changeId: "chg:obs-001",
    },
    {
      step: "2",
      op: "chg:plan-002",
      bindings: "before=snap:t1 after=snap:t2",
      changeId: "chg:plan-002",
    },
    {
      step: "3",
      op: "introduce_artifact",
      bindings: "before=snap:t2 after=snap:t3",
      changeId: "chg:code-003",
    },
  ],
  bundle: [
    { artifact: "fromRef", ref: "snap:t0" },
    { artifact: "terminalRef", ref: "snap:t4" },
    { artifact: "steps", ref: "4" },
    { artifact: "snapshot", ref: "snap:t4" },
  ],
  timeline: [
    { timestamp: Date.now(), label: "Apply chg:obs-001", kind: "replay" },
  ],
};
