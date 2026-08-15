// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, act } from "@testing-library/react";
import React from "react";
import { inkInputHandlers, type InkInputHandler } from "../setup/inkSetup.js";
import { InputBar } from "../../src/tui/InputBar.js";
import { useKeyboard } from "../../src/tui/hooks/useKeyboard.js";
import type { SlashCommand } from "../../src/commands/registry.js";
import { ReactiveStore } from "../../src/store.js";

/** The handler most recently registered by `useInput`. */
function latestHandler(): InkInputHandler {
  const handler = inkInputHandlers.at(-1);
  if (handler === undefined) throw new Error("no ink input handler registered");
  return handler;
}

function press(input: string, key: Record<string, boolean> = {}): void {
  const handler = latestHandler();
  act(() => {
    handler(input, key);
  });
}

function type(text: string): void {
  for (const char of text) press(char, {});
}

const noop = (): void => undefined;

/**
 * A miniature command tree covering every shape the suggestion layer must
 * handle: a segment that is both runnable and a parent (`/world`), a parent with
 * no command of its own (`/export`), a leaf needing an argument (`/base-url`),
 * and a plain leaf (`/clear`).
 */
const COMMANDS: readonly SlashCommand[] = [
  { name: "/world", description: "Show the world", category: "view", handler: noop },
  { name: "/world actors", description: "List participants", category: "view", handler: noop },
  { name: "/world tasks", description: "List artifacts", category: "view", handler: noop },
  { name: "/export graph", description: "Export the graph", category: "export", handler: noop },
  { name: "/export petri", description: "Export the net", category: "export", handler: noop },
  {
    name: "/base-url",
    description: "Override the API base URL",
    category: "control",
    args: [{ name: "url", description: "Base URL", required: true, type: "string" }],
    handler: noop,
  },
  { name: "/clear", description: "Clear the transcript", category: "session", handler: noop },
];

beforeEach(() => {
  inkInputHandlers.length = 0;
});

