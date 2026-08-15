import { describe, it, expect } from "vitest";
import { mergeToolExecutors } from "../../src/index.js";
import { invalidateToolIndex } from "../../src/toolMerge.js";
import type { ToolExecutor } from "@cantilune/syscall";

describe("mergeToolExecutors branch coverage", () => {
  it("returns empty list when no executors provided", async () => {
    const merged = mergeToolExecutors([]);
    const tools = await merged.listTools();
    expect(tools).toEqual([]);
  });

  it("returns error for any tool when no executors", async () => {
    const merged = mergeToolExecutors([]);
    const result = await merged.execute("anything", {});
    expect(result.ok).toBe(false);
    expect(result.output).toContain("No executor found");
  });

  it("uses cached index on second call", async () => {
    let listCount = 0;
    const exec: ToolExecutor = {
      async execute(name) {
        return { ok: true, output: name };
      },
      async listTools() {
        listCount++;
        return [{ name: "t1", description: "T1", parameters: {} }];
      },
    };
    const merged = mergeToolExecutors([exec]);
    await merged.execute("t1", {});
    await merged.execute("t1", {});
    expect(listCount).toBe(1);
  });

  it("exposes executors property", () => {
    const exec: ToolExecutor = {
      async execute() {
        return { ok: true, output: "" };
      },
      async listTools() {
        return [];
      },
    };
    const merged = mergeToolExecutors([exec]);
    expect(merged.executors).toHaveLength(1);
  });
});

describe("invalidateToolIndex", () => {
  it("is a no-op on composite (closure-based cache)", async () => {
    const exec: ToolExecutor = {
      async execute(name) {
        return { ok: true, output: name };
      },
      async listTools() {
        return [{ name: "t", description: "T", parameters: {} }];
      },
    };
    const merged = mergeToolExecutors([exec]);
    await merged.execute("t", {});
    invalidateToolIndex(merged);
    const result = await merged.execute("t", {});
    expect(result.ok).toBe(true);
  });
});
