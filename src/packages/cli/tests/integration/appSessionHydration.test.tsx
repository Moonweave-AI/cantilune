// @vitest-environment happy-dom
import React from "react";
import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type * as SessionHookModule from "../../src/tui/hooks/useSession.js";

const controls = vi.hoisted(() => {
  let resolveConfig!: (value: {
    provider: string;
    model: string;
    durable: "file";
    storagePath: string;
    principalId: string;
  }) => void;
  const configPromise = new Promise<{
    provider: string;
    model: string;
    durable: "file";
    storagePath: string;
    principalId: string;
  }>((resolve) => {
    resolveConfig = resolve;
  });
  return {
    configPromise,
    resolveConfig,
    save: vi.fn(async () => undefined),
  };
});

vi.mock("@cantilune/adapter", () => ({ listProviders: vi.fn(() => []) }));

vi.mock("../../src/config.js", () => ({
  loadConfig: vi.fn(() => controls.configPromise),
  ensureCliPrincipal: vi.fn(async (config: unknown) => config),
  updateConfig: vi.fn(async () => undefined),
}));

vi.mock("../../src/tui/hooks/useAgentLoop.js", () => ({
  useAgentLoop: vi.fn(() => ({
    running: false,
    start: vi.fn(async () => undefined),
    abort: vi.fn(),
    stop: vi.fn(),
    sessionWorld: vi.fn(() => null),
    privateHistory: vi.fn(() => null),
    isolateSession: vi.fn(async () => undefined),
  })),
}));

vi.mock("../../src/tui/hooks/useSession.js", async (importOriginal) => {
  const actual = await importOriginal<typeof SessionHookModule>();
  return {
    ...actual,
    createSessionWorldBinding: vi.fn((config: SessionHookModule.SessionWorldConfig) =>
      config.principalId === undefined
        ? null
        : {
            durable: "file" as const,
            storagePath: "C:\\verified-world",
            principalId: config.principalId,
            genesisRef: "genesis-a",
          },
    ),
    useSession: vi.fn(() => ({
      world: null,
      // Intentionally return a session even for the pre-config null binding:
      // App's configured gate, not this test double, must prevent early hydration.
      restoreFor: vi.fn(() => ({
        session: {
          messages: [
            {
              role: "user" as const,
              content: "persisted private transcript",
              timestamp: 1,
            },
          ],
          turnCount: 1,
          startTime: 1,
          tokenUsage: { prompt: 0, completion: 0, total: 0 },
          costUsd: 0,
        },
        history: {
          messages: [{ role: "user" as const, content: "persisted private transcript" }],
          pendingToolObservations: [],
        },
      })),
      save: controls.save,
      clear: vi.fn(async () => undefined),
      loaded: true,
      loadError: null,
    })),
  };
});

import { App } from "../../src/app.js";

describe("App private-session hydration", () => {
  it("does not hydrate a transcript until world configuration has completed", async () => {
    render(<App />);

    expect(screen.queryByText("persisted private transcript")).toBeNull();

    await act(async () => {
      controls.resolveConfig({
        provider: "openai",
        model: "gpt-4o",
        durable: "file",
        storagePath: "./world-a",
        principalId: "agent-a",
      });
      await controls.configPromise;
    });

    expect(await screen.findByText("persisted private transcript")).toBeTruthy();
  });
});
