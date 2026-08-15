import { describe, expect, it } from "vitest";
import {
  fromGoogleResponse,
  toGoogleContents,
  toGoogleTools,
} from "../../src/google/googleToolMapping.js";

describe("googleToolMapping", () => {
  it("returns empty array when no tools are provided", () => {
    expect(toGoogleTools([])).toEqual([]);
  });

  it("wraps tool definitions in functionDeclarations", () => {
    expect(
      toGoogleTools([
        {
          name: "search",
          description: "Search the web",
          parameters: { type: "object", properties: { q: { type: "string" } } },
        },
      ]),
    ).toEqual([
      {
        functionDeclarations: [
          {
            name: "search",
            description: "Search the web",
            parameters: { type: "object", properties: { q: { type: "string" } } },
          },
        ],
      },
    ]);
  });

  it("converts all message roles to Google contents", () => {
    const contents = toGoogleContents([
      { role: "system", content: "Be helpful." },
      { role: "user", content: "Hello" },
      {
        role: "assistant",
        content: "Calling tool",
        toolCalls: [{ id: "fc_1", name: "search", arguments: '{"q":"test"}' }],
      },
      { role: "tool", toolCallId: "search", content: "found it" },
    ]);

    expect(contents).toEqual([
      { role: "user", parts: [{ text: "Be helpful." }] },
      { role: "user", parts: [{ text: "Hello" }] },
      {
        role: "model",
        parts: [
          { text: "Calling tool" },
          { functionCall: { name: "search", args: { q: "test" } } },
        ],
      },
      {
        role: "user",
        parts: [{ functionResponse: { name: "search", response: { result: "found it" } } }],
      },
    ]);
  });

  it("handles assistant tool calls without text and invalid JSON args", () => {
    const contents = toGoogleContents([
      {
        role: "assistant",
        content: "",
        toolCalls: [{ id: "fc_2", name: "act", arguments: "broken-json" }],
      },
    ]);

    expect(contents).toEqual([
      {
        role: "model",
        parts: [{ functionCall: { name: "act", args: { raw: "broken-json" } } }],
      },
    ]);
  });

  it("wraps array JSON arguments in value field", () => {
    const contents = toGoogleContents([
      {
        role: "assistant",
        content: "",
        toolCalls: [{ id: "fc_3", name: "list", arguments: "[1,2]" }],
      },
    ]);

    expect(contents[0]?.parts[0]?.functionCall?.args).toEqual({ value: [1, 2] });
  });

  it("parses text-only Gemini responses", () => {
    expect(
      fromGoogleResponse({
        candidates: [
          {
            content: { parts: [{ text: "Hello" }] },
            finishReason: "STOP",
          },
        ],
      }),
    ).toEqual({
      text: "Hello",
      toolCalls: [],
      finishReason: "stop",
    });
  });

  it("parses function call responses", () => {
    expect(
      fromGoogleResponse({
        candidates: [
          {
            content: {
              parts: [{ functionCall: { name: "search", args: { q: "hello" } } }],
            },
            finishReason: "STOP",
          },
        ],
      }),
    ).toEqual({
      text: undefined,
      toolCalls: [{ id: "search", name: "search", arguments: { q: "hello" } }],
      finishReason: "tool_calls",
    });
  });

  it("maps finish reasons including MAX_TOKENS and unknown values", () => {
    expect(
      fromGoogleResponse({
        candidates: [{ content: { parts: [{ text: "x" }] }, finishReason: "MAX_TOKENS" }],
      }).finishReason,
    ).toBe("length");

    expect(
      fromGoogleResponse({
        candidates: [{ content: { parts: [{ text: "x" }] }, finishReason: "SAFETY" }],
      }).finishReason,
    ).toBe("error");

    expect(fromGoogleResponse({}).finishReason).toBe("stop");
  });

  it("handles missing function call args", () => {
    expect(
      fromGoogleResponse({
        candidates: [
          {
            content: { parts: [{ functionCall: { name: "noop" } }] },
          },
        ],
      }).toolCalls[0]?.arguments,
    ).toEqual({});
  });
});
