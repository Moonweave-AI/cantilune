import { describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  fingerprintSuiteSources,
  loadCantiluneL7TwentySuite,
  type L7TaskEvidence,
  type L7TaskSpec,
} from "../../src/corpus/cantiluneL7Twenty.js";
import {
  clusterEventsMentionAgentStart,
  evaluateL7TwentyCheckpoint,
  evaluateNoSelfScore,
  looksLikeLecture,
  nextL7TwentyAction,
  parseDurableWorld,
  readDurableWorld,
  writeL7RepairMarkdown,
} from "../../src/corpus/evaluateL7TwentyCheckpoint.js";

const repoRoot = resolve(fileURLToPath(new URL("../../../../../", import.meta.url)));
const suiteRoot = join(repoRoot, "eval/cantilune-l7-20");

function passingBundle(initiator = "boot-a"): unknown {
  return {
    t0Ref: "t0",
    headRef: "h1",
    snapshots: [
      {
        snapshotRef: "t0",
        participants: [{ actorId: initiator, kind: "agent", status: "active" }],
        sessions: [],
        auditTail: [],
        heartbeatLog: [],
        transcripts: [],
      },
      {
        snapshotRef: "h1",
        participants: [
          { actorId: initiator, kind: "agent", status: "active" },
          { actorId: "peer-1", kind: "agent", status: "active" },
          { actorId: "peer-2", kind: "agent", status: "done" },
          { actorId: "peer-3", kind: "agent", status: "waiting" },
          { actorId: "tool-x", kind: "tool", status: "active" },
          { actorId: "ghost", kind: "agent", status: "registered" },
        ],
        sessions: [{ sessionId: "s1" }],
        auditTail: [{ entryId: "e1" }],
        heartbeatLog: [{ actorId: "peer-1" }, { from: "peer-2" }, { actorId: initiator }],
        transcripts: [{ actorId: initiator }, { actorId: "peer-1" }],
      },
    ],
    changes: [
      { operationTypeId: "register_participant" },
      { operationTypeId: "activate_participant" },
      { operationTypeId: "create_session" },
      { operationTypeId: "introduce_artifact" },
    ],
  };
}

function writePassingWorkspace(spec: L7TaskSpec): string {
  const dir = mkdtempSync(join(tmpdir(), "l7-20-pass-"));
  for (const artifact of spec.checkpoint.requiredArtifacts) {
    const full = join(dir, ...artifact.split("/"));
    mkdirSync(join(full, ".."), { recursive: true });
    writeFileSync(full, "wave-1\n", "utf8");
  }
  for (const pattern of spec.checkpoint.requiredGlobs) {
    const prefix = pattern.endsWith("/**") ? pattern.slice(0, -3) : pattern;
    const nested = join(dir, ...prefix.split("/"), "seed.txt");
    mkdirSync(join(nested, ".."), { recursive: true });
    writeFileSync(nested, "glob\n", "utf8");
  }
  mkdirSync(join(dir, "runtime"), { recursive: true });
  writeFileSync(
    join(dir, "runtime", "durable.bundle.json"),
    JSON.stringify(passingBundle()),
    "utf8",
  );
  writeFileSync(
    join(dir, "result.json"),
    JSON.stringify({
      ok: true,
      summary: "committed work",
      turns: spec.checkpoint.minTurns,
      operations: { committed: 4, rejected: 0 },
    }),
    "utf8",
  );
  writeFileSync(
    join(dir, "swarm-status.json"),
    JSON.stringify({ running: false, startedTotal: 3, consumedTurns: spec.checkpoint.minTurns }),
    "utf8",
  );
  writeFileSync(
    join(dir, "cluster-events.jsonl"),
    `${JSON.stringify({ kind: "agent_started" })}\n${JSON.stringify({ kind: "agent_done" })}\n`,
    "utf8",
  );
  return dir;
}

function evidenceFor(
  spec: L7TaskSpec,
  workspaceDir: string,
  extra: Partial<L7TaskEvidence> = {},
): L7TaskEvidence {
  return {
    workspaceDir,
    suiteRoot,
    taskId: spec.id,
    suiteFingerprints: fingerprintSuiteSources(suiteRoot),
    scorerSourcePaths: [],
    principalId: "boot-a",
    ...extra,
  };
}

