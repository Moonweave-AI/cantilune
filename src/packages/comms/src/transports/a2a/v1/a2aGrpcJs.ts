/**
 * Official A2A 1.0.0 gRPC binding.
 *
 * Loads the normative `lf.a2a.v1.A2AService` proto and serves the same
 * {@link A2AOperationEngine} used by JSON-RPC / REST / SSE. Agent Card
 * discovery stays on HTTP `/.well-known/agent-card.json` — the proto has no
 * GetAgentCard RPC.
 */
import { Buffer } from "node:buffer";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";
import type {
  ChannelCredentials,
  ClientReadableStream,
  Metadata,
  ServerCredentials,
  ServiceClientConstructor,
  ServiceDefinition,
  ServiceError,
  UntypedServiceImplementation,
  handleServerStreamingCall,
  handleUnaryCall,
} from "@grpc/grpc-js";
import { a2aErrorReason, type A2AProtocolError } from "./a2aMessage.js";
import {
  dispatchA2AOperation,
  parseA2AServiceParameters,
  type A2AOperationEngine,
  type A2AOperationName,
} from "./a2aOperations.js";
import { mapA2AErrorToGrpcStatus } from "./a2aGrpcBinding.js";
import { jsonToProtoMessage, protoMessageToJson } from "./a2aProtoJson.js";

export const A2A_GRPC_PROTO_PACKAGE = "lf.a2a.v1";
export const A2A_GRPC_PROTO_SERVICE = "A2AService";
export const A2A_GRPC_PROTO_SERVICE_NAME = `${A2A_GRPC_PROTO_PACKAGE}.${A2A_GRPC_PROTO_SERVICE}`;

export const A2A_GRPC_PROTO_METHODS = [
  "SendMessage",
  "SendStreamingMessage",
  "GetTask",
  "ListTasks",
  "CancelTask",
  "SubscribeToTask",
  "CreateTaskPushNotificationConfig",
  "GetTaskPushNotificationConfig",
  "ListTaskPushNotificationConfigs",
  "DeleteTaskPushNotificationConfig",
  "GetExtendedAgentCard",
] as const;

export type A2AGrpcProtoMethod = (typeof A2A_GRPC_PROTO_METHODS)[number];

const STREAM_METHODS = new Set<A2AGrpcProtoMethod>(["SendStreamingMessage", "SubscribeToTask"]);

const PROTO_LOADER_OPTIONS = {
  keepCase: false,
  longs: String,
  enums: String,
  defaults: false,
  oneofs: true,
  bytes: String,
} as const;

export function a2aProtoRootDir(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, "../../../../spec/a2a/v1.0.0");
}

export function a2aProtoFile(): string {
  return path.join(a2aProtoRootDir(), "a2a.proto");
}

export interface LoadedA2AGrpcPackage {
  readonly root: string;
  readonly service: ServiceDefinition;
  readonly Client: ServiceClientConstructor;
  readonly methodNames: readonly string[];
}

let cachedPackage: LoadedA2AGrpcPackage | undefined;

function readServiceDescriptor(loaded: unknown): {
  readonly service: ServiceDefinition;
  readonly Client: ServiceClientConstructor;
} {
  const root = loaded as {
    lf?: { a2a?: { v1?: { A2AService?: ServiceClientConstructor } } };
  };
  const ctor = root.lf?.a2a?.v1?.A2AService;
  if (ctor === undefined || ctor.service === undefined) {
    throw new Error(`failed to load ${A2A_GRPC_PROTO_SERVICE_NAME} from official a2a.proto`);
  }
  return { service: ctor.service, Client: ctor };
}

export function loadA2AGrpcPackage(): LoadedA2AGrpcPackage {
  if (cachedPackage !== undefined) {
    return cachedPackage;
  }
  const root = a2aProtoRootDir();
  const definition = protoLoader.loadSync(a2aProtoFile(), {
    ...PROTO_LOADER_OPTIONS,
    includeDirs: [root],
  });
  const loaded = grpc.loadPackageDefinition(definition);
  const { service, Client } = readServiceDescriptor(loaded);
  cachedPackage = {
    root,
    service,
    Client,
    methodNames: Object.keys(service),
  };
  return cachedPackage;
}

export function officialA2AGrpcMethodNames(): readonly string[] {
  return loadA2AGrpcPackage().methodNames;
}

function metadataToRecord(metadata: Metadata): Record<string, string> {
  const record: Record<string, string> = {};
  for (const [key, value] of Object.entries(metadata.getMap())) {
    if (typeof value === "string") {
      record[key] = value;
    } else if (Buffer.isBuffer(value)) {
      record[key] = value.toString("utf8");
    }
  }
  return record;
}

function serviceParametersFromMetadata(
  metadata: Metadata,
): ReturnType<typeof parseA2AServiceParameters> {
  const parsed = parseA2AServiceParameters(metadataToRecord(metadata));
  if (parsed.a2aVersion === undefined) {
    return { ...parsed, a2aVersion: "1.0" };
  }
  return parsed;
}

