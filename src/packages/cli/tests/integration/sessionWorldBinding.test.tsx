// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { collaborationSnapshot, epochId, snapshotRef } from "@cantilune/core";
import { createFileRuntimePersistence } from "@cantilune/runtime/memory";
import { createEmptySession } from "../../src/store.js";
import { createSessionWorldBinding, useSession } from "../../src/tui/hooks/useSession.js";
import type { AgentLoopHistory } from "@cantilune/boot";

const exactHistory: AgentLoopHistory = {
  messages: [
    { role: "user", content: "write the report" },
    {
      role: "assistant",
      content: "",
      toolCalls: [{ id: "write-1", name: "write_content", arguments: '{"content":"report"}' }],
    },
    {
      role: "tool",
      toolCallId: "write-1",
      content:
        "Written. ref=sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    },
  ],
  pendingToolObservations: [
    {
      toolName: "shell",
      originalToolCallId: "external-1",
      argumentsDigest: "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      outputRef: "sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc" as never,
      receiptRef:
        "sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd" as never,
    },
  ],
};

function initializeFileWorld(storagePath: string, genesisRef: string): void {
  createFileRuntimePersistence({
    dir: path.join(storagePath, "runtime"),
    initial: collaborationSnapshot({
      snapshotRef: snapshotRef(genesisRef),
      epochId: epochId("epoch-a"),
    }),
  });
}

describe("private transcript world binding", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("round-trips only into the exact durable path and principal world", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "cantilune-session-binding-"));
    const worldPath = path.join(dir, "world-a");
    const otherWorldPath = path.join(dir, "world-b");
    initializeFileWorld(worldPath, "genesis-a");
    initializeFileWorld(otherWorldPath, "genesis-b");
    const world = createSessionWorldBinding({
      durable: "file",
      storagePath: worldPath,
      principalId: "agent-a",
    })!;
    const otherPath = createSessionWorldBinding({
      durable: "file",
      storagePath: otherWorldPath,
      principalId: "agent-a",
    })!;
    const otherPrincipal = createSessionWorldBinding({
      durable: "file",
      storagePath: worldPath,
      principalId: "agent-b",
    })!;
    const ephemeralRestart = createSessionWorldBinding({
      durable: "memory",
      storagePath: worldPath,
      principalId: "agent-a",
    });
    expect(ephemeralRestart).toBeNull();

    const first = renderHook(() => useSession(dir));
    await waitFor(() => expect(first.result.current.loaded).toBe(true));
    const saved = {
      ...createEmptySession(),
      turnCount: 3,
      messages: [
        {
          role: "user" as const,
          content: "private world-a prompt",
          timestamp: 1,
        },
      ],
    };
    await act(async () => {
      await first.result.current.save(saved, exactHistory, world);
    });
    first.unmount();

    const onDisk = JSON.parse(
      await readFile(path.join(dir, ".cantilune", "session.json"), "utf8"),
    ) as Record<string, unknown>;
    expect(onDisk).toMatchObject({
      version: 3,
      world: {
        durable: "file",
        storagePath: world.storagePath,
        principalId: "agent-a",
        genesisRef: "genesis-a",
      },
    });

    const resumed = renderHook(() => useSession(dir));
    await waitFor(() => expect(resumed.result.current.loaded).toBe(true));
    expect(resumed.result.current.restoreFor(world)?.session.messages[0]?.content).toBe(
      "private world-a prompt",
    );
    expect(resumed.result.current.restoreFor(world)?.history).toEqual(exactHistory);
    expect(resumed.result.current.restoreFor(otherPath)).toBeNull();
    expect(resumed.result.current.restoreFor(otherPrincipal)).toBeNull();
    // Same principal/path after an ephemeral restart is still a different
    // coordination world and therefore cannot authorize transcript recovery.
    expect(resumed.result.current.restoreFor(ephemeralRestart)).toBeNull();

    resumed.unmount();
    await rm(dir, { recursive: true, force: true });
  });

  it("rejects an old transcript when the same path and principal now hold a replacement genesis", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "cantilune-session-generation-"));
    const worldPath = path.join(dir, "world");
    initializeFileWorld(worldPath, "genesis-old");
    const oldWorld = createSessionWorldBinding({
      durable: "file",
      storagePath: worldPath,
      principalId: "same-agent",
    })!;

    const first = renderHook(() => useSession(dir));
    await waitFor(() => expect(first.result.current.loaded).toBe(true));
    await act(async () => {
      await first.result.current.save(
        {
          ...createEmptySession(),
          messages: [{ role: "user", content: "old-generation secret", timestamp: 1 }],
        },
        exactHistory,
        oldWorld,
      );
    });
    first.unmount();

    await rm(path.join(worldPath, "runtime"), { recursive: true, force: true });
    initializeFileWorld(worldPath, "genesis-replacement");
    const replacementWorld = createSessionWorldBinding({
      durable: "file",
      storagePath: worldPath,
      principalId: "same-agent",
    })!;
    expect(replacementWorld).toMatchObject({
      storagePath: oldWorld.storagePath,
      principalId: oldWorld.principalId,
      genesisRef: "genesis-replacement",
    });
    expect(replacementWorld.genesisRef).not.toBe(oldWorld.genesisRef);

    const resumed = renderHook(() => useSession(dir));
    await waitFor(() => expect(resumed.result.current.loaded).toBe(true));
    expect(resumed.result.current.restoreFor(replacementWorld)).toBeNull();
    await expect(
      resumed.result.current.save(
        {
          ...createEmptySession(),
          messages: [{ role: "user", content: "must not overwrite", timestamp: 2 }],
        },
        exactHistory,
        oldWorld,
      ),
    ).rejects.toThrow("current canonical file-world generation");

    resumed.unmount();
    await rm(dir, { recursive: true, force: true });
  });

  it("rejects a stale independent writer instead of overwriting a newer revision", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "cantilune-session-cas-"));
    const worldPath = path.join(dir, "world");
    initializeFileWorld(worldPath, "genesis-cas");
    const world = createSessionWorldBinding({
      durable: "file",
      storagePath: worldPath,
      principalId: "same-agent",
    })!;

    // Both hook instances load the same absent-file revision zero, just as two
    // independent CLI processes would before either one persists.
    const first = renderHook(() => useSession(dir));
    const stale = renderHook(() => useSession(dir));
    await waitFor(() => expect(first.result.current.loaded).toBe(true));
    await waitFor(() => expect(stale.result.current.loaded).toBe(true));

    await act(async () => {
      await first.result.current.save(
        {
          ...createEmptySession(),
          messages: [{ role: "user", content: "winning transcript", timestamp: 1 }],
        },
        exactHistory,
        world,
      );
    });

    await expect(
      stale.result.current.save(
        {
          ...createEmptySession(),
          messages: [{ role: "user", content: "stale overwrite", timestamp: 2 }],
        },
        exactHistory,
        world,
      ),
    ).rejects.toThrow("revision conflict");

    const persisted = JSON.parse(
      await readFile(path.join(dir, ".cantilune", "session.json"), "utf8"),
    ) as {
      readonly revision: number;
      readonly session: { readonly messages: readonly { readonly content: string }[] };
    };
    expect(persisted.revision).toBe(1);
    expect(persisted.session.messages[0]?.content).toBe("winning transcript");

    first.unmount();
    stale.unmount();
    await rm(dir, { recursive: true, force: true });
  });

  it("fails closed when v3 exact history is tampered", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "cantilune-session-tamper-"));
    const worldPath = path.join(dir, "world");
    initializeFileWorld(worldPath, "genesis-tamper");
    const world = createSessionWorldBinding({
      durable: "file",
      storagePath: worldPath,
      principalId: "agent-a",
    })!;
    const first = renderHook(() => useSession(dir));
    await waitFor(() => expect(first.result.current.loaded).toBe(true));
    await act(async () => {
      await first.result.current.save(createEmptySession(), exactHistory, world);
    });
    first.unmount();

    const file = path.join(dir, ".cantilune", "session.json");
    const envelope = JSON.parse(await readFile(file, "utf8")) as {
      history: { messages: { content: string }[] };
    };
    envelope.history.messages.at(-1)!.content = "forged ref";
    const { writeFile } = await import("node:fs/promises");
    await writeFile(file, JSON.stringify(envelope), "utf8");

    const resumed = renderHook(() => useSession(dir));
    await waitFor(() => expect(resumed.result.current.loaded).toBe(true));
    expect(resumed.result.current.loadError).toContain("integrity check failed");
    expect(resumed.result.current.restoreFor(world)).toBeNull();
    await expect(
      resumed.result.current.save(createEmptySession(), exactHistory, world),
    ).rejects.toThrow("integrity check failed");

    resumed.unmount();
    await rm(dir, { recursive: true, force: true });
  });

  it("migrates v2 only as safe user and assistant text", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "cantilune-session-v2-"));
    const worldPath = path.join(dir, "world");
    initializeFileWorld(worldPath, "genesis-v2");
    const world = createSessionWorldBinding({
      durable: "file",
      storagePath: worldPath,
      principalId: "agent-a",
    })!;
    const { mkdir, writeFile } = await import("node:fs/promises");
    await mkdir(path.join(dir, ".cantilune"), { recursive: true });
    await writeFile(
      path.join(dir, ".cantilune", "session.json"),
      JSON.stringify({
        version: 2,
        revision: 4,
        world,
        session: {
          ...createEmptySession(),
          messages: [
            { role: "user", content: "safe question", timestamp: 1 },
            {
              role: "system",
              content:
                "Written. ref=sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
              timestamp: 2,
              toolCalls: [{ id: "fake", name: "write_content", status: "done", args: {} }],
            },
            { role: "assistant", content: "safe answer", timestamp: 3 },
          ],
        },
      }),
      "utf8",
    );

    const resumed = renderHook(() => useSession(dir));
    await waitFor(() => expect(resumed.result.current.loaded).toBe(true));
    expect(resumed.result.current.loadError).toBeNull();
    expect(resumed.result.current.restoreFor(world)?.history).toEqual({
      messages: [
        { role: "user", content: "safe question" },
        { role: "assistant", content: "safe answer" },
      ],
      pendingToolObservations: [],
    });

    resumed.unmount();
    await rm(dir, { recursive: true, force: true });
  });
});
