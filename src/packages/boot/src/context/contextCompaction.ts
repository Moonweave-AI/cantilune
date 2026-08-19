import type { LlmAdapter, LlmMessage } from "../types.js";
import { estimateMessageTokens } from "./tokenMeter.js";

export const CONTEXT_CHECKPOINT_PREFIX = "[Conversation compacted:";

const SUMMARY_INSTRUCTION = [
  "Act only as a context compaction engine.",
  "Summarize the conversation above into a checkpoint that lets another model continue the task.",
  "Use terse Markdown bullets under these exact headings:",
  "## Primary Request and Intent",
  "## Key Technical Context",
  "## Files, Commands, and Changes",
  "## Errors and Fixes",
  "## Pending Work",
  "## Next Step",
  "Preserve exact paths, identifiers, commands, numeric limits, decisions, and unresolved user requests.",
  "Do not call tools. Output only the checkpoint.",
].join("\n");

export interface ContextCompactionPolicy {
  readonly auto: boolean;
  readonly thresholdRatio: number;
  readonly retainRatio: number;
  readonly maxSummaryTokens: number;
  readonly compactionRetries: number;
  readonly maxOverflowRetries: number;
}

export const DEFAULT_CONTEXT_COMPACTION_POLICY: ContextCompactionPolicy = {
  auto: true,
  thresholdRatio: 0.8,
  retainRatio: 0.16,
  maxSummaryTokens: 8_192,
  compactionRetries: 1,
  maxOverflowRetries: 1,
};

export function resolveContextCompactionPolicy(
  input: Partial<ContextCompactionPolicy> | undefined,
): ContextCompactionPolicy {
  const policy = { ...DEFAULT_CONTEXT_COMPACTION_POLICY, ...input };
  if (typeof policy.auto !== "boolean")
    throw new TypeError("contextCompaction.auto must be boolean.");
  for (const [name, ratio] of [
    ["thresholdRatio", policy.thresholdRatio],
    ["retainRatio", policy.retainRatio],
  ] as const) {
    if (!Number.isFinite(ratio) || ratio <= 0 || ratio >= 1) {
      throw new TypeError(`contextCompaction.${name} must be greater than 0 and less than 1.`);
    }
  }
  if (policy.retainRatio >= policy.thresholdRatio) {
    throw new TypeError("contextCompaction.retainRatio must be smaller than thresholdRatio.");
  }
  for (const [name, value, minimum] of [
    ["maxSummaryTokens", policy.maxSummaryTokens, 1],
    ["compactionRetries", policy.compactionRetries, 0],
    ["maxOverflowRetries", policy.maxOverflowRetries, 0],
  ] as const) {
    if (!Number.isInteger(value) || value < minimum) {
      throw new TypeError(`contextCompaction.${name} must be an integer >= ${String(minimum)}.`);
    }
  }
  return Object.freeze(policy);
}

export interface ContextCompactionResult {
  readonly messages: LlmMessage[];
  readonly shadowedMessages: number;
  readonly summaryUsagePrompt?: number;
}

interface MessageUnit {
  readonly messages: readonly LlmMessage[];
  readonly indices: readonly number[];
}

function messageUnits(messages: readonly LlmMessage[]): MessageUnit[] {
  const units: MessageUnit[] = [];
  for (let index = 0; index < messages.length; index++) {
    const first = messages[index];
    if (first === undefined) continue;
    if (first.role === "assistant" && (first.toolCalls?.length ?? 0) > 0) {
      const count = first.toolCalls?.length ?? 0;
      const rows = messages.slice(index, index + count + 1);
      if (
        rows.length === count + 1 &&
        rows
          .slice(1)
          .every(
            (row, offset) =>
              row.role === "tool" && row.toolCallId === first.toolCalls?.[offset]?.id,
          )
      ) {
        units.push({
          messages: rows,
          indices: Array.from({ length: rows.length }, (_, offset) => index + offset),
        });
        index += count;
        continue;
      }
    }
    units.push({ messages: [first], indices: [index] });
  }
  return units;
}

function checkpoint(message: LlmMessage): boolean {
  return message.role === "system" && message.content.startsWith(CONTEXT_CHECKPOINT_PREFIX);
}

