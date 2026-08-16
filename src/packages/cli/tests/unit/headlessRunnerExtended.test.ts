import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  commitParticipantDone,
  headlessWorkspaceDir,
  parseHeadlessArgs,
  parsePositiveFlag,
  runHeadless,
  selectHeadlessSwarmMode,
  writeResult,
  writeSwarmTrace,
} from "../../src/headless/headlessRunner.js";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { RunResult } from "@cantilune/boot";
import { spyOnStdoutWrite, type StdoutWriteSpy } from "../support/stdoutSpy.js";

describe("headlessRunner extended", () => {
  let writeSpy: StdoutWriteSpy;

  beforeEach(() => {
    writeSpy = spyOnStdoutWrite();
  });

  afterEach(() => {
    writeSpy.mockRestore();
    vi.restoreAllMocks();
  });

  /**
   * Absent flags must stay absent so `headlessRunner` can fall back to the
   * persisted config; substituting a default here silently outranked whatever
   * `/provider` had last selected.
   */
  it("leaves provider and model unset when their flags are omitted", () => {
    const parsed = parseHeadlessArgs(["run", "task"]);
    expect(parsed.provider).toBeUndefined();
    expect(parsed.model).toBeUndefined();
    expect(parsed.json).toBe(false);
  });

  it("writes plain text summary when json disabled", async () => {
    const mockResult: RunResult = {
      ok: true,
      summary: "plain",
      turns: 1,
      elapsedMs: 5,
      producedRefs: [],
      operations: { committed: 0, rejected: 0 },
    };
    await runHeadless({
      instruction: "x",
      provider: "openai",
      model: "gpt-4o",
      json: false,
      boot: () => ({
        run: vi.fn(async () => mockResult),
        shutdown: vi.fn(async () => undefined),
      }),
    });
    expect(writeSpy).toHaveBeenCalledWith("plain\n");
  });

  it("parses isolation and instruction-file flags", () => {
    const parsed = parseHeadlessArgs([
      "--instruction-file",
      "TASK.md",
      "--storage-path",
      "C:/tmp/world",
      "--workspace",
      "C:/tmp/world",
      "--max-turns",
      "40",
      "--max-time-ms",
      "1000",
    ]);
    expect(parsed.instructionFile).toBe("TASK.md");
    expect(parsed.storagePath).toBe("C:/tmp/world");
    expect(parsed.maxTurns).toBe(40);
    expect(parsed.maxTimeMs).toBe(1000);
    expect(parseHeadlessArgs(["--max-turns", "nope"]).maxTurns).toBeUndefined();
    expect(parseHeadlessArgs(["--max-time-ms", "-1"]).maxTimeMs).toBeUndefined();
    expect(parsePositiveFlag(undefined)).toBeUndefined();
    expect(parsePositiveFlag("8")).toBe(8);
  });

  it("selects swarm mode and writes traces", async () => {
    expect(selectHeadlessSwarmMode("w1", { id: "i1" })).toBe("activate-registered-worker");
    expect(selectHeadlessSwarmMode(undefined, { id: "i1" })).toBe("initiator-with-supervisor");
    expect(headlessWorkspaceDir(undefined, undefined)).toBe(process.cwd());
    expect(headlessWorkspaceDir({ storagePath: "/os" }, "/ws")).toBe("/ws");
    writeSwarmTrace(undefined, [], {
      running: false,
      scheduler: { startedTotal: 0, completedTotal: 0, consumedTurns: 0 },
    });
    const dir = mkdtempSync(join(tmpdir(), "swarm-trace-"));
    writeSwarmTrace(dir, [{ kind: "agent_started" }, { kind: "agent_done" }], {
      running: false,
      scheduler: { startedTotal: 2, completedTotal: 1, consumedTurns: 9 },
    });
    expect(readFileSync(join(dir, "cluster-events.jsonl"), "utf8")).toContain("agent_started");
    expect(JSON.parse(readFileSync(join(dir, "swarm-status.json"), "utf8")).agentStarted).toBe(1);
    writeSwarmTrace(dir, [], {
      running: false,
      scheduler: { startedTotal: 0, completedTotal: 0, consumedTurns: 0 },
    });
    const commits: unknown[] = [];
    commitParticipantDone(
      {
        proposeAndCommit: (intent, options) => {
          commits.push({ intent, options });
          return { ok: true };
        },
      },
      { id: "cli-initiator", kind: "agent" },
    );
    expect(commits).toHaveLength(1);
    const recorded = commits[0] as {
      intent: { operationTypeId: string; matchBindings: { role: string; actorId: string }[] };
    };
    expect(recorded.intent.operationTypeId).toBe("signal_done");
    expect(recorded.intent.matchBindings[0]?.actorId).toBe("cli-initiator");
    const resultDir = mkdtempSync(join(tmpdir(), "headless-result-"));
    writeResult(
      {
        ok: true,
        summary: "done",
        turns: 12,
        elapsedMs: 9,
        producedRefs: [],
        operations: { committed: 1, rejected: 0 },
      },
      true,
      resultDir,
    );
    const dumped = JSON.parse(readFileSync(join(resultDir, "result.json"), "utf8")) as {
      turns: number;
    };
    expect(dumped.turns).toBe(12);
    expect(writeSpy.mock.calls.some((call) => String(call[0]).includes("\n  "))).toBe(false);
  });
});
