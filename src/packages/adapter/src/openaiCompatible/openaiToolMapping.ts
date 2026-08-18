import type {
  LlmChatResponse,
  LlmMessage,
  LlmToolCallResult,
  LlmToolDef,
  TokenUsage,
} from "@cantilune/boot";

export interface OpenAiFunctionTool {
  readonly type: "function";
  readonly function: {
    readonly name: string;
    readonly description: string;
    readonly parameters: Record<string, unknown>;
  };
}

export interface OpenAiChatMessage {
  readonly role: "system" | "user" | "assistant" | "tool";
  readonly content?: string | null;
  readonly tool_calls?: readonly OpenAiToolCall[];
  readonly tool_call_id?: string;
}

export interface OpenAiToolCall {
  readonly id: string;
  readonly type: "function";
  readonly function: {
    readonly name: string;
    readonly arguments: string;
  };
}

export interface OpenAiChoice {
  readonly message?: {
    readonly content?: string | null;
    readonly tool_calls?: readonly OpenAiToolCall[];
  };
  readonly finish_reason?: string | null;
}

export interface OpenAiUsage {
  readonly prompt_tokens?: number;
  readonly completion_tokens?: number;
  readonly total_tokens?: number;
}

/** One `chat.completion.chunk` frame from an OpenAI-compatible SSE stream. */
export interface OpenAiStreamChunk {
  readonly choices?: readonly {
    readonly delta?: {
      readonly content?: string | null;
      readonly tool_calls?: readonly OpenAiToolCallDelta[];
    };
    readonly finish_reason?: string | null;
  }[];
  readonly usage?: OpenAiUsage;
}

/**
 * Tool calls arrive fragmented: the first frame for a given `index` carries
 * `id` and `function.name`, later frames append `function.arguments` slices.
 *
 * Every field is tolerant of provider drift: OpenAI-compatible endpoints
 * (notably Zhipu/GLM, DeepSeek, Moonshot) occasionally emit `index` as a
 * numeric string, omit it on the first frame, or send `function.arguments`
 * as a non-string (null, empty object). The {@link normalizeToolCallDelta}
 * helper absorbs these before the chunk reaches the boot layer's strict
 * validator, so one malformed frame degrades to a skipped frame rather than
 * a stream-fatal `TypeError`.
 */
export interface OpenAiToolCallDelta {
  readonly index: number | string;
  readonly id?: string;
  readonly function?: {
    readonly name?: string;
    readonly arguments?: string | null;
  };
}

/**
 * A tool-call delta after provider drift has been normalized away.
 *
 * `index` is always a non-negative integer; `argumentsDelta` is always a
 * string when present. Returning `undefined` means the frame was too
 * malformed to recover and should be skipped, not propagated.
 */
export interface NormalizedToolCallDelta {
  readonly index: number;
  readonly id?: string;
  readonly name?: string;
  readonly argumentsDelta?: string;
}

/**
 * OpenAI-compatible providers only accept ASCII tool names. Cantilune keeps
 * the richer internal names (for example `tool:shell_run_command`) so that
 * the tool registry and audit trail remain lossless. This boundary encoding
 * is reversible and only changes names that need it.
 */
const PROVIDER_TOOL_NAME_PREFIX = "cln_";

function isProviderSafeToolName(name: string): boolean {
  return /^[a-zA-Z0-9_-]+$/.test(name);
}

export function encodeOpenAiToolName(name: string): string {
  if (isProviderSafeToolName(name) && !name.startsWith(PROVIDER_TOOL_NAME_PREFIX)) {
    return name;
  }

  const encoded = [...name]
    .map((character) => {
      if (/^[a-zA-Z0-9-]$/.test(character)) return character;
      return `_x${character.codePointAt(0)?.toString(16) ?? "0"}_`;
    })
    .join("");
  return `${PROVIDER_TOOL_NAME_PREFIX}${encoded}`;
}

