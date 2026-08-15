// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createEmptySession } from "../../src/store.js";
import type { SessionWorldBinding } from "../../src/tui/hooks/useSession.js";

const identityRead = vi.hoisted(() => vi.fn());

vi.mock("@cantilune/runtime/memory", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, readFileRuntimeIdentity: identityRead };
});

import { useSession } from "../../src/tui/hooks/useSession.js";

describe("session persistence generation race", () => {
  it("quarantines the transcript if durable genesis changes across the atomic session write", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "cantilune-session-race-"));
    const world: SessionWorldBinding = {
      durable: "file",
      storagePath: path.join(dir, "world"),
      principalId: "agent-a",
      genesisRef: "genesis-old",
    };
    identityRead
      .mockReturnValueOnce({ genesisRef: "genesis-old" })
      .mockReturnValueOnce({ genesisRef: "genesis-replacement" });

    const hook = renderHook(() => useSession(dir));
    await waitFor(() => expect(hook.result.current.loaded).toBe(true));
    let caught: unknown;
    await act(async () => {
      try {
        await hook.result.current.save(
          {
            ...createEmptySession(),
            messages: [{ role: "user", content: "must be quarantined", timestamp: 1 }],
          },
          { messages: [], pendingToolObservations: [] },
          world,
        );
      } catch (error) {
        caught = error;
      }
    });
    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toContain("generation changed");

    const persisted = JSON.parse(
      await readFile(path.join(dir, ".cantilune", "session.json"), "utf8"),
    ) as Record<string, unknown>;
    expect(persisted).toEqual({ version: 3, revision: 1, invalidated: true });
    expect(hook.result.current.world).toBeNull();
    expect(hook.result.current.restoreFor(world)).toBeNull();

    hook.unmount();
    vi.restoreAllMocks();
    await rm(dir, { recursive: true, force: true });
  });
});
