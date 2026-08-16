import { describe, expect, it } from "vitest";
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
import { applyMcpAttach } from "../../src/mcp/mcpEpochAttach.js";
import { clearMcpDiscoveryCache, discoverMcpTools } from "../../src/mcp/mcpDiscovery.js";
import type { McpClient } from "../../src/mcp/mcpBridge.js";

function receipt(overrides: Partial<SchemaAdmissionReceipt> = {}): SchemaAdmissionReceipt {
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
    ...overrides,
  };
}

describe("applyMcpAttach", () => {
  it("rejects without a schema admission receipt", () => {
    expect(() =>
      applyMcpAttach({
        currentEpoch: "epoch-1",
        servers: [{ name: "docs", command: "npx" }],
      }),
    ).toThrow(/admission receipt required/);
  });

  it("rejects a receipt that is not bound to the current epoch", () => {
    expect(() =>
      applyMcpAttach({
        currentEpoch: "epoch-other",
        admissionReceipt: receipt(),
        servers: [{ name: "docs", command: "npx" }],
      }),
    ).toThrow(/not the current epoch/);
  });

  it("rejects a receipt that does not advance the epoch", () => {
    const sameEpoch = receipt();
    expect(() =>
      applyMcpAttach({
        currentEpoch: "epoch-1",
        admissionReceipt: {
          ...sameEpoch,
          toBinding: sameEpoch.fromBinding,
        },
        servers: [{ name: "docs", command: "npx" }],
      }),
    ).toThrow(/does not advance/);
  });

  it("allows HTTP MCP when a schema admission receipt advances the epoch", () => {
    const surface = applyMcpAttach({
      currentEpoch: "epoch-1",
      admissionReceipt: receipt(),
      servers: [{ name: "remote", command: "https://mcp.example/sse" }],
    });
    expect(surface.servers[0]?.command).toContain("https://");
  });

  it("returns the next tool surface and invalidates discovery cache", async () => {
    clearMcpDiscoveryCache();
    const client: McpClient = {
      connect: async () => undefined,
      disconnect: () => undefined,
      listTools: async () => [
        { name: "stale", description: "old", inputSchema: { type: "object", properties: {} } },
      ],
      callTool: async () => ({ content: [] }),
    };
    await discoverMcpTools(client, "docs");

    const surface = applyMcpAttach({
      currentEpoch: "epoch-1",
      admissionReceipt: receipt(),
      servers: [{ name: "docs", command: "npx", args: ["-y", "server"] }],
    });

    expect(surface.epochId).toBe("epoch-2");
    expect(surface.admissionId).toBe("adm-mcp-1");
    expect(surface.servers).toEqual([{ name: "docs", command: "npx", args: ["-y", "server"] }]);

    const refreshed = await discoverMcpTools(
      {
        ...client,
        listTools: async () => [
          { name: "fresh", description: "new", inputSchema: { type: "object", properties: {} } },
        ],
      },
      "docs",
    );
    expect(refreshed.tools[0]?.name).toBe("mcp_docs_fresh");
  });

  it("still requires epoch admission for HTTP MCP", () => {
    expect(() =>
      applyMcpAttach({
        currentEpoch: "epoch-1",
        servers: [{ name: "remote", command: "https://mcp.example/sse" }],
      }),
    ).toThrow(/admission receipt required/);
  });
});