describe("evaluateL7TwentyCheckpoint", () => {
  it("does not let a stdout-scrape placeholder zero out swarm turns", () => {
    const spec = loadCantiluneL7TwentySuite(suiteRoot).tasks[0]!;
    const workspaceDir = writePassingWorkspace(spec);
    writeFileSync(
      join(workspaceDir, "result.json"),
      JSON.stringify({ ok: false, summary: "no-json-result", turns: 0 }),
      "utf8",
    );
    writeFileSync(
      join(workspaceDir, "swarm-status.json"),
      JSON.stringify({ running: false, startedTotal: 2, consumedTurns: spec.checkpoint.minTurns }),
      "utf8",
    );
    const evaluation = evaluateL7TwentyCheckpoint(spec, evidenceFor(spec, workspaceDir));
    const horizon = evaluation.gates.find((gate) => gate.id === "horizon");
    expect(horizon?.passed).toBe(true);
    expect(horizon?.value).toBe(spec.checkpoint.minTurns);
  });

  it("measures a complete T01 wave-1 world", () => {
    const spec = loadCantiluneL7TwentySuite(suiteRoot).tasks[0]!;
    const workspaceDir = writePassingWorkspace(spec);
    const evaluation = evaluateL7TwentyCheckpoint(spec, evidenceFor(spec, workspaceDir));
    expect(evaluation.passed).toBe(true);
    expect(evaluation.decision).toBe("measured");
    expect(nextL7TwentyAction(evaluation)).toBe("continue");
    expect(evaluation.gates.every((gate) => gate.passed)).toBe(true);
  });

  it("stops and writes repair text on hard-gate failure", () => {
    const spec = loadCantiluneL7TwentySuite(suiteRoot).tasks[0]!;
    const dir = mkdtempSync(join(tmpdir(), "l7-20-fail-"));
    writeFileSync(
      join(dir, "result.json"),
      JSON.stringify({
        summary: "请运行 /swarm 来启动集群",
        turns: 1,
        operations: { committed: 0 },
      }),
      "utf8",
    );
    const evaluation = evaluateL7TwentyCheckpoint(spec, evidenceFor(spec, dir));
    expect(evaluation.passed).toBe(false);
    expect(evaluation.decision).toBe("notSupported");
    expect(nextL7TwentyAction(evaluation)).toBe("stop-repair");
    expect(writeL7RepairMarkdown(evaluation)).toContain("swarmFanout");
    expect(writeL7RepairMarkdown(evaluation)).toContain("PROTOCOL §6");
  });

  it("parses durable worlds and ignores unreadable bundles", () => {
    expect(parseDurableWorld(null, undefined)).toBeUndefined();
    expect(parseDurableWorld({ snapshots: [] }, undefined)).toBeUndefined();
    expect(parseDurableWorld({ snapshots: "no" }, undefined)).toBeUndefined();
    expect(
      parseDurableWorld({ snapshots: [null], headRef: "h", t0Ref: "t" }, undefined),
    ).toBeUndefined();
    const world = parseDurableWorld(passingBundle("cli-1"), undefined);
    expect(world?.peerCount).toBe(3);
    expect(world?.activateCount).toBe(1);
    expect(world?.sessionCount).toBe(1);
    expect(world?.heartbeatOthers).toBe(2);
    const skipped = parseDurableWorld(
      {
        t0Ref: "t0",
        headRef: "h1",
        snapshots: [
          { snapshotRef: "t0", participants: [{ actorId: "a", kind: "agent", status: "active" }] },
          { snapshotRef: "h1", participants: [null, { kind: "agent", status: "active" }] },
        ],
        changes: [null, { operationTypeId: 1 }, {}],
      },
      "a",
    );
    expect(skipped?.peerCount).toBe(0);
    expect(skipped?.changeCount).toBe(3);
    const dir = mkdtempSync(join(tmpdir(), "l7-20-bundle-"));
    mkdirSync(join(dir, "runtime"), { recursive: true });
    writeFileSync(join(dir, "runtime", "durable.bundle.json"), "not-json", "utf8");
    expect(
      readDurableWorld({
        workspaceDir: dir,
        suiteRoot,
        taskId: "T01",
        suiteFingerprints: {},
        scorerSourcePaths: [],
        durableBundlePath: join(dir, "runtime", "durable.bundle.json"),
      }),
    ).toBeUndefined();
    expect(
      readDurableWorld({
        workspaceDir: dir,
        suiteRoot,
        taskId: "T01",
        suiteFingerprints: {},
        scorerSourcePaths: [],
      }),
    ).toBeUndefined();
  });

  it("detects lecture, agent starts, and self-score rewrites", () => {
    expect(looksLikeLecture(undefined)).toBe(false);
    expect(looksLikeLecture("all good")).toBe(false);
    expect(looksLikeLecture("Please run /swarm")).toBe(true);
    const events = join(mkdtempSync(join(tmpdir(), "l7-20-ev-")), "events.jsonl");
    writeFileSync(events, 'noise\n{"kind":"agent_started"}\n', "utf8");
    expect(clusterEventsMentionAgentStart(undefined)).toBe(0);
    expect(clusterEventsMentionAgentStart(join(tmpdir(), "missing.jsonl"))).toBe(0);
    expect(clusterEventsMentionAgentStart(events)).toBe(1);

    const spec = loadCantiluneL7TwentySuite(suiteRoot).tasks[0]!;
    const dir = writePassingWorkspace(spec);
    writeFileSync(join(dir, "checkpoint.json"), "{}", "utf8");
    const fingerprints = fingerprintSuiteSources(suiteRoot);
    expect(
      evaluateNoSelfScore(
        {
          workspaceDir: dir,
          suiteRoot,
          taskId: "T01",
          suiteFingerprints: fingerprints,
          scorerSourcePaths: [],
        },
        ["checkpoint.json"],
      ).passed,
    ).toBe(false);
    expect(
      evaluateNoSelfScore(
        {
          workspaceDir: dir,
          suiteRoot,
          taskId: "T01",
          suiteFingerprints: { "PROTOCOL.md": "deadbeef" },
          scorerSourcePaths: [],
        },
        [],
      ).detail,
    ).toMatch(/rewritten/);
    expect(
      evaluateNoSelfScore(
        {
          workspaceDir: dir,
          suiteRoot,
          taskId: "T01",
          suiteFingerprints: { "gone.md": "abc" },
          scorerSourcePaths: [],
        },
        [],
      ).detail,
    ).toMatch(/missing after run/);
    const scorer = join(suiteRoot, "README.md");
    expect(
      evaluateNoSelfScore(
        {
          workspaceDir: dir,
          suiteRoot,
          taskId: "T01",
          suiteFingerprints: { [scorer]: "deadbeef" },
          scorerSourcePaths: [scorer],
        },
        [],
      ).detail,
    ).toMatch(/scorer source rewritten/);
    expect(
      evaluateNoSelfScore(
        {
          workspaceDir: dir,
          suiteRoot,
          taskId: "T01",
          suiteFingerprints: {},
          scorerSourcePaths: [join(suiteRoot, "missing-scorer.ts")],
        },
        [],
      ).detail,
    ).toMatch(/scorer source missing/);
  });

  it("fails escaped artifacts and optional gates when disabled", () => {
    const base = loadCantiluneL7TwentySuite(suiteRoot).tasks[0]!;
    const escaped: L7TaskSpec = {
      ...base,
      checkpoint: {
        ...base.checkpoint,
        requiredArtifacts: ["../outside.md"],
        requiredGlobs: ["artifacts/nope/**"],
        requireComms: false,
        requireObserve: false,
        requireActivate: false,
        forbidSelfScore: false,
        minPeers: 0,
        minTurns: 0,
      },
    };
    const dir = mkdtempSync(join(tmpdir(), "l7-20-opt-"));
    writeFileSync(
      join(dir, "result.json"),
      JSON.stringify({ turns: 0, operations: { committed: 1 } }),
      "utf8",
    );
    writeFileSync(join(dir, "swarm-status.json"), JSON.stringify({ startedTotal: 1 }), "utf8");
    const evaluation = evaluateL7TwentyCheckpoint(escaped, evidenceFor(escaped, dir));
    expect(evaluation.gates.find((gate) => gate.id === "comms")?.hard).toBe(false);
    expect(evaluation.gates.find((gate) => gate.id === "observe")?.hard).toBe(false);
    expect(evaluation.gates.find((gate) => gate.id === "noSelfScore")?.hard).toBe(false);
    expect(evaluation.gates.find((gate) => gate.id === "artifacts")?.passed).toBe(false);
    expect(evaluation.gates.find((gate) => gate.id === "wave1")?.detail).toContain("escapes");
  });

  it("labels a silent workspace as no tool/act", () => {
    const spec = loadCantiluneL7TwentySuite(suiteRoot).tasks[0]!;
    const dir = mkdtempSync(join(tmpdir(), "l7-20-silent-"));
    writeFileSync(
      join(dir, "result.json"),
      JSON.stringify({ summary: "thinking", turns: 0 }),
      "utf8",
    );
    const evaluation = evaluateL7TwentyCheckpoint(spec, evidenceFor(spec, dir));
    expect(evaluation.gates.find((gate) => gate.id === "notLecture")?.detail).toBe(
      "no tool/act and no artifacts",
    );
  });

  it("treats empty required files as missing", () => {
    const spec = loadCantiluneL7TwentySuite(suiteRoot).tasks[0]!;
    const dir = writePassingWorkspace(spec);
    writeFileSync(join(dir, spec.checkpoint.requiredArtifacts[0]!), "", "utf8");
    const evaluation = evaluateL7TwentyCheckpoint(spec, evidenceFor(spec, dir));
    expect(evaluation.gates.find((gate) => gate.id === "artifacts")?.passed).toBe(false);
  });
});
