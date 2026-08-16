/**
 * A2A 1.0.0 Server-Sent Events binding (spec §6.2 / §9.4.2 / §11.7).
 *
 * REST: `data: { StreamResponse }`
 * JSON-RPC: `data: {"jsonrpc":"2.0","id":...,"result":{ StreamResponse }}`
 */
import { type Result, err, ok } from "@cantilune/core";
import { a2aProtocolError, type A2AProtocolError } from "./a2aMessage.js";
import { parseA2AStreamResponse, type A2AStreamResponse } from "./a2aTask.js";

export const A2A_SSE_CONTENT_TYPE = "text/event-stream" as const;

export type A2ASseEncodeMode = "rest" | "jsonrpc";

export interface A2ASseEncodeOptions {
  readonly mode?: A2ASseEncodeMode;
  readonly id?: string | number | null;
  readonly event?: string;
}

export function encodeA2ASseEvent(
  event: A2AStreamResponse,
  options: A2ASseEncodeOptions = {},
): string {
  const mode = options.mode ?? "rest";
  const payload =
    mode === "jsonrpc"
      ? {
          jsonrpc: "2.0",
          id: options.id ?? 1,
          result: event,
        }
      : event;
  const lines: string[] = [];
  if (options.event !== undefined) {
    lines.push(`event: ${options.event}`);
  }
  lines.push(`data: ${JSON.stringify(payload)}`);
  return `${lines.join("\n")}\n\n`;
}

export function encodeA2ASseStream(
  events: readonly A2AStreamResponse[],
  options: A2ASseEncodeOptions = {},
): string {
  return events.map((event) => encodeA2ASseEvent(event, options)).join("");
}

export function decodeA2ASseStream(
  body: string,
  mode: A2ASseEncodeMode = "rest",
): Result<readonly A2AStreamResponse[], A2AProtocolError> {
  const events: A2AStreamResponse[] = [];
  for (const block of body.split(/\n\n+/)) {
    const decoded = decodeSseBlock(block, mode);
    if (!decoded.ok) {
      return decoded;
    }
    if (decoded.value !== undefined) {
      events.push(decoded.value);
    }
  }
  return ok(events);
}

function collectSseDataLines(block: string): readonly string[] {
  const dataLines: string[] = [];
  for (const line of block.split("\n")) {
    if (line.startsWith(":") || !line.startsWith("data:")) {
      continue;
    }
    dataLines.push(line.slice(5).trimStart());
  }
  return dataLines;
}

function decodeSseBlock(
  block: string,
  mode: A2ASseEncodeMode,
): Result<A2AStreamResponse | undefined, A2AProtocolError> {
  const trimmed = block.trim();
  if (trimmed.length === 0) {
    return ok(undefined);
  }
  const dataLines = collectSseDataLines(trimmed);
  if (dataLines.length === 0) {
    return ok(undefined);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(dataLines.join("\n")) as unknown;
  } catch {
    return err(a2aProtocolError("JSONParseError", "SSE data is not valid JSON"));
  }
  const payload = mode === "jsonrpc" ? unwrapJsonRpcResult(parsed) : ok(parsed);
  if (!payload.ok) {
    return payload;
  }
  return parseA2AStreamResponse(payload.value);
}

function unwrapJsonRpcResult(value: unknown): Result<unknown, A2AProtocolError> {
  if (
    typeof value === "object" &&
    value !== null &&
    "result" in value &&
    (value as { jsonrpc?: unknown }).jsonrpc === "2.0"
  ) {
    return ok((value as { result: unknown }).result);
  }
  return err(a2aProtocolError("InvalidRequestError", "SSE JSON-RPC frame is missing result"));
}

export function a2aStreamKind(
  event: A2AStreamResponse,
): "task" | "message" | "statusUpdate" | "artifactUpdate" {
  if ("task" in event) {
    return "task";
  }
  if ("message" in event) {
    return "message";
  }
  if ("statusUpdate" in event) {
    return "statusUpdate";
  }
  return "artifactUpdate";
}
