/**
 * Confirm-prompt derivation.
 *
 * `/quit` signals a confirmation by switching to `confirm` mode and putting its
 * copy in `viewArgs` — the only channel a command handler has, since handlers
 * receive the store rather than React state. The App previously read the copy
 * from a `useState` nothing ever set, so the dialog never rendered while
 * confirm mode disabled the input bar and the global keybindings: `/quit` froze
 * the TUI. These cases pin the derivation that closes it.
 */
import { describe, it, expect } from "vitest";
import { modeAfterCommand, readConfirmMessage } from "../../src/tui/commandMode.js";
import { createFullCommandRegistry } from "../../src/commands/fullRegistry.js";
import { createStore } from "../../src/store.js";

describe("readConfirmMessage", () => {
  it("returns the message a command put in viewArgs", () => {
    expect(readConfirmMessage("confirm", { message: "Quit Cantilune?" })).toBe("Quit Cantilune?");
  });

  it("returns null outside confirm mode, so no dialog steals the input", () => {
    expect(readConfirmMessage("chat", { message: "Quit Cantilune?" })).toBeNull();
    expect(readConfirmMessage("view", { message: "Quit Cantilune?" })).toBeNull();
  });

  it("falls back to a generic prompt rather than rendering nothing", () => {
    // Rendering nothing is the frozen-TUI failure: confirm mode has already
    // disabled every other input path, so there must always be a way out.
    expect(readConfirmMessage("confirm", {})).toBe("Are you sure?");
    expect(readConfirmMessage("confirm", { message: "" })).toBe("Are you sure?");
    expect(readConfirmMessage("confirm", { message: 42 })).toBe("Are you sure?");
  });
});

describe("/quit wiring", () => {
  it("enters confirm mode carrying a message the dialog can render", async () => {
    const registry = createFullCommandRegistry();
    const store = createStore();

    await registry.execute("/quit", store, {});

    expect(store.mode).toBe("confirm");
    expect(readConfirmMessage(store.mode, store.viewArgs)).toBe("Quit Cantilune?");
  });

  it("does not get reset to chat after the handler returns", () => {
    expect(modeAfterCommand("confirm", null)).toBe("confirm");
    expect(modeAfterCommand("picker", null)).toBe("picker");
    expect(modeAfterCommand("ask", null)).toBe("ask");
    expect(modeAfterCommand("approve", null)).toBe("approve");
    expect(modeAfterCommand("chat", "world")).toBe("view");
    expect(modeAfterCommand("chat", null)).toBe("chat");
  });

  it("reaches the same prompt through every alias", async () => {
    for (const alias of ["/exit", "/q"]) {
      const registry = createFullCommandRegistry();
      const store = createStore();
      await registry.execute(alias, store, {});
      expect(readConfirmMessage(store.mode, store.viewArgs)).toBe("Quit Cantilune?");
    }
  });
});
