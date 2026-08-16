import { describe, expect, it } from "vitest";
import {
  A2AOperationEngine,
  decodeA2AGrpcRequest,
  decodeA2AGrpcResponse,
  decodeA2AJsonRpcRequest,
  decodeA2AJsonRpcResponse,
  dispatchA2AOperation,
  handleA2AJsonRpc,
  handleA2ARestRequest,
  matchA2ARestRoute,
  parseA2AAgentCard,
  parseA2AArtifact,
  parseA2ACancelTaskRequest,
  parseA2AGetTaskRequest,
  parseA2AListTasksRequest,
  parseA2AMessage,
  parseA2APart,
  parseA2ASecurityScheme,
  parseA2ASendMessageRequest,
  parseA2AStreamResponse,
  parseA2ATask,
  type A2AOperationName,
} from "../../src/index.js";
import { parseA2AOperationRequest } from "../../src/transports/a2a/v1/a2aOperations.js";
import { parseA2ASendMessageConfiguration } from "../../src/transports/a2a/v1/a2aMessage.js";
import { sampleA2AAgentCard, sequentialA2AIds, userTextMessage } from "../support/a2aV1Fixtures.js";

function expectInvalid(result: { ok: boolean }): void {
  expect(result.ok).toBe(false);
}

describe("A2A v1 parse error matrix", () => {
  it("rejects invalid parts, messages, and send configuration", () => {
    expectInvalid(parseA2APart({ text: "a", metadata: 1 }));
    expectInvalid(parseA2APart({ text: "a", filename: 1 }));
    expectInvalid(parseA2APart({ text: "a", mediaType: 1 }));
    expectInvalid(parseA2APart({ raw: 1 }));
    expectInvalid(parseA2APart({ url: 1 }));
    expectInvalid(parseA2AMessage("x"));
    expectInvalid(parseA2AMessage({ messageId: "", role: "ROLE_USER", parts: [{ text: "a" }] }));
    expectInvalid(parseA2AMessage({ messageId: "m", role: "ROLE_USER", parts: [] }));
    expectInvalid(parseA2AMessage({ messageId: "m", role: "ROLE_USER", parts: ["bad"] }));
    expectInvalid(parseA2AMessage({ messageId: "m", role: "ROLE_USER", parts: [{ text: "a" }], contextId: 1 }));
    expectInvalid(parseA2AMessage({ messageId: "m", role: "ROLE_USER", parts: [{ text: "a" }], taskId: 1 }));
    expectInvalid(parseA2AMessage({ messageId: "m", role: "ROLE_USER", parts: [{ text: "a" }], metadata: 1 }));
    expectInvalid(parseA2AMessage({ messageId: "m", role: "ROLE_USER", parts: [{ text: "a" }], extensions: [1] }));
    expectInvalid(
      parseA2AMessage({ messageId: "m", role: "ROLE_USER", parts: [{ text: "a" }], referenceTaskIds: 1 }),
    );
    expectInvalid(parseA2ASendMessageConfiguration("x"));
    expectInvalid(parseA2ASendMessageConfiguration({ acceptedOutputModes: [1] }));
    expectInvalid(parseA2ASendMessageConfiguration({ taskPushNotificationConfig: {} }));
    expectInvalid(parseA2ASendMessageConfiguration({ historyLength: 1.5 }));
    expectInvalid(parseA2ASendMessageConfiguration({ returnImmediately: "yes" }));
    expectInvalid(parseA2ASendMessageConfiguration({ taskPushNotificationConfig: { url: "u", id: 1 } }));
    expectInvalid(parseA2ASendMessageConfiguration({ taskPushNotificationConfig: { url: "u", taskId: 1 } }));
    expectInvalid(parseA2ASendMessageConfiguration({ taskPushNotificationConfig: { url: "u", token: 1 } }));
    expectInvalid(
      parseA2ASendMessageConfiguration({
        taskPushNotificationConfig: { url: "u", authentication: { scheme: 1 } },
      }),
    );
    expectInvalid(
      parseA2ASendMessageConfiguration({
        taskPushNotificationConfig: { url: "u", authentication: { scheme: "Bearer", credentials: 1 } },
      }),
    );
    expectInvalid(parseA2ASendMessageRequest({ message: userTextMessage("x"), tenant: 1 }));
    expectInvalid(parseA2ASendMessageRequest({ message: userTextMessage("x"), metadata: 1 }));
    expectInvalid(parseA2ASendMessageRequest({ message: userTextMessage("x"), configuration: "x" }));
    expect(
      parseA2ASendMessageRequest({
        message: { ...userTextMessage("x"), extensions: ["https://ext"], referenceTaskIds: ["t1"] },
      }).ok,
    ).toBe(true);
  });

  it("rejects invalid tasks, artifacts, and stream events", () => {
    expectInvalid(parseA2ATaskStatusLike());
    expectInvalid(parseA2ATask("x"));
    expectInvalid(parseA2ATask({ id: "t", status: { state: "NOPE" } }));
    expectInvalid(parseA2ATask({ id: "t", status: { state: "TASK_STATE_WORKING", message: {} } }));
    expectInvalid(parseA2ATask({ id: "t", status: { state: "TASK_STATE_WORKING", timestamp: 1 } }));
    expectInvalid(parseA2ATask({ id: "t", status: { state: "TASK_STATE_WORKING" }, contextId: 1 }));
    expectInvalid(parseA2ATask({ id: "t", status: { state: "TASK_STATE_WORKING" }, metadata: 1 }));
    expectInvalid(parseA2ATask({ id: "t", status: { state: "TASK_STATE_WORKING" }, artifacts: {} }));
    expectInvalid(parseA2ATask({ id: "t", status: { state: "TASK_STATE_WORKING" }, artifacts: [{}] }));
    expectInvalid(parseA2ATask({ id: "t", status: { state: "TASK_STATE_WORKING" }, history: {} }));
    expectInvalid(parseA2ATask({ id: "t", status: { state: "TASK_STATE_WORKING" }, history: [{}] }));
    expectInvalid(parseA2AArtifact("x"));
    expectInvalid(parseA2AArtifact({ artifactId: "a", parts: [] }));
    expectInvalid(parseA2AArtifact({ artifactId: "a", parts: ["x"] }));
    expectInvalid(parseA2AArtifact({ artifactId: "a", parts: [{ text: "x" }], name: 1 }));
    expectInvalid(parseA2AArtifact({ artifactId: "a", parts: [{ text: "x" }], description: 1 }));
    expectInvalid(parseA2AArtifact({ artifactId: "a", parts: [{ text: "x" }], metadata: 1 }));
    expectInvalid(parseA2AArtifact({ artifactId: "a", parts: [{ text: "x" }], extensions: [1] }));
    expectInvalid(parseA2AStreamResponse("x"));
    expectInvalid(parseA2AStreamResponse({ task: { id: "", status: { state: "TASK_STATE_WORKING" } } }));
    expectInvalid(parseA2AStreamResponse({ message: {} }));
    expectInvalid(parseA2AStreamResponse({ statusUpdate: "x" }));
    expectInvalid(parseA2AStreamResponse({ statusUpdate: { contextId: "c", status: { state: "TASK_STATE_WORKING" } } }));
    expectInvalid(parseA2AStreamResponse({ statusUpdate: { taskId: "t", status: { state: "TASK_STATE_WORKING" } } }));
    expectInvalid(
      parseA2AStreamResponse({
        statusUpdate: { taskId: "t", contextId: "c", status: { state: "NOPE" } },
      }),
    );
    expectInvalid(
      parseA2AStreamResponse({
        statusUpdate: { taskId: "t", contextId: "c", status: { state: "TASK_STATE_WORKING" }, metadata: 1 },
      }),
    );
    expectInvalid(parseA2AStreamResponse({ artifactUpdate: "x" }));
    expectInvalid(
      parseA2AStreamResponse({
        artifactUpdate: { contextId: "c", artifact: { artifactId: "a", parts: [{ text: "x" }] } },
      }),
    );
    expectInvalid(
      parseA2AStreamResponse({
        artifactUpdate: { taskId: "t", artifact: { artifactId: "a", parts: [{ text: "x" }] } },
      }),
    );
    expectInvalid(parseA2AStreamResponse({ artifactUpdate: { taskId: "t", contextId: "c", artifact: {} } }));
    expectInvalid(
      parseA2AStreamResponse({
        artifactUpdate: {
          taskId: "t",
          contextId: "c",
          artifact: { artifactId: "a", parts: [{ text: "x" }] },
          metadata: 1,
        },
      }),
    );
    expectInvalid(
      parseA2AStreamResponse({
        artifactUpdate: {
          taskId: "t",
          contextId: "c",
          artifact: { artifactId: "a", parts: [{ text: "x" }] },
          append: "yes",
        },
      }),
    );
    expectInvalid(
      parseA2AStreamResponse({
        artifactUpdate: {
          taskId: "t",
          contextId: "c",
          artifact: { artifactId: "a", parts: [{ text: "x" }] },
          lastChunk: "yes",
        },
      }),
    );
    expectInvalid(parseA2AGetTaskRequest({}));
    expectInvalid(parseA2AGetTaskRequest({ id: "t", tenant: 1 }));
    expectInvalid(parseA2AGetTaskRequest({ id: "t", historyLength: 1.2 }));
    expectInvalid(parseA2AListTasksRequest("x"));
    expectInvalid(parseA2AListTasksRequest({ tenant: 1 }));
    expectInvalid(parseA2AListTasksRequest({ contextId: 1 }));
    expectInvalid(parseA2AListTasksRequest({ status: "NOPE" }));
    expectInvalid(parseA2AListTasksRequest({ pageSize: 1.2 }));
    expectInvalid(parseA2AListTasksRequest({ pageToken: 1 }));
    expectInvalid(parseA2AListTasksRequest({ historyLength: 1.2 }));
    expectInvalid(parseA2AListTasksRequest({ statusTimestampAfter: 1 }));
    expectInvalid(parseA2AListTasksRequest({ includeArtifacts: "yes" }));
    expectInvalid(parseA2ACancelTaskRequest({}));
    expectInvalid(parseA2ACancelTaskRequest({ id: "t", tenant: 1 }));
    expectInvalid(parseA2ACancelTaskRequest({ id: "t", metadata: 1 }));
  });

  it("rejects invalid Agent Cards and security schemes", () => {
    expectInvalid(parseA2AAgentCard({ name: 1, description: "d", version: "1", supportedInterfaces: [], capabilities: {}, defaultInputModes: ["t"], defaultOutputModes: ["t"], skills: [] }));
    expectInvalid(parseA2AAgentCard({ name: "n", description: 1, version: "1", supportedInterfaces: [{}], capabilities: {}, defaultInputModes: ["t"], defaultOutputModes: ["t"], skills: [] }));
    expectInvalid(parseA2AAgentCard({ name: "n", description: "d", version: 1, supportedInterfaces: [{}], capabilities: {}, defaultInputModes: ["t"], defaultOutputModes: ["t"], skills: [] }));
    expectInvalid(parseA2AAgentCard({ name: "n", description: "d", version: "1", supportedInterfaces: [], capabilities: {}, defaultInputModes: ["t"], defaultOutputModes: ["t"], skills: [] }));
    expectInvalid(parseA2AAgentCard({ name: "n", description: "d", version: "1", supportedInterfaces: ["x"], capabilities: {}, defaultInputModes: ["t"], defaultOutputModes: ["t"], skills: [] }));
    expectInvalid(
      parseA2AAgentCard({
        ...sampleA2AAgentCard(),
        supportedInterfaces: [{ url: "u", protocolBinding: "JSONRPC" }],
      }),
    );
    expectInvalid(
      parseA2AAgentCard({
        ...sampleA2AAgentCard(),
        supportedInterfaces: [{ url: "u", protocolBinding: "JSONRPC", protocolVersion: "1.0", tenant: 1 }],
      }),
    );
    expectInvalid(parseA2AAgentCard({ ...sampleA2AAgentCard(), capabilities: "x" }));
    expectInvalid(parseA2AAgentCard({ ...sampleA2AAgentCard(), capabilities: { streaming: "yes" } }));
    expectInvalid(parseA2AAgentCard({ ...sampleA2AAgentCard(), capabilities: { pushNotifications: "yes" } }));
    expectInvalid(parseA2AAgentCard({ ...sampleA2AAgentCard(), capabilities: { extendedAgentCard: "yes" } }));
    expectInvalid(parseA2AAgentCard({ ...sampleA2AAgentCard(), capabilities: { extensions: "x" } }));
    expectInvalid(parseA2AAgentCard({ ...sampleA2AAgentCard(), capabilities: { extensions: ["x"] } }));
    expectInvalid(
      parseA2AAgentCard({
        ...sampleA2AAgentCard(),
        capabilities: { extensions: [{ uri: 1 }] },
      }),
    );
    expectInvalid(
      parseA2AAgentCard({
        ...sampleA2AAgentCard(),
        capabilities: { extensions: [{ description: 1 }] },
      }),
    );
    expectInvalid(
      parseA2AAgentCard({
        ...sampleA2AAgentCard(),
        capabilities: { extensions: [{ required: "yes" }] },
      }),
    );
    expectInvalid(
      parseA2AAgentCard({
        ...sampleA2AAgentCard(),
        capabilities: { extensions: [{ params: 1 }] },
      }),
    );
    expectInvalid(parseA2AAgentCard({ ...sampleA2AAgentCard(), defaultInputModes: [] }));
    expectInvalid(parseA2AAgentCard({ ...sampleA2AAgentCard(), defaultOutputModes: [1] }));
    expectInvalid(parseA2AAgentCard({ ...sampleA2AAgentCard(), skills: "x" }));
    expectInvalid(parseA2AAgentCard({ ...sampleA2AAgentCard(), skills: ["x"] }));
    expectInvalid(parseA2AAgentCard({ ...sampleA2AAgentCard(), skills: [{ id: "s" }] }));
    expectInvalid(
      parseA2AAgentCard({
        ...sampleA2AAgentCard(),
        skills: [{ id: "s", name: "n", description: "d", tags: "x" }],
      }),
    );
    expectInvalid(
      parseA2AAgentCard({
        ...sampleA2AAgentCard(),
        skills: [{ id: "s", name: "n", description: "d", tags: ["t"], examples: [1] }],
      }),
    );
    expectInvalid(
      parseA2AAgentCard({
        ...sampleA2AAgentCard(),
        skills: [{ id: "s", name: "n", description: "d", tags: ["t"], inputModes: [1] }],
      }),
    );
    expectInvalid(
      parseA2AAgentCard({
        ...sampleA2AAgentCard(),
        skills: [{ id: "s", name: "n", description: "d", tags: ["t"], outputModes: 1 }],
      }),
    );
    expectInvalid(
      parseA2AAgentCard({
        ...sampleA2AAgentCard(),
        skills: [{ id: "s", name: "n", description: "d", tags: ["t"], securityRequirements: "x" }],
      }),
    );
    expectInvalid(
      parseA2AAgentCard({
        ...sampleA2AAgentCard(),
        skills: [{ id: "s", name: "n", description: "d", tags: ["t"], securityRequirements: [{}] }],
      }),
    );
    expectInvalid(
      parseA2AAgentCard({
        ...sampleA2AAgentCard(),
        skills: [
          {
            id: "s",
            name: "n",
            description: "d",
            tags: ["t"],
            securityRequirements: [{ schemes: { g: { list: [1] } } }],
          },
        ],
      }),
    );
    expect(
      parseA2AAgentCard({
        ...sampleA2AAgentCard(),
        skills: [
          {
            id: "s",
            name: "n",
            description: "d",
            tags: ["t"],
            securityRequirements: [{ schemes: { g: { list: ["openid"] } } }],
          },
        ],
      }).ok,
    ).toBe(true);
    expectInvalid(parseA2AAgentCard({ ...sampleA2AAgentCard(), provider: "x" }));
    expectInvalid(parseA2AAgentCard({ ...sampleA2AAgentCard(), provider: { url: "u" } }));
    expectInvalid(parseA2AAgentCard({ ...sampleA2AAgentCard(), documentationUrl: 1 }));
    expectInvalid(parseA2AAgentCard({ ...sampleA2AAgentCard(), iconUrl: 1 }));
    expectInvalid(parseA2AAgentCard({ ...sampleA2AAgentCard(), securitySchemes: "x" }));
    expectInvalid(parseA2AAgentCard({ ...sampleA2AAgentCard(), securitySchemes: { a: {} } }));
    expectInvalid(parseA2AAgentCard({ ...sampleA2AAgentCard(), securityRequirements: "x" }));
    expectInvalid(parseA2AAgentCard({ ...sampleA2AAgentCard(), securityRequirements: [{}] }));
    expectInvalid(parseA2AAgentCard({ ...sampleA2AAgentCard(), signatures: "x" }));
    expectInvalid(parseA2AAgentCard({ ...sampleA2AAgentCard(), signatures: [{}] }));
    expectInvalid(
      parseA2AAgentCard({
        ...sampleA2AAgentCard(),
        signatures: [{ protected: "p", signature: "s", header: 1 }],
      }),
    );
    expect(
      parseA2AAgentCard({
        ...sampleA2AAgentCard(),
        signatures: [{ protected: "p", signature: "s", header: { kid: "1" } }],
      }).ok,
    ).toBe(true);

    expectInvalid(parseA2ASecurityScheme("x"));
    expectInvalid(parseA2ASecurityScheme({ apiKeySecurityScheme: "x" }));
    expectInvalid(parseA2ASecurityScheme({ apiKeySecurityScheme: { location: "body", name: "k" } }));
    expectInvalid(parseA2ASecurityScheme({ apiKeySecurityScheme: { location: "header" } }));
    expectInvalid(parseA2ASecurityScheme({ httpAuthSecurityScheme: { description: 1 } }));
    expectInvalid(parseA2ASecurityScheme({ httpAuthSecurityScheme: {} }));
    expectInvalid(parseA2ASecurityScheme({ httpAuthSecurityScheme: { scheme: "Bearer", bearerFormat: 1 } }));
    expectInvalid(parseA2ASecurityScheme({ oauth2SecurityScheme: { flows: "x" } }));
    expectInvalid(parseA2ASecurityScheme({ oauth2SecurityScheme: { flows: {} } }));
    expectInvalid(
      parseA2ASecurityScheme({
        oauth2SecurityScheme: { flows: { authorizationCode: "x" } },
      }),
    );
    expectInvalid(
      parseA2ASecurityScheme({
        oauth2SecurityScheme: {
          flows: { authorizationCode: { authorizationUrl: "a", tokenUrl: "t", scopes: { r: 1 } } },
        },
      }),
    );
    expectInvalid(
      parseA2ASecurityScheme({
        oauth2SecurityScheme: {
          flows: { authorizationCode: { tokenUrl: "t", scopes: { r: "r" } } },
        },
      }),
    );
    expectInvalid(
      parseA2ASecurityScheme({
        oauth2SecurityScheme: {
          flows: { authorizationCode: { authorizationUrl: "a", scopes: { r: "r" } } },
        },
      }),
    );
    expectInvalid(
      parseA2ASecurityScheme({
        oauth2SecurityScheme: {
          flows: { clientCredentials: { scopes: { r: "r" } } },
        },
      }),
    );
    expectInvalid(
      parseA2ASecurityScheme({
        oauth2SecurityScheme: {
          flows: { implicit: { scopes: { r: "r" } } },
        },
      }),
    );
    expectInvalid(
      parseA2ASecurityScheme({
        oauth2SecurityScheme: {
          flows: { password: { scopes: { r: "r" } } },
        },
      }),
    );
    expectInvalid(
      parseA2ASecurityScheme({
        oauth2SecurityScheme: {
          flows: { deviceCode: { tokenUrl: "t", scopes: { r: "r" } } },
        },
      }),
    );
    expectInvalid(
      parseA2ASecurityScheme({
        oauth2SecurityScheme: {
          flows: { deviceCode: { deviceAuthorizationUrl: "d", scopes: { r: "r" } } },
        },
      }),
    );
    expectInvalid(
      parseA2ASecurityScheme({
        oauth2SecurityScheme: {
          flows: {
            authorizationCode: {
              authorizationUrl: "a",
              tokenUrl: "t",
              scopes: { r: "r" },
              refreshUrl: 1,
            },
          },
        },
      }),
    );
    expectInvalid(
      parseA2ASecurityScheme({
        oauth2SecurityScheme: {
          flows: { authorizationCode: { authorizationUrl: "a", tokenUrl: "t", scopes: "x" } },
        },
      }),
    );
    expectInvalid(parseA2ASecurityScheme({ openIdConnectSecurityScheme: {} }));
    expectInvalid(
      parseA2ASecurityScheme({
        oauth2SecurityScheme: {
          flows: { clientCredentials: { tokenUrl: "t", scopes: { r: "r" } } },
          oauth2MetadataUrl: 1,
        },
      }),
    );
    expect(
      parseA2ASecurityScheme({
        oauth2SecurityScheme: {
          description: "oauth",
          oauth2MetadataUrl: "https://auth.example/.well-known/oauth",
          flows: {
            authorizationCode: {
              authorizationUrl: "a",
              tokenUrl: "t",
              scopes: { r: "r" },
              refreshUrl: "https://auth.example/refresh",
            },
          },
        },
      }).ok,
    ).toBe(true);
    expect(
      parseA2ASecurityScheme({
        oauth2SecurityScheme: {
          flows: {
            clientCredentials: { tokenUrl: "t", scopes: { r: "r" }, refreshUrl: "r" },
          },
        },
      }).ok,
    ).toBe(true);
    expect(
      parseA2ASecurityScheme({
        oauth2SecurityScheme: {
          flows: { implicit: { authorizationUrl: "a", scopes: { r: "r" }, refreshUrl: "r" } },
        },
      }).ok,
    ).toBe(true);
    expect(
      parseA2ASecurityScheme({
        oauth2SecurityScheme: {
          flows: { password: { tokenUrl: "t", scopes: { r: "r" }, refreshUrl: "r" } },
        },
      }).ok,
    ).toBe(true);
    expect(
      parseA2ASecurityScheme({
        oauth2SecurityScheme: {
          flows: {
            deviceCode: {
              deviceAuthorizationUrl: "d",
              tokenUrl: "t",
              scopes: { r: "r" },
              refreshUrl: "r",
            },
          },
        },
      }).ok,
    ).toBe(true);
  });
});

