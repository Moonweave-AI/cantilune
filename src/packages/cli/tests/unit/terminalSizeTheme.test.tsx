// @vitest-environment happy-dom
import { describe, it, expect, vi } from "vitest";
import { render, act } from "@testing-library/react";
import React from "react";
import { setInkStdout, type FakeStdout } from "../setup/inkSetup.js";
import { useTerminalSize } from "../../src/tui/hooks/useTerminalSize.js";
import { ThemeProvider, useTheme, resetAutoTheme } from "../../src/theme/themeContext.js";
import { createTheme, DEFAULT_THEME } from "../../src/theme/theme.js";

/** Minimal stdout double that records resize subscriptions. */
function fakeStdout(columns: number, rows: number): FakeStdout & { emit: () => void } {
  const listeners = new Set<() => void>();
  return {
    columns,
    rows,
    on: (_event, listener) => {
      listeners.add(listener);
    },
    off: (_event, listener) => {
      listeners.delete(listener);
    },
    emit: () => {
      for (const listener of listeners) listener();
    },
  };
}

function Probe({ onSize }: { onSize: (size: ReturnType<typeof useTerminalSize>) => void }) {
  onSize(useTerminalSize());
  return null;
}

describe("useTerminalSize", () => {
  it("falls back to a usable size when there is no TTY", () => {
    const seen: { columns: number; rows: number }[] = [];
    render(<Probe onSize={(size) => seen.push(size)} />);
    expect(seen.at(-1)).toEqual({ columns: 100, rows: 30 });
  });

  it("reads the current dimensions from the stream", () => {
    setInkStdout(fakeStdout(140, 48));
    const seen: { columns: number; rows: number }[] = [];
    render(<Probe onSize={(size) => seen.push(size)} />);
    expect(seen.at(-1)).toEqual({ columns: 140, rows: 48 });
  });

  it("falls back when the stream reports non-positive dimensions", () => {
    setInkStdout(fakeStdout(0, 0));
    const seen: { columns: number; rows: number }[] = [];
    render(<Probe onSize={(size) => seen.push(size)} />);
    expect(seen.at(-1)).toEqual({ columns: 100, rows: 30 });
  });

  it("re-reads dimensions when the terminal is resized", () => {
    const stdout = fakeStdout(80, 24);
    setInkStdout(stdout);
    const seen: { columns: number; rows: number }[] = [];
    render(<Probe onSize={(size) => seen.push(size)} />);
    expect(seen.at(-1)).toEqual({ columns: 80, rows: 24 });

    stdout.columns = 200;
    stdout.rows = 60;
    act(() => {
      stdout.emit();
    });
    expect(seen.at(-1)).toEqual({ columns: 200, rows: 60 });
  });

  it("unsubscribes on unmount so a resize cannot touch a dead tree", () => {
    const stdout = fakeStdout(80, 24);
    const off = vi.spyOn(stdout, "off");
    setInkStdout(stdout);
    const view = render(<Probe onSize={() => undefined} />);
    view.unmount();
    expect(off).toHaveBeenCalledOnce();
  });
});

function ThemeProbe({ onTheme }: { onTheme: (name: string) => void }) {
  onTheme(useTheme().name);
  return null;
}

/** Detection keys the test runner itself sets, which would otherwise dominate. */
const DETECTION_KEYS = ["CANTILUNE_THEME", "NO_COLOR", "FORCE_COLOR", "COLORFGBG"] as const;

/**
 * Run `body` against an isolated detection environment.
 *
 * The runner is invoked with `--no-color`, so `NO_COLOR` would force the mono
 * theme and mask whatever the test is actually asserting.
 */
function withDetectionEnv(env: Partial<Record<string, string>>, body: () => void): void {
  const saved = new Map(DETECTION_KEYS.map((key) => [key, process.env[key]]));
  resetAutoTheme();
  try {
    for (const key of DETECTION_KEYS) delete process.env[key];
    for (const [key, value] of Object.entries(env)) {
      if (value !== undefined) process.env[key] = value;
    }
    body();
  } finally {
    for (const [key, value] of saved) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    resetAutoTheme();
  }
}

describe("ThemeProvider", () => {
  it("falls back to the default theme with no provider mounted", () => {
    const seen: string[] = [];
    render(<ThemeProbe onTheme={(name) => seen.push(name)} />);
    expect(seen.at(-1)).toBe(DEFAULT_THEME.name);
  });

  it("uses an explicitly named theme", () => {
    const seen: string[] = [];
    render(
      <ThemeProvider name="daylight">
        <ThemeProbe onTheme={(name) => seen.push(name)} />
      </ThemeProvider>,
    );
    expect(seen.at(-1)).toBe("daylight");
  });

  it("prefers a fully-built theme over a name", () => {
    const seen: string[] = [];
    render(
      <ThemeProvider name="daylight" theme={createTheme("mono", "ascii")}>
        <ThemeProbe onTheme={(name) => seen.push(name)} />
      </ThemeProvider>,
    );
    expect(seen.at(-1)).toBe("mono");
  });

  it("detects from the environment when given neither", () => {
    withDetectionEnv({ CANTILUNE_THEME: "ansi" }, () => {
      const seen: string[] = [];
      render(
        <ThemeProvider>
          <ThemeProbe onTheme={(name) => seen.push(name)} />
        </ThemeProvider>,
      );
      expect(seen.at(-1)).toBe("ansi");
    });
  });

  it("caches the detected theme instead of re-probing the terminal", () => {
    withDetectionEnv({ CANTILUNE_THEME: "mono" }, () => {
      const first: string[] = [];
      render(
        <ThemeProvider>
          <ThemeProbe onTheme={(name) => first.push(name)} />
        </ThemeProvider>,
      );
      expect(first.at(-1)).toBe("mono");

      // A later environment change must not leak into an already-resolved session.
      process.env.CANTILUNE_THEME = "daylight";
      const second: string[] = [];
      render(
        <ThemeProvider>
          <ThemeProbe onTheme={(name) => second.push(name)} />
        </ThemeProvider>,
      );
      expect(second.at(-1)).toBe("mono");
    });
  });
});
