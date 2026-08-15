// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import React from "react";
import { ToolCard } from "../../src/tui/ToolCard.js";
import { LifecycleRail } from "../../src/tui/LifecycleRail.js";
import type { LifecycleLine } from "../../src/store.js";

describe("coordination and lifecycle rendering", () => {
  it("renders a coordination ToolCard without throwing (accentAlt path)", () => {
    const { container } = render(
      <ToolCard
        toolCall={{
          id: "1",
          name: "fork_branch",
          args: { from: "x" },
          status: "running",
          coordination: true,
        }}
      />,
    );
    expect(container.textContent).toContain("fork_branch");
  });

  it("renders a coordination ToolCard expanded with a failed result", () => {
    const { container } = render(
      <ToolCard
        detail="observe"
        toolCall={{
          id: "2",
          name: "introduce_artifact",
          args: { target: "t" },
          status: "error",
          result: { ok: false, output: "rejected by world" },
          coordination: true,
        }}
      />,
    );
    expect(container.textContent).toContain("rejected by world");
  });

  it("renders a plain ToolCard without coordination", () => {
    const { container } = render(
      <ToolCard
        toolCall={{
          id: "3",
          name: "read_content",
          args: { ref: "sha256:x" },
          status: "done",
          result: { ok: true, output: "ok" },
        }}
      />,
    );
    expect(container.textContent).toContain("read_content");
  });

  it("renders a LifecycleRail with turn header and stage labels", () => {
    const lines: LifecycleLine[] = [
      { stage: "turn_open", label: "Turn 1 open", ts: 1000 },
      { stage: "llm", label: "LLM thinking", ts: 1050 },
      {
        stage: "tool_start",
        label: "introduce_artifact",
        ts: 1100,
        coordination: true,
      },
      {
        stage: "tool_end",
        label: "introduce_artifact",
        ts: 1200,
        coordination: true,
        detail: "committed",
      },
      { stage: "turn_close", label: "Turn 1 end", ts: 1250 },
    ];
    const { container } = render(<LifecycleRail lines={lines} turn={1} width={80} />);
    expect(container.textContent).toContain("t1 lifecycle");
    expect(container.textContent).toContain("Turn 1 open");
    expect(container.textContent).toContain("introduce_artifact");
    expect(container.textContent).toContain("committed");
    expect(container.textContent).toContain("Turn 1 end");
  });

  it("renders nothing for an empty LifecycleRail", () => {
    const { container } = render(<LifecycleRail lines={[]} turn={1} />);
    expect(container.textContent).toBe("");
  });
});
