import type { LlmChatResponse, LlmMessage, LlmToolCallResult, LlmToolDef } from "@cantilune/boot";

export interface BedrockToolSpec {
  readonly toolSpec: {
    readonly name: string;
    readonly description: string;
    readonly inputSchema: {
      readonly json: Record<string, unknown>;
    };
  };
}

export interface BedrockContentBlock {
  readonly text?: string;
  readonly toolUse?: {
    readonly toolUseId: string;
    readonly name: string;
    readonly input?: Record<string, unknown>;
  };
  readonly toolResult?: {
    readonly toolUseId: string;
    readonly content: readonly { readonly text: string }[];
  };
}

export interface BedrockMessage {
  readonly role: "user" | "assistant";
  readonly content: BedrockContentBlock[];
}

export function toBedrockTools(tools: readonly LlmToolDef[]): BedrockToolSpec[] {
  return tools.map((tool) => ({
    toolSpec: {
      name: tool.name,
      description: tool.description,
      inputSchema: {
        json: tool.parameters,
      },
    },
  }));
}

export function splitSystemPrompt(messages: readonly LlmMessage[]): {
  readonly system: readonly { readonly text: string }[];
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
    system: systemParts.map((text) => ({ text })),
    conversation,
  };
}

function toBedrockAssistantMessage(
  message: Extract<LlmMessage, { role: "assistant" }>,
): BedrockMessage {
  if (message.toolCalls !== undefined && message.toolCalls.length > 0) {
    const content: BedrockContentBlock[] = [];
    if (message.content.length > 0) {
      content.push({ text: message.content });
    }
    for (const toolCall of message.toolCalls) {
      content.push({
        toolUse: {
          toolUseId: toolCall.id,
          name: toolCall.name,
          input: parseToolArguments(toolCall.arguments),
        },
      });
    }
    return { role: "assistant", content };
  }
  return {
    role: "assistant",
    content: [{ text: message.content }],
  };
}

export function toBedrockMessages(messages: readonly LlmMessage[]): BedrockMessage[] {
  const result: BedrockMessage[] = [];

  for (const message of messages) {
    switch (message.role) {
      case "user":
        result.push({
          role: "user",
          content: [{ text: message.content }],
        });
        break;
      case "assistant":
        result.push(toBedrockAssistantMessage(message));
        break;
      case "tool":
        result.push({
          role: "user",
          content: [
            {
              toolResult: {
                toolUseId: message.toolCallId,
                content: [{ text: message.content }],
              },
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

export function fromBedrockResponse(payload: {
  readonly output?: {
    readonly message?: {
      readonly content?: readonly BedrockContentBlock[];
    };
  };
  readonly stopReason?: string;
}): LlmChatResponse {
  const content = payload.output?.message?.content ?? [];
  const toolCalls: LlmToolCallResult[] = [];
  const textParts: string[] = [];

  for (const block of content) {
    if (block.text !== undefined) {
      textParts.push(block.text);
    }
    if (block.toolUse !== undefined) {
      toolCalls.push({
        id: block.toolUse.toolUseId,
        name: block.toolUse.name,
        arguments: block.toolUse.input ?? {},
      });
    }
  }

  return {
    text: toolCalls.length > 0 ? undefined : textParts.join("") || undefined,
    toolCalls,
    finishReason: toolCalls.length > 0 ? "tool_calls" : mapStopReason(payload.stopReason),
  };
}
