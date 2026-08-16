import { afterEach, describe, expect, it } from "vitest";
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import {
  A2AOperationEngine,
  A2A_GRPC_PROTO_METHODS,
  A2A_GRPC_PROTO_SERVICE_NAME,
  a2aProtoFile,
  a2aProtoRootDir,
  createA2AGrpcClient,
  createA2AGrpcServer,
  loadA2AGrpcPackage,
  officialA2AGrpcMethodNames,
  type A2AGrpcClient,
  type A2AGrpcServer,
} from "../../src/index.js";

const require = createRequire(import.meta.url);
const grpc = require("@grpc/grpc-js") as typeof import("@grpc/grpc-js");
import {
  sampleA2AAgentCard,
  sequentialA2AIds,
  testSessionBinding,
  userTextMessage,
} from "../support/a2aV1Fixtures.js";

function createEngine() {
  const created = A2AOperationEngine.create({
    agentCard: sampleA2AAgentCard(),
    extendedAgentCard: sampleA2AAgentCard({
      name: "GeoSpatial Route Planner Agent (extended)",
    }),
    idGenerator: sequentialA2AIds(),
    clock: { now: () => "2026-08-16T00:00:00Z" },
    session: testSessionBinding(),
  });
  if (!created.ok) {
    throw new Error(created.error.message);
  }
  return created.value;
}

describe("official A2A 1.0.0 gRPC binding", () => {
  let server: A2AGrpcServer | undefined;
  let client: A2AGrpcClient | undefined;

  afterEach(async () => {
    client?.close();
    client = undefined;
    if (server !== undefined) {
      await server.close();
      server = undefined;
    }
  });

  it("loads lf.a2a.v1.A2AService from the vendored proto", () => {
    const methods = officialA2AGrpcMethodNames();
    expect(A2A_GRPC_PROTO_SERVICE_NAME).toBe("lf.a2a.v1.A2AService");
    for (const method of A2A_GRPC_PROTO_METHODS) {
      expect(methods.some((name) => name.toLowerCase() === method.toLowerCase())).toBe(true);
    }
    expect(methods.some((name) => name.toLowerCase() === "getagentcard")).toBe(false);
    expect(existsSync(a2aProtoFile())).toBe(true);
    expect(existsSync(a2aProtoRootDir())).toBe(true);
    expect(loadA2AGrpcPackage().methodNames).toEqual(methods);
  });

  it("refuses to bind without TLS unless insecure loopback is explicit", async () => {
    await expect(createA2AGrpcServer(createEngine(), {})).rejects.toThrow(/TLS credentials/);
    expect(() => createA2AGrpcClient("127.0.0.1:1")).toThrow(/TLS credentials/);
    await expect(
      createA2AGrpcServer(createEngine(), { host: "256.256.256.256", insecure: true }),
    ).rejects.toBeTruthy();
  });

  it("serves the official RPCs over grpc-js on a loopback port", async () => {
    const engine = createEngine();
    server = await createA2AGrpcServer(engine, {
      host: "127.0.0.1",
      port: 0,
      credentials: grpc.ServerCredentials.createInsecure(),
    });
    const live = createA2AGrpcClient(server.address, {
      credentials: grpc.credentials.createInsecure(),
      metadata: { "A2A-Version": "1.0", "x-test": "1" },
    });
    client = live;

    const sent = (await live.sendMessage({
      message: userTextMessage("Plan a route"),
    })) as { task: { id: string; status: { state: string } } };
    expect(sent.task.id).toBe("task-1");
    expect(sent.task.status.state).toBe("TASK_STATE_COMPLETED");

    const got = (await live.getTask({ id: "task-1" })) as { id: string };
    expect(got.id).toBe("task-1");

    const listed = (await live.listTasks({ includeArtifacts: true })) as {
      tasks: readonly unknown[];
    };
    expect(listed.tasks).toHaveLength(1);

    const card = (await live.getExtendedAgentCard({})) as { name: string };
    expect(card.name).toContain("extended");

    const working = (await live.sendMessage({
      message: { ...userTextMessage("hold"), messageId: "msg-hold" },
      configuration: { returnImmediately: true },
    })) as { task: { id: string } };
    const subscribed: unknown[] = [];
    for await (const event of live.subscribeToTask({ id: working.task.id })) {
      subscribed.push(event);
    }
    expect(subscribed.length).toBeGreaterThan(0);
    const canceled = (await live.cancelTask({ id: working.task.id })) as {
      status: { state: string };
    };
    expect(canceled.status.state).toBe("TASK_STATE_CANCELED");
    await expect(async () => {
      for await (const event of live.subscribeToTask({ id: working.task.id })) {
        void event;
      }
    }).rejects.toBeTruthy();

    const created = (await live.createTaskPushNotificationConfig({
      taskId: "task-1",
      url: "https://example.com/push",
    })) as { id: string; taskId: string };
    expect(created.taskId).toBe("task-1");
    const fetched = (await live.getTaskPushNotificationConfig({
      taskId: "task-1",
      id: created.id,
    })) as { url: string };
    expect(fetched.url).toBe("https://example.com/push");
    const listedPush = (await live.listTaskPushNotificationConfigs({ taskId: "task-1" })) as {
      configs: readonly unknown[];
    };
    expect(listedPush.configs.length).toBeGreaterThan(0);
    await live.deleteTaskPushNotificationConfig({ taskId: "task-1", id: created.id });

    const streamEvents: unknown[] = [];
    for await (const event of live.sendStreamingMessage({
      message: { ...userTextMessage("stream"), messageId: "msg-stream" },
    })) {
      streamEvents.push(event);
    }
    expect(streamEvents.length).toBeGreaterThan(0);

    await expect(live.getTask({ id: "missing" })).rejects.toMatchObject({
      details: expect.stringMatching(/not found/i),
    });
  });

  it("accepts explicit insecure loopback and per-call A2A-Version metadata", async () => {
    const engine = createEngine();
    server = await createA2AGrpcServer(engine, {
      insecure: true,
    });
    const live = createA2AGrpcClient(server.address, { insecure: true });
    client = live;
    const card = (await live.getExtendedAgentCard(undefined, {
      "A2A-Version": "1.0",
      "x-trace": "grpc",
    })) as {
      name: string;
    };
    expect(card.name).toContain("extended");
    await expect(live.cancelTask({ id: "missing" })).rejects.toBeTruthy();
  });
});
