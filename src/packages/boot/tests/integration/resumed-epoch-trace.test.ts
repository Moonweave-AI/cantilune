import { describe, expect, it, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { actorId, collaborationSnapshot, epochId, participant, snapshotRef } from "@cantilune/core";
import { createFileRuntimePersistence } from "@cantilune/runtime/memory";
import { bootFileOS } from "../../src/bootCantilune.js";
import type { LlmAdapter, LlmChatResponse, LlmToolCallResult } from "../../src/types.js";
import { mockLlmConfig } from "../support/mockLlmConfig.js";

const dirs: string[] = [];

function storage(): string {
  const dir = mkdtempSync(join(tmpdir(), "cantilune-resumed-"));
  dirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/** Replays a fixed tool-call script, one call per turn, then finishes. */
function scriptedAdapter(script: readonly LlmToolCallResult[]): LlmAdapter {
  let turn = 0;
  return {
    async chat(request): Promise<LlmChatResponse> {
      const step = script[turn];
      turn++;
      let call =
        step ??
        ({ id: "d", name: "done", arguments: { summary: "ok" } } satisfies LlmToolCallResult);
      if (call.name === "introduce_artifact") {
        const writeResult = request.messages.find(
          (message) => message.role === "tool" && message.toolCallId === "3",
        );
        const ref = writeResult?.content.match(/ref=(\S+)/u)?.[1];
        if (ref !== undefined) {
          call = { ...call, arguments: { ...call.arguments, contentRef: ref } };
        }
      }
      return { text: undefined, toolCalls: [call], finishReason: "tool_calls" };
    },
  };
}

/**
 * A world written by a build that stamped a per-process random epoch. Resuming
 * it is the case that broke: the boot epoch this build would pick disagrees
 * with what is on disk, and admission compares the two.
 */
function seedForeignEpochWorld(
  storagePath: string,
  pid: string,
  worldEpoch = "boot-epoch-3dd1b913",
): void {
  const aid = actorId(pid);
  createFileRuntimePersistence({
    dir: join(storagePath, "runtime"),
    initial: collaborationSnapshot({
      snapshotRef: snapshotRef("snap-0"),
      epochId: epochId(worldEpoch),
      participants: new Map([[aid, participant(aid, "agent")]]),
    }),
  });
}

describe("a world resumed under a foreign epoch stays operable", () => {
  it("does not treat an incident-shaped epoch name as schema proof", () => {
    const dir = storage();
    const pid = "legacy-unreviewed-agent";
    seedForeignEpochWorld(dir, pid);

    expect(() =>
      bootFileOS(scriptedAdapter([]), {
        llm: mockLlmConfig,
        storagePath: dir,
        principalId: pid,
      }),
    ).toThrow(/not bound to head snapshot epoch/);
  });

  it("refuses to attach the boot schema to an unrelated governed epoch", () => {
    const dir = storage();
    const pid = "governed-agent";
    seedForeignEpochWorld(dir, pid, "governed-schema-epoch-2");

    expect(() =>
      bootFileOS(scriptedAdapter([]), {
        llm: mockLlmConfig,
        storagePath: dir,
        principalId: pid,
      }),
    ).toThrow(/not bound to head snapshot epoch/);
  });

  it("admits the full coordination trace that previously failed on every op", async () => {
    const dir = storage();
    const pid = "boot-06864291";
    seedForeignEpochWorld(dir, pid);

    // The sequence from the incident: coordination operations interleaved with
    // content writes, which advance the head through `observe` without
    // recording a change.
    const script: LlmToolCallResult[] = [
      { id: "1", name: "create_session", arguments: { from: pid } },
      { id: "2", name: "fork_branch", arguments: { from: pid } },
      {
        id: "3",
        name: "write_content",
        arguments: { content: "Initial content for swarm design analysis", mimeType: "text/plain" },
      },
      {
        id: "4",
        name: "introduce_artifact",
        arguments: { from: pid, task: "swarm-design-analysis" },
      },
      { id: "5", name: "register_participant", arguments: { from: pid, participant: "worker-a" } },
      {
        id: "6",
        name: "emit_heartbeat",
        arguments: { from: pid, turnCount: "5", lastAction: "register_participant" },
      },
    ];

    const os = bootFileOS(scriptedAdapter(script), {
      llm: mockLlmConfig,
      storagePath: dir,
      principalId: pid,
      compatibleEpochIds: ["boot-epoch-3dd1b913"],
      maxTurns: script.length + 2,
    });

    const failures: { name: string; output: string }[] = [];
    const succeeded: string[] = [];
    const result = await os.run("Design an agent swarm and analyse the coordination logic", {
      onEvent: (event) => {
        if (event.kind !== "tool_end") return;
        if (event.ok) succeeded.push(event.name);
        else failures.push({ name: event.name, output: event.output });
      },
    });
    await os.shutdown();

    expect(result.ok).toBe(true);
    expect(result.turns).toBe(script.length + 1);
    expect(result.operations).toEqual({ committed: 5, rejected: 0 });
    expect(result.toolCalls).toEqual({
      total: script.length + 1,
      succeeded: script.length + 1,
      failed: 0,
      unresolved: 0,
    });
    expect(failures).toEqual([]);
    for (const step of script) {
      expect(succeeded).toContain(step.name);
    }
  });

  it("keeps the heartbeat it committed after the world is reloaded from disk", async () => {
    const dir = storage();
    const pid = "beating-agent";
    seedForeignEpochWorld(dir, pid);

    const first = bootFileOS(
      scriptedAdapter([
        {
          id: "1",
          name: "emit_heartbeat",
          arguments: { from: pid, turnCount: "9", lastAction: "resume" },
        },
      ]),
      {
        llm: mockLlmConfig,
        storagePath: dir,
        principalId: pid,
        compatibleEpochIds: ["boot-epoch-3dd1b913"],
        maxTurns: 3,
      },
    );
    const rejections: string[] = [];
    const result = await first.run("Prove liveness", {
      onEvent: (event) => {
        if (event.kind === "tool_end" && !event.ok) rejections.push(event.output);
      },
    });
    await first.shutdown();
    expect(result.ok).toBe(true);
    expect(result.turns).toBe(2);
    expect(result.operations).toEqual({ committed: 1, rejected: 0 });
    expect(result.toolCalls?.failed).toBe(0);
    expect(rejections).toEqual([]);

    // Reload through the file codec, as a restarted supervisor would.
    const reloaded = createFileRuntimePersistence({ dir: join(dir, "runtime") });
    const head = reloaded.durable.head();
    const snapshot = head === undefined ? undefined : reloaded.durable.get(head);

    expect(snapshot?.heartbeatLog).toHaveLength(1);
    expect(snapshot?.heartbeatLog[0]?.agentId).toBe(pid);
  });
});
