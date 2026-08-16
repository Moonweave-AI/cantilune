/**
 * A2A 1.0.0 Task, Artifact, and streaming event objects.
 */
import { type Result, err, ok } from "@cantilune/core";
import {
  a2aProtocolError,
  isJsonObject,
  parseA2AMessage,
  parseA2APart,
  type A2AMessage,
  type A2AMetadata,
  type A2APart,
  type A2AProtocolError,
} from "./a2aMessage.js";

export type A2ATaskState =
  | "TASK_STATE_UNSPECIFIED"
  | "TASK_STATE_SUBMITTED"
  | "TASK_STATE_WORKING"
  | "TASK_STATE_COMPLETED"
  | "TASK_STATE_FAILED"
  | "TASK_STATE_CANCELED"
  | "TASK_STATE_INPUT_REQUIRED"
  | "TASK_STATE_REJECTED"
  | "TASK_STATE_AUTH_REQUIRED";

export const A2A_TASK_STATES: readonly A2ATaskState[] = [
  "TASK_STATE_UNSPECIFIED",
  "TASK_STATE_SUBMITTED",
  "TASK_STATE_WORKING",
  "TASK_STATE_COMPLETED",
  "TASK_STATE_FAILED",
  "TASK_STATE_CANCELED",
  "TASK_STATE_INPUT_REQUIRED",
  "TASK_STATE_REJECTED",
  "TASK_STATE_AUTH_REQUIRED",
];

export const A2A_TERMINAL_TASK_STATES: readonly A2ATaskState[] = [
  "TASK_STATE_COMPLETED",
  "TASK_STATE_FAILED",
  "TASK_STATE_CANCELED",
  "TASK_STATE_REJECTED",
];

export const A2A_INTERRUPTED_TASK_STATES: readonly A2ATaskState[] = [
  "TASK_STATE_INPUT_REQUIRED",
  "TASK_STATE_AUTH_REQUIRED",
];

export function isA2ATaskState(value: unknown): value is A2ATaskState {
  return (A2A_TASK_STATES as readonly string[]).includes(value as string);
}

export function isA2ATerminalTaskState(state: A2ATaskState): boolean {
  return (A2A_TERMINAL_TASK_STATES as readonly A2ATaskState[]).includes(state);
}

export function isA2AInterruptedTaskState(state: A2ATaskState): boolean {
  return (A2A_INTERRUPTED_TASK_STATES as readonly A2ATaskState[]).includes(state);
}

export function isA2ACancelableTaskState(state: A2ATaskState): boolean {
  return !isA2ATerminalTaskState(state);
}

export interface A2ATaskStatus {
  readonly state: A2ATaskState;
  readonly message?: A2AMessage;
  readonly timestamp?: string;
}

export interface A2AArtifact {
  readonly artifactId: string;
  readonly parts: readonly A2APart[];
  readonly name?: string;
  readonly description?: string;
  readonly metadata?: A2AMetadata;
  readonly extensions?: readonly string[];
}

export interface A2ATask {
  readonly id: string;
  readonly status: A2ATaskStatus;
  readonly contextId?: string;
  readonly artifacts?: readonly A2AArtifact[];
  readonly history?: readonly A2AMessage[];
  readonly metadata?: A2AMetadata;
}

export interface A2ATaskStatusUpdateEvent {
  readonly taskId: string;
  readonly contextId: string;
  readonly status: A2ATaskStatus;
  readonly metadata?: A2AMetadata;
}

export interface A2ATaskArtifactUpdateEvent {
  readonly taskId: string;
  readonly contextId: string;
  readonly artifact: A2AArtifact;
  readonly append?: boolean;
  readonly lastChunk?: boolean;
  readonly metadata?: A2AMetadata;
}

export type A2AStreamResponse =
  | { readonly task: A2ATask }
  | { readonly message: A2AMessage }
  | { readonly statusUpdate: A2ATaskStatusUpdateEvent }
  | { readonly artifactUpdate: A2ATaskArtifactUpdateEvent };

export interface A2AGetTaskRequest {
  readonly id: string;
  readonly tenant?: string;
  readonly historyLength?: number;
}

export interface A2AListTasksRequest {
  readonly tenant?: string;
  readonly contextId?: string;
  readonly status?: A2ATaskState;
  readonly pageSize?: number;
  readonly pageToken?: string;
  readonly historyLength?: number;
  readonly statusTimestampAfter?: string;
  readonly includeArtifacts?: boolean;
}

