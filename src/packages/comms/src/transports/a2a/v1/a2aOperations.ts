/**
 * A2A 1.0.0 abstract operations (spec §3) — binding-independent engine.
 * Identity is the existing comms SessionTransportBinding / PeerEndpoint, not a second actor layer.
 */
import { type Result, err, ok } from "@cantilune/core";
import { A2A_PROTOCOL_VERSION_V1 } from "../../../foundation/commsLimits.js";
import { type SessionTransportBinding } from "../../../session/sessionTransportBinding.js";
import {
  a2aProtocolError,
  isJsonObject,
  parseA2ASendMessageRequest,
  parseA2ATaskPushNotificationConfigInput,
  type A2AAuthenticationInfo,
  type A2AMessage,
  type A2AMetadata,
  type A2AProtocolError,
  type A2ASendMessageRequest,
  type A2ATaskPushNotificationConfigInput,
} from "./a2aMessage.js";
import {
  parseA2AAgentCard,
  type A2AAgentCard,
} from "./agentCard.js";
import {
  applyA2AHistoryLength,
  isA2ACancelableTaskState,
  isA2ATerminalTaskState,
  omitA2ATaskArtifacts,
  parseA2ACancelTaskRequest,
  parseA2AGetTaskRequest,
  parseA2AListTasksRequest,
  type A2AArtifact,
  type A2ACancelTaskRequest,
  type A2AGetTaskRequest,
  type A2AListTasksRequest,
  type A2AListTasksResponse,
  type A2AStreamResponse,
  type A2ATask,
  type A2ATaskState,
} from "./a2aTask.js";

export const A2A_DEFAULT_LIST_PAGE_SIZE = 50;
export const A2A_MAX_LIST_PAGE_SIZE = 100;

export interface A2AServiceParameters {
  readonly a2aVersion?: string;
  readonly a2aExtensions?: readonly string[];
}

export interface A2APushNotificationConfig {
  readonly id: string;
  readonly taskId: string;
  readonly url: string;
  readonly token?: string;
  readonly authentication?: A2AAuthenticationInfo;
}

export interface A2AListPushNotificationConfigsResponse {
  readonly configs: readonly A2APushNotificationConfig[];
  readonly nextPageToken: string;
}

export type A2ASendMessageResult =
  | { readonly task: A2ATask }
  | { readonly message: A2AMessage };

export type A2ATaskProcessResult =
  | {
      readonly kind: "task";
      readonly state: A2ATaskState;
      readonly statusMessage?: A2AMessage;
      readonly artifacts?: readonly A2AArtifact[];
    }
  | { readonly kind: "message"; readonly message: A2AMessage };

export interface A2ATaskProcessor {
  process(input: {
    readonly task: A2ATask;
    readonly message: A2AMessage;
    readonly configuration?: A2ASendMessageRequest["configuration"];
  }): A2ATaskProcessResult;
}

export interface A2AIdGenerator {
  next(kind: "task" | "context" | "config" | "artifact"): string;
}

export interface A2AOperationEngineOptions {
  readonly agentCard: A2AAgentCard;
  readonly extendedAgentCard?: A2AAgentCard;
  readonly processor?: A2ATaskProcessor;
  readonly clock?: { now(): string };
  readonly idGenerator?: A2AIdGenerator;
  readonly session?: SessionTransportBinding;
  readonly fetchImpl?: typeof fetch;
}

export interface A2APushDeliveryResult {
  readonly configId: string;
  readonly url: string;
  readonly status: number;
}

function defaultIdGenerator(): A2AIdGenerator {
  return {
    next(kind) {
      return `${kind}-${crypto.randomUUID()}`;
    },
  };
}

function defaultProcessor(idGenerator: A2AIdGenerator): A2ATaskProcessor {
  return {
    process(input) {
      const textPart = input.message.parts.find((part) => "text" in part);
      const text = textPart !== undefined && "text" in textPart ? textPart.text : "";
      return {
        kind: "task",
        state: "TASK_STATE_COMPLETED",
        artifacts: [
          {
            artifactId: idGenerator.next("artifact"),
            parts: [{ text, mediaType: "text/plain" }],
          },
        ],
      };
    },
  };
}

