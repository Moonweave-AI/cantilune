import { describe, it, expect } from "vitest";
import { createEmptySession, createStore, ReactiveStore } from "../../src/store.js";

describe("store helpers", () => {
  it("creates store with overrides", () => {
    const store = createStore({ provider: "anthropic", model: "claude", connected: true });
    expect(store.provider).toBe("anthropic");
    expect(store.connected).toBe(true);
  });

  it("creates empty session with zero turns", () => {
    expect(createEmptySession().turnCount).toBe(0);
  });

  it("rewrites the last assistant even when a later tool card is the tail", () => {
    const handle = new ReactiveStore();
    handle.appendMessage({ role: "assistant", content: "", timestamp: 1 });
    handle.appendMessage({
      role: "system",
      content: "",
      timestamp: 2,
      toolCalls: [
        {
          id: "t1",
          name: "done",
          args: {},
          status: "done",
          startedAt: 1,
          endedAt: 2,
        },
      ],
    });
    handle.updateLastAssistant((message) => ({ ...message, content: "filled" }));
    expect(handle.get().session.messages[0]?.content).toBe("filled");
    expect(handle.get().session.messages[1]?.role).toBe("system");
  });

  it("leaves the transcript unchanged when no assistant bubble exists", () => {
    const handle = new ReactiveStore();
    handle.appendMessage({ role: "user", content: "hi", timestamp: 1 });
    handle.updateLastAssistant((message) => ({ ...message, content: "nope" }));
    expect(handle.get().session.messages).toHaveLength(1);
    expect(handle.get().session.messages[0]?.content).toBe("hi");
  });
});
