import { describe, expect, it } from "vitest";
import {
  A2AOperationEngine,
  A2A_AGENT_CARD_WELL_KNOWN_PATH,
  A2A_GRPC_METHODS,
  A2A_JSONRPC_METHODS,
  A2A_PROFILE_PINNED,
  A2A_PROFILE_V1,
  A2A_PROTOCOL_VERSION_V1,
  A2A_REST_ROUTES,
  A2A_SSE_CONTENT_TYPE,
  a2aErrorReason,
  a2aJsonRpcErrorCode,
  a2aRestStatus,
  a2aStreamKind,
  createA2AGrpcService,
  decodeA2ASseStream,
  encodeA2AJsonRpcRequest,
  encodeA2ASseEvent,
  encodeA2ASseStream,
  handleA2AJsonRpc,
  handleA2ARestRequest,
  invokeA2AGrpc,
  matchA2ARestRoute,
  parseA2AAgentCard,
  parseA2AStreamResponse,
} from "../../src/index.js";
import {
  A2A_V1_HEADERS,
  sampleA2AAgentCard,
  sequentialA2AIds,
  testSessionBinding,
  userTextMessage,
} from "../support/a2aV1Fixtures.js";

function createEngine(
  overrides: Parameters<typeof sampleA2AAgentCard>[0] = {},
  extras: { processor?: Parameters<typeof A2AOperationEngine.create>[0]["processor"] } = {},
) {
  const created = A2AOperationEngine.create({
    agentCard: sampleA2AAgentCard(overrides),
    extendedAgentCard: sampleA2AAgentCard({
      name: "GeoSpatial Route Planner Agent (extended)",
      skills: [
        ...sampleA2AAgentCard().skills,
        {
          id: "internal-debug",
          name: "Internal debug",
          description: "Authenticated-only skill",
          tags: ["debug"],
        },
      ],
    }),
    idGenerator: sequentialA2AIds(),
    clock: { now: () => "2026-08-16T00:00:00Z" },
    session: testSessionBinding(),
    ...(extras.processor !== undefined ? { processor: extras.processor } : {}),
  });
  expect(created.ok).toBe(true);
  if (!created.ok) {
    throw new Error(created.error.message);
  }
  return created.value;
}

describe("A2A 1.0.0 Agent Card contract", () => {
  it("parses the official sample card and keeps a2a/0.1 as a distinct pin", () => {
    const parsed = parseA2AAgentCard(sampleA2AAgentCard());
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }
    expect(parsed.value.supportedInterfaces[0]?.protocolVersion).toBe(A2A_PROTOCOL_VERSION_V1);
    expect(parsed.value.capabilities.streaming).toBe(true);
    expect(A2A_PROFILE_PINNED).toBe("a2a/0.1");
    expect(A2A_PROFILE_V1).toBe("a2a/1.0");
  });

  it("rejects a card missing required fields", () => {
    const parsed = parseA2AAgentCard({ name: "x" });
    expect(parsed.ok).toBe(false);
  });
});

describe("A2A 1.0.0 task lifecycle contract", () => {
  it("sends, gets, lists, and cancels a task", () => {
    const engine = createEngine();
    const sent = engine.sendMessage(
      { message: userTextMessage("Plan a route") },
      { a2aVersion: "1.0" },
    );
    expect(sent.ok).toBe(true);
    if (!sent.ok || !("task" in sent.value)) {
      return;
    }
    expect(sent.value.task.id).toBe("task-1");
    expect(sent.value.task.status.state).toBe("TASK_STATE_COMPLETED");
    expect(sent.value.task.metadata?.sessionId).toBeDefined();

    const got = engine.getTask({ id: "task-1" }, { a2aVersion: "1.0" });
    expect(got.ok).toBe(true);

    const listed = engine.listTasks({ includeArtifacts: true }, { a2aVersion: "1.0" });
    expect(listed.ok).toBe(true);
    if (!listed.ok) {
      return;
    }
    expect(listed.value.tasks).toHaveLength(1);
    expect(listed.value.nextPageToken).toBe("");
    expect(listed.value.totalSize).toBe(1);

    const working = engine.sendMessage(
      { message: userTextMessage("async"), configuration: { returnImmediately: true } },
      { a2aVersion: "1.0" },
    );
    expect(working.ok).toBe(true);
    if (!working.ok || !("task" in working.value)) {
      return;
    }
    expect(working.value.task.status.state).toBe("TASK_STATE_WORKING");
    const canceled = engine.cancelTask({ id: working.value.task.id }, { a2aVersion: "1.0" });
    expect(canceled.ok).toBe(true);
    if (!canceled.ok) {
      return;
    }
    expect(canceled.value.status.state).toBe("TASK_STATE_CANCELED");
  });

  it("rejects further messages on a terminal task", () => {
    const engine = createEngine();
    const sent = engine.sendMessage(
      { message: userTextMessage("done") },
      { a2aVersion: "1.0" },
    );
    expect(sent.ok).toBe(true);
    if (!sent.ok || !("task" in sent.value)) {
      return;
    }
    const again = engine.sendMessage(
      { message: userTextMessage("more", { taskId: sent.value.task.id }) },
      { a2aVersion: "1.0" },
    );
    expect(again.ok).toBe(false);
    if (again.ok) {
      return;
    }
    expect(again.error.name).toBe("UnsupportedOperationError");
  });
});