export function normalizeA2AVersion(raw: string | undefined): string {
  if (raw === undefined || raw.trim().length === 0) {
    return "0.3";
  }
  const trimmed = raw.trim();
  const parts = trimmed.split(".");
  if (parts.length >= 2 && parts[0] !== undefined && parts[1] !== undefined) {
    return `${parts[0]}.${parts[1]}`;
  }
  return trimmed;
}

export function assertA2AVersionSupported(
  raw: string | undefined,
): Result<void, A2AProtocolError> {
  const version = normalizeA2AVersion(raw);
  if (version !== A2A_PROTOCOL_VERSION_V1) {
    return err(
      a2aProtocolError(
        "VersionNotSupportedError",
        `A2A-Version ${version} is not supported; this interface is ${A2A_PROTOCOL_VERSION_V1}`,
      ),
    );
  }
  return ok(undefined);
}

export function parseA2AServiceParameters(
  headers: Readonly<Record<string, string | undefined>>,
): A2AServiceParameters {
  const entries = Object.entries(headers);
  const find = (name: string): string | undefined => {
    const hit = entries.find(([key]) => key.toLowerCase() === name.toLowerCase());
    return hit?.[1];
  };
  const version = find("a2a-version");
  const extensions = find("a2a-extensions");
  return {
    ...(version !== undefined ? { a2aVersion: version } : {}),
    ...(extensions !== undefined
      ? {
          a2aExtensions: extensions
            .split(",")
            .map((item) => item.trim())
            .filter((item) => item.length > 0),
        }
      : {}),
  };
}

function sessionMetadata(session: SessionTransportBinding | undefined): A2AMetadata | undefined {
  if (session === undefined) {
    return undefined;
  }
  return {
    sessionId: session.sessionId,
    channelId: session.channelId,
    localEndpoint: session.localEndpoint,
    remoteEndpoint: session.remoteEndpoint,
  };
}

export class A2AOperationEngine {
  private readonly tasks = new Map<string, A2ATask>();
  private readonly pushConfigs = new Map<string, A2APushNotificationConfig[]>();
  private readonly processor: A2ATaskProcessor;
  private readonly clock: { now(): string };
  private readonly ids: A2AIdGenerator;
  private readonly fetchImpl: typeof fetch | undefined;

  private constructor(
    private readonly agentCard: A2AAgentCard,
    private readonly extendedAgentCard: A2AAgentCard | undefined,
    private readonly session: SessionTransportBinding | undefined,
    processor: A2ATaskProcessor,
    clock: { now(): string },
    ids: A2AIdGenerator,
    fetchImpl: typeof fetch | undefined,
  ) {
    this.processor = processor;
    this.clock = clock;
    this.ids = ids;
    this.fetchImpl = fetchImpl;
  }

  static create(options: A2AOperationEngineOptions): Result<A2AOperationEngine, A2AProtocolError> {
    const card = parseA2AAgentCard(options.agentCard);
    if (!card.ok) {
      return card;
    }
    let extended: A2AAgentCard | undefined;
    if (options.extendedAgentCard !== undefined) {
      const parsed = parseA2AAgentCard(options.extendedAgentCard);
      if (!parsed.ok) {
        return parsed;
      }
      extended = parsed.value;
    }
    const ids = options.idGenerator ?? defaultIdGenerator();
    return ok(
      new A2AOperationEngine(
        card.value,
        extended,
        options.session,
        options.processor ?? defaultProcessor(ids),
        options.clock ?? { now: () => new Date().toISOString() },
        ids,
        options.fetchImpl,
      ),
    );
  }

  getPublicAgentCard(): A2AAgentCard {
    return this.agentCard;
  }

