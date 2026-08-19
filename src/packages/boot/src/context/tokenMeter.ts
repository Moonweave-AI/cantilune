import type { LlmMessage, LlmToolDef, TokenUsage } from "../types.js";

const CHARS_PER_TOKEN = 4;
const MESSAGE_OVERHEAD = 4;
const TOOL_OVERHEAD = 8;

export type TokenEstimateSource = "heuristic" | "provider_usage";

export interface ContextTokenAnchor {
  readonly heuristicPromptTokens: number;
  readonly providerPromptTokens: number;
}

export interface ContextTokenMeasurement {
  readonly promptTokens: number;
  readonly heuristicPromptTokens: number;
  readonly source: TokenEstimateSource;
}

function textTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

export function estimateMessageTokens(message: LlmMessage): number {
  let tokens = textTokens(message.content) + MESSAGE_OVERHEAD;
  if (message.role === "tool") return tokens + textTokens(message.toolCallId);
  if (message.role !== "assistant" || message.toolCalls === undefined) return tokens;
  for (const call of message.toolCalls) {
    tokens +=
      textTokens(call.id) + textTokens(call.name) + textTokens(call.arguments) + TOOL_OVERHEAD;
  }
  return tokens;
}

export function estimateRequestTokens(
  messages: readonly LlmMessage[],
  tools: readonly LlmToolDef[],
): number {
  const messageTokens = messages.reduce(
    (total, message) => total + estimateMessageTokens(message),
    0,
  );
  const toolTokens = tools.reduce(
    (total, tool) =>
      total +
      textTokens(tool.name) +
      textTokens(tool.description) +
      textTokens(JSON.stringify(tool.parameters)) +
      TOOL_OVERHEAD,
    0,
  );
  return messageTokens + toolTokens;
}

/**
 * Provider-anchored prompt meter. A successful call supplies the exact prompt
 * price; subsequent measurements reprice only the heuristic surface delta.
 */
export class ContextTokenMeter {
  private anchor: ContextTokenAnchor | undefined;

  constructor(anchor?: ContextTokenAnchor) {
    this.anchor = anchor === undefined ? undefined : { ...anchor };
  }

  measure(messages: readonly LlmMessage[], tools: readonly LlmToolDef[]): ContextTokenMeasurement {
    const heuristicPromptTokens = estimateRequestTokens(messages, tools);
    if (this.anchor === undefined) {
      return {
        promptTokens: heuristicPromptTokens,
        heuristicPromptTokens,
        source: "heuristic",
      };
    }
    return {
      promptTokens: Math.max(
        0,
        this.anchor.providerPromptTokens +
          heuristicPromptTokens -
          this.anchor.heuristicPromptTokens,
      ),
      heuristicPromptTokens,
      source: "provider_usage",
    };
  }

  recordSuccessfulRequest(
    messages: readonly LlmMessage[],
    tools: readonly LlmToolDef[],
    usage: TokenUsage | undefined,
  ): void {
    if (usage === undefined) return;
    this.anchor = {
      heuristicPromptTokens: estimateRequestTokens(messages, tools),
      providerPromptTokens: usage.prompt,
    };
  }

  snapshot(): ContextTokenAnchor | undefined {
    return this.anchor === undefined ? undefined : { ...this.anchor };
  }
}