export interface A2AListTasksResponse {
  readonly tasks: readonly A2ATask[];
  readonly nextPageToken: string;
  readonly pageSize: number;
  readonly totalSize: number;
}

export interface A2ACancelTaskRequest {
  readonly id: string;
  readonly tenant?: string;
  readonly metadata?: A2AMetadata;
}

export function applyA2AHistoryLength(
  task: A2ATask,
  historyLength: number | undefined,
): A2ATask {
  if (historyLength === undefined) {
    return task;
  }
  if (historyLength === 0) {
    const { history: _history, ...rest } = task;
    return rest;
  }
  if (task.history === undefined) {
    return task;
  }
  return {
    ...task,
    history: task.history.slice(-historyLength),
  };
}

export function omitA2ATaskArtifacts(task: A2ATask): A2ATask {
  const { artifacts: _artifacts, ...rest } = task;
  return rest;
}

function optionalString(
  record: Record<string, unknown>,
  key: string,
  path: string,
): Result<string | undefined, A2AProtocolError> {
  if (!(key in record) || record[key] === undefined) {
    return ok(undefined);
  }
  if (typeof record[key] !== "string") {
    return err(a2aProtocolError("InvalidParamsError", `${path} must be a string`, { path }));
  }
  return ok(record[key]);
}

function optionalMetadata(
  record: Record<string, unknown>,
  path: string,
): Result<A2AMetadata | undefined, A2AProtocolError> {
  if (!("metadata" in record) || record.metadata === undefined) {
    return ok(undefined);
  }
  if (!isJsonObject(record.metadata)) {
    return err(a2aProtocolError("InvalidParamsError", `${path} must be an object`, { path }));
  }
  return ok(record.metadata);
}

function optionalStringArray(
  record: Record<string, unknown>,
  key: string,
  path: string,
): Result<readonly string[] | undefined, A2AProtocolError> {
  if (!(key in record) || record[key] === undefined) {
    return ok(undefined);
  }
  if (!Array.isArray(record[key]) || record[key].some((item) => typeof item !== "string")) {
    return err(
      a2aProtocolError("InvalidParamsError", `${path} must be an array of strings`, { path }),
    );
  }
  return ok(record[key] as readonly string[]);
}

export function parseA2ATaskStatus(
  value: unknown,
  path = "status",
): Result<A2ATaskStatus, A2AProtocolError> {
  if (!isJsonObject(value) || !isA2ATaskState(value.state)) {
    return err(
      a2aProtocolError("InvalidParamsError", `${path}.state must be a TaskState`, { path }),
    );
  }
  let message: A2AMessage | undefined;
  if (value.message !== undefined) {
    const parsed = parseA2AMessage(value.message, `${path}.message`);
    if (!parsed.ok) {
      return parsed;
    }
    message = parsed.value;
  }
  const timestamp = optionalString(value, "timestamp", `${path}.timestamp`);
  if (!timestamp.ok) {
    return timestamp;
  }
  return ok({
    state: value.state,
    ...(message !== undefined ? { message } : {}),
    ...(timestamp.value !== undefined ? { timestamp: timestamp.value } : {}),
  });
}

export function parseA2AArtifact(
  value: unknown,
  path = "artifact",
): Result<A2AArtifact, A2AProtocolError> {
  if (!isJsonObject(value) || typeof value.artifactId !== "string" || value.artifactId.length === 0) {
    return err(
      a2aProtocolError("InvalidParamsError", `${path}.artifactId is required`, { path }),
    );
  }
  if (!Array.isArray(value.parts) || value.parts.length === 0) {
    return err(
      a2aProtocolError("InvalidParamsError", `${path}.parts must contain at least one part`, {
        path: `${path}.parts`,
      }),
    );
  }
  const parts: A2APart[] = [];
  for (const [index, part] of value.parts.entries()) {
    const parsed = parseA2APart(part, `${path}.parts[${index}]`);
    if (!parsed.ok) {
      return parsed;
    }
    parts.push(parsed.value);
  }
  const name = optionalString(value, "name", `${path}.name`);
  if (!name.ok) {
    return name;
  }
  const description = optionalString(value, "description", `${path}.description`);
  if (!description.ok) {
    return description;
  }
  const metadata = optionalMetadata(value, `${path}.metadata`);
  if (!metadata.ok) {
    return metadata;
  }
  const extensions = optionalStringArray(value, "extensions", `${path}.extensions`);
  if (!extensions.ok) {
    return extensions;
  }
  return ok({
    artifactId: value.artifactId,
    parts,
    ...(name.value !== undefined ? { name: name.value } : {}),
    ...(description.value !== undefined ? { description: description.value } : {}),
    ...(metadata.value !== undefined ? { metadata: metadata.value } : {}),
    ...(extensions.value !== undefined ? { extensions: extensions.value } : {}),
  });
}

