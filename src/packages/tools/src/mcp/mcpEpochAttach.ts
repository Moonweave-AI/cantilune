import type { SchemaAdmissionReceipt } from "@cantilune/core";
import type { McpConfig } from "../types.js";
import { clearMcpDiscoveryCache } from "./mcpDiscovery.js";

export interface McpAttachInput {
  readonly currentEpoch: string;
  readonly admissionReceipt?: SchemaAdmissionReceipt;
  readonly servers: readonly McpConfig[];
}

export interface McpToolSurface {
  readonly epochId: string;
  readonly admissionId: string;
  readonly servers: readonly McpConfig[];
}

/**
 * Commit an epoch-bound MCP tool surface. Rejects without a schema admission
 * receipt and never mutates mid-turn — the caller applies the returned surface
 * on the next turn boundary (ADR-0026). HTTP and stdio servers are both
 * admitted here; transport is chosen later by `createMcpClient`.
 */
export function applyMcpAttach(input: McpAttachInput): McpToolSurface {
  const receipt = input.admissionReceipt;
  if (receipt === undefined) {
    throw new Error("MCP attach rejected: schema admission receipt required (ADR-0026)");
  }

  const fromEpoch = String(receipt.fromBinding.epochId);
  const toEpoch = String(receipt.toBinding.epochId);
  if (fromEpoch !== input.currentEpoch) {
    throw new Error(
      `MCP attach rejected: receipt fromBinding epoch ${fromEpoch} is not the current epoch ${input.currentEpoch}`,
    );
  }
  if (toEpoch === input.currentEpoch) {
    throw new Error("MCP attach rejected: receipt does not advance the schema epoch");
  }

  clearMcpDiscoveryCache();
  return {
    epochId: toEpoch,
    admissionId: String(receipt.admissionId),
    servers: input.servers,
  };
}
