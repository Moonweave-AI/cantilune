/**
 * ADR-0016 tier declarations on the built-in tool executors.
 *
 * Each executor declares the side-effect tier of its tools so the syscall
 * exactly-once journal can reconcile correctly after a crash:
 *  - filesystem read/list/search tools → Tier 0 ("read")
 *  - filesystem_write_file → Tier 1 ("idempotent") with a reconcile stub
 *  - filesystem_edit_file → Tier 2 ("non-idempotent")
 *  - shell → Tier 2 ("non-idempotent")
 *  - web → Tier 0 ("read")
 *  - mcp → Tier 2 ("non-idempotent", fail-safe default for unknown remote tools)
 * The composite `createToolSet` executor routes `tierFor` / `reconcile` to the
 * underlying executor that owns the tool.
 */
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import * as mcpBridge from "../../src/mcp/mcpBridge.js";
import { clearMcpDiscoveryCache } from "../../src/mcp/mcpDiscovery.js";
import { createFilesystemExecutor } from "../../src/filesystem/filesystemExecutor.js";
import { createMcpExecutor } from "../../src/mcp/mcpExecutor.js";
import { createShellExecutor } from "../../src/shell/shellExecutor.js";
import { createWebExecutor } from "../../src/web/webExecutor.js";
import { createHostToolSet } from "../support/hostToolSet.js";
import type { ToolInvocationKey } from "@cantilune/syscall";

function key(toolName: string): ToolInvocationKey {
  return {
    principal: { actorId: "planner", kind: "agent" },
    toolName,
    argumentsDigest: "sha256:0000000000000000000000000000000000000000000000000000000000000000",
    originalToolCallId: "call-1",
  };
}

describe("filesystem executor tier declarations", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "cantilune-tier-fs-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("declares a non-idempotent default tier", () => {
    const exec = createFilesystemExecutor({ enabled: true, rootDir: tempDir });
    expect(exec.tier).toBe("non-idempotent");
  });

  it("classifies read tools as Tier 0 (read)", () => {
    const exec = createFilesystemExecutor({ enabled: true, rootDir: tempDir });
    expect(exec.tierFor?.("filesystem_read_file")).toBe("read");
    expect(exec.tierFor?.("filesystem_list_directory")).toBe("read");
    expect(exec.tierFor?.("filesystem_search_files")).toBe("read");
    expect(exec.tierFor?.("filesystem_search_content")).toBe("read");
  });

  it("classifies write_file as Tier 1 (idempotent)", () => {
    const exec = createFilesystemExecutor({ enabled: true, rootDir: tempDir });
    expect(exec.tierFor?.("filesystem_write_file")).toBe("idempotent");
  });

  it("classifies edit_file as Tier 2 (non-idempotent)", () => {
    const exec = createFilesystemExecutor({ enabled: true, rootDir: tempDir });
    expect(exec.tierFor?.("filesystem_edit_file")).toBe("non-idempotent");
  });

  it("returns undefined for an unknown tool (falls back to the default tier)", () => {
    const exec = createFilesystemExecutor({ enabled: true, rootDir: tempDir });
    expect(exec.tierFor?.("filesystem_unknown")).toBeUndefined();
  });

  it("reconcile reports unknown for write_file (idempotent re-dispatch is safe)", async () => {
    const exec = createFilesystemExecutor({ enabled: true, rootDir: tempDir });
    // A write_file is idempotent by content; the key carries no original args,
    // so reconcile cannot prove "already written" and reports unknown → the
    // run re-dispatches, which is a no-op overwrite. See ADR-0016 §4.
    const result = await exec.reconcile!(key("filesystem_write_file"));
    expect(result.status).toBe("unknown");
  });

  it("reconcile reports unknown for non-write tools (never reached in production)", async () => {
    const exec = createFilesystemExecutor({ enabled: true, rootDir: tempDir });
    const result = await exec.reconcile!(key("filesystem_read_file"));
    expect(result.status).toBe("unknown");
  });
});

describe("shell executor tier declaration", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "cantilune-tier-shell-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("declares a non-idempotent tier (no outcome query)", () => {
    const exec = createShellExecutor({ enabled: true, workingDirectory: tempDir });
    expect(exec.tier).toBe("non-idempotent");
    expect(exec.reconcile).toBeUndefined();
  });
});

