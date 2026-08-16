import { describe, expect, it } from "vitest";
import {
  A2AOperationEngine,
  A2A_GRPC_SERVICE_NAME,
  A2A_JSON_CONTENT_TYPE,
  A2A_JSONRPC_VERSION,
  a2aErrorReason,
  a2aProtocolError,
  agentInterfaceFromPeerEndpoint,
  applyA2AHistoryLength,
  assertA2AVersionSupported,
  createA2AGrpcService,
  decodeA2AGrpcRequest,
  decodeA2AGrpcResponse,
  decodeA2AJsonRpcRequest,
  decodeA2AJsonRpcResponse,
  decodeA2ASseStream,
  dispatchA2AOperation,
  encodeA2AGrpcRequest,
  encodeA2AGrpcResponse,
  encodeA2AJsonRpcError,
  encodeA2AJsonRpcSuccess,
  encodeA2ARestError,
  encodeA2ASseEvent,
  grpcMetadataToServiceParameters,
  handleA2AJsonRpc,
  handleA2ARestRequest,
  invokeA2AGrpc,
  isA2ACancelableTaskState,
  isA2AGrpcMethod,
  isA2AInterruptedTaskState,
  isA2AJsonRpcMethod,
  isA2AProtocolBinding,
  isA2ARole,
  isA2ATaskState,
  isA2ATerminalTaskState,
  mapA2AErrorToGrpcStatus,
  matchA2ARestRoute,
  normalizeA2AVersion,
  parseA2AAgentCard,
  parseA2AArtifact,
  parseA2ACancelTaskRequest,
  parseA2AGetTaskRequest,
  parseA2AListTasksRequest,
  parseA2AMessage,
  parseA2APart,
  parseA2ASecurityScheme,
  parseA2ASendMessageRequest,
  parseA2AServiceParameters,
  parseA2AStreamResponse,
  parseA2ATask,
  parseA2ARestQuery,
} from "../../src/index.js";
import {
  A2A_V1_HEADERS,
  sampleA2AAgentCard,
  sequentialA2AIds,
  testPeerEndpoint,
  testSessionBinding,
  userTextMessage,
} from "../support/a2aV1Fixtures.js";

function engine(card = sampleA2AAgentCard(), extras: Record<string, unknown> = {}) {
  const created = A2AOperationEngine.create({
    agentCard: card,
    idGenerator: sequentialA2AIds(),
    clock: { now: () => "2026-08-16T00:00:00Z" },
    session: testSessionBinding(),
    ...extras,
  });
  if (!created.ok) {
    throw new Error(created.error.message);
  }
  return created.value;
}

