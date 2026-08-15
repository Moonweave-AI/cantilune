import type { LlmChatResponse, LlmMessage, LlmToolCallResult, LlmToolDef } from "@cantilune/boot";

export interface GoogleFunctionDeclaration {
  readonly name: string;
  readonly description: string;
  readonly parameters: Record<string, unknown>;
}

export interface GoogleContent {
  readonly role: "user" | "model";
  readonly parts: GooglePart[];
}

export interface GooglePart {
  readonly text?: string;
  readonly functionCall?: {
    readonly name: string;
    readonly args?: Record<string, unknown>;
  };
  readonly functionResponse?: {
    readonly name: string;
    readonly response: Record<string, unknown>;
  };
}

export function toGoogleTools(tools: readonly LlmToolDef[]): {
  readonly functionDeclarations: GoogleFunctionDeclaration[];
}[] {
  if (tools.length === 0) {
    return [];
  }

  return [
    {
      functionDeclarations: tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      })),
    },
  ];
}

function toGoogleAssistantContent(
  message: Extract<LlmMessage, { role: "assistant" }>,
): GoogleContent {
  if (message.toolCalls !== undefined && message.toolCalls.length > 0) {
    const parts: GooglePart[] = [];
    if (message.content.length > 0) {
      parts.push({ text: message.content });
    }
    for (const toolCall of message.toolCalls) {
      parts.push({
        functionCall: {
          name: toolCall.name,
          args: parseToolArguments(toolCall.arguments),
        },
      });
    }
    return { role: "model", parts };
  }
  return {
    role: "model",
    parts: [{ text: message.content }],
  };
}

export function toGoogleContents(messages: readonly LlmMessage[]): GoogleContent[] {
  const contents: GoogleContent[] = [];

  for (const message of messages) {
    switch (message.role) {
      case "system":
      case "user":
        contents.push({
          role: "user",
          parts: [{ text: message.content }],
        });
        break;
      case "assistant":
        contents.push(toGoogleAssistantContent(message));
        break;
      case "tool":
        contents.push({
          role: "user",
          parts: [
            {
              functionResponse: {
                name: message.toolCallId,
                response: { result: message.content },
              },
            },
          ],
        });
        break;
      default: {
        const _exhaustive: never = message;
        throw new Error(`Unsupported message role: ${String(_exhaustive)}`);
      }
    }
  }

  return contents;
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

function mapFinishReason(reason: string | undefined): LlmChatResponse["finishReason"] {
  switch (reason) {
    case "STOP":
      return "stop";
    case "MAX_TOKENS":
      return "length";
    default:
      return reason === undefined ? "stop" : "error";
  }
}

export function fromGoogleResponse(payload: {
  readonly candidates?: readonly {
    readonly content?: {
      readonly parts?: readonly GooglePart[];
    };
    readonly finishReason?: string;
  }[];
}): LlmChatResponse {
  const candidate = payload.candidates?.[0];
  const parts = candidate?.content?.parts ?? [];
  const toolCalls: LlmToolCallResult[] = [];
  const textParts: string[] = [];

  for (const part of parts) {
    if (part.text !== undefined) {
      textParts.push(part.text);
    }
    if (part.functionCall?.name !== undefined) {
      toolCalls.push({
        id: part.functionCall.name,
        name: part.functionCall.name,
        arguments: part.functionCall.args ?? {},
      });
    }
  }

  return {
    text: toolCalls.length > 0 ? undefined : textParts.join("") || undefined,
    toolCalls,
    finishReason: toolCalls.length > 0 ? "tool_calls" : mapFinishReason(candidate?.finishReason),
  };
}
