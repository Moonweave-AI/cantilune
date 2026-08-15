import { describe, it, expect } from "vitest";
import { createEmptySession, createStore } from "../../src/store.js";

describe("store helpers", () => {
  it("creates store with overrides", () => {
    const store = createStore({ provider: "anthropic", model: "claude", connected: true });
    expect(store.provider).toBe("anthropic");
    expect(store.connected).toBe(true);
  });

  it("creates empty session with zero turns", () => {
    expect(createEmptySession().turnCount).toBe(0);
  });
});
