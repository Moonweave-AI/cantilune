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

export function estimateDuration(node: ConversationNode, now: number): number {
  if (node.elapsedMs !== undefined && node.elapsedMs > 0) return node.elapsedMs;
  if (node.startedAt !== undefined) {
    const end = node.endedAt ?? (node.pending === true ? now : node.startedAt);
    const lived = Math.max(0, end - node.startedAt);
    if (lived > 0) return lived;
  }
  if (node.kind === "tool_call") return Math.max(180, (node.output?.length ?? 24) * 2);
  if (node.kind === "reasoning") return Math.max(140, (node.text?.length ?? 16) * 8);
  if (node.kind === "assistant") return Math.max(120, (node.text?.length ?? 16) * 4);
  if (node.kind === "user") return 80;
  return 60;
}

export function buildTrajectory(
  nodes: readonly ConversationNode[],
  mode: TimelineMode,
  now = Date.now(),
): TrajectoryModel {
  const timed = nodes.map((node, index) => {
    const durationMs = estimateDuration(node, now);
    const startMs = node.startedAt ?? (index === 0 ? 0 : (nodes[0]?.startedAt ?? 0) + index * 40);
    return { node, startMs, durationMs };
  });
  const origin = timed[0]?.startMs ?? 0;
  const relative = timed.map((item) => ({
    ...item,
    startMs: Math.max(0, item.startMs - origin),
  }));

  let cursor = 0;
  const sequential = relative.map((item) => {
    const startMs = cursor;
    cursor += item.durationMs;
    return { ...item, seqStart: startMs };
  });
  const packedEnd = Math.max(1, cursor);

  const spans: TimelineSpan[] = nodes.map((node, index) => {
    const item = relative[index]!;
    const seq = sequential[index]!;
    const turn = node.turn || 0;
    // Duration mode is busy-time, not wall clock: idle gaps (think 然后 tool
    // 中间的空档) are dropped so each span's width is duration / total busy.
    let start = seq.seqStart / packedEnd;
    let end = (seq.seqStart + seq.durationMs) / packedEnd;
    if (mode === "sequence") {
      start = index / Math.max(1, nodes.length);
      end = (index + 1) / Math.max(1, nodes.length);
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

  const domainMs =
    mode === "sequence" ? Math.max(1, nodes.length) : packedEnd;
  const tickCount = domainMs >= 8000 ? 5 : 4;
  const ticks = Array.from({ length: tickCount }, (_, index) =>
    Math.round((domainMs * index) / (tickCount - 1)),
  );

  return {
    spans,
    stats: {
      turns: Math.max(0, ...nodes.map((node) => node.turn)),
      steps: nodes.length,
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

export function summaryFor(node: ConversationNode): string {
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
