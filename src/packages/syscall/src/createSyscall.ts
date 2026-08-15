/// <reference types="node" />
import type { ContentRef } from "@cantilune/core";
import type {
  Syscall,
  SyscallDependencies,
  ActionCall,
  ActionResult,
  ActionSchema,
  PerceptionResult,
  ReadContentResult,
  ToolCall,
  ToolResult,
  ToolObservationRecovery,
  ToolObservationRetryResult,
  WriteContentOptions,
} from "./syscall.js";
import { perceive } from "./perceive.js";
import { act, retryToolObservation, useTool } from "./act.js";
import { schemasFromTemplates, mergeWithToolSchemas } from "./toolSchema.js";

/**
 * Create a Syscall instance — the complete LLM ↔ OS translation layer.
 *
 * Design: pure pipe, no decisions. The Syscall instance:
 * - serializes state (perceive)
 * - parses+forwards actions (act)
 * - reads/writes content
 * - invokes tools
 *
 * All intelligence is on the LLM side. All governance is in runtime admission.
 */
export function createSyscall(deps: SyscallDependencies): Syscall {
  const { runtime, contentStore, principal, schemaProvider, toolExecutor } = deps;

  return {
    async perceive(): Promise<PerceptionResult> {
      return perceive(runtime, principal, schemaProvider);
    },

    async act(call: ActionCall): Promise<ActionResult> {
      if (call.operation.startsWith("tool:")) {
        return {
          ok: false,
          message:
            "External tool actions require the original LLM tool-call id. " +
            "Call syscall.useTool({ callId, toolName, args }) instead.",
          newHeadRef: undefined,
        };
      }
      return act(runtime, principal, schemaProvider, call, contentStore);
    },

    async readContent(ref: ContentRef): Promise<ReadContentResult> {
      const blob = await contentStore.get(ref);
      if (blob === undefined) {
        return { found: false, text: undefined, mimeType: undefined };
      }
      return {
        found: true,
        text: new TextDecoder().decode(blob.bytes),
        mimeType: blob.metadata.mimeType,
      };
    },

    async writeContent(content: string, options?: WriteContentOptions): Promise<ContentRef> {
      return contentStore.put(content, {
        mimeType: options?.mimeType ?? "text/plain",
        createdBy: principal.actorId,
      });
    },

    async useTool(call: ToolCall): Promise<ToolResult> {
      return useTool(runtime, contentStore, principal, toolExecutor, call);
    },

    async retryToolObservation(
      recovery: ToolObservationRecovery,
    ): Promise<ToolObservationRetryResult> {
      return retryToolObservation(runtime, contentStore, principal, recovery);
    },

    async availableActions(): Promise<ActionSchema[]> {
      const templates = schemaProvider.getTemplates();
      const actionSchemas = schemasFromTemplates(templates);
      return mergeWithToolSchemas(actionSchemas, toolExecutor);
    },
  };
}