export function decodeOpenAiToolName(name: string): string {
  if (!name.startsWith(PROVIDER_TOOL_NAME_PREFIX)) return name;

  const encoded = name.slice(PROVIDER_TOOL_NAME_PREFIX.length);
  let decoded = "";
  for (let index = 0; index < encoded.length;) {
    if (encoded[index] !== "_" || encoded[index + 1] !== "x") {
      decoded += encoded[index];
      index++;
      continue;
    }

    const end = encoded.indexOf("_", index + 2);
    if (end < 0) return name;
    const codePoint = Number.parseInt(encoded.slice(index + 2, end), 16);
    if (!Number.isInteger(codePoint) || codePoint < 0 || codePoint > 0x10ffff) return name;
    decoded += String.fromCodePoint(codePoint);
    index = end + 1;
  }
  return decoded;
}

/**
 * Normalize one raw tool-call delta against the OpenAI spec, absorbing the
 * provider drift that would otherwise trip the boot layer's strict
 * {@code requireToolCallDelta} validator.
 *
 * - `index`: a real non-negative integer wins; a numeric string ("0") is
 *   coerced; anything else returns `undefined` (the frame is dropped).
 * - `id` / `name`: kept only when they are strings.
 * - `argumentsDelta`: kept only when `function.arguments` is a string;
 *   null / object / number arguments are stripped (the accumulator simply
 *   appends nothing for that frame, matching how a missing slice behaves).
 */
/** Resolve a tool-call delta's `index` to a non-negative integer, or undefined. */
function normalizeIndex(rawIndex: unknown): number | undefined {
  if (typeof rawIndex === "number") {
    if (!Number.isInteger(rawIndex) || rawIndex < 0) return undefined;
    return rawIndex;
  }
  if (typeof rawIndex === "string" && rawIndex.length > 0) {
    const parsed = Number(rawIndex);
    if (!Number.isInteger(parsed) || parsed < 0) return undefined;
    return parsed;
  }
  return undefined;
}

export function normalizeToolCallDelta(
  delta: OpenAiToolCallDelta,
): NormalizedToolCallDelta | undefined {
  const index = normalizeIndex(delta.index);
  if (index === undefined) return undefined;

  const id = typeof delta.id === "string" ? delta.id : undefined;
  const fn = delta.function;
  const name = fn !== undefined && typeof fn.name === "string" ? fn.name : undefined;
  const args = fn !== undefined && typeof fn.arguments === "string" ? fn.arguments : undefined;

  return {
    index,
    ...(id !== undefined ? { id } : {}),
    ...(name !== undefined ? { name } : {}),
    ...(args !== undefined ? { argumentsDelta: args } : {}),
  };
}

export function toOpenAiTools(tools: readonly LlmToolDef[]): OpenAiFunctionTool[] {
  return tools.map((tool) => ({
    type: "function" as const,
    function: {
      name: encodeOpenAiToolName(tool.name),
      description: tool.description,
      parameters: tool.parameters,
    },
  }));
}