export function parseA2ATask(value: unknown, path = "task"): Result<A2ATask, A2AProtocolError> {
  if (!isJsonObject(value) || typeof value.id !== "string" || value.id.length === 0) {
    return err(a2aProtocolError("InvalidParamsError", `${path}.id is required`, { path }));
  }
  const status = parseA2ATaskStatus(value.status, `${path}.status`);
  if (!status.ok) {
    return status;
  }
  const contextId = optionalString(value, "contextId", `${path}.contextId`);
  if (!contextId.ok) {
    return contextId;
  }
  const metadata = optionalMetadata(value, `${path}.metadata`);
  if (!metadata.ok) {
    return metadata;
  }
  const artifacts = parseOptionalArtifactList(value.artifacts, `${path}.artifacts`);
  if (!artifacts.ok) {
    return artifacts;
  }
  const history = parseOptionalMessageList(value.history, `${path}.history`);
  if (!history.ok) {
    return history;
  }
  return ok({
    id: value.id,
    status: status.value,
    ...(contextId.value !== undefined ? { contextId: contextId.value } : {}),
    ...(artifacts.value !== undefined ? { artifacts: artifacts.value } : {}),
    ...(history.value !== undefined ? { history: history.value } : {}),
    ...(metadata.value !== undefined ? { metadata: metadata.value } : {}),
  });
}

function parseOptionalArtifactList(
  value: unknown,
  path: string,
): Result<readonly A2AArtifact[] | undefined, A2AProtocolError> {
  if (value === undefined) {
    return ok(undefined);
  }
  if (!Array.isArray(value)) {
    return err(a2aProtocolError("InvalidParamsError", `${path} must be an array`, { path }));
  }
  const parsed: A2AArtifact[] = [];
  for (const [index, artifact] of value.entries()) {
    const item = parseA2AArtifact(artifact, `${path}[${index}]`);
    if (!item.ok) {
      return item;
    }
    parsed.push(item.value);
  }
  return ok(parsed);
}

function parseOptionalMessageList(
  value: unknown,
  path: string,
): Result<readonly A2AMessage[] | undefined, A2AProtocolError> {
  if (value === undefined) {
    return ok(undefined);
  }
  if (!Array.isArray(value)) {
    return err(a2aProtocolError("InvalidParamsError", `${path} must be an array`, { path }));
  }
  const parsed: A2AMessage[] = [];
  for (const [index, message] of value.entries()) {
    const item = parseA2AMessage(message, `${path}[${index}]`);
    if (!item.ok) {
      return item;
    }
    parsed.push(item.value);
  }
  return ok(parsed);
}

export function parseA2AStreamResponse(
  value: unknown,
): Result<A2AStreamResponse, A2AProtocolError> {
  if (!isJsonObject(value)) {
    return err(
      a2aProtocolError("InvalidParamsError", "StreamResponse must be an object", { path: "event" }),
    );
  }
  const keys = ["task", "message", "statusUpdate", "artifactUpdate"] as const;
  const present = keys.filter((key) => key in value);
  if (present.length !== 1) {
    return err(
      a2aProtocolError(
        "InvalidParamsError",
        "StreamResponse must contain exactly one of task, message, statusUpdate, artifactUpdate",
        { path: "event" },
      ),
    );
  }
  if (present[0] === "task") {
    const task = parseA2ATask(value.task);
    if (!task.ok) {
      return task;
    }
    return ok({ task: task.value });
  }
  if (present[0] === "message") {
    const message = parseA2AMessage(value.message);
    if (!message.ok) {
      return message;
    }
    return ok({ message: message.value });
  }
  if (present[0] === "statusUpdate") {
    return parseTaskStatusUpdate(value.statusUpdate);
  }
  return parseTaskArtifactUpdate(value.artifactUpdate);
}

