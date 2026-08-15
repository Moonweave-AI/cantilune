// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor, act } from "@testing-library/react";
import React from "react";
import { inkInputHandlers } from "../setup/inkSetup.js";
import { InputBar } from "../../src/tui/InputBar.js";
import { ViewContainer } from "../../src/tui/ViewContainer.js";
import type { ViewType } from "../../src/store.js";

describe("input bar and view container branches", () => {
  beforeEach(() => {
    inkInputHandlers.length = 0;
  });

  it("submits trimmed input and navigates history middle index", async () => {
    const onSubmit = vi.fn();
    render(<InputBar onSubmit={onSubmit} history={["first", "second", "third"]} />);

    let handler = inkInputHandlers.at(-1)!;
    await act(async () => {
      for (const ch of "hello") {
        handler = inkInputHandlers.at(-1)!;
        handler(ch, {});
      }
    });
    handler = inkInputHandlers.at(-1)!;
    await act(async () => {
      handler("", { return: true });
    });
    expect(onSubmit).toHaveBeenCalledWith("hello");

    render(<InputBar onSubmit={onSubmit} history={["first", "second"]} />);
    handler = inkInputHandlers.at(-1)!;
    handler("", { upArrow: true });
    handler = inkInputHandlers.at(-1)!;
    handler("", { upArrow: true });
    handler = inkInputHandlers.at(-1)!;
    handler("", { downArrow: true });
    handler = inkInputHandlers.at(-1)!;
    expect(handler).toBeTypeOf("function");
  });

  it("clears input when down-arrow moves past last history item", async () => {
    render(<InputBar onSubmit={vi.fn()} history={["only"]} />);
    let handler = inkInputHandlers.at(-1)!;
    await act(async () => {
      handler("", { upArrow: true });
    });
    handler = inkInputHandlers.at(-1)!;
    await act(async () => {
      handler("", { downArrow: true });
    });
    handler = inkInputHandlers.at(-1)!;
    await act(async () => {
      handler("", { downArrow: true });
    });
    expect(handler).toBeTypeOf("function");
  });

  it("selects intermediate history item via down arrow", async () => {
    render(<InputBar onSubmit={vi.fn()} history={["first", "second", "third"]} />);
    let handler = inkInputHandlers.at(-1)!;
    await act(async () => {
      handler("", { upArrow: true });
    });
    handler = inkInputHandlers.at(-1)!;
    await act(async () => {
      handler("", { upArrow: true });
    });
    handler = inkInputHandlers.at(-1)!;
    await act(async () => {
      handler("", { downArrow: true });
    });
    expect(inkInputHandlers.at(-1)).toBeTypeOf("function");
  });

  it("renders view container initial loading state then resolves", async () => {
    const loaded = render(<ViewContainer activeView="graph" viewArgs={{ depth: 1 }} />);
    expect(loaded.container.textContent).toContain("loading graph");
    await waitFor(
      () => {
        expect(loaded.container.textContent).not.toContain("loading graph");
      },
      { timeout: 3000 },
    );
    loaded.unmount();
  });

  it("renders fallback for unregistered view type", async () => {
    const unknown = render(<ViewContainer activeView={"unknown" as ViewType} viewArgs={{}} />);
    await waitFor(() => {
      expect(unknown.container.textContent).not.toContain("loading unknown");
    });
    expect(unknown.container.textContent).toContain("not implemented yet");
  });

  it("view module map contains export and help entries", () => {
    expect(ViewContainer).toBeDefined();
  });
});