function createClientMetadata(headers: Readonly<Record<string, string>> | undefined): Metadata {
  const metadata = new grpc.Metadata();
  metadata.set("a2a-version", headers?.["a2a-version"] ?? headers?.["A2A-Version"] ?? "1.0");
  if (headers !== undefined) {
    for (const [key, value] of Object.entries(headers)) {
      if (key.toLowerCase() === "a2a-version") {
        continue;
      }
      metadata.set(key, value);
    }
  }
  return metadata;
}

function toServiceError(error: A2AProtocolError): ServiceError {
  const statusName = mapA2AErrorToGrpcStatus(error.name);
  const serviceError = new Error(error.message) as ServiceError;
  serviceError.code = grpc.status[statusName];
  serviceError.details = error.message;
  serviceError.metadata = new grpc.Metadata();
  serviceError.metadata.set("a2a-error-reason", a2aErrorReason(error.name));
  return serviceError;
}

function toInternalError(error: unknown): ServiceError {
  const message = error instanceof Error ? error.message : String(error);
  const serviceError = new Error(message) as ServiceError;
  serviceError.code = grpc.status.INTERNAL;
  serviceError.details = message;
  serviceError.metadata = new grpc.Metadata();
  return serviceError;
}

function resolveServerCredentials(options: A2AGrpcListenOptions): ServerCredentials {
  if (options.credentials !== undefined) {
    return options.credentials;
  }
  if (options.insecure === true) {
    return grpc.ServerCredentials.createInsecure();
  }
  throw new Error(
    "A2A gRPC server requires TLS credentials (ADR-0008); pass insecure: true only for loopback tests",
  );
}

function resolveClientCredentials(options: A2AGrpcClientOptions): ChannelCredentials {
  if (options.credentials !== undefined) {
    return options.credentials;
  }
  if (options.insecure === true) {
    return grpc.credentials.createInsecure();
  }
  throw new Error(
    "A2A gRPC client requires TLS credentials (ADR-0008); pass insecure: true only for loopback tests",
  );
}

function dispatchJson(
  engine: A2AOperationEngine,
  operation: A2AOperationName,
  request: unknown,
  metadata: Metadata,
) {
  return dispatchA2AOperation(
    engine,
    operation,
    protoMessageToJson(request),
    serviceParametersFromMetadata(metadata),
  );
}

function unaryHandler(
  engine: A2AOperationEngine,
  operation: A2AOperationName,
): handleUnaryCall<unknown, unknown> {
  return (call, callback) => {
    try {
      const result = dispatchJson(engine, operation, call.request, call.metadata);
      if (!result.ok) {
        callback(toServiceError(result.error), null);
        return;
      }
      callback(null, jsonToProtoMessage(result.value ?? {}));
    } catch (error) {
      callback(toInternalError(error), null);
    }
  };
}

function streamHandler(
  engine: A2AOperationEngine,
  operation: A2AOperationName,
): handleServerStreamingCall<unknown, unknown> {
  return (call) => {
    try {
      const result = dispatchJson(engine, operation, call.request, call.metadata);
      if (!result.ok) {
        call.emit("error", toServiceError(result.error));
        return;
      }
      const events = Array.isArray(result.value) ? result.value : [];
      for (const event of events) {
        call.write(jsonToProtoMessage(event));
      }
      call.end();
    } catch (error) {
      call.emit("error", toInternalError(error));
    }
  };
}

export interface A2AGrpcListenOptions {
  readonly host?: string;
  readonly port?: number;
  readonly credentials?: ServerCredentials;
  readonly insecure?: boolean;
}

export interface A2AGrpcServer {
  readonly address: string;
  readonly port: number;
  close(): Promise<void>;
}

export async function createA2AGrpcServer(
  engine: A2AOperationEngine,
  options: A2AGrpcListenOptions = {},
): Promise<A2AGrpcServer> {
  const loaded = loadA2AGrpcPackage();
  const server = new grpc.Server();
  const implementation: UntypedServiceImplementation = {};
  for (const method of A2A_GRPC_PROTO_METHODS) {
    implementation[method] = STREAM_METHODS.has(method)
      ? streamHandler(engine, method)
      : unaryHandler(engine, method);
  }
  server.addService(loaded.service, implementation);

  const host = options.host ?? "127.0.0.1";
  const port = options.port ?? 0;
  const bound = await new Promise<number>((resolve, reject) => {
    server.bindAsync(
      `${host}:${String(port)}`,
      resolveServerCredentials(options),
      (error, boundPort) => {
        if (error !== null) {
          reject(error);
          return;
        }
        resolve(boundPort);
      },
    );
  });

  return {
    address: `${host}:${String(bound)}`,
    port: bound,
    close() {
      return new Promise((resolve) => {
        server.tryShutdown((error) => {
          if (error !== undefined && error !== null) {
            server.forceShutdown();
          }
          resolve();
        });
      });
    },
  };
}

export interface A2AGrpcClientOptions {
  readonly credentials?: ChannelCredentials;
  readonly insecure?: boolean;
  readonly metadata?: Readonly<Record<string, string>>;
}

