import type { ConversationNode, NodeKind } from "./nodes";

export type TimelineLane = "input" | "model" | "tools";
export type TimelineMode = "duration" | "sequence";
export type KindFilter = "all" | "model" | "tools" | "errors";

export interface TimelineSpan {
  readonly id: string;
  readonly lane: TimelineLane;
  readonly kind: NodeKind;
  readonly start: number;
  readonly end: number;
  readonly startMs: number;
  readonly durationMs: number;
  readonly error: boolean;
  readonly pending: boolean;
  readonly turn: number;
}

export interface TrajectoryStats {
  readonly turns: number;
  readonly steps: number;
  readonly llmMs: number;
  readonly toolMs: number;
  readonly tokens: number;
  readonly errors: number;
  readonly pending: number;
}

export interface TrajectoryModel {
  readonly spans: readonly TimelineSpan[];
  readonly stats: TrajectoryStats;
  readonly ticks: readonly number[];
  readonly domainMs: number;
}

const LANE_OF: Record<NodeKind, TimelineLane> = {
  user: "input",
  ask_user: "input",
  assistant: "model",
  reasoning: "model",
  diagnostic: "model",
  turn: "model",
  control_verdict: "model",
  run_result: "model",
  error: "model",
  tool_call: "tools",
  approval: "tools",
};

export function laneFor(kind: NodeKind): TimelineLane {
  return LANE_OF[kind];
}

/**
 * Busy-time estimate for one trajectory step. Wall-clock gaps between runs,
 * turns, or user idle time must not inflate the packed duration axis.
 */
export function estimateDuration(node: ConversationNode, now: number): number {
  if (node.pending === true && node.startedAt !== undefined) {
    return Math.max(60, now - node.startedAt);
  }
  if (node.kind === "tool_call") return Math.max(180, (node.output?.length ?? 24) * 2);
  if (node.kind === "reasoning") return Math.max(140, (node.text?.length ?? 16) * 8);
  if (node.kind === "assistant") return Math.max(120, (node.text?.length ?? 16) * 4);
  if (node.kind === "user") return 80;
  if (node.kind === "ask_user") return Math.max(100, (node.question?.length ?? 16) * 3);
  if (node.kind === "control_verdict") return 48;
  if (node.kind === "run_result") return 40;
  if (node.kind === "error") return 72;
  if (node.kind === "approval") return 56;
  if (node.kind === "diagnostic") return 40;
  return 60;
}

/** Turn boundaries are kept for run accounting, but are never user-visible spans. */
export function isTrajectoryEvent(node: ConversationNode): boolean {
  return node.kind !== "turn";
}