describe("A2A v1 data-model coverage", () => {
  it("parses parts, messages, tasks, and stream events", () => {
    expect(isA2ARole("ROLE_USER")).toBe(true);
    expect(isA2ARole("nope")).toBe(false);
    expect(parseA2APart({ text: "hi", mediaType: "text/plain" }).ok).toBe(true);
    expect(parseA2APart({ raw: "Zm9v", filename: "a.bin" }).ok).toBe(true);
    expect(parseA2APart({ url: "https://example.com/a.png" }).ok).toBe(true);
    expect(parseA2APart({ data: { k: 1 }, metadata: { src: "t" } }).ok).toBe(true);
    expect(parseA2APart({ text: "a", raw: "b" }).ok).toBe(false);
    expect(parseA2APart("x").ok).toBe(false);
    expect(parseA2APart({ text: 1 }).ok).toBe(false);
    expect(parseA2AMessage({ messageId: "m", role: "ROLE_AGENT", parts: [{ text: "a" }] }).ok).toBe(
      true,
    );
    expect(parseA2AMessage({}).ok).toBe(false);
    expect(parseA2ASendMessageRequest({ message: userTextMessage("x") }).ok).toBe(true);
    expect(parseA2ASendMessageRequest("bad").ok).toBe(false);
    expect(
      parseA2ASendMessageRequest({
        message: userTextMessage("x"),
        configuration: {
          acceptedOutputModes: ["text/plain"],
          returnImmediately: true,
          historyLength: 2,
          taskPushNotificationConfig: { url: "https://hook.example/push", token: "t" },
        },
        tenant: "t1",
        metadata: { k: 1 },
      }).ok,
    ).toBe(true);

    const task = parseA2ATask({
      id: "t1",
      contextId: "c1",
      status: { state: "TASK_STATE_WORKING", timestamp: "2026-08-16T00:00:00Z" },
      artifacts: [{ artifactId: "a1", parts: [{ text: "out" }] }],
      history: [userTextMessage("in")],
      metadata: { k: 1 },
    });
    expect(task.ok).toBe(true);
    if (task.ok) {
      expect(applyA2AHistoryLength(task.value, 0).history).toBeUndefined();
      expect(applyA2AHistoryLength(task.value, 1).history).toHaveLength(1);
      expect(applyA2AHistoryLength(task.value, undefined)).toBe(task.value);
    }
    expect(parseA2AArtifact({ artifactId: "a", parts: [{ text: "x" }], name: "n" }).ok).toBe(true);
    expect(parseA2AStreamResponse({ task: { id: "t", status: { state: "TASK_STATE_WORKING" } } }).ok).toBe(
      true,
    );
    expect(parseA2AStreamResponse({ message: userTextMessage("m") }).ok).toBe(true);
    expect(
      parseA2AStreamResponse({
        statusUpdate: {
          taskId: "t",
          contextId: "c",
          status: { state: "TASK_STATE_COMPLETED" },
        },
      }).ok,
    ).toBe(true);
    expect(
      parseA2AStreamResponse({
        artifactUpdate: {
          taskId: "t",
          contextId: "c",
          artifact: { artifactId: "a", parts: [{ text: "x" }] },
          append: true,
          lastChunk: false,
        },
      }).ok,
    ).toBe(true);
    expect(parseA2AStreamResponse({ task: {}, message: {} }).ok).toBe(false);
    expect(isA2ATaskState("TASK_STATE_FAILED")).toBe(true);
    expect(isA2ATerminalTaskState("TASK_STATE_FAILED")).toBe(true);
    expect(isA2AInterruptedTaskState("TASK_STATE_AUTH_REQUIRED")).toBe(true);
    expect(isA2ACancelableTaskState("TASK_STATE_WORKING")).toBe(true);
    expect(parseA2AGetTaskRequest({ id: "t", historyLength: 3 }).ok).toBe(true);
    expect(parseA2AListTasksRequest(undefined).ok).toBe(true);
    expect(parseA2AListTasksRequest({ status: "TASK_STATE_WORKING", pageSize: 2 }).ok).toBe(true);
    expect(parseA2ACancelTaskRequest({ id: "t", metadata: { reason: "stop" } }).ok).toBe(true);
    expect(a2aErrorReason("VersionNotSupportedError")).toBe("VERSION_NOT_SUPPORTED");
    expect(a2aProtocolError("InternalError", "x", { details: [{ "@type": "t" }] }).details).toHaveLength(
      1,
    );
  });

  it("parses Agent Card security schemes and peer endpoint mapping", () => {
    expect(isA2AProtocolBinding("JSONRPC")).toBe(true);
    expect(isA2AProtocolBinding("SOAP")).toBe(false);
    const mapped = agentInterfaceFromPeerEndpoint(testPeerEndpoint(), "HTTP+JSON");
    expect(mapped.url).toBe("https://agent.example.com/a2a/v1");

    expect(
      parseA2ASecurityScheme({
        apiKeySecurityScheme: { location: "header", name: "X-Key", description: "k" },
      }).ok,
    ).toBe(true);
    expect(
      parseA2ASecurityScheme({
        httpAuthSecurityScheme: { scheme: "Bearer", bearerFormat: "JWT" },
      }).ok,
    ).toBe(true);
    expect(
      parseA2ASecurityScheme({
        mtlsSecurityScheme: { description: "pin" },
      }).ok,
    ).toBe(true);
    expect(
      parseA2ASecurityScheme({
        oauth2SecurityScheme: {
          flows: {
            authorizationCode: {
              authorizationUrl: "https://auth.example/authorize",
              tokenUrl: "https://auth.example/token",
              scopes: { read: "r" },
              pkceRequired: true,
            },
          },
        },
      }).ok,
    ).toBe(true);
    expect(
      parseA2ASecurityScheme({
        oauth2SecurityScheme: {
          flows: {
            clientCredentials: { tokenUrl: "https://auth.example/token", scopes: { read: "r" } },
          },
        },
      }).ok,
    ).toBe(true);
    expect(
      parseA2ASecurityScheme({
        oauth2SecurityScheme: {
          flows: { implicit: { authorizationUrl: "https://auth.example/a", scopes: { r: "r" } } },
        },
      }).ok,
    ).toBe(true);
    expect(
      parseA2ASecurityScheme({
        oauth2SecurityScheme: {
          flows: { password: { tokenUrl: "https://auth.example/token", scopes: { r: "r" } } },
        },
      }).ok,
    ).toBe(true);
    expect(
      parseA2ASecurityScheme({
        oauth2SecurityScheme: {
          flows: {
            deviceCode: {
              deviceAuthorizationUrl: "https://auth.example/device",
              tokenUrl: "https://auth.example/token",
              scopes: { r: "r" },
            },
          },
        },
      }).ok,
    ).toBe(true);
    expect(parseA2ASecurityScheme({ apiKeySecurityScheme: {}, httpAuthSecurityScheme: {} }).ok).toBe(
      false,
    );
    expect(parseA2AAgentCard("nope").ok).toBe(false);
    expect(
      parseA2AAgentCard(
        sampleA2AAgentCard({
          capabilities: {
            streaming: true,
            extensions: [{ uri: "https://ext.example/v1", required: true, params: { a: 1 } }],
          },
        }),
      ).ok,
    ).toBe(true);
  });
});