function parseA2ATaskStatusLike(): { ok: boolean } {
  return parseA2ATask({ id: "t", status: "x" });
}

describe("A2A v1 remaining operation and binding branches", () => {
  it("covers parseA2AOperationRequest, defaults, and dispatch leftovers", () => {
    const names: A2AOperationName[] = [
      "SendMessage",
      "SendStreamingMessage",
      "GetTask",
      "SubscribeToTask",
      "ListTasks",
      "CancelTask",
      "GetAgentCard",
      "GetExtendedAgentCard",
      "CreateTaskPushNotificationConfig",
      "GetTaskPushNotificationConfig",
      "ListTaskPushNotificationConfigs",
      "DeleteTaskPushNotificationConfig",
    ];
    for (const name of names) {
      parseA2AOperationRequest(name, {});
    }
    expect(parseA2AOperationRequest("Nope" as A2AOperationName, {}).ok).toBe(false);

    const created = A2AOperationEngine.create({ agentCard: sampleA2AAgentCard() });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    const sent = created.value.sendMessage({ message: userTextMessage("defaults") }, { a2aVersion: "1.0" });
    expect(sent.ok).toBe(true);
    expect(dispatchA2AOperation(created.value, "Nope" as A2AOperationName, {}).ok).toBe(false);
    expect(dispatchA2AOperation(created.value, "SendStreamingMessage", {}, { a2aVersion: "1.0" }).ok).toBe(
      false,
    );
    expect(dispatchA2AOperation(created.value, "GetTask", {}, { a2aVersion: "1.0" }).ok).toBe(false);
    expect(dispatchA2AOperation(created.value, "CancelTask", {}, { a2aVersion: "1.0" }).ok).toBe(false);
    expect(dispatchA2AOperation(created.value, "SubscribeToTask", {}, { a2aVersion: "1.0" }).ok).toBe(false);
    expect(
      dispatchA2AOperation(created.value, "CreateTaskPushNotificationConfig", {}, { a2aVersion: "1.0" }).ok,
    ).toBe(false);
    expect(
      dispatchA2AOperation(created.value, "GetTaskPushNotificationConfig", {}, { a2aVersion: "1.0" }).ok,
    ).toBe(false);
    expect(
      dispatchA2AOperation(created.value, "ListTaskPushNotificationConfigs", {}, { a2aVersion: "1.0" }).ok,
    ).toBe(false);
    expect(
      dispatchA2AOperation(created.value, "DeleteTaskPushNotificationConfig", {}, { a2aVersion: "1.0" }).ok,
    ).toBe(false);
    expect(dispatchA2AOperation(created.value, "GetExtendedAgentCard", {}, { a2aVersion: "0.3" }).ok).toBe(
      false,
    );
    if (sent.ok && "task" in sent.value) {
      expect(
        created.value.getTask({ id: sent.value.task.id, historyLength: 0 }, { a2aVersion: "1.0" }).ok,
      ).toBe(true);
      expect(
        created.value.cancelTask(
          { id: sent.value.task.id, metadata: { reason: "late" } },
          { a2aVersion: "1.0" },
        ).ok,
      ).toBe(false);
    }

    const noTs = A2AOperationEngine.create({
      agentCard: sampleA2AAgentCard(),
      idGenerator: sequentialA2AIds(),
      processor: {
        process: (input) => ({
          kind: "task",
          state: "TASK_STATE_WORKING",
          statusMessage: { ...userTextMessage("working"), role: "ROLE_AGENT" },
          artifacts: input.task.artifacts,
        }),
      },
    });
    expect(noTs.ok).toBe(true);
    if (noTs.ok) {
      const working = noTs.value.sendMessage({ message: userTextMessage("w") }, { a2aVersion: "1.0" });
      expect(working.ok).toBe(true);
      expect(noTs.value.listTasks({}, { a2aVersion: "1.0" }).ok).toBe(true);
      expect(noTs.value.sendMessage({ message: userTextMessage("x") }, { a2aVersion: "0.3" }).ok).toBe(false);
      expect(
        noTs.value.createPushNotificationConfig("missing", { url: "https://h" }, { a2aVersion: "1.0" }).ok,
      ).toBe(false);
    }

    const noPush = A2AOperationEngine.create({
      agentCard: sampleA2AAgentCard({ capabilities: { streaming: true, pushNotifications: false } }),
      idGenerator: sequentialA2AIds(),
    });
    if (noPush.ok) {
      const task = noPush.value.sendMessage(
        {
          message: userTextMessage("p"),
          configuration: { returnImmediately: true, taskPushNotificationConfig: { url: "https://h" } },
        },
        { a2aVersion: "1.0" },
      );
      expect(task.ok).toBe(true);
      expect(noPush.value.listPushNotificationConfigs("x", { a2aVersion: "1.0" }).ok).toBe(false);
    }
  });

  it("covers leftover JSON-RPC, REST, and gRPC decode branches", () => {
    expect(decodeA2AJsonRpcRequest(1).ok).toBe(false);
    expect(decodeA2AJsonRpcResponse(1).ok).toBe(false);
    expect(decodeA2AJsonRpcResponse({ jsonrpc: "2.0", id: 1 }).ok).toBe(false);
    expect(decodeA2AJsonRpcResponse({ jsonrpc: "2.0", id: 1, error: { code: "x" } }).ok).toBe(false);
    const inst = A2AOperationEngine.create({
      agentCard: sampleA2AAgentCard(),
      idGenerator: sequentialA2AIds(),
    });
    expect(inst.ok).toBe(true);
    if (!inst.ok) {
      return;
    }
    const rpc = handleA2AJsonRpc(inst.value, {
      jsonrpc: "2.0",
      id: 1,
      method: "SendStreamingMessage",
      params: { message: userTextMessage("s") },
    });
    expect(rpc.kind === "json").toBe(true);
    const restUnknown = handleA2ARestRequest(inst.value, { method: "GET", path: "/nope" });
    expect(restUnknown.status).toBe(404);
    expect(matchA2ARestRoute("GET", "/tasks/abc/pushNotificationConfigs/cfg").ok).toBe(true);
    expect(decodeA2AGrpcRequest({ service: "a2a.v1.A2AService", method: "GetTask", metadata: "x" }).ok).toBe(
      false,
    );
    expect(decodeA2AGrpcResponse(1).ok).toBe(false);
    expect(decodeA2AGrpcResponse({ service: "nope", method: "GetTask" }).ok).toBe(false);
    expect(decodeA2AGrpcResponse({ service: "a2a.v1.A2AService", method: "Nope" }).ok).toBe(false);
    expect(
      decodeA2AGrpcResponse({
        service: "a2a.v1.A2AService",
        method: "GetTask",
        error: { code: 1, message: 2, details: "x" },
      }).ok,
    ).toBe(true);
  });
});
