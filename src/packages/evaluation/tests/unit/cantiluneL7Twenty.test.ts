import { describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  collectL7TwentyEvidence,
  composeL7TwentyInstruction,
  extractRunResultJson,
  createCantiluneL7TwentySuite,
  fingerprintSuiteSources,
  globHasMatch,
  isL7TaskId,
  listWorkspaceFiles,
  loadCantiluneL7TwentySuite,
  parseL7SuiteManifest,
  parseL7TaskCheckpoint,
  parseL7TwentyRunArgs,
  parsePositiveInt,
  planL7TwentyRun,
  posixRel,
  sha256File,
  workspaceHasForbiddenScorerName,
} from "../../src/corpus/cantiluneL7Twenty.js";

const repoRoot = resolve(fileURLToPath(new URL("../../../../../", import.meta.url)));
const suiteRoot = join(repoRoot, "eval/cantilune-l7-20");

describe("cantilune L7-20 suite loader", () => {
  it("loads twenty proposed tasks from the repo suite", () => {
    const suite = loadCantiluneL7TwentySuite(suiteRoot);
    expect(suite.tasks).toHaveLength(20);
    expect(suite.tasks.map((task) => task.id)).toEqual(
      Array.from({ length: 20 }, (_, index) => `T${String(index + 1).padStart(2, "0")}`),
    );
    expect(suite.benchmark.status).toBe("draft");
    expect(suite.manifest.runPolicy).toBe("serial-fail-closed");
    expect(createCantiluneL7TwentySuite(suiteRoot).tasks[0]?.id).toBe("T01");
    expect(suite.fingerprints["PROTOCOL.md"]).toBe(sha256File(join(suiteRoot, "PROTOCOL.md")));
  });

  it("rejects a missing suite root", () => {
    expect(() => loadCantiluneL7TwentySuite(join(suiteRoot, "missing"))).toThrow(
      /missing suite.manifest.json/,
    );
  });

  it("parses run args and plans a slice", () => {
    const args = parseL7TwentyRunArgs([
      "--provider",
      "dashscope",
      "--model",
      "qwen",
      "--base-url",
      "https://example.test",
      "--from",
      "T07",
      "--to",
      "T08",
      "--run-id",
      "r1",
      "--max-turns",
      "12",
      "--score-only",
      "C:/tmp/world",
      "--k",
      "3",
      "--plan-only",
    ]);
    expect(args).toMatchObject({
      provider: "dashscope",
      model: "qwen",
      fromId: "T07",
      toId: "T08",
      maxTurns: 12,
      planOnly: true,
      passAtK: 3,
    });
    const suite = loadCantiluneL7TwentySuite(suiteRoot);
    expect(planL7TwentyRun(suite.tasks, args).map((task) => task.id)).toEqual(["T07", "T08"]);
    expect(parsePositiveInt("0")).toBeUndefined();
    expect(parsePositiveInt(undefined)).toBeUndefined();
    expect(parseL7TwentyRunArgs(["--max-turns", "nope"]).maxTurns).toBeUndefined();
    expect(parseL7TwentyRunArgs(["--k", "nope"]).passAtK).toBe(1);
    expect(parseL7TwentyRunArgs(["--unknown"]).planOnly).toBe(false);
  });

  it("rejects empty or inverted run plans", () => {
    const suite = loadCantiluneL7TwentySuite(suiteRoot);
    expect(() => planL7TwentyRun([], {})).toThrow(/no tasks/);
    expect(() => planL7TwentyRun(suite.tasks, { fromId: "T99" })).toThrow(/unknown --from/);
    expect(() => planL7TwentyRun(suite.tasks, { toId: "T99" })).toThrow(/unknown --to/);
    expect(() => planL7TwentyRun(suite.tasks, { fromId: "T08", toId: "T07" })).toThrow(
      /after --to/,
    );
  });

  it("validates manifest and checkpoint shapes", () => {
    expect(() => parseL7SuiteManifest(null)).toThrow(/must be an object/);
    expect(() => parseL7SuiteManifest({ tasks: [] })).toThrow(/non-empty array/);
    expect(() =>
      parseL7SuiteManifest({
        suiteId: "x",
        suiteVersion: 1,
        protocolId: "p",
        status: "proposed",
        name: "n",
        claimRefs: "no",
        isolationRoot: "i",
        sourceRoot: "s",
        runPolicy: "serial-fail-closed",
        passAtK: 1,
        tasks: [{ id: "T01" }],
      }),
    ).toThrow(/claimRefs/);
    expect(() => parseL7TaskCheckpoint(null, "T01")).toThrow(/must be an object/);
    expect(() =>
      parseL7TaskCheckpoint(
        {
          taskId: "T02",
          failClosed: true,
          minPeers: 1,
          minTurns: 1,
          requireActivate: true,
          requireComms: true,
          requireObserve: true,
          forbidSelfScore: true,
          requiredArtifacts: [],
          requiredGlobs: [],
        },
        "T01",
      ),
    ).toThrow(/checkpoint.taskId/);
    expect(isL7TaskId("T20")).toBe(true);
    expect(isL7TaskId("T21")).toBe(false);
  });

  it("rejects unknown domain and network policy", () => {
    const base = {
      suiteId: "cantilune-l7-20",
      suiteVersion: 1,
      protocolId: "evaluation.protocol.cantilune-l7-20",
      status: "proposed",
      name: "n",
      claimRefs: ["evaluation.c1"],
      isolationRoot: "i",
      sourceRoot: "s",
      runPolicy: "serial-fail-closed",
      passAtK: 1,
    };
    expect(() =>
      parseL7SuiteManifest({
        ...base,
        tasks: [
          {
            id: "T01",
            slug: "x",
            domain: "magic",
            title: "t",
            minPeers: 1,
            minTurns: 1,
            requireComms: true,
            networkPolicy: "deny",
            filesystemPolicy: "workspace",
            engineeringTimeoutMs: 1,
          },
        ],
      }),
    ).toThrow(/known domain/);
    expect(() =>
      parseL7SuiteManifest({
        ...base,
        tasks: [
          {
            id: "T01",
            slug: "x",
            domain: "software",
            title: "t",
            minPeers: 1,
            minTurns: 1,
            requireComms: true,
            networkPolicy: "open",
            filesystemPolicy: "workspace",
            engineeringTimeoutMs: 1,
          },
        ],
      }),
    ).toThrow(/deny\|allowlist/);
    expect(() => parseL7SuiteManifest({ ...base, tasks: [null] })).toThrow(/must be an object/);
  });

  it("composes an instruction and lists workspace files", () => {
    const suite = loadCantiluneL7TwentySuite(suiteRoot);
    const t01 = suite.tasks[0]!;
    const t15 = suite.tasks.find((task) => task.id === "T15")!;
    expect(composeL7TwentyInstruction(t01)).toContain("create_session");
    expect(composeL7TwentyInstruction(t01)).toContain("operator/atom/evaluator");
    expect(composeL7TwentyInstruction(t01)).toContain("artifacts/legacy/");
    expect(composeL7TwentyInstruction(t15)).toContain(t15.brief.slice(0, 20));
    const dir = mkdtempSync(join(tmpdir(), "l7-20-ws-"));
    mkdirSync(join(dir, "runtime"), { recursive: true });
    mkdirSync(join(dir, "artifacts"), { recursive: true });
    writeFileSync(join(dir, "runtime", "durable.bundle.json"), "{}", "utf8");
    writeFileSync(join(dir, "artifacts", "a.md"), "ok", "utf8");
    expect(listWorkspaceFiles(dir)).toEqual(["artifacts/a.md"]);
    expect(listWorkspaceFiles(join(dir, "missing"))).toEqual([]);
    expect(globHasMatch(["artifacts/legacy/x.java"], "artifacts/legacy/**")).toBe(true);
    expect(globHasMatch(["artifacts/legacy"], "artifacts/legacy/**")).toBe(false);
    expect(globHasMatch(["artifacts/a.md"], "artifacts/a.md")).toBe(true);
    expect(workspaceHasForbiddenScorerName(["notes.md"])).toBe(false);
    expect(workspaceHasForbiddenScorerName(["artifacts/checkpoint.json"])).toBe(true);
    expect(posixRel(dir, join(dir, "artifacts", "a.md"))).toBe("artifacts/a.md");
  });

  it("collects evidence from workspace and eval-trace fallbacks", () => {
    const dir = mkdtempSync(join(tmpdir(), "l7-20-ev-"));
    mkdirSync(join(dir, "eval-trace"), { recursive: true });
    mkdirSync(join(dir, "os", "runtime"), { recursive: true });
    writeFileSync(
      join(dir, "eval-trace", "result.json"),
      JSON.stringify({
        ok: true,
        summary: "done",
        turns: 11,
        elapsedMs: 9,
        operations: { committed: 4, rejected: 0 },
      }),
      "utf8",
    );
    writeFileSync(
      join(dir, "eval-trace", "swarm-status.json"),
      JSON.stringify({
        running: false,
        scheduler: { startedTotal: 3, completedTotal: 3, consumedTurns: 12 },
      }),
      "utf8",
    );
    writeFileSync(join(dir, "os", "runtime", "durable.bundle.json"), "{}", "utf8");
    writeFileSync(
      join(dir, "eval-trace", "cluster-events.jsonl"),
      '{"kind":"agent_started"}\n',
      "utf8",
    );
    const evidence = collectL7TwentyEvidence({
      workspaceDir: dir,
      suiteRoot,
      taskId: "T01",
      suiteFingerprints: fingerprintSuiteSources(suiteRoot),
      principalId: "boot-a",
    });
    expect(evidence.result?.turns).toBe(11);
    expect(evidence.swarmStatus?.startedTotal).toBe(3);
    expect(evidence.durableBundlePath).toContain("durable.bundle.json");
    expect(evidence.clusterEventsPath).toContain("cluster-events.jsonl");
  });

  it("rejects broken on-disk suites", () => {
    const tasks = Array.from({ length: 20 }, (_, index) => {
      const id = `T${String(index + 1).padStart(2, "0")}`;
      return {
        id,
        slug: `task-${id.toLowerCase()}`,
        domain: "software",
        title: id,
        minPeers: 1,
        minTurns: 1,
        requireComms: false,
        networkPolicy: "deny",
        filesystemPolicy: "workspace",
        engineeringTimeoutMs: 1000,
      };
    });
    const writeSuite = (
      manifest: unknown,
      options: { skipBrief?: boolean; skipCheckpoint?: boolean } = {},
    ): string => {
      const root = mkdtempSync(join(tmpdir(), "l7-20-suite-"));
      writeFileSync(join(root, "suite.manifest.json"), JSON.stringify(manifest), "utf8");
      for (const task of (manifest as { tasks: typeof tasks }).tasks) {
        const folder = join(root, "tasks", `${task.id}-${task.slug}`);
        mkdirSync(folder, { recursive: true });
        if (options.skipBrief !== true) writeFileSync(join(folder, "brief.md"), "# b\n", "utf8");
        if (options.skipCheckpoint !== true) {
          writeFileSync(
            join(folder, "checkpoint.json"),
            JSON.stringify({
              taskId: task.id,
              failClosed: true,
              minPeers: 1,
              minTurns: 1,
              requireActivate: true,
              requireComms: false,
              requireObserve: true,
              forbidSelfScore: true,
              requiredArtifacts: [],
              requiredGlobs: [],
            }),
            "utf8",
          );
        }
      }
      return root;
    };
    const base = {
      suiteId: "cantilune-l7-20",
      suiteVersion: 1,
      protocolId: "evaluation.protocol.cantilune-l7-20",
      status: "proposed",
      name: "n",
      claimRefs: ["evaluation.c1"],
      isolationRoot: "i",
      sourceRoot: "s",
      runPolicy: "serial-fail-closed",
      passAtK: 1,
      tasks,
    };
    expect(() => loadCantiluneL7TwentySuite(writeSuite({ ...base, suiteId: "nope" }))).toThrow(
      /unexpected suiteId/,
    );
    expect(() => loadCantiluneL7TwentySuite(writeSuite({ ...base, protocolId: "nope" }))).toThrow(
      /unexpected protocolId/,
    );
    expect(() =>
      loadCantiluneL7TwentySuite(writeSuite({ ...base, tasks: tasks.slice(0, 2) })),
    ).toThrow(/must declare 20/);
    const dup = tasks.map((task, index) => (index === 1 ? { ...task, id: "T01" } : task));
    expect(() => loadCantiluneL7TwentySuite(writeSuite({ ...base, tasks: dup }))).toThrow(
      /duplicate task id/,
    );
    const invalidId = tasks.map((task, index) =>
      index === 0 ? { ...task, id: "T00", slug: "bad" } : task,
    );
    expect(() => loadCantiluneL7TwentySuite(writeSuite({ ...base, tasks: invalidId }))).toThrow(
      /invalid task id/,
    );
    expect(() => loadCantiluneL7TwentySuite(writeSuite(base, { skipBrief: true }))).toThrow(
      /missing brief/,
    );
    expect(() => loadCantiluneL7TwentySuite(writeSuite(base, { skipCheckpoint: true }))).toThrow(
      /missing checkpoint/,
    );
    expect(() =>
      parseL7SuiteManifest({
        suiteId: 1,
        suiteVersion: "x",
        protocolId: "p",
        status: "proposed",
        name: "n",
        claimRefs: ["evaluation.c1"],
        isolationRoot: "i",
        sourceRoot: "s",
        runPolicy: "serial-fail-closed",
        passAtK: 1,
        tasks: [tasks[0]],
      }),
    ).toThrow(/missing string suiteId/);
    expect(() =>
      parseL7TaskCheckpoint(
        {
          taskId: "T01",
          failClosed: "yes",
          minPeers: 1,
          minTurns: 1,
          requireActivate: true,
          requireComms: true,
          requireObserve: true,
          forbidSelfScore: true,
          requiredArtifacts: [],
          requiredGlobs: [],
        },
        "T01",
      ),
    ).toThrow(/missing boolean/);
    expect(() =>
      parseL7TaskCheckpoint(
        {
          taskId: "T01",
          failClosed: true,
          minPeers: 1,
          minTurns: 1,
          requireActivate: true,
          requireComms: true,
          requireObserve: true,
          forbidSelfScore: true,
          requiredArtifacts: [1],
          requiredGlobs: [],
        },
        "T01",
      ),
    ).toThrow(/missing string\[\]/);
    expect(() =>
      parseL7SuiteManifest({
        suiteId: "cantilune-l7-20",
        suiteVersion: Number.NaN,
        protocolId: "evaluation.protocol.cantilune-l7-20",
        status: "proposed",
        name: "n",
        claimRefs: ["evaluation.c1"],
        isolationRoot: "i",
        sourceRoot: "s",
        runPolicy: "serial-fail-closed",
        passAtK: 1,
        tasks: [
          {
            id: "T01",
            slug: "x",
            domain: "software",
            title: "t",
            minPeers: 1,
            minTurns: 1,
            requireComms: true,
            networkPolicy: "deny",
            filesystemPolicy: "workspace",
            engineeringTimeoutMs: 1,
          },
        ],
      }),
    ).toThrow(/missing number suiteVersion/);
  });

  it("composes the optional-comms line and fingerprints extras", () => {
    const suite = loadCantiluneL7TwentySuite(suiteRoot);
    const spec = {
      ...suite.tasks[0]!,
      checkpoint: { ...suite.tasks[0]!.checkpoint, requireComms: false },
    };
    expect(composeL7TwentyInstruction(spec)).toContain("按任务需要自决");
    const pretty = 'noise\n{\n  "ok": false,\n  "turns": 44,\n  "summary": "done"\n}\nELIFECYCLE\n';
    expect(extractRunResultJson(pretty)).toEqual({ ok: false, turns: 44, summary: "done" });
    expect(extractRunResultJson("no object here")).toBeUndefined();
    const extra = join(suiteRoot, "README.md");
    const prints = fingerprintSuiteSources(suiteRoot, [extra, join(suiteRoot, "missing.bin")]);
    expect(prints[extra]).toBe(sha256File(extra));
  });

  it("reads top-level swarm counters and partial result operations", () => {
    const dir = mkdtempSync(join(tmpdir(), "l7-20-partial-"));
    writeFileSync(
      join(dir, "result.json"),
      JSON.stringify({ ok: false, operations: { rejected: 2 } }),
      "utf8",
    );
    writeFileSync(
      join(dir, "swarm-status.json"),
      JSON.stringify({ startedTotal: 2, completedTotal: 1, consumedTurns: 4, agentStarted: 2 }),
      "utf8",
    );
    const evidence = collectL7TwentyEvidence({
      workspaceDir: dir,
      suiteRoot,
      taskId: "T01",
      suiteFingerprints: {},
    });
    expect(evidence.result?.operations?.rejected).toBe(2);
    expect(evidence.swarmStatus?.startedTotal).toBe(2);
    expect(evidence.swarmStatus?.agentStarted).toBe(2);
  });

  it("reads empty operation objects and scheduler-less swarm dumps", () => {
    const dir = mkdtempSync(join(tmpdir(), "l7-20-emptyops-"));
    writeFileSync(join(dir, "result.json"), JSON.stringify({ operations: {} }), "utf8");
    writeFileSync(join(dir, "swarm-status.json"), JSON.stringify({ running: true }), "utf8");
    const evidence = collectL7TwentyEvidence({
      workspaceDir: dir,
      suiteRoot,
      taskId: "T01",
      suiteFingerprints: {},
    });
    expect(evidence.result?.operations).toEqual({});
    expect(evidence.swarmStatus?.running).toBe(true);
    expect(evidence.swarmStatus?.startedTotal).toBeUndefined();
  });

  it("tolerates unreadable optional json dumps", () => {
    const dir = mkdtempSync(join(tmpdir(), "l7-20-badjson-"));
    writeFileSync(join(dir, "result.json"), "not-json", "utf8");
    writeFileSync(join(dir, "swarm-status.json"), "[]", "utf8");
    const evidence = collectL7TwentyEvidence({
      workspaceDir: dir,
      suiteRoot,
      taskId: "T01",
      suiteFingerprints: {},
    });
    expect(evidence.result).toBeUndefined();
    expect(evidence.swarmStatus).toBeUndefined();
  });
});