  getAgentCard(params?: A2AServiceParameters): Result<A2AAgentCard, A2AProtocolError> {
    const extensions = this.assertRequiredExtensions(params);
    if (!extensions.ok) {
      return extensions;
    }
    return ok(this.agentCard);
  }

  getExtendedAgentCard(params?: A2AServiceParameters): Result<A2AAgentCard, A2AProtocolError> {
    const gated = this.assertVersioned(params);
    if (!gated.ok) {
      return gated;
    }
    if (this.agentCard.capabilities.extendedAgentCard !== true) {
      return err(
        a2aProtocolError(
          "UnsupportedOperationError",
          "extended Agent Card is not declared in capabilities",
        ),
      );
    }
    if (this.extendedAgentCard === undefined) {
      return err(
        a2aProtocolError(
          "ExtendedAgentCardNotConfiguredError",
          "extended Agent Card is declared but not configured",
        ),
      );
    }
    return ok(this.extendedAgentCard);
  }

  sendMessage(
    request: A2ASendMessageRequest,
    params?: A2AServiceParameters,
  ): Result<A2ASendMessageResult, A2AProtocolError> {
    const gated = this.assertVersioned(params);
    if (!gated.ok) {
      return gated;
    }
    const content = this.assertContentTypes(request.message);
    if (!content.ok) {
      return content;
    }
    const prepared = this.prepareTask(request);
    if (!prepared.ok) {
      return prepared;
    }
    if (prepared.value.kind === "existing-terminal") {
      return err(
        a2aProtocolError(
          "UnsupportedOperationError",
          "messages cannot be sent to a task in a terminal state",
        ),
      );
    }
    const task = prepared.value.task;
    if (request.configuration?.returnImmediately === true) {
      const working = this.writeTask({
        ...task,
        status: { state: "TASK_STATE_WORKING", timestamp: this.clock.now() },
      });
      this.maybeCreateInlinePush(working.id, request.configuration.taskPushNotificationConfig);
      return ok({ task: this.projectTask(working, request.configuration.historyLength) });
    }
    const processed = this.processor.process({
      task,
      message: request.message,
      ...(request.configuration !== undefined ? { configuration: request.configuration } : {}),
    });
    if (processed.kind === "message") {
      return ok({ message: processed.message });
    }
    const completed = this.writeTask({
      ...task,
      status: {
        state: processed.state,
        timestamp: this.clock.now(),
        ...(processed.statusMessage !== undefined ? { message: processed.statusMessage } : {}),
      },
      ...(processed.artifacts !== undefined ? { artifacts: processed.artifacts } : {}),
    });
    this.maybeCreateInlinePush(completed.id, request.configuration?.taskPushNotificationConfig);
    return ok({ task: this.projectTask(completed, request.configuration?.historyLength) });
  }

  sendStreamingMessage(
    request: A2ASendMessageRequest,
    params?: A2AServiceParameters,
  ): Result<readonly A2AStreamResponse[], A2AProtocolError> {
    const gated = this.assertVersioned(params);
    if (!gated.ok) {
      return gated;
    }
    if (this.agentCard.capabilities.streaming !== true) {
      return err(a2aProtocolError("UnsupportedOperationError", "streaming is not supported"));
    }
    const content = this.assertContentTypes(request.message);
    if (!content.ok) {
      return content;
    }
    const prepared = this.prepareTask(request);
    if (!prepared.ok) {
      return prepared;
    }
    if (prepared.value.kind === "existing-terminal") {
      return err(
        a2aProtocolError(
          "UnsupportedOperationError",
          "messages cannot be sent to a task in a terminal state",
        ),
      );
    }
    const processed = this.processor.process({
      task: prepared.value.task,
      message: request.message,
      ...(request.configuration !== undefined ? { configuration: request.configuration } : {}),
    });
    if (processed.kind === "message") {
      return ok([{ message: processed.message }]);
    }
    const working = this.writeTask({
      ...prepared.value.task,
      status: { state: "TASK_STATE_WORKING", timestamp: this.clock.now() },
    });
    const events: A2AStreamResponse[] = [{ task: working }];
    const finalTask = this.writeTask({
      ...working,
      status: {
        state: processed.state,
        timestamp: this.clock.now(),
        ...(processed.statusMessage !== undefined ? { message: processed.statusMessage } : {}),
      },
      ...(processed.artifacts !== undefined ? { artifacts: processed.artifacts } : {}),
    });
    const contextId = finalTask.contextId ?? "";
    for (const artifact of finalTask.artifacts ?? []) {
      events.push({
        artifactUpdate: {
          taskId: finalTask.id,
          contextId,
          artifact,
          lastChunk: true,
        },
      });
    }
    events.push({
      statusUpdate: {
        taskId: finalTask.id,
        contextId,
        status: finalTask.status,
      },
    });
    this.maybeCreateInlinePush(finalTask.id, request.configuration?.taskPushNotificationConfig);
    return ok(events);
  }

