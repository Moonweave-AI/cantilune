/**
 * A2A 1.0.0 JSON-RPC 2.0 binding (spec §9).
 * Streaming methods return SSE frames whose `data` is a JSON-RPC success object.
 */
import { type Result, err, ok } from "@cantilune/core";
import {
  a2aErrorReason,
  a2aProtocolError,
  isJsonObject,
  type A2AProtocolError,
} from "./a2aMessage.js";
import {
  dispatchA2AOperation,
  type A2AOperationEngine,
  type A2AOperationName,
  type A2AServiceParameters,
} from "./a2aOperations.js";
import { encodeA2ASseEvent, type A2ASseEncodeMode } from "./a2aSseBinding.js";
import { type A2AStreamResponse } from "./a2aTask.js";

export const A2A_JSONRPC_VERSION = "2.0" as const;

export const A2A_JSONRPC_METHODS = {
  SendMessage: "SendMessage",
  SendStreamingMessage: "SendStreamingMessage",
  GetTask: "GetTask",
  ListTasks: "ListTasks",
  CancelTask: "CancelTask",
  SubscribeToTask: "SubscribeToTask",
  CreateTaskPushNotificationConfig: "CreateTaskPushNotificationConfig",
  GetTaskPushNotificationConfig: "GetTaskPushNotificationConfig",
  ListTaskPushNotificationConfigs: "ListTaskPushNotificationConfigs",
  DeleteTaskPushNotificationConfig: "DeleteTaskPushNotificationConfig",
  GetExtendedAgentCard: "GetExtendedAgentCard",
  GetAgentCard: "GetAgentCard",
} as const;

export type A2AJsonRpcMethod = (typeof A2A_JSONRPC_METHODS)[keyof typeof A2A_JSONRPC_METHODS];

export type A2AJsonRpcId = string | number | null;

export interface A2AJsonRpcRequest {
  readonly jsonrpc: typeof A2A_JSONRPC_VERSION;
  readonly method: A2AJsonRpcMethod;
  readonly id: A2AJsonRpcId;
  readonly params?: unknown;
}

export interface A2AJsonRpcSuccess {
  readonly jsonrpc: typeof A2A_JSONRPC_VERSION;
  readonly id: A2AJsonRpcId;
  readonly result: unknown;
}

export interface A2AJsonRpcFailure {
  readonly jsonrpc: typeof A2A_JSONRPC_VERSION;
  readonly id: A2AJsonRpcId;
  readonly error: {
    readonly code: number;
    readonly message: string;
    readonly data?: readonly Readonly<Record<string, unknown>>[];
  };
}

export type A2AJsonRpcResponse = A2AJsonRpcSuccess | A2AJsonRpcFailure;

export type A2AJsonRpcHandleResult =
  | { readonly kind: "json"; readonly status: number; readonly body: A2AJsonRpcResponse }
  | { readonly kind: "sse"; readonly status: number; readonly body: string };

const JSONRPC_ERROR_CODES: Readonly<Record<A2AProtocolError["name"], number>> = {
  JSONParseError: -32700,
  InvalidRequestError: -32600,
  MethodNotFoundError: -32601,
  InvalidParamsError: -32602,
  InternalError: -32603,
  TaskNotFoundError: -32001,
  TaskNotCancelableError: -32002,
  PushNotificationNotSupportedError: -32003,
  UnsupportedOperationError: -32004,
  ContentTypeNotSupportedError: -32005,
  InvalidAgentResponseError: -32006,
  ExtendedAgentCardNotConfiguredError: -32007,
  ExtensionSupportRequiredError: -32008,
  VersionNotSupportedError: -32009,
};

export function a2aJsonRpcErrorCode(name: A2AProtocolError["name"]): number {
  return JSONRPC_ERROR_CODES[name];
}

export function isA2AJsonRpcMethod(value: unknown): value is A2AJsonRpcMethod {
  return (
    typeof value === "string" &&
    (Object.values(A2A_JSONRPC_METHODS) as readonly string[]).includes(value)
  );
}

export function encodeA2AJsonRpcRequest(
  method: A2AJsonRpcMethod,
  params: unknown,
  id: A2AJsonRpcId = 1,
): A2AJsonRpcRequest {
  return {
    jsonrpc: A2A_JSONRPC_VERSION,
    method,
    id,
    ...(params !== undefined ? { params } : {}),
  };
}

export function encodeA2AJsonRpcSuccess(id: A2AJsonRpcId, result: unknown): A2AJsonRpcSuccess {
  return { jsonrpc: A2A_JSONRPC_VERSION, id, result };
}

