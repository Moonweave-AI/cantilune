import { describe, it, expect } from "vitest";
import type { ToolCallDisplay } from "../../src/store.js";
import {
  describeToolCard,
  formatArgValue,
  humanizeToolOutput,
  toolFamily,
  toolTitle,
} from "../../src/tui/formatToolCard.js";

function tool(partial: Partial<ToolCallDisplay> & Pick<ToolCallDisplay, "name">): ToolCallDisplay {
  return {
    id: "t1",
    args: {},
    status: "done",
    ...partial,
  };
}

describe("toolFamily / toolTitle", () => {
  it("classifies the production tool names", () => {
    expect(toolFamily("done")).toBe("done");
    expect(toolFamily("shell_run_command")).toBe("shell");
    expect(toolFamily("web_search")).toBe("search");
    expect(toolFamily("web_fetch")).toBe("fetch");
    expect(toolFamily("filesystem_read_file")).toBe("read");
    expect(toolFamily("filesystem_write_file")).toBe("write");
    expect(toolFamily("filesystem_list_directory")).toBe("list");
    expect(toolFamily("mcp_docs_lookup")).toBe("mcp");
    expect(toolTitle("shell_run_command")).toBe("Shell");
    expect(toolTitle("register_participant")).toBe("register_participant");
  });
});

describe("formatArgValue / humanizeToolOutput", () => {
  it("renders nested objects as labeled prose, not a JSON blob", () => {
    expect(formatArgValue({ path: "/tmp", n: 2 })).toBe("path: /tmp · n: 2");
    expect(formatArgValue(["a", "b"])).toBe("a, b");
  });

  it("unwraps common JSON envelopes so the card shows the payload", () => {
    expect(humanizeToolOutput('{"stdout":"hello\\nworld"}')).toBe("hello\nworld");
    expect(humanizeToolOutput('{"content":"file body"}')).toBe("file body");
    expect(
      humanizeToolOutput('{"results":[{"title":"A","url":"https://a.test","snippet":"s"}]}'),
    ).toContain("1. A");
    expect(humanizeToolOutput("plain text")).toBe("plain text");
  });
});

describe("describeToolCard", () => {
  it("keeps done as a single completion claim", () => {
    const model = describeToolCard(
      tool({ name: "done", args: { summary: "成功回复用户的问候，任务完成。" } }),
    );
    expect(model.compact).toBe(true);
    expect(model.headline).toContain("成功回复");
    expect(model.body).toBe("");
  });

  it("surfaces the shell command and its output", () => {
    const model = describeToolCard(
      tool({
        name: "shell_run_command",
        args: { command: "ls -la", cwd: "/repo" },
        result: { ok: true, output: "README.md\npackage.json" },
      }),
    );
    expect(model.family).toBe("shell");
    expect(model.headline).toBe("ls -la");
    expect(model.fields.some((field) => field.value === "/repo")).toBe(true);
    expect(model.body).toContain("README.md");
    expect(model.compact).toBe(false);
  });

  it("surfaces a search query and formatted hits", () => {
    const model = describeToolCard(
      tool({
        name: "web_search",
        args: { query: "cantilune agent os" },
        result: {
          ok: true,
          output: "1. Cantilune\n   https://example.test\n   coordination OS",
        },
      }),
    );
    expect(model.headline).toBe("cantilune agent os");
    expect(model.body).toContain("https://example.test");
  });
});