  getTask(
    request: A2AGetTaskRequest,
    params?: A2AServiceParameters,
  ): Result<A2ATask, A2AProtocolError> {
    const gated = this.assertVersioned(params);
    if (!gated.ok) {
      return gated;
    }
    const task = this.tasks.get(request.id);
    if (task === undefined) {
      return err(a2aProtocolError("TaskNotFoundError", `task ${request.id} was not found`));
    }
    return ok(this.projectTask(task, request.historyLength));
  }

  listTasks(
    request: A2AListTasksRequest,
    params?: A2AServiceParameters,
  ): Result<A2AListTasksResponse, A2AProtocolError> {
    const gated = this.assertVersioned(params);
    if (!gated.ok) {
      return gated;
    }
    const pageSize = clampPageSize(request.pageSize);
    const offset = decodePageToken(request.pageToken);
    if (!offset.ok) {
      return offset;
    }
    const filtered = [...this.tasks.values()]
      .filter((task) => request.contextId === undefined || task.contextId === request.contextId)
      .filter((task) => request.status === undefined || task.status.state === request.status)
      .filter((task) => {
        if (request.statusTimestampAfter === undefined) {
          return true;
        }
        const timestamp = task.status.timestamp;
        return timestamp !== undefined && timestamp >= request.statusTimestampAfter;
      })
      .sort((left, right) => {
        const leftTs = left.status.timestamp ?? "";
        const rightTs = right.status.timestamp ?? "";
        return rightTs.localeCompare(leftTs);
      });
    const page = filtered.slice(offset.value, offset.value + pageSize).map((task) => {
      const withHistory = this.projectTask(task, request.historyLength);
      return request.includeArtifacts === true ? withHistory : omitA2ATaskArtifacts(withHistory);
    });
    const nextOffset = offset.value + page.length;
    return ok({
      tasks: page,
      nextPageToken: nextOffset >= filtered.length ? "" : String(nextOffset),
      pageSize,
      totalSize: filtered.length,
    });
  }

  cancelTask(
    request: A2ACancelTaskRequest,
    params?: A2AServiceParameters,
  ): Result<A2ATask, A2AProtocolError> {
    const gated = this.assertVersioned(params);
    if (!gated.ok) {
      return gated;
    }
    const task = this.tasks.get(request.id);
    if (task === undefined) {
      return err(a2aProtocolError("TaskNotFoundError", `task ${request.id} was not found`));
    }
    if (task.status.state === "TASK_STATE_CANCELED") {
      return ok(task);
    }
    if (!isA2ACancelableTaskState(task.status.state)) {
      return err(
        a2aProtocolError("TaskNotCancelableError", `task ${request.id} is not cancelable`),
      );
    }
    return ok(
      this.writeTask({
        ...task,
        status: { state: "TASK_STATE_CANCELED", timestamp: this.clock.now() },
        ...(request.metadata !== undefined
          ? { metadata: { ...(task.metadata ?? {}), cancel: request.metadata } }
          : {}),
      }),
    );
  }

