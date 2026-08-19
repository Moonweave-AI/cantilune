import type { LlmMessage } from "../types.js";

export const TOOL_RESULT_PRUNE_MARKER = "\n\n[... tool result middle pruned ...]\n\n";

export interface ToolResultPrunePolicy {
  readonly thresholdChars: number;
  readonly headChars: number;
  readonly tailChars: number;
}

export interface ToolResultPruneResult {
  readonly messages: LlmMessage[];
  readonly prunedResults: number;
  readonly removedChars: number;
}

export const DEFAULT_TOOL_RESULT_PRUNE_POLICY: ToolResultPrunePolicy = {
  thresholdChars: 8_192,
  headChars: 4_096,
  tailChars: 1_024,
};

export function resolveToolResultPrunePolicy(
  input: Partial<ToolResultPrunePolicy> | undefined,
): ToolResultPrunePolicy {
  const policy = { ...DEFAULT_TOOL_RESULT_PRUNE_POLICY, ...input };
  for (const [name, value, minimum] of [
    ["thresholdChars", policy.thresholdChars, 1],
    ["headChars", policy.headChars, 0],
    ["tailChars", policy.tailChars, 0],
  ] as const) {
    if (!Number.isInteger(value) || value < minimum) {
      throw new TypeError(`toolResultPruning.${name} must be an integer >= ${String(minimum)}.`);
    }
  }
  if (
    policy.headChars + TOOL_RESULT_PRUNE_MARKER.length + policy.tailChars >
    policy.thresholdChars
  ) {
    throw new TypeError(
      "toolResultPruning headChars + marker + tailChars must not exceed thresholdChars.",
    );
  }
  return Object.freeze(policy);
}

export function pruneToolResults(
  messages: readonly LlmMessage[],
  policy: ToolResultPrunePolicy = DEFAULT_TOOL_RESULT_PRUNE_POLICY,
): ToolResultPruneResult {
  let prunedResults = 0;
  let removedChars = 0;
  const next = messages.map((message): LlmMessage => {
    if (message.role !== "tool" || message.content.length <= policy.thresholdChars) {
      return message;
    }
    const content =
      message.content.slice(0, policy.headChars) +
      TOOL_RESULT_PRUNE_MARKER +
      message.content.slice(Math.max(policy.headChars, message.content.length - policy.tailChars));
    prunedResults++;
    removedChars += message.content.length - content.length;
    return { role: "tool", toolCallId: message.toolCallId, content };
  });
  return { messages: next, prunedResults, removedChars };
}