export function toOpenAiMessages(messages: readonly LlmMessage[]): OpenAiChatMessage[] {
  const result: OpenAiChatMessage[] = [];

  for (const message of messages) {
    switch (message.role) {
      case "system":
      case "user":
        result.push({ role: message.role, content: message.content });
        break;
      case "assistant":
        result.push({
          role: "assistant",
          content: message.content,
          ...(message.toolCalls !== undefined && message.toolCalls.length > 0
            ? {
                tool_calls: message.toolCalls.map((toolCall) => ({
                  id: toolCall.id,
                  type: "function" as const,
                  function: {
                    name: encodeOpenAiToolName(toolCall.name),
                    arguments: toolCall.arguments,
                  },
                })),
              }
            : {}),
        });
        break;
      case "tool":
        result.push({
          role: "tool",
          tool_call_id: message.toolCallId,
          content: message.content,
        });
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

function mapFinishReason(reason: string | null | undefined): LlmChatResponse["finishReason"] {
  switch (reason) {
    case "stop":
      return "stop";
    case "tool_calls":
      return "tool_calls";
    case "length":
      return "length";
    default:
      return "error";
  }
}

export function fromOpenAiResponse(
  choice: OpenAiChoice | undefined,
  usage?: OpenAiUsage,
): LlmChatResponse {
  const message = choice?.message;
  const toolCalls: LlmToolCallResult[] = (message?.tool_calls ?? []).map((toolCall) => ({
    id: toolCall.id,
    name: decodeOpenAiToolName(toolCall.function.name),
    arguments: parseToolArguments(toolCall.function.arguments),
  }));

  const text = message?.content ?? undefined;

  return {
    text: toolCalls.length > 0 ? undefined : (text ?? undefined),
    toolCalls,
    finishReason: toolCalls.length > 0 ? "tool_calls" : mapFinishReason(choice?.finish_reason),
    ...(usage !== undefined ? { usage: toTokenUsage(usage) } : {}),
  };
}

export function toTokenUsage(usage: OpenAiUsage): TokenUsage {
  const prompt = usage.prompt_tokens ?? 0;
  const completion = usage.completion_tokens ?? 0;
  return {
    prompt,
    completion,
    total: usage.total_tokens ?? prompt + completion,
  };
}

/**
 * Accumulates SSE frames into a single {@link LlmChatResponse}.
 *
 * Tool-call arguments are concatenated per `index` because providers split
 * the JSON across frames; parsing happens once at {@link StreamAccumulator.finish}.
 */
export class StreamAccumulator {
  private text = "";
  private finishReason: string | null | undefined;
  private usage: OpenAiUsage | undefined;
  private readonly toolCalls = new Map<number, { id: string; name: string; args: string }>();

  /** Feed one frame. Returns the text delta it contributed, if any. */
  push(chunk: OpenAiStreamChunk): string | undefined {
    if (chunk.usage !== undefined) {
      this.usage = chunk.usage;
    }

    const choice = chunk.choices?.[0];
    if (choice === undefined) return undefined;

    if (choice.finish_reason !== undefined && choice.finish_reason !== null) {
      this.finishReason = choice.finish_reason;
    }

    for (const rawDelta of choice.delta?.tool_calls ?? []) {
      const delta = normalizeToolCallDelta(rawDelta);
      // An unrecoverable frame is skipped rather than allowed to corrupt the
      // accumulator; the remaining frames for the same index still arrive.
      if (delta === undefined) continue;
      const existing = this.toolCalls.get(delta.index) ?? { id: "", name: "", args: "" };
      this.toolCalls.set(delta.index, {
        id: delta.id ?? existing.id,
        name: delta.name ?? existing.name,
        args: existing.args + (delta.argumentsDelta ?? ""),
      });
    }

    const textDelta = choice.delta?.content;
    if (typeof textDelta === "string" && textDelta.length > 0) {
      this.text += textDelta;
      return textDelta;
    }
    return undefined;
  }

  finish(): LlmChatResponse {
    const toolCalls: LlmToolCallResult[] = [...this.toolCalls.entries()]
      .sort(([a], [b]) => a - b)
      .map(([index, entry]) => ({
        id: entry.id.length > 0 ? entry.id : `call_${index}`,
        name: decodeOpenAiToolName(entry.name),
        arguments: parseToolArguments(entry.args),
      }));

    // A tool-call turn carries no prose, so text is dropped rather than emitted empty.
    const accumulated = this.text.length > 0 ? this.text : undefined;

    return {
      text: toolCalls.length > 0 ? undefined : accumulated,
      toolCalls,
      finishReason: toolCalls.length > 0 ? "tool_calls" : mapFinishReason(this.finishReason),
      ...(this.usage !== undefined ? { usage: toTokenUsage(this.usage) } : {}),
    };
  }
}