  subscribeToTask(
    request: A2AGetTaskRequest,
    params?: A2AServiceParameters,
  ): Result<readonly A2AStreamResponse[], A2AProtocolError> {
    const gated = this.assertVersioned(params);
    if (!gated.ok) {
      return gated;
    }
    if (this.agentCard.capabilities.streaming !== true) {
      return err(a2aProtocolError("UnsupportedOperationError", "streaming is not supported"));
    }
    const task = this.tasks.get(request.id);
    if (task === undefined) {
      return err(a2aProtocolError("TaskNotFoundError", `task ${request.id} was not found`));
    }
    if (isA2ATerminalTaskState(task.status.state)) {
      return err(
        a2aProtocolError(
          "UnsupportedOperationError",
          "subscribe is not available on a terminal task",
        ),
      );
    }
    return ok([{ task: this.projectTask(task, request.historyLength) }]);
  }

  createPushNotificationConfig(
    taskId: string,
    input: A2ATaskPushNotificationConfigInput,
    params?: A2AServiceParameters,
  ): Result<A2APushNotificationConfig, A2AProtocolError> {
    const gated = this.assertVersioned(params);
    if (!gated.ok) {
      return gated;
    }
    if (this.agentCard.capabilities.pushNotifications !== true) {
      return err(
        a2aProtocolError("PushNotificationNotSupportedError", "push notifications are not supported"),
      );
    }
    if (!this.tasks.has(taskId)) {
      return err(a2aProtocolError("TaskNotFoundError", `task ${taskId} was not found`));
    }
    const config: A2APushNotificationConfig = {
      id: input.id ?? this.ids.next("config"),
      taskId,
      url: input.url,
      ...(input.token !== undefined ? { token: input.token } : {}),
      ...(input.authentication !== undefined ? { authentication: input.authentication } : {}),
    };
    const existing = this.pushConfigs.get(taskId) ?? [];
    this.pushConfigs.set(taskId, [...existing, config]);
    return ok(config);
  }

  getPushNotificationConfig(
    taskId: string,
    configId: string,
    params?: A2AServiceParameters,
  ): Result<A2APushNotificationConfig, A2AProtocolError> {
    const gated = this.assertPush(params);
    if (!gated.ok) {
      return gated;
    }
    const config = (this.pushConfigs.get(taskId) ?? []).find((item) => item.id === configId);
    if (config === undefined) {
      return err(a2aProtocolError("TaskNotFoundError", `push config ${configId} was not found`));
    }
    return ok(config);
  }

  listPushNotificationConfigs(
    taskId: string,
    params?: A2AServiceParameters,
  ): Result<A2AListPushNotificationConfigsResponse, A2AProtocolError> {
    const gated = this.assertPush(params);
    if (!gated.ok) {
      return gated;
    }
    if (!this.tasks.has(taskId)) {
      return err(a2aProtocolError("TaskNotFoundError", `task ${taskId} was not found`));
    }
    return ok({
      configs: this.pushConfigs.get(taskId) ?? [],
      nextPageToken: "",
    });
  }

  deletePushNotificationConfig(
    taskId: string,
    configId: string,
    params?: A2AServiceParameters,
  ): Result<void, A2AProtocolError> {
    const gated = this.assertPush(params);
    if (!gated.ok) {
      return gated;
    }
    if (!this.tasks.has(taskId)) {
      return err(a2aProtocolError("TaskNotFoundError", `task ${taskId} was not found`));
    }
    const existing = this.pushConfigs.get(taskId) ?? [];
    this.pushConfigs.set(
      taskId,
      existing.filter((item) => item.id !== configId),
    );
    return ok(undefined);
  }

  buildPushPayload(event: A2AStreamResponse): A2AStreamResponse {
    return event;
  }

