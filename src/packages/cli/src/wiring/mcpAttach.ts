import type { SchemaAdmissionReceipt } from "@cantilune/core";
import type { McpConfig, ToolSet } from "@cantilune/tools";
import type { CommandServices } from "../commands/registry.js";
import type { AppStore, PendingToolSurface } from "../store.js";
import { parseMcpServerSpec } from "./cliToolSet.js";

export function currentMcpEpoch(store: AppStore, services?: CommandServices): string {
  return (
    store.runtime.epoch?.epochId ??
    (services?.controlPlane?.()?.genesisBinding.epochId as string | undefined) ??
    "unknown"
  );
}

export async function scheduleMcpAttach(input: {
  readonly store: AppStore;
  readonly services?: CommandServices;
  readonly action: PendingToolSurface["action"];
  readonly servers: readonly string[];
}): Promise<PendingToolSurface> {
  const currentEpoch = currentMcpEpoch(input.store, input.services);
  let admissionId: string | undefined;
  let admissionReceipt = undefined as PendingToolSurface["admissionReceipt"];
  let epochForAttach = currentEpoch;
  const controller = input.services?.controlPlane?.();
  if (controller !== undefined && typeof controller.commitToolSurfaceEpoch === "function") {
    const committed = controller.commitToolSurfaceEpoch(currentEpoch);
    if (committed.ok && committed.receipt !== undefined) {
      admissionId = committed.admissionId;
      admissionReceipt = committed.receipt;
      epochForAttach = String(committed.receipt.fromBinding.epochId);
    } else {
      input.services?.notify?.("warn", `tool-surface epoch: ${committed.message}`);
    }
  } else if (controller !== undefined) {
    const admitted = await controller.admitCandidate(currentEpoch);
    if (admitted.ok) {
      admissionId = admitted.admissionId;
    } else {
      input.services?.notify?.("warn", `schema admission: ${admitted.message}`);
    }
  }

  const pending: PendingToolSurface = {
    action: input.action,
    servers: input.servers,
    currentEpoch: epochForAttach,
    ...(admissionId !== undefined ? { admissionId } : {}),
    ...(admissionReceipt !== undefined ? { admissionReceipt } : {}),
  };
  input.store.pendingToolSurface = pending;
  return pending;
}

export function resolvePendingReceipt(
  pending: PendingToolSurface,
  services?: CommandServices,
): SchemaAdmissionReceipt | undefined {
  if (pending.admissionReceipt !== undefined) {
    return pending.admissionReceipt;
  }
  if (pending.admissionId === undefined) {
    return undefined;
  }
  return services?.controlPlane?.()?.getCommitReceipt(pending.admissionId);
}

export function pendingServersToConfigs(servers: readonly string[]): readonly McpConfig[] {
  return servers
    .map(parseMcpServerSpec)
    .map((parsed) => parsed.config)
    .filter((config): config is McpConfig => config !== undefined);
}

/**
 * Apply a scheduled MCP surface. Safe to call at turn start (onBeforeTurn).
 * Returns without mutating tools when the receipt is still missing.
 */
export function applyPendingMcpAttach(input: {
  readonly store: AppStore;
  readonly toolSet: ToolSet;
  readonly services?: CommandServices;
}): { readonly applied: boolean; readonly reason?: string } {
  const pending = input.store.pendingToolSurface;
  if (pending === null) {
    return { applied: false, reason: "no pending surface" };
  }
  const receipt = resolvePendingReceipt(pending, input.services);
  if (receipt === undefined) {
    return { applied: false, reason: "admission receipt required" };
  }
  try {
    input.toolSet.applyMcpSurface({
      currentEpoch: pending.currentEpoch,
      admissionReceipt: receipt,
      servers: pendingServersToConfigs(pending.servers),
    });
    input.store.pendingToolSurface = null;
    return { applied: true };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return { applied: false, reason };
  }
}
