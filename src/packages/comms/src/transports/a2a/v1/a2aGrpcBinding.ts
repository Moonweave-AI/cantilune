/**
 * A2A 1.0.0 gRPC semantic mapper (spec §10) for hosts that already own a
 * transport. The official wire server is {@link createA2AGrpcServer} in
 * `a2aGrpcJs.ts` (`lf.a2a.v1.A2AService` from the vendored 1.0.0 proto).
 *
 * Frame shape (JSON object, not length-prefixed protobuf):
 * `{ service, method, metadata, message }` request and
 * `{ service, method, status, message?, error? }` response.
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
  parseA2AServiceParameters,
  type A2AOperationEngine,
  type A2AOperationName,
  type A2AServiceParameters,
} from "./a2aOperations.js";

export const A2A_GRPC_SERVICE_NAME = "a2a.v1.A2AService" as const;

export const A2A_GRPC_METHODS = {
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

export type A2AGrpcMethod = (typeof A2A_GRPC_METHODS)[keyof typeof A2A_GRPC_METHODS];

export type A2AGrpcStatusName =
  | "OK"
  | "INVALID_ARGUMENT"
  | "NOT_FOUND"
  | "FAILED_PRECONDITION"
  | "INTERNAL"
  | "UNAUTHENTICATED"
  | "PERMISSION_DENIED"
  | "UNAVAILABLE";

export interface A2AGrpcFrame {
  readonly service: typeof A2A_GRPC_SERVICE_NAME;
  readonly method: A2AGrpcMethod;
  readonly metadata?: Readonly<Record<string, string>>;
  readonly message?: unknown;
  readonly status?: A2AGrpcStatusName;
  readonly error?: {
    readonly code: A2AGrpcStatusName;
    readonly message: string;
    readonly details: readonly Readonly<Record<string, unknown>>[];
  };
}

export interface A2AGrpcService {
  invoke(
    method: A2AGrpcMethod,
    message: unknown,
    metadata?: Readonly<Record<string, string>>,
  ): Result<unknown, A2AProtocolError>;
}

const GRPC_STATUS: Readonly<Record<A2AProtocolError["name"], A2AGrpcStatusName>> = {
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

export function mapA2AErrorToGrpcStatus(name: A2AProtocolError["name"]): A2AGrpcStatusName {
  return GRPC_STATUS[name];
}

export function isA2AGrpcMethod(value: unknown): value is A2AGrpcMethod {
  return (
    typeof value === "string" &&
    (Object.values(A2A_GRPC_METHODS) as readonly string[]).includes(value)
  );
}

export function encodeA2AGrpcRequest(
  method: A2AGrpcMethod,
  message: unknown,
  metadata?: Readonly<Record<string, string>>,
): A2AGrpcFrame {
  return {
    service: A2A_GRPC_SERVICE_NAME,
    method,
    ...(metadata !== undefined ? { metadata } : {}),
    ...(message !== undefined ? { message } : {}),
  };
}

export function decodeA2AGrpcRequest(value: unknown): Result<A2AGrpcFrame, A2AProtocolError> {
  if (typeof value === "string") {
    try {
      return decodeA2AGrpcRequest(JSON.parse(value) as unknown);
    } catch {
      return err(a2aProtocolError("JSONParseError", "gRPC frame is not valid JSON"));
    }
  }
  if (!isJsonObject(value) || value.service !== A2A_GRPC_SERVICE_NAME) {
    return err(a2aProtocolError("InvalidRequestError", "gRPC frame service must be a2a.v1.A2AService"));
  }
  if (!isA2AGrpcMethod(value.method)) {
    return err(a2aProtocolError("MethodNotFoundError", "unknown gRPC method"));
  }
  let metadata: Record<string, string> | undefined;
  if (value.metadata !== undefined) {
    if (!isJsonObject(value.metadata)) {
      return err(a2aProtocolError("InvalidParamsError", "gRPC metadata must be an object"));
    }
    metadata = {};
    for (const [key, entry] of Object.entries(value.metadata)) {
      if (typeof entry !== "string") {
        return err(a2aProtocolError("InvalidParamsError", `metadata.${key} must be a string`));
      }
      metadata[key] = entry;
    }
  }
  return ok({
    service: A2A_GRPC_SERVICE_NAME,
    method: value.method,
    ...(metadata !== undefined ? { metadata } : {}),
    ...(value.message !== undefined ? { message: value.message } : {}),
  });
}

export function encodeA2AGrpcResponse(
  method: A2AGrpcMethod,
  result: Result<unknown, A2AProtocolError>,
): A2AGrpcFrame {
  if (!result.ok) {
    return {
      service: A2A_GRPC_SERVICE_NAME,
      method,
      status: mapA2AErrorToGrpcStatus(result.error.name),
      error: {
        code: mapA2AErrorToGrpcStatus(result.error.name),
        message: result.error.message,
        details: [
          {
            "@type": "type.googleapis.com/google.rpc.ErrorInfo",
            reason: a2aErrorReason(result.error.name),
            domain: "a2a-protocol.org",
          },
        ],
      },
    };
  }
  return {
    service: A2A_GRPC_SERVICE_NAME,
    method,
    status: "OK",
    message: result.value,
  };
}

const A2A_GRPC_STATUSES = new Set<string>([
  "OK",
  "INVALID_ARGUMENT",
  "NOT_FOUND",
  "FAILED_PRECONDITION",
  "INTERNAL",
  "UNAUTHENTICATED",
  "PERMISSION_DENIED",
  "UNAVAILABLE",
]);

function isA2AGrpcStatusName(value: unknown): value is A2AGrpcStatusName {
  return typeof value === "string" && A2A_GRPC_STATUSES.has(value);
}

function parseGrpcError(value: unknown): A2AGrpcFrame["error"] | undefined {
  if (!isJsonObject(value)) {
    return undefined;
  }
  return {
    code: isA2AGrpcStatusName(value.code) ? value.code : "INTERNAL",
    message: typeof value.message === "string" ? value.message : "gRPC error",
    details: Array.isArray(value.details)
      ? (value.details as readonly Readonly<Record<string, unknown>>[])
      : [],
  };
}

export function decodeA2AGrpcResponse(value: unknown): Result<A2AGrpcFrame, A2AProtocolError> {
  if (typeof value === "string") {
    try {
      return decodeA2AGrpcResponse(JSON.parse(value) as unknown);
    } catch {
      return err(a2aProtocolError("JSONParseError", "gRPC response is not valid JSON"));
    }
  }
  if (!isJsonObject(value) || value.service !== A2A_GRPC_SERVICE_NAME) {
    return err(a2aProtocolError("InvalidRequestError", "gRPC response service must be a2a.v1.A2AService"));
  }
  if (!isA2AGrpcMethod(value.method)) {
    return err(a2aProtocolError("MethodNotFoundError", "unknown gRPC method"));
  }
  if (value.status !== undefined && !isA2AGrpcStatusName(value.status)) {
    return err(a2aProtocolError("InvalidRequestError", "gRPC status is not recognized"));
  }
  const error = parseGrpcError(value.error);
  return ok({
    service: A2A_GRPC_SERVICE_NAME,
    method: value.method,
    ...(isA2AGrpcStatusName(value.status) ? { status: value.status } : {}),
    ...(value.message !== undefined ? { message: value.message } : {}),
    ...(error !== undefined ? { error } : {}),
  });
}

export function grpcMetadataToServiceParameters(
  metadata: Readonly<Record<string, string>> | undefined,
): A2AServiceParameters {
  return parseA2AServiceParameters(metadata ?? {});
}

export function createA2AGrpcService(engine: A2AOperationEngine): A2AGrpcService {
  return {
    invoke(method, message, metadata) {
      return dispatchA2AOperation(
        engine,
        method as A2AOperationName,
        message,
        grpcMetadataToServiceParameters(metadata),
      );
    },
  };
}

export function invokeA2AGrpc(
  service: A2AGrpcService,
  frame: A2AGrpcFrame | string,
): A2AGrpcFrame {
  const decoded = decodeA2AGrpcRequest(frame);
  if (!decoded.ok) {
    return encodeA2AGrpcResponse("GetTask", decoded);
  }
  const result = service.invoke(
    decoded.value.method,
    decoded.value.message,
    decoded.value.metadata,
  );
  return encodeA2AGrpcResponse(decoded.value.method, result);
}