describe("web executor tier declaration", () => {
  it("declares a read tier (no side effect)", () => {
    const exec = createWebExecutor({ enabled: true });
    expect(exec.tier).toBe("read");
    expect(exec.reconcile).toBeUndefined();
  });
});

describe("mcp executor tier declaration", () => {
  let createClientSpy: MockInstance<typeof mcpBridge.createMcpClient>;

  beforeEach(() => {
    clearMcpDiscoveryCache();
    createClientSpy = vi.spyOn(mcpBridge, "createMcpClient").mockReturnValue({
      connect: vi.fn(async () => undefined),
      disconnect: vi.fn(),
      listTools: vi.fn(async () => []),
      callTool: vi.fn(async () => ({ content: [{ type: "text", text: "ok" }] })),
    });
  });

  afterEach(() => {
    clearMcpDiscoveryCache();
    createClientSpy.mockRestore();
  });

  it("declares a non-idempotent tier (unknown remote tools fail safe)", () => {
    const exec = createMcpExecutor({ name: "svc", command: "echo", args: [] });
    expect(exec.tier).toBe("non-idempotent");
    expect(exec.reconcile).toBeUndefined();
  });
});

describe("createToolSet composite tier routing", () => {
  let tempDir: string;
  let createClientSpy: MockInstance<typeof mcpBridge.createMcpClient>;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "cantilune-tier-set-"));
    clearMcpDiscoveryCache();
    createClientSpy = vi.spyOn(mcpBridge, "createMcpClient").mockReturnValue({
      connect: vi.fn(async () => undefined),
      disconnect: vi.fn(),
      listTools: vi.fn(async () => [
        {
          name: "call",
          description: "Proxy",
          inputSchema: { type: "object", properties: {}, required: [] },
        },
      ]),
      callTool: vi.fn(async () => ({ content: [{ type: "text", text: "ok" }] })),
    });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
    clearMcpDiscoveryCache();
    createClientSpy.mockRestore();
  });

  it("routes tierFor to the owning executor", async () => {
    const toolSet = createHostToolSet({
      workingDirectory: tempDir,
      filesystem: { enabled: true, rootDir: tempDir },
      shell: { enabled: true },
      web: { enabled: true },
      mcp: [{ name: "svc", command: "echo", args: ["x"] }],
    });
    // listTools must run first to populate the route table.
    await toolSet.listTools();
    expect(toolSet.tierFor?.("filesystem_read_file")).toBe("read");
    expect(toolSet.tierFor?.("filesystem_write_file")).toBe("idempotent");
    expect(toolSet.tierFor?.("filesystem_edit_file")).toBe("non-idempotent");
    expect(toolSet.tierFor?.("shell_run_command")).toBe("non-idempotent");
    expect(toolSet.tierFor?.("web_search")).toBe("read");
    expect(toolSet.tierFor?.("mcp_svc_call")).toBe("non-idempotent");
  });

  it("returns undefined for an unknown tool (falls back to the composite default)", () => {
    const toolSet = createHostToolSet({ workingDirectory: tempDir });
    expect(toolSet.tierFor?.("no_such_tool")).toBeUndefined();
  });

  it("composite defaults to non-idempotent and routes reconcile to the owner", async () => {
    const toolSet = createHostToolSet({
      workingDirectory: tempDir,
      filesystem: { enabled: true, rootDir: tempDir },
    });
    await toolSet.listTools();
    expect(toolSet.tier).toBe("non-idempotent");
    const reconciled = await toolSet.reconcile!(key("filesystem_write_file"));
    expect(reconciled.status).toBe("unknown");
  });

  it("composite reconcile reports unknown for an unknown tool", async () => {
    const toolSet = createHostToolSet({
      workingDirectory: tempDir,
      filesystem: { enabled: true, rootDir: tempDir },
    });
    await toolSet.listTools();
    const reconciled = await toolSet.reconcile!(key("filesystem_unknown"));
    expect(reconciled.status).toBe("unknown");
  });
});