describe("A2A 1.0.0 JSON-RPC methods contract", () => {
  it("exposes the spec method names and dispatches SendMessage / GetTask / ListTasks / CancelTask / GetAgentCard", () => {
    expect(A2A_JSONRPC_METHODS.SendMessage).toBe("SendMessage");
    expect(A2A_JSONRPC_METHODS.GetTask).toBe("GetTask");
    expect(A2A_JSONRPC_METHODS.ListTasks).toBe("ListTasks");
    expect(A2A_JSONRPC_METHODS.CancelTask).toBe("CancelTask");
    expect(A2A_JSONRPC_METHODS.GetAgentCard).toBe("GetAgentCard");
    expect(a2aJsonRpcErrorCode("TaskNotFoundError")).toBe(-32001);

    const engine = createEngine();
    const send = handleA2AJsonRpc(
      engine,
      encodeA2AJsonRpcRequest("SendMessage", { message: userTextMessage("hello") }, 1),
      { a2aVersion: "1.0" },
    );
    expect(send.kind).toBe("json");
    if (send.kind !== "json" || !("result" in send.body)) {
      return;
    }
    const taskId = (send.body.result as { task: { id: string } }).task.id;

    const get = handleA2AJsonRpc(
      engine,
      encodeA2AJsonRpcRequest("GetTask", { id: taskId }, 2),
      { a2aVersion: "1.0" },
    );
    expect(get.kind).toBe("json");

    const list = handleA2AJsonRpc(
      engine,
      encodeA2AJsonRpcRequest("ListTasks", { pageSize: 10 }, 3),
      { a2aVersion: "1.0" },
    );
    expect(list.kind).toBe("json");

    const card = handleA2AJsonRpc(engine, encodeA2AJsonRpcRequest("GetAgentCard", {}, 4));
    expect(card.kind).toBe("json");
    if (card.kind !== "json" || !("result" in card.body)) {
      return;
    }
    expect((card.body.result as { name: string }).name).toContain("GeoSpatial");

    const working = handleA2AJsonRpc(
      engine,
      encodeA2AJsonRpcRequest(
        "SendMessage",
        { message: userTextMessage("hold"), configuration: { returnImmediately: true } },
        5,
      ),
      { a2aVersion: "1.0" },
    );
    if (working.kind !== "json" || !("result" in working.body)) {
      return;
    }
    const cancelId = (working.body.result as { task: { id: string } }).task.id;
    const cancel = handleA2AJsonRpc(
      engine,
      encodeA2AJsonRpcRequest("CancelTask", { id: cancelId }, 6),
      { a2aVersion: "1.0" },
    );
    expect(cancel.kind).toBe("json");
  });

  it("maps unknown methods and missing tasks to JSON-RPC error codes", () => {
    const engine = createEngine();
    const unknown = handleA2AJsonRpc(engine, {
      jsonrpc: "2.0",
      id: 9,
      method: "Nope",
    });
    expect(unknown.kind).toBe("json");
    if (unknown.kind !== "json" || !("error" in unknown.body)) {
      return;
    }
    expect(unknown.body.error.code).toBe(-32601);

    const missing = handleA2AJsonRpc(
      engine,
      encodeA2AJsonRpcRequest("GetTask", { id: "missing" }, 10),
      { a2aVersion: "1.0" },
    );
    if (missing.kind !== "json" || !("error" in missing.body)) {
      return;
    }
    expect(missing.body.error.code).toBe(-32001);
    expect(missing.body.error.data?.[0]).toMatchObject({
      reason: "TASK_NOT_FOUND",
      domain: "a2a-protocol.org",
    });
    expect(a2aErrorReason("TaskNotFoundError")).toBe("TASK_NOT_FOUND");
  });
});