function requiredUpdateId(
  value: Record<string, unknown>,
  field: "taskId" | "contextId",
  path: string,
): Result<string, A2AProtocolError> {
  const parsed = optionalString(value, field, `${path}.${field}`);
  if (!parsed.ok || parsed.value === undefined || parsed.value.length === 0) {
    return err(a2aProtocolError("InvalidParamsError", `${path}.${field} is required`, { path: `${path}.${field}` }));
  }
  return ok(parsed.value);
}

function parseTaskStatusUpdate(value: unknown): Result<A2AStreamResponse, A2AProtocolError> {
  if (!isJsonObject(value)) {
    return err(
      a2aProtocolError("InvalidParamsError", "statusUpdate must be an object", {
        path: "statusUpdate",
      }),
    );
  }
  const taskId = requiredUpdateId(value, "taskId", "statusUpdate");
  if (!taskId.ok) {
    return taskId;
  }
  const contextId = requiredUpdateId(value, "contextId", "statusUpdate");
  if (!contextId.ok) {
    return contextId;
  }
  const status = parseA2ATaskStatus(value.status, "statusUpdate.status");
  if (!status.ok) {
    return status;
  }
  const metadata = optionalMetadata(value, "statusUpdate.metadata");
  if (!metadata.ok) {
    return metadata;
  }
  return ok({
    statusUpdate: {
      taskId: taskId.value,
      contextId: contextId.value,
      status: status.value,
      ...(metadata.value !== undefined ? { metadata: metadata.value } : {}),
    },
  });
}

function parseOptionalBooleanFlag(
  value: unknown,
  path: string,
): Result<boolean | undefined, A2AProtocolError> {
  if (value === undefined) {
    return ok(undefined);
  }
  if (typeof value !== "boolean") {
    return err(a2aProtocolError("InvalidParamsError", `${path} must be a boolean`, { path }));
  }
  return ok(value);
}

function parseTaskArtifactUpdate(value: unknown): Result<A2AStreamResponse, A2AProtocolError> {
  if (!isJsonObject(value)) {
    return err(
      a2aProtocolError("InvalidParamsError", "artifactUpdate must be an object", {
        path: "artifactUpdate",
      }),
    );
  }
  const taskId = requiredUpdateId(value, "taskId", "artifactUpdate");
  if (!taskId.ok) {
    return taskId;
  }
  const contextId = requiredUpdateId(value, "contextId", "artifactUpdate");
  if (!contextId.ok) {
    return contextId;
  }
  const artifact = parseA2AArtifact(value.artifact, "artifactUpdate.artifact");
  if (!artifact.ok) {
    return artifact;
  }
  const metadata = optionalMetadata(value, "artifactUpdate.metadata");
  if (!metadata.ok) {
    return metadata;
  }
  const append = parseOptionalBooleanFlag(value.append, "artifactUpdate.append");
  if (!append.ok) {
    return append;
  }
  const lastChunk = parseOptionalBooleanFlag(value.lastChunk, "artifactUpdate.lastChunk");
  if (!lastChunk.ok) {
    return lastChunk;
  }
  return ok({
    artifactUpdate: {
      taskId: taskId.value,
      contextId: contextId.value,
      artifact: artifact.value,
      ...(append.value !== undefined ? { append: append.value } : {}),
      ...(lastChunk.value !== undefined ? { lastChunk: lastChunk.value } : {}),
      ...(metadata.value !== undefined ? { metadata: metadata.value } : {}),
    },
  });
}

export function parseA2AGetTaskRequest(
  value: unknown,
): Result<A2AGetTaskRequest, A2AProtocolError> {
  if (!isJsonObject(value) || typeof value.id !== "string" || value.id.length === 0) {
    return err(a2aProtocolError("InvalidParamsError", "GetTask.id is required", { path: "id" }));
  }
  const tenant = optionalString(value, "tenant", "tenant");
  if (!tenant.ok) {
    return tenant;
  }
  if (value.historyLength !== undefined && !Number.isInteger(value.historyLength)) {
    return err(
      a2aProtocolError("InvalidParamsError", "historyLength must be an integer", {
        path: "historyLength",
      }),
    );
  }
  return ok({
    id: value.id,
    ...(tenant.value !== undefined ? { tenant: tenant.value } : {}),
    ...(typeof value.historyLength === "number" ? { historyLength: value.historyLength } : {}),
  });
}