describe("A2A v1 operations coverage", () => {
  it("enforces version, extensions, content type, and extended card rules", () => {
    expect(normalizeA2AVersion(undefined)).toBe("0.3");
    expect(normalizeA2AVersion("1.0.0")).toBe("1.0");
    expect(assertA2AVersionSupported("0.3").ok).toBe(false);
    expect(assertA2AVersionSupported("1.0").ok).toBe(true);
    expect(parseA2AServiceParameters({ "A2A-Version": "1.0", "A2A-Extensions": "a, b" })).toEqual({
      a2aVersion: "1.0",
      a2aExtensions: ["a", "b"],
    });

    const created = A2AOperationEngine.create({ agentCard: { name: "bad" } as never });
    expect(created.ok).toBe(false);
    const badExt = A2AOperationEngine.create({
      agentCard: sampleA2AAgentCard(),
      extendedAgentCard: { name: "bad" } as never,
    });
    expect(badExt.ok).toBe(false);

    const restricted = engine(
      sampleA2AAgentCard({
        capabilities: {
          streaming: false,
          pushNotifications: false,
          extendedAgentCard: false,
          extensions: [{ uri: "https://ext.example/v1", required: true }],
        },
      }),
    );
    expect(restricted.getPublicAgentCard().name).toContain("GeoSpatial");
    expect(restricted.getAgentCard().ok).toBe(false);
    expect(restricted.getAgentCard({ a2aExtensions: ["https://ext.example/v1"] }).ok).toBe(true);
    expect(restricted.getExtendedAgentCard({ a2aVersion: "1.0" }).ok).toBe(false);
    expect(
      restricted.sendStreamingMessage({ message: userTextMessage("x") }, { a2aVersion: "1.0" }).ok,
    ).toBe(false);
    expect(
      restricted.createPushNotificationConfig("t", { url: "https://hook" }, { a2aVersion: "1.0" }).ok,
    ).toBe(false);
    expect(
      restricted.sendMessage(
        { message: { ...userTextMessage("x"), parts: [{ text: "x", mediaType: "image/png" }] } },
        { a2aVersion: "1.0" },
      ).ok,
    ).toBe(false);

    const withExt = engine(sampleA2AAgentCard({ capabilities: { extendedAgentCard: true } }));
    const extendedMissing = withExt.getExtendedAgentCard({ a2aVersion: "1.0" });
    expect(extendedMissing.ok).toBe(false);
    if (!extendedMissing.ok) {
      expect(extendedMissing.error.name).toBe("ExtendedAgentCardNotConfiguredError");
    }
  });

  it("covers list filters, subscribe, push, and message-only processing", async () => {
    const ops = engine(sampleA2AAgentCard(), {
      processor: {
        process: () => ({ kind: "message", message: { ...userTextMessage("agent"), role: "ROLE_AGENT" } }),
      },
    });
    const direct = ops.sendMessage({ message: userTextMessage("q") }, { a2aVersion: "1.0" });
    expect(direct.ok && "message" in direct.value).toBe(true);
    const streamed = ops.sendStreamingMessage({ message: userTextMessage("q2") }, { a2aVersion: "1.0" });
    expect(streamed.ok && streamed.value[0] && "message" in streamed.value[0]).toBe(true);

    const full = engine();
    const first = full.sendMessage(
      { message: userTextMessage("one"), configuration: { returnImmediately: true } },
      { a2aVersion: "1.0" },
    );
    expect(first.ok).toBe(true);
    if (!first.ok || !("task" in first.value)) {
      return;
    }
    const follow = full.sendMessage(
      {
        message: userTextMessage("two", {
          taskId: first.value.task.id,
          ...(first.value.task.contextId !== undefined
            ? { contextId: first.value.task.contextId }
            : {}),
        }),
        configuration: { returnImmediately: true },
      },
      { a2aVersion: "1.0" },
    );
    expect(follow.ok).toBe(true);
    const mismatch = full.sendMessage(
      { message: userTextMessage("bad", { taskId: first.value.task.id, contextId: "other" }) },
      { a2aVersion: "1.0" },
    );
    expect(mismatch.ok).toBe(false);
    expect(full.sendMessage({ message: userTextMessage("x", { taskId: "nope" }) }, { a2aVersion: "1.0" }).ok).toBe(
      false,
    );

    const listed = full.listTasks(
      {
        ...(first.value.task.contextId !== undefined
          ? { contextId: first.value.task.contextId }
          : {}),
        status: "TASK_STATE_WORKING",
        pageSize: 1,
        pageToken: "0",
        statusTimestampAfter: "2020-01-01T00:00:00Z",
        includeArtifacts: false,
      },
      { a2aVersion: "1.0" },
    );
    expect(listed.ok).toBe(true);
    expect(full.listTasks({ pageToken: "abc" }, { a2aVersion: "1.0" }).ok).toBe(false);
    expect(full.listTasks({ pageSize: 0 }, { a2aVersion: "1.0" }).ok).toBe(true);
    expect(full.listTasks({ pageSize: 1000 }, { a2aVersion: "1.0" }).ok).toBe(true);

    const sub = full.subscribeToTask({ id: first.value.task.id }, { a2aVersion: "1.0" });
    expect(sub.ok).toBe(true);
    const done = full.sendMessage({ message: userTextMessage("fin") }, { a2aVersion: "1.0" });
    if (done.ok && "task" in done.value) {
      expect(full.subscribeToTask({ id: done.value.task.id }, { a2aVersion: "1.0" }).ok).toBe(false);
      expect(full.cancelTask({ id: done.value.task.id }, { a2aVersion: "1.0" }).ok).toBe(false);
    }
    expect(full.subscribeToTask({ id: "missing" }, { a2aVersion: "1.0" }).ok).toBe(false);
    expect(full.getTask({ id: "missing" }, { a2aVersion: "1.0" }).ok).toBe(false);
    expect(full.cancelTask({ id: "missing" }, { a2aVersion: "1.0" }).ok).toBe(false);

    const push = full.createPushNotificationConfig(
      first.value.task.id,
      { url: "https://hook.example/push", token: "tok", authentication: { scheme: "Bearer", credentials: "abc" } },
      { a2aVersion: "1.0" },
    );
    expect(push.ok).toBe(true);
    if (!push.ok) {
      return;
    }
    expect(full.getPushNotificationConfig(first.value.task.id, push.value.id, { a2aVersion: "1.0" }).ok).toBe(
      true,
    );
    expect(full.listPushNotificationConfigs(first.value.task.id, { a2aVersion: "1.0" }).ok).toBe(true);
    expect(full.listPushNotificationConfigs("missing", { a2aVersion: "1.0" }).ok).toBe(false);
    expect(full.getPushNotificationConfig(first.value.task.id, "nope", { a2aVersion: "1.0" }).ok).toBe(false);
    const failingPush = engine(sampleA2AAgentCard(), {
      fetchImpl: async () => {
        throw new Error("webhook unreachable");
      },
    });
    const failingTask = failingPush.sendMessage(
      { message: userTextMessage("fail-push"), configuration: { returnImmediately: true } },
      { a2aVersion: "1.0" },
    );
    if (failingTask.ok && "task" in failingTask.value) {
      failingPush.createPushNotificationConfig(
        failingTask.value.task.id,
        { url: "https://hook.example/fail" },
        { a2aVersion: "1.0" },
      );
      const delivered = await failingPush.deliverPushNotifications(failingTask.value.task.id, {
        task: failingTask.value.task,
      });
      expect(delivered.ok).toBe(false);
    }
    const withFetch = engine(sampleA2AAgentCard(), {
      fetchImpl: async () => new Response(null, { status: 204 }),
    });
    const createdTask = withFetch.sendMessage(
      {
        message: userTextMessage("p"),
        configuration: {
          returnImmediately: true,
          taskPushNotificationConfig: { url: "https://hook.example/inline" },
        },
      },
      { a2aVersion: "1.0" },
    );
    expect(createdTask.ok).toBe(true);
    if (createdTask.ok && "task" in createdTask.value) {
      const okPush = await withFetch.deliverPushNotifications(createdTask.value.task.id, {
        task: createdTask.value.task,
      });
      expect(okPush.ok).toBe(true);
    }
    expect(full.deletePushNotificationConfig(first.value.task.id, push.value.id, { a2aVersion: "1.0" }).ok).toBe(
      true,
    );
    expect(full.deletePushNotificationConfig("missing", "x", { a2aVersion: "1.0" }).ok).toBe(false);
    expect(full.cancelTask({ id: first.value.task.id }, { a2aVersion: "1.0" }).ok).toBe(true);
    expect(full.cancelTask({ id: first.value.task.id }, { a2aVersion: "1.0" }).ok).toBe(true);

    const extended = A2AOperationEngine.create({
      agentCard: sampleA2AAgentCard(),
      extendedAgentCard: sampleA2AAgentCard({ name: "Extended" }),
    });
    expect(extended.ok && extended.value.getExtendedAgentCard({ a2aVersion: "1.0" }).ok).toBe(true);

    expect(full.buildPushPayload({ task: first.value.task })).toEqual({ task: first.value.task });
    expect(dispatchA2AOperation(full, "GetAgentCard", {}).ok).toBe(true);
    expect(dispatchA2AOperation(full, "ListTasks", { pageSize: 2 }, { a2aVersion: "1.0" }).ok).toBe(true);
    expect(
      dispatchA2AOperation(
        full,
        "CreateTaskPushNotificationConfig",
        { taskId: first.value.task.id, url: "https://hook.example/x" },
        { a2aVersion: "1.0" },
      ).ok,
    ).toBe(true);
  });
});