export function buildTrajectory(
  nodes: readonly ConversationNode[],
  mode: TimelineMode,
  now = Date.now(),
): TrajectoryModel {
  const events = nodes.filter(isTrajectoryEvent);
  const timed = events.map((node) => ({
    node,
    durationMs: estimateDuration(node, now),
  }));

  let cursor = 0;
  const sequential = timed.map((item) => {
    const seqStart = cursor;
    cursor += item.durationMs;
    return { ...item, seqStart };
  });
  const packedEnd = Math.max(1, cursor);

  const spans: TimelineSpan[] = events.map((node, index) => {
    const item = timed[index]!;
    const seq = sequential[index]!;
    const turn = node.turn || 0;
    // Duration mode is busy-time, not wall clock: idle gaps (think 然后 tool
    // 中间的空档) are dropped so each span's width is duration / total busy.
    let start = seq.seqStart / packedEnd;
    let end = (seq.seqStart + seq.durationMs) / packedEnd;
    if (mode === "sequence") {
      start = index / Math.max(1, events.length);
      end = (index + 1) / Math.max(1, events.length);
    }
    return {
      id: node.id,
      lane: laneFor(node.kind),
      kind: node.kind,
      start: Math.min(0.995, start),
      end: Math.max(start + 0.004, Math.min(1, end)),
      startMs: mode === "sequence" ? index : seq.seqStart,
      durationMs: item.durationMs,
      error: node.ok === false || node.kind === "error",
      pending: node.pending === true,
      turn,
    };
  });

  let llmMs = 0;
  let toolMs = 0;
  let tokens = 0;
  let errors = 0;
  let pending = 0;
  for (const span of spans) {
    if (span.lane === "model") llmMs += span.durationMs;
    if (span.lane === "tools") toolMs += span.durationMs;
    if (span.error) errors += 1;
    if (span.pending) pending += 1;
  }
  for (const node of nodes) {
    if (node.usage !== undefined) tokens += node.usage.total;
  }

  const domainMs = mode === "sequence" ? Math.max(1, events.length) : packedEnd;
  const tickCount = domainMs >= 8000 ? 5 : 4;
  const ticks = Array.from({ length: tickCount }, (_, index) =>
    Math.round((domainMs * index) / (tickCount - 1)),
  );

  return {
    spans,
    stats: {
      turns: Math.max(0, ...nodes.map((node) => node.turn)),
      steps: events.length,
      llmMs,
      toolMs,
      tokens,
      errors,
      pending,
    },
    ticks,
    domainMs,
  };
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)}s`;
  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.round((ms % 60_000) / 1000);
  return `${minutes}m${seconds.toString().padStart(2, "0")}s`;
}

export function formatTokens(count: number): string {
  if (count <= 0) return "—";
  if (count < 1000) return `${count}`;
  if (count < 10_000) return `${(count / 1000).toFixed(1)}k`;
  return `${Math.round(count / 1000)}k`;
}

export function labelFor(node: ConversationNode): string {
  if (node.kind === "tool_call") return node.ok === false ? "工具失败" : "工具";
  if (node.kind === "reasoning") return "思考";
  if (node.kind === "assistant") return "助手";
  if (node.kind === "user") return "用户";
  if (node.kind === "run_result") return "结果";
  if (node.kind === "error") return "错误";
  if (node.kind === "control_verdict") return "裁决";
  if (node.kind === "ask_user") return "询问";
  if (node.kind === "approval") return "审批";
  if (node.kind === "diagnostic") return "诊断";
  if (node.kind === "turn") return "回合";
  return node.kind;
}

/** Internal transport prefixes are useful to the runtime, not to a human. */
export function displayToolName(toolName: string | undefined): string {
  const normalized = toolName?.replace(/^(?:tool:)+/u, "").trim();
  return normalized && normalized.length > 0 ? normalized : "tool";
}

function inlineValue(value: unknown, maxLength = 132): string {
  let text: string;
  if (typeof value === "string") text = value;
  else {
    try {
      text = JSON.stringify(value);
    } catch {
      text = "[unserializable]";
    }
  }
  const compact = text.replace(/\s+/gu, " ").trim();
  return compact.length > maxLength ? `${compact.slice(0, maxLength - 1)}…` : compact;
}

export function summaryFor(node: ConversationNode): string {
  if (node.kind === "tool_call") {
    const payload = inlineValue(node.arguments ?? {});
    const result = node.pending === true ? "running" : inlineValue(node.output ?? "no result");
    return `${displayToolName(node.toolName)} ${payload} -> ${result}`;
  }
  const text =
    node.text ??
    node.output ??
    node.detail ??
    node.message ??
    node.question ??
    node.runResult?.summary ??
    node.lastAction ??
    node.toolName ??
    "运行事件";
  return text.replace(/\s+/g, " ").trim();
}

export function searchable(node: ConversationNode): string {
  return `${labelFor(node)} ${summaryFor(node)} ${node.toolName ?? ""} ${node.kind}`.toLowerCase();
}

export function matchesFilter(node: ConversationNode, filter: KindFilter): boolean {
  if (filter === "all") return true;
  if (filter === "errors") return node.ok === false || node.kind === "error";
  if (filter === "tools") return laneFor(node.kind) === "tools";
  return laneFor(node.kind) === "model";
}

export function schemaFor(node: ConversationNode): string {
  if (node.toolName === undefined) return "该事件没有独立工具定义。";
  const keys = node.arguments === undefined ? [] : Object.keys(node.arguments);
  if (keys.length === 0) return `${node.toolName} 没有记录到结构化参数。`;
  return `${node.toolName} 参数：${keys.join(" · ")}`;
}
