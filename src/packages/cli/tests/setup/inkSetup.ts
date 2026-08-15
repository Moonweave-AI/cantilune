import React from "react";
import { vi, afterEach } from "vitest";

export type InkInputHandler = (input: string, key: Record<string, boolean | undefined>) => void;

export const inkInputHandlers: InkInputHandler[] = [];

/**
 * Stand-in for the stdout stream Ink hands to `useStdout`.
 *
 * Defaults to absent, matching a non-TTY test runner. Tests that exercise
 * terminal-size behaviour swap in a fake stream via {@link setInkStdout}.
 */
export interface FakeStdout {
  columns?: number | undefined;
  rows?: number | undefined;
  on: (event: string, listener: () => void) => void;
  off: (event: string, listener: () => void) => void;
}

export const inkStdout: { current: FakeStdout | undefined } = { current: undefined };

export function setInkStdout(stdout: FakeStdout | undefined): void {
  inkStdout.current = stdout;
}

vi.mock("ink", () => ({
  Box: ({ children }: { children?: React.ReactNode }) =>
    React.createElement("div", { "data-testid": "ink-box" }, children),
  Text: ({ children }: { children?: React.ReactNode }) =>
    React.createElement("span", { "data-testid": "ink-text" }, children),
  useInput: (handler: InkInputHandler) => {
    inkInputHandlers.push(handler);
  },
  useApp: () => ({ exit: vi.fn(async () => undefined) }),
  useStdout: () => ({ stdout: inkStdout.current, write: vi.fn() }),
}));

/**
 * Unmount every rendered tree between tests.
 *
 * Without this, components holding timers (spinners, elapsed counters) keep
 * ticking after the environment is torn down, which surfaces as
 * "window is not defined" and prevents the runner from exiting.
 *
 * This setup file applies to every test, including pure-Node ones with no DOM,
 * so Testing Library is imported lazily and only when a document exists.
 */
afterEach(async () => {
  setInkStdout(undefined);
  if (typeof document === "undefined") return;
  const { cleanup } = await import("@testing-library/react");
  cleanup();
});
