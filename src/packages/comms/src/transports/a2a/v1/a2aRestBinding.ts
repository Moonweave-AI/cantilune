/**
 * A2A 1.0.0 HTTP+JSON/REST binding (spec §11).
 */
import { type Result, err, ok } from "@cantilune/core";
import { A2A_AGENT_CARD_WELL_KNOWN_PATH, A2A_JSON_CONTENT_TYPE } from "./agentCard.js";
import {
  a2aErrorReason,
  a2aProtocolError,
  isJsonObject,
  type A2AProtocolError,
} from "./a2aMessage.js";
import {
  dispatchA2AOperation,
  parseA2AServiceParameters,
  type A2AOperationEngine,
  type A2AOperationName,
  type A2AServiceParameters,
} from "./a2aOperations.js";
import { encodeA2ASseStream } from "./a2aSseBinding.js";
import { isA2ATaskState, type A2AStreamResponse } from "./a2aTask.js";

export const A2A_REST_CONTENT_TYPE = A2A_JSON_CONTENT_TYPE;

export interface A2ARestRoute {
  readonly method: "GET" | "POST" | "DELETE";
  readonly path: string;
  readonly operation: A2AOperationName;
}

export const A2A_REST_ROUTES: readonly A2ARestRoute[] = [
  { method: "POST", path: "/message:send", operation: "SendMessage" },
  { method: "POST", path: "/message:stream", operation: "SendStreamingMessage" },
  { method: "GET", path: "/tasks", operation: "ListTasks" },
  { method: "GET", path: "/tasks/{id}", operation: "GetTask" },
  { method: "POST", path: "/tasks/{id}:cancel", operation: "CancelTask" },
  { method: "POST", path: "/tasks/{id}:subscribe", operation: "SubscribeToTask" },
  {
    method: "POST",
    path: "/tasks/{id}/pushNotificationConfigs",
    operation: "CreateTaskPushNotificationConfig",
  },
  {
    method: "GET",
    path: "/tasks/{id}/pushNotificationConfigs/{configId}",
    operation: "GetTaskPushNotificationConfig",
  },
  {
    method: "GET",
    path: "/tasks/{id}/pushNotificationConfigs",
    operation: "ListTaskPushNotificationConfigs",
  },
  {
    method: "DELETE",
    path: "/tasks/{id}/pushNotificationConfigs/{configId}",
    operation: "DeleteTaskPushNotificationConfig",
  },
  { method: "GET", path: "/extendedAgentCard", operation: "GetExtendedAgentCard" },
  { method: "GET", path: A2A_AGENT_CARD_WELL_KNOWN_PATH, operation: "GetAgentCard" },
];

export interface A2ARestMatch {
  readonly operation: A2AOperationName;
  readonly params: Record<string, string>;
}

export interface A2ARestRequest {
  readonly method: string;
  readonly path: string;
  readonly headers?: Readonly<Record<string, string | undefined>>;
  readonly body?: unknown;
}

export type A2ARestResponse =
  | {
      readonly kind: "json";
      readonly status: number;
      readonly contentType: typeof A2A_JSON_CONTENT_TYPE;
      readonly body: unknown;
    }
  | {
      readonly kind: "sse";
      readonly status: number;
      readonly contentType: "text/event-stream";
      readonly body: string;
    };

const HTTP_STATUS: Readonly<Record<A2AProtocolError["name"], number>> = {
  JSONParseError: 400,
  InvalidRequestError: 400,
  MethodNotFoundError: 404,
  InvalidParamsError: 400,
  InternalError: 500,
  TaskNotFoundError: 404,
  TaskNotCancelableError: 400,
  PushNotificationNotSupportedError: 400,
  UnsupportedOperationError: 400,
  ContentTypeNotSupportedError: 400,
  InvalidAgentResponseError: 500,
  ExtendedAgentCardNotConfiguredError: 400,
  ExtensionSupportRequiredError: 400,
  VersionNotSupportedError: 400,
};

const GRPC_STATUS_FOR_HTTP: Readonly<Record<A2AProtocolError["name"], string>> = {
  JSONParseError: "INVALID_ARGUMENT",
  InvalidRequestError: "INVALID_ARGUMENT",
  MethodNotFoundError: "NOT_FOUND",
  InvalidParamsError: "INVALID_ARGUMENT",
  InternalError: "INTERNAL",
  TaskNotFoundError: "NOT_FOUND",
  TaskNotCancelableError: "FAILED_PRECONDITION",
  PushNotificationNotSupportedError: "FAILED_PRECONDITION",
  UnsupportedOperationError: "FAILED_PRECONDITION",
  ContentTypeNotSupportedError: "INVALID_ARGUMENT",
  InvalidAgentResponseError: "INTERNAL",
  ExtendedAgentCardNotConfiguredError: "FAILED_PRECONDITION",
  ExtensionSupportRequiredError: "FAILED_PRECONDITION",
  VersionNotSupportedError: "FAILED_PRECONDITION",
};

export function a2aRestStatus(name: A2AProtocolError["name"]): number {
  return HTTP_STATUS[name];
}

export function encodeA2ARestError(error: A2AProtocolError): {
  readonly error: {
    readonly code: number;
    readonly status: string;
    readonly message: string;
    readonly details: readonly Readonly<Record<string, unknown>>[];
  };
} {
  return {
    error: {
      code: a2aRestStatus(error.name),
      status: GRPC_STATUS_FOR_HTTP[error.name],
      message: error.message,
      details: [
        {
          "@type": "type.googleapis.com/google.rpc.ErrorInfo",
          reason: a2aErrorReason(error.name),
          domain: "a2a-protocol.org",
          ...(error.path !== undefined ? { metadata: { path: error.path } } : {}),
        },
        ...(error.details ?? []),
      ],
    },
  };
}

