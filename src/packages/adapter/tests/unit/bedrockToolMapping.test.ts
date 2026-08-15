import { describe, expect, it } from "vitest";
import {
  fromBedrockResponse,
  splitSystemPrompt,
  toBedrockMessages,
  toBedrockTools,
} from "../../src/bedrock/bedrockToolMapping.js";

describe("bedrockToolMapping", () => {
  it("converts tool definitions to Bedrock toolSpec format", () => {
    expect(
      toBedrockTools([
        {
          name: "lookup",
          description: "Lookup data",
          parameters: { type: "object", properties: { id: { type: "string" } } },
        },
      ]),
    ).toEqual([
      {
        toolSpec: {
          name: "lookup",
          description: "Lookup data",
          inputSchema: { json: { type: "object", properties: { id: { type: "string" } } } },
        },
      },
    ]);
  });

  it("separates system prompts into Bedrock system blocks", () => {
    const split = splitSystemPrompt([
      { role: "system", content: "Be helpful." },
      { role: "system", content: "Be concise." },
      { role: "user", content: "Hello" },
    ]);

    expect(split.system).toEqual([{ text: "Be helpful." }, { text: "Be concise." }]);
    expect(split.conversation).toEqual([{ role: "user", content: "Hello" }]);
  });

  it("returns empty system when no system messages exist", () => {
    const split = splitSystemPrompt([{ role: "user", content: "Hi" }]);
    expect(split.system).toEqual([]);
    expect(split.conversation).toHaveLength(1);
  });

  it("converts user, assistant, and tool messages", () => {
    const messages = toBedrockMessages([
      { role: "user", content: "Question" },
      {
        role: "assistant",
        content: "Using tool",
        toolCalls: [{ id: "tu_1", name: "search", arguments: '{"q":"test"}' }],
      },
      { role: "tool", toolCallId: "tu_1", content: "result data" },
      { role: "system", content: "ignored inline" },
    ]);

    expect(messages).toEqual([
      { role: "user", content: [{ text: "Question" }] },
      {
        role: "assistant",
        content: [
          { text: "Using tool" },
          { toolUse: { toolUseId: "tu_1", name: "search", input: { q: "test" } } },
        ],
      },
      {
        role: "user",
        content: [{ toolResult: { toolUseId: "tu_1", content: [{ text: "result data" }] } }],
      },
    ]);
  });

  it("handles assistant tool calls without text content", () => {
    const messages = toBedrockMessages([
      {
        role: "assistant",
        content: "",
        toolCalls: [{ id: "tu_2", name: "act", arguments: "not-json" }],
      },
    ]);

    expect(messages).toEqual([
      {
        role: "assistant",
        content: [{ toolUse: { toolUseId: "tu_2", name: "act", input: { raw: "not-json" } } }],
      },
    ]);
  });

  it("wraps non-object JSON arguments in value field", () => {
    const messages = toBedrockMessages([
      {
        role: "assistant",
        content: "",
        toolCalls: [{ id: "tu_3", name: "list", arguments: "[1,2,3]" }],
      },
    ]);

    expect(messages[0]?.content[0]?.toolUse?.input).toEqual({ value: [1, 2, 3] });
  });

  it("parses text-only Bedrock responses", () => {
    expect(
      fromBedrockResponse({
        output: { message: { content: [{ text: "Hello" }] } },
        stopReason: "end_turn",
      }),
    ).toEqual({
      text: "Hello",
      toolCalls: [],
      finishReason: "stop",
    });
  });

  it("parses tool_use responses and maps stop reasons", () => {
    expect(
      fromBedrockResponse({
        output: {
          message: {
            content: [{ toolUse: { toolUseId: "tu_1", name: "search", input: { q: "hi" } } }],
          },
        },
        stopReason: "tool_use",
      }),
    ).toEqual({
      text: undefined,
      toolCalls: [{ id: "tu_1", name: "search", arguments: { q: "hi" } }],
      finishReason: "tool_calls",
    });

    expect(
      fromBedrockResponse({
        output: { message: { content: [{ text: "truncated" }] } },
        stopReason: "max_tokens",
      }).finishReason,
    ).toBe("length");

    expect(
      fromBedrockResponse({
        output: { message: { content: [{ text: "weird" }] } },
        stopReason: "content_filtered",
      }).finishReason,
    ).toBe("error");
  });

  it("handles empty or missing output gracefully", () => {
    expect(fromBedrockResponse({})).toEqual({
      text: undefined,
      toolCalls: [],
      finishReason: "error",
    });

    expect(
      fromBedrockResponse({
        output: { message: { content: [{ toolUse: { toolUseId: "x", name: "y" } }] } },
      }).toolCalls[0]?.arguments,
    ).toEqual({});
  });
});