describe("A2A v1 binding coverage", () => {
  it("covers JSON-RPC encode/decode and error frames", () => {
    expect(isA2AJsonRpcMethod("SendMessage")).toBe(true);
    expect(isA2AJsonRpcMethod("nope")).toBe(false);
    expect(decodeA2AJsonRpcRequest("{").ok).toBe(false);
    expect(decodeA2AJsonRpcRequest({ jsonrpc: "1.0", method: "SendMessage", id: 1 }).ok).toBe(false);
    expect(decodeA2AJsonRpcRequest({ jsonrpc: "2.0", method: "SendMessage" }).ok).toBe(false);
    expect(decodeA2AJsonRpcResponse("{").ok).toBe(false);
    expect(decodeA2AJsonRpcResponse({ jsonrpc: A2A_JSONRPC_VERSION, id: 1, result: { ok: true } }).ok).toBe(
      true,
    );
    expect(
      decodeA2AJsonRpcResponse({
        jsonrpc: "2.0",
        id: 1,
        error: { code: -32600, message: "bad", data: [] },
      }).ok,
    ).toBe(true);
    const engineInst = engine();
    const parsed = handleA2AJsonRpc(engineInst, "not-json");
    expect(parsed.kind).toBe("json");
    const success = encodeA2AJsonRpcSuccess(1, { ok: true });
    expect(success.result).toEqual({ ok: true });
    const failure = encodeA2AJsonRpcError(1, a2aProtocolError("InvalidParamsError", "bad", { path: "x" }));
    expect(failure.error.code).toBe(-32602);
  });

  it("covers REST matching, query parsing, and error bodies", () => {
    expect(parseA2ARestQuery("pageSize=2&includeArtifacts=true&status=TASK_STATE_WORKING").pageSize).toBe(
      "2",
    );
    expect(parseA2ARestQuery("").pageSize).toBeUndefined();
    expect(matchA2ARestRoute("GET", "tasks?x=1").ok).toBe(true);
    expect(matchA2ARestRoute("PATCH", "/tasks").ok).toBe(false);
    const inst = engine();
    const missing = handleA2ARestRequest(inst, {
      method: "GET",
      path: "/tasks/missing",
      headers: A2A_V1_HEADERS,
    });
    expect(missing.status).toBe(404);
    expect(missing.contentType).toBe(A2A_JSON_CONTENT_TYPE);
    const stream = handleA2ARestRequest(inst, {
      method: "POST",
      path: "/tasks/missing:subscribe",
      headers: A2A_V1_HEADERS,
    });
    expect(stream.kind).toBe("json");
    const created = handleA2ARestRequest(inst, {
      method: "POST",
      path: "/message:send",
      headers: A2A_V1_HEADERS,
      body: { message: userTextMessage("r"), configuration: { returnImmediately: true } },
    });
    const id = (created.body as { task: { id: string } }).task.id;
    const push = handleA2ARestRequest(inst, {
      method: "POST",
      path: `/tasks/${id}/pushNotificationConfigs`,
      headers: A2A_V1_HEADERS,
      body: { url: "https://hook.example/r" },
    });
    expect(push.status).toBe(200);
    const configId = (push.body as { id: string }).id;
    expect(
      handleA2ARestRequest(inst, {
        method: "GET",
        path: `/tasks/${id}/pushNotificationConfigs/${configId}`,
        headers: A2A_V1_HEADERS,
      }).status,
    ).toBe(200);
    expect(
      handleA2ARestRequest(inst, {
        method: "GET",
        path: `/tasks/${id}/pushNotificationConfigs`,
        headers: A2A_V1_HEADERS,
      }).status,
    ).toBe(200);
    expect(
      handleA2ARestRequest(inst, {
        method: "DELETE",
        path: `/tasks/${id}/pushNotificationConfigs/${configId}`,
        headers: A2A_V1_HEADERS,
      }).status,
    ).toBe(200);
    expect(
      handleA2ARestRequest(inst, {
        method: "GET",
        path: "/extendedAgentCard",
        headers: A2A_V1_HEADERS,
      }).status,
    ).toBe(400);
    expect(encodeA2ARestError(a2aProtocolError("TaskNotFoundError", "missing")).error.status).toBe(
      "NOT_FOUND",
    );
    const sub = handleA2ARestRequest(inst, {
      method: "POST",
      path: `/tasks/${id}:subscribe`,
      headers: A2A_V1_HEADERS,
    });
    expect(sub.kind).toBe("sse");
  });

  it("covers SSE decode edge cases", () => {
    expect(decodeA2ASseStream(": comment\n\n").ok).toBe(true);
    expect(decodeA2ASseStream("data: {not json}\n\n").ok).toBe(false);
    expect(decodeA2ASseStream('data: {"jsonrpc":"2.0","id":1}\n\n', "jsonrpc").ok).toBe(false);
    const event = encodeA2ASseEvent(
      { message: userTextMessage("x") },
      { mode: "jsonrpc", id: "abc", event: "message" },
    );
    expect(event).toContain("event: message");
    expect(decodeA2ASseStream(event, "jsonrpc").ok).toBe(true);
  });

  it("covers gRPC encode/decode and invoke errors", () => {
    expect(isA2AGrpcMethod("GetTask")).toBe(true);
    expect(isA2AGrpcMethod("Nope")).toBe(false);
    expect(mapA2AErrorToGrpcStatus("TaskNotFoundError")).toBe("NOT_FOUND");
    expect(grpcMetadataToServiceParameters({ "a2a-version": "1.0" }).a2aVersion).toBe("1.0");
    const frame = encodeA2AGrpcRequest("GetTask", { id: "t" }, { "a2a-version": "1.0" });
    expect(decodeA2AGrpcRequest(frame).ok).toBe(true);
    expect(decodeA2AGrpcRequest("{").ok).toBe(false);
    expect(decodeA2AGrpcRequest({ service: "nope", method: "GetTask" }).ok).toBe(false);
    expect(decodeA2AGrpcRequest({ service: A2A_GRPC_SERVICE_NAME, method: "Nope" }).ok).toBe(false);
    expect(
      decodeA2AGrpcRequest({
        service: A2A_GRPC_SERVICE_NAME,
        method: "GetTask",
        metadata: { n: 1 },
      }).ok,
    ).toBe(false);
    expect(decodeA2AGrpcResponse("{").ok).toBe(false);
    expect(
      decodeA2AGrpcResponse({
        service: A2A_GRPC_SERVICE_NAME,
        method: "GetTask",
        status: "OK",
        message: { id: "t" },
      }).ok,
    ).toBe(true);
    expect(
      decodeA2AGrpcResponse({
        service: A2A_GRPC_SERVICE_NAME,
        method: "GetTask",
        status: "WEIRD",
      }).ok,
    ).toBe(false);
    const inst = engine();
    const service = createA2AGrpcService(inst);
    const missing = invokeA2AGrpc(service, JSON.stringify(encodeA2AGrpcRequest("GetTask", { id: "no" })));
    expect(missing.status).toBe("FAILED_PRECONDITION");
    const bad = invokeA2AGrpc(service, "{");
    expect(bad.status).toBe("INVALID_ARGUMENT");
    const encodedErr = encodeA2AGrpcResponse("GetTask", {
      ok: false,
      error: a2aProtocolError("TaskNotFoundError", "missing"),
    });
    expect(encodedErr.error?.code).toBe("NOT_FOUND");
    expect(
      decodeA2AGrpcResponse({
        service: A2A_GRPC_SERVICE_NAME,
        method: "GetTask",
        error: { code: "NOT_FOUND", message: "missing", details: [] },
      }).ok,
    ).toBe(true);
  });
});