function protectedMessageIndices(
  messages: readonly LlmMessage[],
  units: readonly MessageUnit[],
  goalMessage: LlmMessage,
): Set<number> {
  const protectedIndices = new Set<number>();
  const systemIndex = messages.findIndex(
    (message) => message.role === "system" && !checkpoint(message),
  );
  if (systemIndex >= 0) protectedIndices.add(systemIndex);
  const goalIndex = messages.indexOf(goalMessage);
  if (goalIndex >= 0) protectedIndices.add(goalIndex);
  const latestToolUnit = [...units].reverse().find((unit) => {
    const first = unit.messages[0];
    return first?.role === "assistant" && (first.toolCalls?.length ?? 0) > 0;
  });
  for (const index of latestToolUnit?.indices ?? []) protectedIndices.add(index);
  return protectedIndices;
}

function retainedTailStart(units: readonly MessageUnit[], retainTokens: number): number {
  let retained = 0;
  let keepFrom = units.length;
  for (let index = units.length - 1; index >= 0; index--) {
    const unit = units[index];
    if (unit === undefined) continue;
    retained += unit.messages.reduce((total, message) => total + estimateMessageTokens(message), 0);
    keepFrom = index;
    if (retained >= retainTokens) break;
  }
  return keepFrom;
}

function selectShadowedIndices(
  messages: readonly LlmMessage[],
  goalMessage: LlmMessage,
  retainTokens: number,
): Set<number> {
  const units = messageUnits(messages);
  const protectedIndices = protectedMessageIndices(messages, units, goalMessage);
  const keepFrom = retainedTailStart(units, retainTokens);

  const shadowed = new Set<number>();
  for (let unitIndex = 0; unitIndex < keepFrom; unitIndex++) {
    const unit = units[unitIndex];
    if (unit === undefined || unit.indices.some((index) => protectedIndices.has(index))) continue;
    for (const index of unit.indices) shadowed.add(index);
  }
  for (let index = 0; index < messages.length; index++) {
    const message = messages[index];
    if (message !== undefined && checkpoint(message)) shadowed.add(index);
  }
  return shadowed;
}

export async function compactContext(
  llm: LlmAdapter,
  messages: readonly LlmMessage[],
  goalMessage: LlmMessage,
  retainTokens: number,
  maxSummaryTokens: number,
  signal?: AbortSignal,
): Promise<ContextCompactionResult | null> {
  const shadowed = selectShadowedIndices(messages, goalMessage, retainTokens);
  if (shadowed.size === 0) return null;
  const source = messages.filter((_, index) => shadowed.has(index));
  if (source.length === 0) return null;

  const system = messages.find((message) => message.role === "system" && !checkpoint(message));
  const summaryMessages: LlmMessage[] = [
    ...(system === undefined ? [] : [system]),
    ...source,
    { role: "user", content: SUMMARY_INSTRUCTION },
  ];
  const response = await llm.chat({
    messages: summaryMessages,
    tools: [],
    maxTokens: maxSummaryTokens,
    ...(signal === undefined ? {} : { signal }),
  });
  if (
    response.finishReason === "length" ||
    response.finishReason === "error" ||
    response.toolCalls.length > 0 ||
    response.text === undefined ||
    response.text.trim().length === 0
  ) {
    throw new Error("Context compaction did not produce a complete text checkpoint.");
  }

  const marker: LlmMessage = {
    role: "system",
    content:
      `${CONTEXT_CHECKPOINT_PREFIX} ${String(shadowed.size)} earlier message(s) summarized.]\n` +
      "Treat this checkpoint as established context and continue from the messages that follow.\n\n" +
      response.text.trim(),
  };
  const retained = messages.filter((_, index) => !shadowed.has(index));
  const retainedSystemIndex = retained.findIndex((message) => message.role === "system");
  const next =
    retainedSystemIndex < 0
      ? [marker, ...retained]
      : [
          ...retained.slice(0, retainedSystemIndex + 1),
          marker,
          ...retained.slice(retainedSystemIndex + 1),
        ];
  return {
    messages: next,
    shadowedMessages: shadowed.size,
    ...(response.usage === undefined ? {} : { summaryUsagePrompt: response.usage.prompt }),
  };
}