function splitPathAndQuery(path: string): { readonly pathname: string; readonly search: string } {
  const q = path.indexOf("?");
  if (q < 0) {
    return { pathname: path, search: "" };
  }
  return { pathname: path.slice(0, q), search: path.slice(q + 1) };
}

export function parseA2ARestQuery(search: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (search.length === 0) {
    return out;
  }
  for (const pair of search.split("&")) {
    if (pair.length === 0) {
      continue;
    }
    const eq = pair.indexOf("=");
    const key = decodeURIComponent(eq < 0 ? pair : pair.slice(0, eq));
    const value = decodeURIComponent(eq < 0 ? "" : pair.slice(eq + 1));
    out[key] = value;
  }
  return out;
}

function matchTemplate(
  template: string,
  pathname: string,
): Record<string, string> | undefined {
  const templateParts = template.split("/");
  const pathParts = pathname.split("/");
  if (templateParts.length !== pathParts.length) {
    return undefined;
  }
  const params: Record<string, string> = {};
  for (const [index, part] of templateParts.entries()) {
    const actual = pathParts[index];
    if (actual === undefined) {
      return undefined;
    }
    const nameStart = part.indexOf("{");
    if (nameStart >= 0) {
      const nameEnd = part.indexOf("}");
      if (nameEnd < 0) {
        return undefined;
      }
      const name = part.slice(nameStart + 1, nameEnd);
      const suffix = part.slice(nameEnd + 1);
      const prefix = part.slice(0, nameStart);
      if (!actual.startsWith(prefix) || !actual.endsWith(suffix)) {
        return undefined;
      }
      params[name] = actual.slice(prefix.length, actual.length - suffix.length);
      continue;
    }
    if (part !== actual) {
      return undefined;
    }
  }
  return params;
}

export function matchA2ARestRoute(
  method: string,
  path: string,
): Result<A2ARestMatch, A2AProtocolError> {
  const { pathname } = splitPathAndQuery(path);
  const normalized = pathname.startsWith("/") ? pathname : `/${pathname}`;
  const verb = method.toUpperCase();
  const candidates = A2A_REST_ROUTES.filter((route) => route.method === verb);
  const specificFirst = [...candidates].sort((left, right) => right.path.length - left.path.length);
  for (const route of specificFirst) {
    const params = matchTemplate(route.path, normalized);
    if (params !== undefined) {
      return ok({ operation: route.operation, params });
    }
  }
  return err(a2aProtocolError("MethodNotFoundError", `no REST route for ${verb} ${normalized}`));
}

function coerceQueryParams(query: Record<string, string>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...query };
  if (query.pageSize !== undefined) {
    out.pageSize = Number(query.pageSize);
  }
  if (query.historyLength !== undefined) {
    out.historyLength = Number(query.historyLength);
  }
  if (query.includeArtifacts !== undefined) {
    out.includeArtifacts = query.includeArtifacts === "true";
  }
  if (query.status !== undefined && !isA2ATaskState(query.status)) {
    out.status = query.status;
  }
  return out;
}

function buildOperationParams(
  match: A2ARestMatch,
  query: Record<string, string>,
  body: unknown,
): unknown {
  const queryParams = coerceQueryParams(query);
  switch (match.operation) {
    case "GetTask":
    case "SubscribeToTask":
    case "CancelTask":
      return {
        ...(isJsonObject(body) ? body : {}),
        ...queryParams,
        id: match.params.id,
      };
    case "CreateTaskPushNotificationConfig":
      return {
        ...(isJsonObject(body) ? body : {}),
        taskId: match.params.id,
      };
    case "GetTaskPushNotificationConfig":
    case "DeleteTaskPushNotificationConfig":
      return {
        taskId: match.params.id,
        id: match.params.configId,
      };
    case "ListTaskPushNotificationConfigs":
      return { taskId: match.params.id, ...queryParams };
    case "ListTasks":
      return queryParams;
    case "GetAgentCard":
    case "GetExtendedAgentCard":
      return {};
    default:
      return body;
  }
}

const STREAMING_OPS = new Set<A2AOperationName>(["SendStreamingMessage", "SubscribeToTask"]);

export function handleA2ARestRequest(
  engine: A2AOperationEngine,
  request: A2ARestRequest,
): A2ARestResponse {
  const matched = matchA2ARestRoute(request.method, request.path);
  if (!matched.ok) {
    return {
      kind: "json",
      status: a2aRestStatus(matched.error.name),
      contentType: A2A_JSON_CONTENT_TYPE,
      body: encodeA2ARestError(matched.error),
    };
  }
  const { search } = splitPathAndQuery(request.path);
  const query = parseA2ARestQuery(search);
  const serviceParams: A2AServiceParameters = parseA2AServiceParameters(request.headers ?? {});
  const params = buildOperationParams(matched.value, query, request.body);
  const dispatched = dispatchA2AOperation(
    engine,
    matched.value.operation,
    params,
    serviceParams,
  );
  if (!dispatched.ok) {
    return {
      kind: "json",
      status: a2aRestStatus(dispatched.error.name),
      contentType: A2A_JSON_CONTENT_TYPE,
      body: encodeA2ARestError(dispatched.error),
    };
  }
  if (STREAMING_OPS.has(matched.value.operation)) {
    return {
      kind: "sse",
      status: 200,
      contentType: "text/event-stream",
      body: encodeA2ASseStream(dispatched.value as readonly A2AStreamResponse[], { mode: "rest" }),
    };
  }
  return {
    kind: "json",
    status: 200,
    contentType: A2A_JSON_CONTENT_TYPE,
    body: dispatched.value,
  };
}