  async deliverPushNotifications(
    taskId: string,
    event: A2AStreamResponse,
  ): Promise<Result<readonly A2APushDeliveryResult[], A2AProtocolError>> {
    if (this.agentCard.capabilities.pushNotifications !== true) {
      return err(
        a2aProtocolError("PushNotificationNotSupportedError", "push notifications are not supported"),
      );
    }
    const fetchImpl = this.fetchImpl ?? fetch;
    const configs = this.pushConfigs.get(taskId) ?? [];
    const results: A2APushDeliveryResult[] = [];
    for (const config of configs) {
      const headers: Record<string, string> = {
        "Content-Type": "application/a2a+json",
      };
      if (config.authentication !== undefined) {
        const credentials = config.authentication.credentials ?? "";
        headers.Authorization = `${config.authentication.scheme} ${credentials}`.trim();
      }
      try {
        const response = await fetchImpl(config.url, {
          method: "POST",
          headers,
          body: JSON.stringify(event),
        });
        results.push({ configId: config.id, url: config.url, status: response.status });
      } catch (error) {
        return err(
          a2aProtocolError(
            "InternalError",
            error instanceof Error ? error.message : "push delivery failed",
          ),
        );
      }
    }
    return ok(results);
  }

  private assertVersioned(params?: A2AServiceParameters): Result<void, A2AProtocolError> {
    const version = assertA2AVersionSupported(params?.a2aVersion);
    if (!version.ok) {
      return version;
    }
    return this.assertRequiredExtensions(params);
  }

  private assertRequiredExtensions(
    params?: A2AServiceParameters,
  ): Result<void, A2AProtocolError> {
    const required = (this.agentCard.capabilities.extensions ?? []).filter(
      (extension) => extension.required === true && extension.uri !== undefined,
    );
    const declared = new Set(params?.a2aExtensions ?? []);
    for (const extension of required) {
      if (extension.uri !== undefined && !declared.has(extension.uri)) {
        return err(
          a2aProtocolError(
            "ExtensionSupportRequiredError",
            `required extension ${extension.uri} was not declared`,
          ),
        );
      }
    }
    return ok(undefined);
  }

  private assertPush(params?: A2AServiceParameters): Result<void, A2AProtocolError> {
    const gated = this.assertVersioned(params);
    if (!gated.ok) {
      return gated;
    }
    if (this.agentCard.capabilities.pushNotifications !== true) {
      return err(
        a2aProtocolError("PushNotificationNotSupportedError", "push notifications are not supported"),
      );
    }
    return ok(undefined);
  }

  private assertContentTypes(message: A2AMessage): Result<void, A2AProtocolError> {
    const accepted = new Set(this.agentCard.defaultInputModes);
    for (const part of message.parts) {
      if (part.mediaType !== undefined && !accepted.has(part.mediaType)) {
        return err(
          a2aProtocolError(
            "ContentTypeNotSupportedError",
            `media type ${part.mediaType} is not supported`,
          ),
        );
      }
    }
    return ok(undefined);
  }

  private prepareTask(
    request: A2ASendMessageRequest,
  ): Result<{ kind: "ready"; task: A2ATask } | { kind: "existing-terminal" }, A2AProtocolError> {
    const message = request.message;
    if (message.taskId !== undefined) {
      const existing = this.tasks.get(message.taskId);
      if (existing === undefined) {
        return err(a2aProtocolError("TaskNotFoundError", `task ${message.taskId} was not found`));
      }
      if (
        message.contextId !== undefined &&
        existing.contextId !== undefined &&
        message.contextId !== existing.contextId
      ) {
        return err(
          a2aProtocolError("InvalidParamsError", "contextId does not match the referenced task"),
        );
      }
      if (isA2ATerminalTaskState(existing.status.state)) {
        return ok({ kind: "existing-terminal" });
      }
      const history = [...(existing.history ?? []), message];
      return ok({
        kind: "ready",
        task: this.writeTask({
          ...existing,
          history,
          status: { state: "TASK_STATE_WORKING", timestamp: this.clock.now() },
        }),
      });
    }
    const contextId = message.contextId ?? this.ids.next("context");
    const metadata = {
      ...(request.metadata ?? {}),
      ...(sessionMetadata(this.session) ?? {}),
    };
    const task: A2ATask = {
      id: this.ids.next("task"),
      contextId,
      status: { state: "TASK_STATE_SUBMITTED", timestamp: this.clock.now() },
      history: [message],
      ...(Object.keys(metadata).length > 0 ? { metadata } : {}),
    };
    return ok({ kind: "ready", task: this.writeTask(task) });
  }