describe("A2A 1.0.0 REST paths contract", () => {
  it("matches spec URL patterns including well-known Agent Card", () => {
    const paths = A2A_REST_ROUTES.map((route) => `${route.method} ${route.path}`);
    expect(paths).toContain("POST /message:send");
    expect(paths).toContain("POST /message:stream");
    expect(paths).toContain("GET /tasks/{id}");
    expect(paths).toContain("GET /tasks");
    expect(paths).toContain("POST /tasks/{id}:cancel");
    expect(paths).toContain(`GET ${A2A_AGENT_CARD_WELL_KNOWN_PATH}`);

    const send = matchA2ARestRoute("POST", "/message:send");
    expect(send.ok).toBe(true);
    const get = matchA2ARestRoute("GET", "/tasks/task-1");
    expect(get.ok).toBe(true);
    if (get.ok) {
      expect(get.value.params.id).toBe("task-1");
    }
    const cancel = matchA2ARestRoute("POST", "/tasks/task-1:cancel");
    expect(cancel.ok).toBe(true);
    const card = matchA2ARestRoute("GET", A2A_AGENT_CARD_WELL_KNOWN_PATH);
    expect(card.ok).toBe(true);
  });

  it("serves send / get / list / cancel / agent card over REST", () => {
    const engine = createEngine();
    const sent = handleA2ARestRequest(engine, {
      method: "POST",
      path: "/message:send",
      headers: A2A_V1_HEADERS,
      body: { message: userTextMessage("rest") },
    });
    expect(sent.kind).toBe("json");
    expect(sent.status).toBe(200);
    const taskId = (sent.body as { task: { id: string } }).task.id;

    const got = handleA2ARestRequest(engine, {
      method: "GET",
      path: `/tasks/${taskId}?historyLength=1`,
      headers: A2A_V1_HEADERS,
    });
    expect(got.status).toBe(200);

    const listed = handleA2ARestRequest(engine, {
      method: "GET",
      path: "/tasks?pageSize=10&includeArtifacts=true",
      headers: A2A_V1_HEADERS,
    });
    expect(listed.status).toBe(200);

    const card = handleA2ARestRequest(engine, {
      method: "GET",
      path: A2A_AGENT_CARD_WELL_KNOWN_PATH,
    });
    expect(card.status).toBe(200);

    const working = handleA2ARestRequest(engine, {
      method: "POST",
      path: "/message:send",
      headers: A2A_V1_HEADERS,
      body: { message: userTextMessage("hold"), configuration: { returnImmediately: true } },
    });
    const workingId = (working.body as { task: { id: string } }).task.id;
    const canceled = handleA2ARestRequest(engine, {
      method: "POST",
      path: `/tasks/${workingId}:cancel`,
      headers: A2A_V1_HEADERS,
    });
    expect(canceled.status).toBe(200);
    expect(a2aRestStatus("TaskNotFoundError")).toBe(404);
  });
});

describe("A2A 1.0.0 SSE event shapes contract", () => {
  it("encodes REST and JSON-RPC stream frames that decode back to StreamResponse", () => {
    const engine = createEngine();
    const stream = handleA2AJsonRpc(
      engine,
      encodeA2AJsonRpcRequest("SendStreamingMessage", { message: userTextMessage("stream") }, 1),
      { a2aVersion: "1.0" },
    );
    expect(stream.kind).toBe("sse");
    if (stream.kind !== "sse") {
      return;
    }
    const decoded = decodeA2ASseStream(stream.body, "jsonrpc");
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) {
      return;
    }
    expect(a2aStreamKind(decoded.value[0]!)).toBe("task");
    expect(decoded.value.some((event) => a2aStreamKind(event) === "statusUpdate")).toBe(true);
    expect(decoded.value.some((event) => a2aStreamKind(event) === "artifactUpdate")).toBe(true);

    const rest = handleA2ARestRequest(engine, {
      method: "POST",
      path: "/message:stream",
      headers: A2A_V1_HEADERS,
      body: { message: userTextMessage("rest-stream") },
    });
    expect(rest.kind).toBe("sse");
    expect(rest.contentType).toBe(A2A_SSE_CONTENT_TYPE);
    if (rest.kind !== "sse") {
      return;
    }
    const restDecoded = decodeA2ASseStream(rest.body, "rest");
    expect(restDecoded.ok).toBe(true);

    const parsed = parseA2AStreamResponse({ message: userTextMessage("direct") });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }
    expect(encodeA2ASseEvent(parsed.value)).toContain("data: ");
    expect(encodeA2ASseStream([parsed.value])).toContain('"message"');
  });
});

describe("A2A 1.0.0 gRPC semantic mapper contract", () => {
  it("invokes A2AService methods without a gRPC runtime", () => {
    const engine = createEngine();
    const service = createA2AGrpcService(engine);
    const sent = invokeA2AGrpc(service, {
      service: "a2a.v1.A2AService",
      method: A2A_GRPC_METHODS.SendMessage,
      metadata: { "a2a-version": "1.0" },
      message: { message: userTextMessage("grpc") },
    });
    expect(sent.status).toBe("OK");
    const card = invokeA2AGrpc(service, {
      service: "a2a.v1.A2AService",
      method: A2A_GRPC_METHODS.GetAgentCard,
      message: {},
    });
    expect(card.status).toBe("OK");
  });
});