describe("InputBar editing", () => {
  it("submits the trimmed buffer on Enter and clears it", () => {
    const onSubmit = vi.fn();
    render(<InputBar onSubmit={onSubmit} />);

    type("hi there");
    press("", { return: true });

    expect(onSubmit).toHaveBeenCalledWith("hi there");
  });

  it("ignores Enter on an empty or whitespace-only buffer", () => {
    const onSubmit = vi.fn();
    render(<InputBar onSubmit={onSubmit} />);

    press("", { return: true });
    type("   ");
    press("", { return: true });

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("treats a slash typed mid-word as an ordinary character", () => {
    const onSubmit = vi.fn();
    const { container } = render(<InputBar onSubmit={onSubmit} commands={COMMANDS} />);

    type("a/b");
    expect(container.textContent).not.toContain("Commands");

    press("", { return: true });
    expect(onSubmit).toHaveBeenCalledWith("a/b");
  });

  it("inserts a newline for Shift+Enter instead of submitting", () => {
    const onSubmit = vi.fn();
    const { container } = render(<InputBar onSubmit={onSubmit} />);

    type("one");
    press("", { return: true, shift: true });
    type("two");

    expect(onSubmit).not.toHaveBeenCalled();
    expect(container.textContent).toContain("2 lines");
  });

  it("continues onto a new line after a trailing backslash", () => {
    const onSubmit = vi.fn();
    render(<InputBar onSubmit={onSubmit} />);

    type("one\\");
    press("", { return: true });
    type("two");
    press("", { return: true });

    expect(onSubmit).toHaveBeenCalledWith("one\ntwo");
  });

  it("inserts a pasted chunk verbatim rather than interpreting it", () => {
    const onSubmit = vi.fn();
    render(<InputBar onSubmit={onSubmit} commands={COMMANDS} />);

    press("/usr/local/share/some/long/path", {});
    press("", { return: true });

    expect(onSubmit).toHaveBeenCalledWith("/usr/local/share/some/long/path");
  });

  it("supports emacs-style line editing", () => {
    const onSubmit = vi.fn();
    render(<InputBar onSubmit={onSubmit} />);

    type("hello world");
    press("w", { ctrl: true }); // delete word left
    press("", { return: true });

    expect(onSubmit).toHaveBeenCalledWith("hello");
  });

  it("kills to the start and to the end of the line", () => {
    const onSubmit = vi.fn();
    render(<InputBar onSubmit={onSubmit} />);

    type("abcdef");
    press("a", { ctrl: true }); // home
    press("k", { ctrl: true }); // kill to end
    type("xyz");
    press("u", { ctrl: true }); // kill to start
    type("done");
    press("", { return: true });

    expect(onSubmit).toHaveBeenCalledWith("done");
  });

  it("moves the caret with Ctrl+B/Ctrl+F and arrows", () => {
    const onSubmit = vi.fn();
    render(<InputBar onSubmit={onSubmit} />);

    type("ac");
    press("b", { ctrl: true });
    type("b");
    press("f", { ctrl: true });
    press("", { leftArrow: true });
    press("", { rightArrow: true });
    press("", { return: true });

    expect(onSubmit).toHaveBeenCalledWith("abc");
  });

  it("jumps by word with Meta+arrows", () => {
    const onSubmit = vi.fn();
    render(<InputBar onSubmit={onSubmit} />);

    type("alpha beta");
    press("", { leftArrow: true, meta: true });
    press("X", {});
    press("", { rightArrow: true, meta: true });
    press("", { return: true });

    expect(onSubmit).toHaveBeenCalledWith("alpha Xbeta");
  });

  /**
   * Regression: Ink reports the physical Backspace key (DEL, 0x7f) as
   * `key.delete`, so routing that flag to a forward delete made Backspace a
   * no-op at the end of a line — which is where the caret almost always is.
   */
  it("deletes backwards for both backspace and delete", () => {
    const onSubmit = vi.fn();
    render(<InputBar onSubmit={onSubmit} />);

    type("abcd");
    press("", { backspace: true });
    press("", { delete: true });
    press("", { return: true });

    expect(onSubmit).toHaveBeenCalledWith("ab");
  });

  it("recalls history with the arrow keys", () => {
    const onSubmit = vi.fn();
    render(<InputBar onSubmit={onSubmit} history={["first", "second"]} />);

    press("", { upArrow: true });
    press("", { return: true });
    expect(onSubmit).toHaveBeenLastCalledWith("second");

    press("", { upArrow: true });
    press("", { upArrow: true });
    press("", { return: true });
    expect(onSubmit).toHaveBeenLastCalledWith("first");
  });

  it("walks back down through history to an empty buffer", () => {
    const onSubmit = vi.fn();
    render(<InputBar onSubmit={onSubmit} history={["only"]} />);

    press("", { downArrow: true }); // no-op with no active history index
    press("", { upArrow: true });
    press("", { downArrow: true }); // past the end, clears the buffer
    press("", { return: true });

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("does nothing on arrows with an empty history", () => {
    render(<InputBar onSubmit={vi.fn()} history={[]} />);
    press("", { upArrow: true });
    press("", { downArrow: true });
    expect(inkInputHandlers.length).toBeGreaterThan(0);
  });

  it("leaves multiline text alone when arrows are pressed", () => {
    const onSubmit = vi.fn();
    render(<InputBar onSubmit={onSubmit} history={["recalled"]} />);

    type("one");
    press("", { return: true, shift: true });
    type("two");
    press("", { upArrow: true });
    press("", { downArrow: true });
    press("", { return: true });

    expect(onSubmit).toHaveBeenCalledWith("one\ntwo");
  });

  it("ignores unmapped control keys", () => {
    const onSubmit = vi.fn();
    render(<InputBar onSubmit={onSubmit} />);

    type("abc");
    press("z", { ctrl: true });
    press("", { return: true });

    expect(onSubmit).toHaveBeenCalledWith("abc");
  });

  it("swallows every keystroke while disabled", () => {
    const onSubmit = vi.fn();
    const { container } = render(<InputBar disabled onSubmit={onSubmit} />);

    type("ignored");
    press("", { return: true });

    expect(onSubmit).not.toHaveBeenCalled();
    expect(container.textContent).toContain("Ctrl+C to interrupt");
  });

  it("shows the placeholder until something is typed", () => {
    const { container } = render(<InputBar onSubmit={vi.fn()} placeholder="Ask me" />);
    expect(container.textContent).toContain("Ask me");
  });

  it("shows a character count on a wide terminal", () => {
    const { container } = render(<InputBar onSubmit={vi.fn()} width={120} />);
    type("abcd");
    expect(container.textContent).toContain("4 chars");
  });

  it("hides the character count on a narrow terminal", () => {
    const { container } = render(<InputBar onSubmit={vi.fn()} width={60} />);
    type("abcd");
    expect(container.textContent).not.toContain("4 chars");
  });
});

describe("InputBar slash suggestions", () => {
  it("opens an overlay of top-level segments on a bare slash", () => {
    const { container } = render(<InputBar onSubmit={vi.fn()} commands={COMMANDS} />);

    type("/");

    const text = container.textContent ?? "";
    expect(text).toContain("Commands");
    expect(text).toContain("/world");
    expect(text).toContain("/export");
    // `/world actors` is one level down, so it must not appear at the top level.
    expect(text).not.toContain("/world actors");
  });

  it("keeps narrowing the overlay as more characters arrive", () => {
    const { container } = render(<InputBar onSubmit={vi.fn()} commands={COMMANDS} />);

    type("/wo");

    const text = container.textContent ?? "";
    expect(text).toContain("/world");
    expect(text).not.toContain("/clear");
  });

  it("runs the highlighted command on Enter when it needs no arguments", () => {
    const onSubmit = vi.fn();
    render(<InputBar onSubmit={onSubmit} commands={COMMANDS} />);

    type("/cle");
    press("", { return: true });

    expect(onSubmit).toHaveBeenCalledWith("/clear");
  });

  /**
   * Regression: picking a row straight out of the palette used to execute the
   * bare command name, so anything with a required argument failed immediately
   * with "Missing required argument".
   */
  it("completes rather than runs a command that still needs an argument", () => {
    const onSubmit = vi.fn();
    const { container } = render(<InputBar onSubmit={onSubmit} commands={COMMANDS} />);

    type("/base");
    press("", { return: true });

    expect(onSubmit).not.toHaveBeenCalled();
    expect(container.textContent).toContain("<url>");
  });

  it("completes rather than runs a segment that only groups subcommands", () => {
    const onSubmit = vi.fn();
    const { container } = render(<InputBar onSubmit={onSubmit} commands={COMMANDS} />);

    type("/exp");
    press("", { return: true });

    expect(onSubmit).not.toHaveBeenCalled();
    // Completing to `/export ` reveals the level below it.
    const text = container.textContent ?? "";
    expect(text).toContain("graph");
    expect(text).toContain("petri");
  });

  it("drills into a subcommand tree with Tab without running anything", () => {
    const onSubmit = vi.fn();
    const { container } = render(<InputBar onSubmit={onSubmit} commands={COMMANDS} />);

    type("/wor");
    press("", { tab: true });

    expect(onSubmit).not.toHaveBeenCalled();
    const text = container.textContent ?? "";
    expect(text).toContain("actors");
    expect(text).toContain("tasks");
  });

  it("submits a nested command typed across two levels", () => {
    const onSubmit = vi.fn();
    render(<InputBar onSubmit={onSubmit} commands={COMMANDS} />);

    type("/world");
    press("", { tab: true }); // -> "/world "
    type("ac");
    press("", { return: true });

    expect(onSubmit).toHaveBeenCalledWith("/world actors");
  });

  it("moves the highlight with the arrow keys instead of recalling history", () => {
    const onSubmit = vi.fn();
    render(<InputBar onSubmit={onSubmit} commands={COMMANDS} history={["earlier"]} />);

    type("/export ");
    press("", { downArrow: true }); // graph -> petri
    press("", { return: true });

    expect(onSubmit).toHaveBeenCalledWith("/export petri");
  });

  it("clamps the highlight at both ends of the list", () => {
    const onSubmit = vi.fn();
    render(<InputBar onSubmit={onSubmit} commands={COMMANDS} />);

    type("/export ");
    press("", { upArrow: true }); // already at the top
    press("", { downArrow: true });
    press("", { downArrow: true }); // already at the bottom
    press("", { return: true });

    expect(onSubmit).toHaveBeenCalledWith("/export petri");
  });

  it("shows a usage line once the caret is past a command that takes arguments", () => {
    const { container } = render(<InputBar onSubmit={vi.fn()} commands={COMMANDS} />);

    type("/base-url ");

    const text = container.textContent ?? "";
    expect(text).toContain("/base-url");
    expect(text).toContain("Base URL");
    expect(text).toContain("required");
  });

  it("submits a command with its argument once one is typed", () => {
    const onSubmit = vi.fn();
    render(<InputBar onSubmit={onSubmit} commands={COMMANDS} />);

    type("/base-url https://example.test/v1");
    press("", { return: true });

    expect(onSubmit).toHaveBeenCalledWith("/base-url https://example.test/v1");
  });

  it("dismisses the overlay on Escape while keeping the text", () => {
    const onSubmit = vi.fn();
    const { container } = render(<InputBar onSubmit={onSubmit} commands={COMMANDS} />);

    type("/cle");
    press("", { escape: true });
    expect(container.textContent).not.toContain("Commands");

    // With the overlay gone Enter submits the literal text rather than the
    // previously highlighted candidate.
    press("", { return: true });
    expect(onSubmit).toHaveBeenCalledWith("/cle");
  });

  it("re-opens a dismissed overlay on the next edit", () => {
    const { container } = render(<InputBar onSubmit={vi.fn()} commands={COMMANDS} />);

    type("/cle");
    press("", { escape: true });
    type("a");

    expect(container.textContent).toContain("Commands");
  });

  it("reports no matches for an unknown command", () => {
    const { container } = render(<InputBar onSubmit={vi.fn()} commands={COMMANDS} />);

    type("/zzz");

    expect(container.textContent).toContain("No matching commands.");
  });

  it("keeps Tab inert when there is nothing to complete", () => {
    const onSubmit = vi.fn();
    render(<InputBar onSubmit={onSubmit} commands={COMMANDS} />);

    type("plain text");
    press("", { tab: true });
    press("", { return: true });

    expect(onSubmit).toHaveBeenCalledWith("plain text");
  });
});

describe("useKeyboard", () => {
  function mount(store: ReactiveStore, handlers: Parameters<typeof useKeyboard>[1] = {}) {
    function Host(): null {
      useKeyboard(store, handlers);
      return null;
    }
    return render(<Host />);
  }

  it("aborts a running agent on Ctrl+C", () => {
    const store = new ReactiveStore({ agentRunning: true });
    const onAbort = vi.fn();
    mount(store, { onAbort });

    press("c", { ctrl: true });
    expect(onAbort).toHaveBeenCalledOnce();
  });

  it("exits on Ctrl+C when nothing is running", () => {
    const store = new ReactiveStore({ agentRunning: false });
    const onAbort = vi.fn();
    mount(store, { onAbort });

    press("c", { ctrl: true });
    expect(onAbort).not.toHaveBeenCalled();
  });

  it("exits on Ctrl+D regardless of run state", () => {
    const store = new ReactiveStore({ agentRunning: true });
    const onAbort = vi.fn();
    mount(store, { onAbort });

    press("d", { ctrl: true });
    expect(onAbort).not.toHaveBeenCalled();
  });

  it("toggles the layout on Ctrl+O", () => {
    const store = new ReactiveStore({ layout: "focus" });
    mount(store);

    press("o", { ctrl: true });
    expect(store.get().layout).toBe("observe");

    press("o", { ctrl: true });
    expect(store.get().layout).toBe("focus");
  });

  it("scrolls with PageUp and PageDown", () => {
    const store = new ReactiveStore();
    const onScroll = vi.fn();
    mount(store, { onScroll });

    press("", { pageUp: true });
    press("", { pageDown: true });

    expect(onScroll).toHaveBeenNthCalledWith(1, 5);
    expect(onScroll).toHaveBeenNthCalledWith(2, -5);
  });

  it("Escape closes an open view and resets the scroll position", () => {
    const store = new ReactiveStore({ mode: "view", activeView: "world", notice: null });
    const onScrollReset = vi.fn();
    mount(store, { onScrollReset });

    press("", { escape: true });

    expect(onScrollReset).toHaveBeenCalledOnce();
    expect(store.get().mode).toBe("chat");
    expect(store.get().activeView).toBeNull();
  });

  it("Escape in plain chat only resets the scroll position", () => {
    const store = new ReactiveStore({ mode: "chat", activeView: null });
    const onScrollReset = vi.fn();
    mount(store, { onScrollReset });

    const before = store.getVersion();
    press("", { escape: true });

    expect(onScrollReset).toHaveBeenCalledOnce();
    expect(store.getVersion()).toBe(before);
  });

  /**
   * Regression: this hook used to claim `/` and switch to command mode, which
   * fired even mid-sentence and left the input bar and the palette both acting
   * on the following keystrokes. Printable characters belong to the input bar.
   */
  it("claims no printable characters", () => {
    const store = new ReactiveStore({ mode: "chat" });
    mount(store);

    const before = store.getVersion();
    press("/", {});

    expect(store.get().mode).toBe("chat");
    expect(store.getVersion()).toBe(before);
  });

  it("ignores everything while disabled", () => {
    const store = new ReactiveStore({ layout: "focus" });
    const onScroll = vi.fn();
    mount(store, { enabled: false, onScroll });

    press("o", { ctrl: true });
    press("", { pageUp: true });

    expect(store.get().layout).toBe("focus");
    expect(onScroll).not.toHaveBeenCalled();
  });
});
