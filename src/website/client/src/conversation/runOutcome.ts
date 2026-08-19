import type { RunResultEvent } from "@shared/protocol";
import type { ConversationNode } from "./nodes";

export type RunOutcome = "success" | "partial" | "failed" | "aborted";

export interface RunOutcomePresentation {
  readonly outcome: RunOutcome;
  readonly badge: string;
  readonly hint: string;
}

/** Classify a terminal run for human-facing status (not runtime integrity). */
export function classifyRunOutcome(
  result: RunResultEvent,
  hasAssistantReply: boolean,
): RunOutcome {
  if (result.ok) return "success";
  if (result.terminationReason === "aborted") return "aborted";
  if (
    hasAssistantReply &&
    result.toolCalls.unresolved > 0 &&
    (result.error?.retryable === true || result.terminationReason === "error")
  ) {
    return "partial";
  }
  if (result.error?.retryable === true && result.toolCalls.unresolved > 0) return "partial";
  return "failed";
}

export function presentRunOutcome(
  result: RunResultEvent,
  hasAssistantReply: boolean,
): RunOutcomePresentation {
  const outcome = classifyRunOutcome(result, hasAssistantReply);
  switch (outcome) {
    case "success":
      return { outcome, badge: "✓ 完成", hint: "终止控制器已确认本轮目标。" };
    case "partial":
      return {
        outcome,
        badge: "⚠ 部分完成",
        hint: "助手已给出回复，但有工具失败尚未恢复；可继续对话或重试。",
      };
    case "aborted":
      return { outcome, badge: "⏹ 已中止", hint: "运行被手动停止。" };
    case "failed":
      return { outcome, badge: "✗ 未成功", hint: "本轮未能完成；请查看上方消息或重试。" };
  }
}

/** Whether this run produced a visible assistant reply before its run_result. */
export function hasAssistantReplyBeforeRunResult(
  nodes: readonly ConversationNode[],
  runResultIndex: number,
): boolean {
  for (let index = runResultIndex - 1; index >= 0; index -= 1) {
    const node = nodes[index];
    if (node === undefined) break;
    if (node.kind === "user") break;
    if (
      (node.kind === "assistant" || node.kind === "reasoning") &&
      (node.text ?? "").trim().length > 0
    ) {
      return true;
    }
  }
  return false;
}

export function findLatestRunResultIndex(nodes: readonly ConversationNode[]): number {
  for (let index = nodes.length - 1; index >= 0; index -= 1) {
    if (nodes[index]?.kind === "run_result") return index;
  }
  return -1;
}

export function terminationReasonLabel(reason: RunResultEvent["terminationReason"]): string {
  switch (reason) {
    case "controller":
      return "控制器";
    case "done":
      return "完成";
    case "max_turns":
      return "回合上限";
    case "max_time":
      return "时间上限";
    case "aborted":
      return "中止";
    case "error":
      return "错误";
    default:
      return "控制器";
  }
}