  private writeTask(task: A2ATask): A2ATask {
    this.tasks.set(task.id, task);
    return task;
  }

  private projectTask(task: A2ATask, historyLength: number | undefined): A2ATask {
    return applyA2AHistoryLength(task, historyLength);
  }

  private maybeCreateInlinePush(
    taskId: string,
    input: A2ATaskPushNotificationConfigInput | undefined,
  ): void {
    if (input === undefined || this.agentCard.capabilities.pushNotifications !== true) {
      return;
    }
    this.createPushNotificationConfig(taskId, input);
  }
}

function clampPageSize(pageSize: number | undefined): number {
  if (pageSize === undefined) {
    return A2A_DEFAULT_LIST_PAGE_SIZE;
  }
  if (pageSize < 1) {
    return 1;
  }
  if (pageSize > A2A_MAX_LIST_PAGE_SIZE) {
    return A2A_MAX_LIST_PAGE_SIZE;
  }
  return pageSize;
}

function decodePageToken(token: string | undefined): Result<number, A2AProtocolError> {
  if (token === undefined || token.length === 0) {
    return ok(0);
  }
  if (!/^\d+$/.test(token)) {
    return err(a2aProtocolError("InvalidParamsError", "pageToken is not a valid cursor"));
  }
  return ok(Number(token));
}

export function parseA2AOperationRequest(
  operation: A2AOperationName,
  params: unknown,
): Result<
  | A2ASendMessageRequest
  | A2AGetTaskRequest
  | A2AListTasksRequest
  | A2ACancelTaskRequest
  | { readonly taskId: string; readonly config?: A2ATaskPushNotificationConfigInput; readonly id?: string },
  A2AProtocolError
> {
  switch (operation) {
    case "SendMessage":
    case "SendStreamingMessage":
      return parseA2ASendMessageRequest(params);
    case "GetTask":
    case "SubscribeToTask":
      return parseA2AGetTaskRequest(params);
    case "ListTasks":
      return parseA2AListTasksRequest(params);
    case "CancelTask":
      return parseA2ACancelTaskRequest(params);
    case "GetAgentCard":
    case "GetExtendedAgentCard":
      return ok({});
    case "CreateTaskPushNotificationConfig":
      return parseCreatePush(params);
    case "GetTaskPushNotificationConfig":
    case "DeleteTaskPushNotificationConfig":
      return parseTaskConfigIds(params);
    case "ListTaskPushNotificationConfigs":
      return parseTaskIdOnly(params);
    default: {
      const _never: never = operation;
      return err(a2aProtocolError("MethodNotFoundError", `unknown operation ${_never}`));
    }
  }
}

export type A2AOperationName =
  | "SendMessage"
  | "SendStreamingMessage"
  | "GetTask"
  | "ListTasks"
  | "CancelTask"
  | "SubscribeToTask"
  | "GetAgentCard"
  | "GetExtendedAgentCard"
  | "CreateTaskPushNotificationConfig"
  | "GetTaskPushNotificationConfig"
  | "ListTaskPushNotificationConfigs"
  | "DeleteTaskPushNotificationConfig";

function parseCreatePush(
  value: unknown,
): Result<
  { readonly taskId: string; readonly config: A2ATaskPushNotificationConfigInput },
  A2AProtocolError
> {
  if (!isJsonObject(value) || typeof value.taskId !== "string" || value.taskId.length === 0) {
    return err(a2aProtocolError("InvalidParamsError", "taskId is required", { path: "taskId" }));
  }
  const config = parseA2ATaskPushNotificationConfigInput(value);
  if (!config.ok) {
    return config;
  }
  return ok({ taskId: value.taskId, config: config.value });
}

