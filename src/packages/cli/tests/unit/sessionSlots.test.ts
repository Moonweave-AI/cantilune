import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createEmptySession } from "../../src/store.js";
import { createStore } from "../../src/store.js";
import { registerSessionCommands } from "../../src/commands/sessionCommands.js";
import {
  compactSession,
  listSessionSlots,
  loadSessionSlot,
  saveSessionSlot,
} from "../../src/session/sessionSlots.js";

describe("session slots", () => {
  it("saves, lists, and loads a named slot", () => {
    const dir = mkdtempSync(join(tmpdir(), "cli-slots-"));
    try {
      const session = {
        ...createEmptySession(),
        turnCount: 3,
        messages: [
          { role: "user" as const, content: "hello", timestamp: 1 },
          { role: "assistant" as const, content: "hi", timestamp: 2 },
        ],
      };
      const meta = saveSessionSlot(dir, "alpha", session);
      expect(meta.name).toBe("alpha");
      expect(listSessionSlots(dir).map((slot) => slot.name)).toEqual(["alpha"]);
      expect(loadSessionSlot(dir, "alpha")?.turnCount).toBe(3);
      expect(loadSessionSlot(dir, "missing")).toBeUndefined();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("rejects a path-like slot name", () => {
    const dir = mkdtempSync(join(tmpdir(), "cli-slots-bad-"));
    try {
      expect(() => saveSessionSlot(dir, "../escape", createEmptySession())).toThrow(/Invalid/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("compactSession", () => {
  it("leaves a short transcript untouched", () => {
    const session = createEmptySession();
    expect(compactSession(session).dropped).toBe(0);
  });

  it("drops older messages and inserts a marker", () => {
    const messages = Array.from({ length: 12 }, (_, i) => ({
      role: "user" as const,
      content: `m${String(i)}`,
      timestamp: i,
    }));
    const result = compactSession({ ...createEmptySession(), messages }, 4);
    expect(result.dropped).toBe(8);
    expect(result.session.messages[0]?.role).toBe("system");
    expect(result.session.messages).toHaveLength(5);
  });
});

describe("session slash commands", () => {
  it("compacts, saves, lists, loads, and opens status", async () => {
    const dir = mkdtempSync(join(tmpdir(), "cli-cmd-slots-"));
    try {
      const commands = registerSessionCommands();
      const byName = Object.fromEntries(commands.map((command) => [command.name, command]));
      const store = createStore({
        storagePath: dir,
        session: {
          ...createEmptySession(),
          messages: Array.from({ length: 10 }, (_, i) => ({
            role: "user" as const,
            content: `m${String(i)}`,
            timestamp: i,
          })),
        },
      });
      await byName["/compact"]?.handler({}, store);
      expect(store.session.messages[0]?.role).toBe("system");

      await byName["/session save"]?.handler({ name: "slot-a" }, store);
      await byName["/session list"]?.handler({}, store);
      expect(store.activeView).toBe("session-list");
      expect(JSON.stringify(store.viewArgs.slots)).toContain("slot-a");

      store.session = createEmptySession();
      await byName["/session load"]?.handler({ name: "slot-a" }, store);
      expect(store.session.messages.length).toBeGreaterThan(0);

      await byName["/session load"]?.handler({ name: "missing" }, store);
      expect(store.notice?.level).toBe("error");

      await byName["/session save"]?.handler({ name: "../bad" }, store);
      expect(store.notice?.level).toBe("error");

      await byName["/status"]?.handler({}, store);
      expect(store.activeView).toBe("status");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