export interface A2AGrpcClient {
  sendMessage(request: unknown, metadata?: Readonly<Record<string, string>>): Promise<unknown>;
  sendStreamingMessage(
    request: unknown,
    metadata?: Readonly<Record<string, string>>,
  ): AsyncIterable<unknown>;
  getTask(request: unknown, metadata?: Readonly<Record<string, string>>): Promise<unknown>;
  listTasks(request: unknown, metadata?: Readonly<Record<string, string>>): Promise<unknown>;
  cancelTask(request: unknown, metadata?: Readonly<Record<string, string>>): Promise<unknown>;
  subscribeToTask(
    request: unknown,
    metadata?: Readonly<Record<string, string>>,
  ): AsyncIterable<unknown>;
  createTaskPushNotificationConfig(
    request: unknown,
    metadata?: Readonly<Record<string, string>>,
  ): Promise<unknown>;
  getTaskPushNotificationConfig(
    request: unknown,
    metadata?: Readonly<Record<string, string>>,
  ): Promise<unknown>;
  listTaskPushNotificationConfigs(
    request: unknown,
    metadata?: Readonly<Record<string, string>>,
  ): Promise<unknown>;
  deleteTaskPushNotificationConfig(
    request: unknown,
    metadata?: Readonly<Record<string, string>>,
  ): Promise<unknown>;
  getExtendedAgentCard(
    request?: unknown,
    metadata?: Readonly<Record<string, string>>,
  ): Promise<unknown>;
  close(): void;
}

type UnaryClientMethod = (
  request: unknown,
  metadata: Metadata,
  callback: (error: ServiceError | null, response?: unknown) => void,
) => void;

type StreamClientMethod = (request: unknown, metadata: Metadata) => ClientReadableStream<unknown>;

function unaryCall(
  method: UnaryClientMethod,
  request: unknown,
  metadata: Metadata,
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    method(jsonToProtoMessage(request) ?? {}, metadata, (error, response) => {
      if (error !== null) {
        reject(error);
        return;
      }
      resolve(protoMessageToJson(response));
    });
  });
}

async function* streamCall(
  method: StreamClientMethod,
  request: unknown,
  metadata: Metadata,
): AsyncGenerator<unknown> {
  const call = method(jsonToProtoMessage(request) ?? {}, metadata);
  const queue: unknown[] = [];
  let done = false;
  let failure: unknown;
  let notify: (() => void) | undefined;
  const wake = (): void => {
    notify?.();
    notify = undefined;
  };
  call.on("data", (row: unknown) => {
    queue.push(protoMessageToJson(row));
    wake();
  });
  call.on("end", () => {
    done = true;
    wake();
  });
  call.on("error", (error: unknown) => {
    failure = error;
    done = true;
    wake();
  });
  while (!done || queue.length > 0) {
    if (queue.length === 0) {
      await new Promise<void>((resolve) => {
        notify = resolve;
      });
    }
    while (queue.length > 0) {
      yield queue.shift();
    }
    if (failure !== undefined) {
      throw failure;
    }
  }
}

export function createA2AGrpcClient(
  address: string,
  options: A2AGrpcClientOptions = {},
): A2AGrpcClient {
  const loaded = loadA2AGrpcPackage();
  const client = new loaded.Client(address, resolveClientCredentials(options));
  const defaultMetadata = options.metadata;

  const metadataFor = (headers: Readonly<Record<string, string>> | undefined): Metadata =>
    createClientMetadata(headers ?? defaultMetadata);

  const unary = (name: string) => {
    const method = (client as unknown as Record<string, UnaryClientMethod>)[name];
    if (method === undefined) {
      throw new Error(`gRPC client missing ${name}`);
    }
    return (request: unknown, headers?: Readonly<Record<string, string>>) =>
      unaryCall(method.bind(client), request, metadataFor(headers));
  };

  const stream = (name: string) => {
    const method = (client as unknown as Record<string, StreamClientMethod>)[name];
    if (method === undefined) {
      throw new Error(`gRPC client missing ${name}`);
    }
    return (request: unknown, headers?: Readonly<Record<string, string>>) =>
      streamCall(method.bind(client), request, metadataFor(headers));
  };

  return {
    sendMessage: unary("sendMessage"),
    sendStreamingMessage: stream("sendStreamingMessage"),
    getTask: unary("getTask"),
    listTasks: unary("listTasks"),
    cancelTask: unary("cancelTask"),
    subscribeToTask: stream("subscribeToTask"),
    createTaskPushNotificationConfig: unary("createTaskPushNotificationConfig"),
    getTaskPushNotificationConfig: unary("getTaskPushNotificationConfig"),
    listTaskPushNotificationConfigs: unary("listTaskPushNotificationConfigs"),
    deleteTaskPushNotificationConfig: unary("deleteTaskPushNotificationConfig"),
    getExtendedAgentCard: (request = {}, headers) =>
      unary("getExtendedAgentCard")(request, headers),
    close() {
      client.close();
    },
  };
}