function parseTaskConfigIds(
  value: unknown,
): Result<{ readonly taskId: string; readonly id: string }, A2AProtocolError> {
  if (!isJsonObject(value) || typeof value.taskId !== "string" || typeof value.id !== "string") {
    return err(a2aProtocolError("InvalidParamsError", "taskId and id are required"));
  }
  return ok({ taskId: value.taskId, id: value.id });
}

function parseTaskIdOnly(
  value: unknown,
): Result<{ readonly taskId: string }, A2AProtocolError> {
  if (!isJsonObject(value) || typeof value.taskId !== "string") {
    return err(a2aProtocolError("InvalidParamsError", "taskId is required", { path: "taskId" }));
  }
  return ok({ taskId: value.taskId });
}

function bindParsed<T>(
  parsed: Result<T, A2AProtocolError>,
  next: (value: T) => Result<unknown, A2AProtocolError>,
): Result<unknown, A2AProtocolError> {
  return parsed.ok ? next(parsed.value) : parsed;
}

const A2A_OPERATION_HANDLERS: {
  readonly [K in A2AOperationName]: (
    engine: A2AOperationEngine,
    params: unknown,
    serviceParams?: A2AServiceParameters,
  ) => Result<unknown, A2AProtocolError>;
} = {
  SendMessage: (engine, params, serviceParams) =>
    bindParsed(parseA2ASendMessageRequest(params), (request) =>
      engine.sendMessage(request, serviceParams),
    ),
  SendStreamingMessage: (engine, params, serviceParams) =>
    bindParsed(parseA2ASendMessageRequest(params), (request) =>
      engine.sendStreamingMessage(request, serviceParams),
    ),
  GetTask: (engine, params, serviceParams) =>
    bindParsed(parseA2AGetTaskRequest(params), (request) => engine.getTask(request, serviceParams)),
  ListTasks: (engine, params, serviceParams) =>
    bindParsed(parseA2AListTasksRequest(params), (request) =>
      engine.listTasks(request, serviceParams),
    ),
  CancelTask: (engine, params, serviceParams) =>
    bindParsed(parseA2ACancelTaskRequest(params), (request) =>
      engine.cancelTask(request, serviceParams),
    ),
  SubscribeToTask: (engine, params, serviceParams) =>
    bindParsed(parseA2AGetTaskRequest(params), (request) =>
      engine.subscribeToTask(request, serviceParams),
    ),
  GetAgentCard: (engine, _params, serviceParams) => engine.getAgentCard(serviceParams),
  GetExtendedAgentCard: (engine, _params, serviceParams) =>
    engine.getExtendedAgentCard(serviceParams),
  CreateTaskPushNotificationConfig: (engine, params, serviceParams) =>
    bindParsed(parseCreatePush(params), (request) =>
      engine.createPushNotificationConfig(request.taskId, request.config, serviceParams),
    ),
  GetTaskPushNotificationConfig: (engine, params, serviceParams) =>
    bindParsed(parseTaskConfigIds(params), (request) =>
      engine.getPushNotificationConfig(request.taskId, request.id, serviceParams),
    ),
  ListTaskPushNotificationConfigs: (engine, params, serviceParams) =>
    bindParsed(parseTaskIdOnly(params), (request) =>
      engine.listPushNotificationConfigs(request.taskId, serviceParams),
    ),
  DeleteTaskPushNotificationConfig: (engine, params, serviceParams) =>
    bindParsed(parseTaskConfigIds(params), (request) =>
      engine.deletePushNotificationConfig(request.taskId, request.id, serviceParams),
    ),
};

export function dispatchA2AOperation(
  engine: A2AOperationEngine,
  operation: A2AOperationName,
  params: unknown,
  serviceParams?: A2AServiceParameters,
): Result<unknown, A2AProtocolError> {
  const handler = A2A_OPERATION_HANDLERS[operation];
  if (handler === undefined) {
    return err(a2aProtocolError("MethodNotFoundError", `unknown operation ${String(operation)}`));
  }
  return handler(engine, params, serviceParams);
}
