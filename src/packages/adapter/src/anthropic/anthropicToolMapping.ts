import type {
  LlmChatResponse,
  LlmMessage,
  LlmToolCallResult,
  LlmToolDef,
  TokenUsage,
} from "@cantilune/boot";

export interface AnthropicTool {
  readonly name: string;
  readonly description: string;
  readonly input_schema: Record<string, unknown>;
}

export interface AnthropicContentBlock {
  readonly type: string;
  readonly text?: string;
  readonly id?: string;
  readonly name?: string;
  readonly input?: Record<string, unknown>;
  readonly tool_use_id?: string;
  readonly content?: string;
}

export interface AnthropicMessage {
  readonly role: "user" | "assistant";
  readonly content: string | AnthropicContentBlock[];
}

export interface AnthropicResponseContentBlock {
  readonly type: string;
  readonly text?: string;
  readonly id?: string;
  readonly name?: string;
  readonly input?: Record<string, unknown>;
}

export function toAnthropicTools(tools: readonly LlmToolDef[]): AnthropicTool[] {
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    input_schema: tool.parameters,
  }));
}

export function splitSystemPrompt(messages: readonly LlmMessage[]): {
  readonly system: string | undefined;
  readonly conversation: readonly LlmMessage[];
} {
  const systemParts: string[] = [];
  const conversation: LlmMessage[] = [];

  for (const message of messages) {
    if (message.role === "system") {
      systemParts.push(message.content);
    } else {
      conversation.push(message);
    }
  }

  return {
    system: systemParts.length > 0 ? systemParts.join("\n\n") : undefined,
    conversation,
  };
}

function toAnthropicAssistantMessage(
  message: Extract<LlmMessage, { role: "assistant" }>,
): AnthropicMessage {
  if (message.toolCalls !== undefined && message.toolCalls.length > 0) {
    const blocks: AnthropicContentBlock[] = [];
    if (message.content.length > 0) {
      blocks.push({ type: "text", text: message.content });
    }
    for (const toolCall of message.toolCalls) {
      blocks.push({
        type: "tool_use",
        id: toolCall.id,
        name: toolCall.name,
        input: parseToolArguments(toolCall.arguments),
      });
    }
    return { role: "assistant", content: blocks };
  }
  return { role: "assistant", content: message.content };
}

export function toAnthropicMessages(messages: readonly LlmMessage[]): AnthropicMessage[] {
  const result: AnthropicMessage[] = [];

  for (const message of messages) {
    switch (message.role) {
      case "user":
        result.push({ role: "user", content: message.content });
        break;
      case "assistant":
        result.push(toAnthropicAssistantMessage(message));
        break;
      case "tool":
        result.push({
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: message.toolCallId,
              content: message.content,
            },
          ],
        });
        break;
      case "system":
        break;
      default: {
        const _exhaustive: never = message;
        throw new Error(`Unsupported message role: ${String(_exhaustive)}`);
      }
    }
  }

  return result;
}

function parseToolArguments(raw: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return { value: parsed };
  } catch {
    return { raw };
  }
}

function mapStopReason(reason: string | undefined): LlmChatResponse["finishReason"] {
  switch (reason) {
    case "end_turn":
      return "stop";
    case "tool_use":
      return "tool_calls";
    case "max_tokens":
      return "length";
    default:
      return "error";
  }
}

export interface AnthropicUsage {
  readonly input_tokens?: number;
  readonly output_tokens?: number;
}

function toTokenUsage(usage: AnthropicUsage): TokenUsage {
  const prompt = usage.input_tokens ?? 0;
  const completion = usage.output_tokens ?? 0;
  return { prompt, completion, total: prompt + completion };
}

export function fromAnthropicResponse(payload: {
  readonly content?: readonly AnthropicResponseContentBlock[];
  readonly stop_reason?: string;
  readonly usage?: AnthropicUsage;
}): LlmChatResponse {
  const toolCalls: LlmToolCallResult[] = [];
  const textParts: string[] = [];

  for (const block of payload.content ?? []) {
    if (block.type === "text" && block.text !== undefined) {
      textParts.push(block.text);
    }
    if (block.type === "tool_use" && block.id !== undefined && block.name !== undefined) {
      toolCalls.push({
        id: block.id,
        name: block.name,
        arguments: block.input ?? {},
      });
    }
  }

  return {
    text: toolCalls.length > 0 ? undefined : textParts.join("") || undefined,
    toolCalls,
    finishReason: toolCalls.length > 0 ? "tool_calls" : mapStopReason(payload.stop_reason),
    ...(payload.usage !== undefined ? { usage: toTokenUsage(payload.usage) } : {}),
  };
}

/** One frame from Anthropic's `messages` SSE stream. */
export interface AnthropicStreamEvent {
  readonly type: string;
  readonly index?: number;
  readonly delta?: {
    readonly type?: string;
    readonly text?: string;
    readonly partial_json?: string;
    readonly stop_reason?: string;
  };
  readonly content_block?: {
    readonly type?: string;
    readonly id?: string;
    readonly name?: string;
  };
  readonly message?: { readonly usage?: AnthropicUsage };
  readonly usage?: AnthropicUsage;
}

/**
 * Accumulates Anthropic SSE frames into a single {@link LlmChatResponse}.
 *
 * Anthropic streams content blocks positionally: `content_block_start` opens a
 * block at an index, `content_block_delta` appends to it (text or partial JSON
 * for tool input), and `message_delta` carries the stop reason.
 */
export class AnthropicStreamAccumulator {
  private text = "";
  private stopReason: string | undefined;
  private usage: AnthropicUsage | undefined;
  private readonly toolBlocks = new Map<number, { id: string; name: string; json: string }>();

  /** Feed one frame. Returns the text delta it contributed, if any. */
  push(event: AnthropicStreamEvent): string | undefined {
    const usage = event.usage ?? event.message?.usage;
    if (usage !== undefined) {
      this.usage = { ...this.usage, ...usage };
    }

    if (event.type === "content_block_start" && event.content_block?.type === "tool_use") {
      this.toolBlocks.set(event.index ?? 0, {
        id: event.content_block.id ?? "",
        name: event.content_block.name ?? "",
        json: "",
      });
      return undefined;
    }

    if (event.type === "content_block_delta") {
      const partial = event.delta?.partial_json;
      if (partial !== undefined) {
        const index = event.index ?? 0;
        const existing = this.toolBlocks.get(index);
        if (existing !== undefined) {
          existing.json += partial;
        }
        return undefined;
      }
      const textDelta = event.delta?.text;
      if (typeof textDelta === "string" && textDelta.length > 0) {
        this.text += textDelta;
        return textDelta;
      }
      return undefined;
    }

    if (event.type === "message_delta" && event.delta?.stop_reason !== undefined) {
      this.stopReason = event.delta.stop_reason;
    }
    return undefined;
  }

  finish(): LlmChatResponse {
    const toolCalls: LlmToolCallResult[] = [...this.toolBlocks.entries()]
      .sort(([a], [b]) => a - b)
      .map(([index, block]) => ({
        id: block.id.length > 0 ? block.id : `toolu_${index}`,
        name: block.name,
        arguments: parseToolArguments(block.json),
      }));

    // A tool-call turn carries no prose, so text is dropped rather than emitted empty.
    const accumulated = this.text.length > 0 ? this.text : undefined;

    return {
      text: toolCalls.length > 0 ? undefined : accumulated,
      toolCalls,
      finishReason: toolCalls.length > 0 ? "tool_calls" : mapStopReason(this.stopReason),
      ...(this.usage !== undefined ? { usage: toTokenUsage(this.usage) } : {}),
    };
  }
}
