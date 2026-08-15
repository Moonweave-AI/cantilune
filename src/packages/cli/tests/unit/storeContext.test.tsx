// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { render, renderHook } from "@testing-library/react";
import React from "react";
import { createStore } from "../../src/store.js";
import { StoreProvider, useAppStore } from "../../src/storeContext.js";

function StoreReader({
  onStore,
}: {
  onStore: (store: ReturnType<typeof createStore>) => void;
}): React.ReactElement {
  const store = useAppStore();
  onStore(store);
  return <span>{store.provider}</span>;
}

describe("storeContext", () => {
  it("returns context store when wrapped in StoreProvider", () => {
    const store = createStore({ provider: "anthropic", model: "claude" });
    let captured: ReturnType<typeof createStore> | undefined;
    const { container } = render(
      <StoreProvider store={store}>
        <StoreReader
          onStore={(s) => {
            captured = s;
          }}
        />
      </StoreProvider>,
    );
    expect(captured).toBe(store);
    expect(container.textContent).toBe("anthropic");
  });

  it("creates fallback store when no provider is present", () => {
    const { result } = renderHook(() => useAppStore({ model: "custom-model" }));
    expect(result.current.model).toBe("custom-model");
    expect(result.current.provider).toBe("openai");
  });
});