export function encodeA2AJsonRpcError(
  id: A2AJsonRpcId,
  error: A2AProtocolError,
): A2AJsonRpcFailure {
  const data = [
    {
      "@type": "type.googleapis.com/google.rpc.ErrorInfo",
      reason: a2aErrorReason(error.name),
      domain: "a2a-protocol.org",
      ...(error.path !== undefined ? { metadata: { path: error.path } } : {}),
    },
    ...(error.details ?? []),
  ];
  return {
    jsonrpc: A2A_JSONRPC_VERSION,
    id,
    error: {
      code: a2aJsonRpcErrorCode(error.name),
      message: error.message,
      data,
    },
  };
}

export function decodeA2AJsonRpcRequest(
  value: unknown,
): Result<A2AJsonRpcRequest, A2AProtocolError> {
  if (typeof value === "string") {
    try {
      return decodeA2AJsonRpcRequest(JSON.parse(value) as unknown);
    } catch {
      return err(a2aProtocolError("JSONParseError", "Invalid JSON payload"));
    }
  }
  if (!isJsonObject(value)) {
    return err(a2aProtocolError("InvalidRequestError", "Request payload validation error"));
  }
  if (value.jsonrpc !== A2A_JSONRPC_VERSION) {
    return err(a2aProtocolError("InvalidRequestError", "jsonrpc must be \"2.0\""));
  }
  if (!isA2AJsonRpcMethod(value.method)) {
    return err(a2aProtocolError("MethodNotFoundError", "Method not found"));
  }
  if (
    !("id" in value) ||
    (typeof value.id !== "string" && typeof value.id !== "number" && value.id !== null)
  ) {
    return err(a2aProtocolError("InvalidRequestError", "id must be a string, number, or null"));
  }
  return ok({
    jsonrpc: A2A_JSONRPC_VERSION,
    method: value.method,
    id: value.id,
    ...(value.params !== undefined ? { params: value.params } : {}),
  });
}

export function decodeA2AJsonRpcResponse(
  value: unknown,
): Result<A2AJsonRpcResponse, A2AProtocolError> {
  if (typeof value === "string") {
    try {
      return decodeA2AJsonRpcResponse(JSON.parse(value) as unknown);
    } catch {
      return err(a2aProtocolError("JSONParseError", "Invalid JSON payload"));
    }
  }
  if (!isJsonObject(value) || value.jsonrpc !== A2A_JSONRPC_VERSION) {
    return err(a2aProtocolError("InvalidRequestError", "invalid JSON-RPC response"));
  }
  if (
    !("id" in value) ||
    (typeof value.id !== "string" && typeof value.id !== "number" && value.id !== null)
  ) {
    return err(a2aProtocolError("InvalidRequestError", "id must be a string, number, or null"));
  }
  if ("result" in value) {
    return ok({ jsonrpc: A2A_JSONRPC_VERSION, id: value.id, result: value.result });
  }
  if (!isJsonObject(value.error) || typeof value.error.code !== "number" || typeof value.error.message !== "string") {
    return err(a2aProtocolError("InvalidRequestError", "error object is invalid"));
  }
  return ok({
    jsonrpc: A2A_JSONRPC_VERSION,
    id: value.id,
    error: {
      code: value.error.code,
      message: value.error.message,
      ...(Array.isArray(value.error.data)
        ? { data: value.error.data as readonly Readonly<Record<string, unknown>>[] }
        : {}),
    },
  });
}

const STREAMING_METHODS = new Set<A2AJsonRpcMethod>([
  A2A_JSONRPC_METHODS.SendStreamingMessage,
  A2A_JSONRPC_METHODS.SubscribeToTask,
]);

export function handleA2AJsonRpc(
  engine: A2AOperationEngine,
  raw: unknown,
  serviceParams?: A2AServiceParameters,
): A2AJsonRpcHandleResult {
  const request = decodeA2AJsonRpcRequest(raw);
  if (!request.ok) {
    return {
      kind: "json",
      status: 200,
      body: encodeA2AJsonRpcError(null, request.error),
    };
  }
  const dispatched = dispatchA2AOperation(
    engine,
    request.value.method as A2AOperationName,
    request.value.params,
    serviceParams,
  );
  if (!dispatched.ok) {
    return {
      kind: "json",
      status: 200,
      body: encodeA2AJsonRpcError(request.value.id, dispatched.error),
    };
  }
  if (STREAMING_METHODS.has(request.value.method)) {
    const events = dispatched.value as readonly A2AStreamResponse[];
    const mode: A2ASseEncodeMode = "jsonrpc";
    return {
      kind: "sse",
      status: 200,
      body: events
        .map((event) => encodeA2ASseEvent(event, { mode, id: request.value.id }))
        .join(""),
    };
  }
  return {
    kind: "json",
    status: 200,
    body: encodeA2AJsonRpcSuccess(request.value.id, dispatched.value),
  };
}