export function parseA2AListTasksRequest(
  value: unknown,
): Result<A2AListTasksRequest, A2AProtocolError> {
  if (value === undefined) {
    return ok({});
  }
  if (!isJsonObject(value)) {
    return err(
      a2aProtocolError("InvalidParamsError", "ListTasks params must be an object", { path: "params" }),
    );
  }
  const filters = parseListTaskFilters(value);
  if (!filters.ok) {
    return filters;
  }
  const paging = parseListTaskPaging(value);
  if (!paging.ok) {
    return paging;
  }
  return ok({ ...filters.value, ...paging.value });
}

function parseListTaskFilters(
  value: Record<string, unknown>,
): Result<Pick<A2AListTasksRequest, "tenant" | "contextId" | "status" | "statusTimestampAfter">, A2AProtocolError> {
  const tenant = optionalString(value, "tenant", "tenant");
  if (!tenant.ok) {
    return tenant;
  }
  const contextId = optionalString(value, "contextId", "contextId");
  if (!contextId.ok) {
    return contextId;
  }
  if (value.status !== undefined && !isA2ATaskState(value.status)) {
    return err(
      a2aProtocolError("InvalidParamsError", "status must be a TaskState", { path: "status" }),
    );
  }
  const statusTimestampAfter = optionalString(
    value,
    "statusTimestampAfter",
    "statusTimestampAfter",
  );
  if (!statusTimestampAfter.ok) {
    return statusTimestampAfter;
  }
  return ok({
    ...(tenant.value !== undefined ? { tenant: tenant.value } : {}),
    ...(contextId.value !== undefined ? { contextId: contextId.value } : {}),
    ...(isA2ATaskState(value.status) ? { status: value.status } : {}),
    ...(statusTimestampAfter.value !== undefined
      ? { statusTimestampAfter: statusTimestampAfter.value }
      : {}),
  });
}

function parseOptionalInteger(
  value: unknown,
  path: string,
): Result<number | undefined, A2AProtocolError> {
  if (value === undefined) {
    return ok(undefined);
  }
  if (!Number.isInteger(value)) {
    return err(a2aProtocolError("InvalidParamsError", `${path} must be an integer`, { path }));
  }
  return ok(value as number);
}

function parseListTaskPaging(
  value: Record<string, unknown>,
): Result<
  Pick<A2AListTasksRequest, "pageSize" | "pageToken" | "historyLength" | "includeArtifacts">,
  A2AProtocolError
> {
  const pageSize = parseOptionalInteger(value.pageSize, "pageSize");
  if (!pageSize.ok) {
    return pageSize;
  }
  const pageToken = optionalString(value, "pageToken", "pageToken");
  if (!pageToken.ok) {
    return pageToken;
  }
  const historyLength = parseOptionalInteger(value.historyLength, "historyLength");
  if (!historyLength.ok) {
    return historyLength;
  }
  const includeArtifacts = parseOptionalBooleanFlag(value.includeArtifacts, "includeArtifacts");
  if (!includeArtifacts.ok) {
    return includeArtifacts;
  }
  return ok({
    ...(pageSize.value !== undefined ? { pageSize: pageSize.value } : {}),
    ...(pageToken.value !== undefined ? { pageToken: pageToken.value } : {}),
    ...(historyLength.value !== undefined ? { historyLength: historyLength.value } : {}),
    ...(includeArtifacts.value !== undefined ? { includeArtifacts: includeArtifacts.value } : {}),
  });
}

export function parseA2ACancelTaskRequest(
  value: unknown,
): Result<A2ACancelTaskRequest, A2AProtocolError> {
  if (!isJsonObject(value) || typeof value.id !== "string" || value.id.length === 0) {
    return err(a2aProtocolError("InvalidParamsError", "CancelTask.id is required", { path: "id" }));
  }
  const tenant = optionalString(value, "tenant", "tenant");
  if (!tenant.ok) {
    return tenant;
  }
  const metadata = optionalMetadata(value, "metadata");
  if (!metadata.ok) {
    return metadata;
  }
  return ok({
    id: value.id,
    ...(tenant.value !== undefined ? { tenant: tenant.value } : {}),
    ...(metadata.value !== undefined ? { metadata: metadata.value } : {}),
  });
}
