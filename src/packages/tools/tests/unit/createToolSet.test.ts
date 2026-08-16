import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import * as mcpBridge from "../../src/mcp/mcpBridge.js";
import { clearMcpDiscoveryCache } from "../../src/mcp/mcpDiscovery.js";
import {
  activationDomainId,
  admissionTombstoneId,
  bindingGeneration,
  contentDigest,
  correlationId,
  epochId,
  epochOrdinal,
  handlerManifestDigest,
  handlerManifestId,
  handlerManifestRef,
  idempotencyKey,
  occurrenceId,
  planDigest,
  policyId,
  policyRef,
  policyRevisionId,
  schemaAdmissionId,
  schemaDigest,
  schemaId,
  schemaRevisionId,
  snapshotRef,
  storeSequence,
  type SchemaAdmissionReceipt,
} from "@cantilune/core";
import { createToolSet } from "../../src/createToolSet.js";
import { createOsSandbox } from "../../src/sandbox/osSandbox.js";
import { createHostToolSet } from "../support/hostToolSet.js";

function mcpReceipt(): SchemaAdmissionReceipt {
  const binding = {
    activationDomainId: activationDomainId("default"),
    bindingGeneration: bindingGeneration(1),
    epochId: epochId("epoch-1"),
    epochOrdinal: epochOrdinal(1),
    schemaRef: {
      schemaId: schemaId("default-v1"),
      revisionId: schemaRevisionId("rev-001"),
      digest: schemaDigest("d1"),
    },
    policyRef: policyRef(policyId("p1"), policyRevisionId("pr1"), contentDigest("pd1")),
    handlerManifestRef: handlerManifestRef(handlerManifestId("h1"), handlerManifestDigest("hd1")),
    runtimeHead: snapshotRef("snap-S0"),
    admissionId: schemaAdmissionId("bootstrap"),
    activatedBy: "bootstrap",
    activatedAt: "2026-08-15T00:00:00Z",
  };
  return {
    admissionId: schemaAdmissionId("adm-mcp-1"),
    activationDomainId: activationDomainId("default"),
    fromBinding: binding,
    toBinding: { ...binding, epochId: epochId("epoch-2"), epochOrdinal: epochOrdinal(2) },
    beforeSnapshotRef: snapshotRef("snap-S0"),
    afterSnapshotRef: snapshotRef("snap-E1"),
    extensionPlanRef: "plan-ref-1",
    admissionTombstoneId: admissionTombstoneId("tomb-1"),
    committedBy: "test",
    committedAt: "2026-08-15T00:00:00Z",
    storeSequence: storeSequence(1),
    correlationId: correlationId("corr-1"),
    occurrenceId: occurrenceId("occ-1"),
    idempotencyKey: idempotencyKey("idem-1"),
    planDigest: planDigest("pd-1"),
  };
}

function createMockClient(): mcpBridge.McpClient {
  return {
    connect: vi.fn(async () => undefined),
    disconnect: vi.fn(),
    listTools: vi.fn(async () => [
      {
        name: "call",
        description: "Proxy call",
        inputSchema: {
          type: "object",
          properties: {
            tool: { type: "string" },
            arguments: { type: "object" },
          },
          required: ["tool"],
        },
      },
    ]),
    callTool: vi.fn(async () => ({ content: [{ type: "text", text: "mcp ok" }] })),
  };
}

describe("createToolSet", () => {
  let tempDir: string;
  let createClientSpy: MockInstance<typeof mcpBridge.createMcpClient>;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "cantilune-tools-set-"));
    clearMcpDiscoveryCache();
    createClientSpy = vi.spyOn(mcpBridge, "createMcpClient").mockReturnValue(createMockClient());
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
    clearMcpDiscoveryCache();
    createClientSpy.mockRestore();
  });

  it("merges enabled executors and routes by tool name", async () => {
    const toolSet = createHostToolSet({
      workingDirectory: tempDir,
      filesystem: { enabled: true, rootDir: tempDir },
      shell: { enabled: true },
      web: { enabled: true },
      mcp: [{ name: "test-server", command: "echo", args: ["mcp"] }],
    });

    const tools = await toolSet.listTools();
    const toolNames = tools.map((tool) => tool.name);
    expect(toolNames).toContain("filesystem_write_file");
    expect(toolNames).toContain("shell_run_command");
    expect(toolNames).toContain("web_search");
    expect(toolNames).toContain("mcp_test-server_call");

    const writeResult = await toolSet.execute("filesystem_write_file", {
      path: "routed.txt",
      content: "routed content",
    });
    expect(writeResult.ok).toBe(true);

    const readResult = await toolSet.execute("filesystem_read_file", {
      path: "routed.txt",
    });
    expect(readResult.ok).toBe(true);
    expect(readResult.output).toContain("routed content");

    const unknown = await toolSet.execute("nonexistent_tool", {});
    expect(unknown.ok).toBe(false);
    expect(unknown.output).toContain("Unknown tool");

    const aborted = new AbortController();
    aborted.abort();
    const skipped = await toolSet.execute(
      "filesystem_read_file",
      { path: "routed.txt" },
      { signal: aborted.signal },
    );
    expect(skipped.ok).toBe(false);
    expect(skipped.output).toContain("aborted before dispatch");
  });

  it("creates a required sandbox by default without executing host shell", async () => {
    const toolSet = createToolSet({
      workingDirectory: tempDir,
      shell: { enabled: true },
    });
    const tools = await toolSet.listTools();
    expect(tools.map((tool) => tool.name)).toContain("shell_run_command");
  });

  it("returns empty tool list when no groups enabled", async () => {
    const toolSet = createHostToolSet({
      workingDirectory: tempDir,
    });
    const tools = await toolSet.listTools();
    expect(tools).toEqual([]);
  });

  it("defaults sandbox to required and fail-closes shell without a host fallback", async () => {
    const sandbox = createOsSandbox({
      platform: "linux",
      runner: {
        async run() {
          throw new Error("no docker");
        },
      },
    });
    const toolSet = createToolSet({
      workingDirectory: tempDir,
      shell: { enabled: true },
      osSandbox: sandbox,
    });
    const result = await toolSet.execute("shell_run_command", { command: "echo hi" });
    expect(result.ok).toBe(false);
    expect(result.output).toMatch(/fail-closed/);
  });

  it("applies an epoch-bound MCP surface and refuses attach without a receipt", async () => {
    const toolSet = createHostToolSet({
      workingDirectory: tempDir,
      mcp: [{ name: "old", command: "echo", args: ["old"] }],
    });
    expect(() =>
      toolSet.applyMcpSurface({
        currentEpoch: "epoch-1",
        servers: [{ name: "next", command: "echo", args: ["next"] }],
      }),
    ).toThrow(/admission receipt required/);

    const surface = toolSet.applyMcpSurface({
      currentEpoch: "epoch-1",
      admissionReceipt: mcpReceipt(),
      servers: [{ name: "next", command: "echo", args: ["next"] }],
    });
    expect(surface.epochId).toBe("epoch-2");
    const tools = await toolSet.listTools();
    expect(tools.some((tool) => tool.name.startsWith("mcp_next_"))).toBe(true);
    expect(tools.some((tool) => tool.name.startsWith("mcp_old_"))).toBe(false);
  });
});
