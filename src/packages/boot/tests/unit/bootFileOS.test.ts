import { describe, it, expect, vi, beforeEach } from "vitest";
import { join } from "node:path";
import { createMemoryContentStore } from "@cantilune/content/memory";
import { createMemoryRuntimePersistence, MemoryResourceLockTable } from "@cantilune/runtime/memory";
import type * as RuntimeMemory from "@cantilune/runtime/memory";
import { collaborationSnapshot, snapshotRef, epochId, participant, actorId } from "@cantilune/core";
import type { LlmChatResponse } from "../../src/types.js";
import { mockLlmConfig } from "../support/mockLlmConfig.js";

const createFileRuntimePersistenceMock = vi.fn();
const createFileContentStoreMock = vi.fn();

vi.mock("@cantilune/runtime/memory", async (importOriginal) => {
  const actual = await importOriginal<typeof RuntimeMemory>();
  return {
    ...actual,
    createFileRuntimePersistence: (...args: unknown[]) => createFileRuntimePersistenceMock(...args),
  };
});

vi.mock("@cantilune/content/file", () => ({
  createFileContentStore: (...args: unknown[]) => createFileContentStoreMock(...args),
}));

import { bootFileOS } from "../../src/bootCantilune.js";

function doneAdapter() {
  return {
    async chat(): Promise<LlmChatResponse> {
      return {
        text: undefined,
        toolCalls: [{ id: "tc-1", name: "done", arguments: { summary: "File boot done." } }],
        finishReason: "tool_calls" as const,
      };
    },
  };
}

function setupFileMocks(): { locks: MemoryResourceLockTable } {
  const bootParticipantId = actorId("file-test-agent");
  const t0 = collaborationSnapshot({
    snapshotRef: snapshotRef("snap-0"),
    epochId: epochId("boot-epoch-1"),
    participants: new Map([[bootParticipantId, participant(bootParticipantId, "agent")]]),
  });
  const memoryPersistence = createMemoryRuntimePersistence({ initial: t0 });
  const locks = new MemoryResourceLockTable();
  createFileRuntimePersistenceMock.mockReturnValue({
    ...memoryPersistence,
    locks,
    dir: "/mock/runtime",
    t0Ref: t0.snapshotRef,
  });
  createFileContentStoreMock.mockReturnValue(createMemoryContentStore());
  return { locks };
}

describe("bootFileOS", () => {
  beforeEach(() => {
    createFileRuntimePersistenceMock.mockReset();
    createFileContentStoreMock.mockReset();
    setupFileMocks();
  });

  it("creates file persistence and content store under storagePath", async () => {
    const os = bootFileOS(doneAdapter(), {
      storagePath: "/data/cantilune",
      llm: mockLlmConfig,
      principalId: "file-test-agent",
      history: {
        messages: [{ role: "user", content: "prior file-world request" }],
        pendingToolObservations: [],
      },
    });
    expect(createFileRuntimePersistenceMock).toHaveBeenCalledWith({
      dir: join("/data/cantilune", "runtime"),
      initial: expect.objectContaining({
        snapshotRef: expect.stringMatching(/^genesis-[0-9a-f-]{36}$/u),
      }),
    });
    expect(createFileContentStoreMock).toHaveBeenCalledWith(join("/data/cantilune", "content"));

    const result = await os.run("Persist this");
    expect(result.ok).toBe(true);
    expect(result.summary).toBe("File boot done.");
    await expect(os.shutdown()).resolves.toBeUndefined();
  });

  it("throws when storagePath is missing", () => {
    expect(() => bootFileOS(doneAdapter(), { storagePath: "", llm: mockLlmConfig })).toThrow(
      /storagePath/,
    );
  });

  it("passes FileResourceLockTable locks to coordination runtime", () => {
    const { locks } = setupFileMocks();
    bootFileOS(doneAdapter(), {
      storagePath: "/tmp/cantilune",
      llm: mockLlmConfig,
      principalId: "file-test-agent",
    });
    const persistence = createFileRuntimePersistenceMock.mock.results[0]?.value as {
      locks: MemoryResourceLockTable;
    };
    expect(persistence.locks).toBe(locks);
  });
});
