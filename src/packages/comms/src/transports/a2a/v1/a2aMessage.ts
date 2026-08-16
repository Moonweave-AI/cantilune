/**
 * A2A 1.0.0 Message / Part / Role (https://a2a-protocol.org/latest/specification/).
 */
import { type Result, err, ok } from "@cantilune/core";

export type A2AErrorName =
  | "TaskNotFoundError"
  | "TaskNotCancelableError"
  | "PushNotificationNotSupportedError"
  | "UnsupportedOperationError"
  | "ContentTypeNotSupportedError"
  | "InvalidAgentResponseError"
  | "ExtendedAgentCardNotConfiguredError"
  | "ExtensionSupportRequiredError"
  | "VersionNotSupportedError"
  | "JSONParseError"
  | "InvalidRequestError"
  | "MethodNotFoundError"
  | "InvalidParamsError"
  | "InternalError";

export interface A2AProtocolError {
  readonly name: A2AErrorName;
  readonly message: string;
  readonly path?: string;
  readonly details?: readonly Readonly<Record<string, unknown>>[];
}

export function a2aProtocolError(
  name: A2AErrorName,
  message: string,
  options?: {
    readonly path?: string;
    readonly details?: readonly Readonly<Record<string, unknown>>[];
  },
): A2AProtocolError {
  return {
    name,
    message,
    ...(options?.path !== undefined ? { path: options.path } : {}),
    ...(options?.details !== undefined ? { details: options.details } : {}),
  };
}

/** Spec §11.6: UPPER_SNAKE_CASE without the Error suffix (e.g. TASK_NOT_FOUND). */
export function a2aErrorReason(name: A2AErrorName): string {
  return name
    .replace(/Error$/, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .toUpperCase();
}

export type A2AMetadata = Readonly<Record<string, unknown>>;

export type A2ARole = "ROLE_UNSPECIFIED" | "ROLE_USER" | "ROLE_AGENT";

export const A2A_ROLES: readonly A2ARole[] = ["ROLE_UNSPECIFIED", "ROLE_USER", "ROLE_AGENT"];

export type A2APart = {
  readonly metadata?: A2AMetadata;
  readonly filename?: string;
  readonly mediaType?: string;
} & (
  | { readonly text: string }
  | { readonly raw: string }
  | { readonly url: string }
  | { readonly data: unknown }
);

export interface A2AMessage {
  readonly messageId: string;
  readonly role: A2ARole;
  readonly parts: readonly A2APart[];
  readonly contextId?: string;
  readonly taskId?: string;
  readonly metadata?: A2AMetadata;
  readonly extensions?: readonly string[];
  readonly referenceTaskIds?: readonly string[];
}

export interface A2ASendMessageConfiguration {
  readonly acceptedOutputModes?: readonly string[];
  readonly taskPushNotificationConfig?: A2ATaskPushNotificationConfigInput;
  readonly historyLength?: number;
  readonly returnImmediately?: boolean;
}

export interface A2ATaskPushNotificationConfigInput {
  readonly url: string;
  readonly id?: string;
  readonly taskId?: string;
  readonly token?: string;
  readonly authentication?: A2AAuthenticationInfo;
}

export interface A2AAuthenticationInfo {
  readonly scheme: string;
  readonly credentials?: string;
}

export interface A2ASendMessageRequest {
  readonly message: A2AMessage;
  readonly tenant?: string;
  readonly configuration?: A2ASendMessageConfiguration;
  readonly metadata?: A2AMetadata;
}

export function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isA2ARole(value: unknown): value is A2ARole {
  return value === "ROLE_UNSPECIFIED" || value === "ROLE_USER" || value === "ROLE_AGENT";
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

export function parseA2APart(value: unknown, path = "part"): Result<A2APart, A2AProtocolError> {
  if (!isJsonObject(value)) {
    return err(a2aProtocolError("InvalidParamsError", `${path} must be an object`, { path }));
  }
  const oneof = ["text", "raw", "url", "data"] as const;
  const present = oneof.filter((key) => key in value);
  const kind = present[0];
  if (present.length !== 1 || kind === undefined) {
    return err(
      a2aProtocolError(
        "InvalidParamsError",
        `${path} must contain exactly one of text, raw, url, data`,
        { path },
      ),
    );
  }
  if (kind === "text" || kind === "raw" || kind === "url") {
    if (typeof value[kind] !== "string") {
      return err(
        a2aProtocolError("InvalidParamsError", `${path}.${kind} must be a string`, {
          path: `${path}.${kind}`,
        }),
      );
    }
  }
  const metadata = optionalMetadata(value, `${path}.metadata`);
  if (!metadata.ok) {
    return metadata;
  }
  const filename = optionalString(value, "filename", `${path}.filename`);
  if (!filename.ok) {
    return filename;
  }
  const mediaType = optionalString(value, "mediaType", `${path}.mediaType`);
  if (!mediaType.ok) {
    return mediaType;
  }
  const extras = {
    ...(metadata.value !== undefined ? { metadata: metadata.value } : {}),
    ...(filename.value !== undefined ? { filename: filename.value } : {}),
    ...(mediaType.value !== undefined ? { mediaType: mediaType.value } : {}),
  };
  if (kind === "text") {
    return ok({ text: value.text as string, ...extras });
  }
  if (kind === "raw") {
    return ok({ raw: value.raw as string, ...extras });
  }
  if (kind === "url") {
    return ok({ url: value.url as string, ...extras });
  }
  return ok({ data: value.data, ...extras });
}

export function parseA2AMessage(
  value: unknown,
  path = "message",
): Result<A2AMessage, A2AProtocolError> {
  if (!isJsonObject(value)) {
    return err(a2aProtocolError("InvalidParamsError", `${path} must be an object`, { path }));
  }
  if (typeof value.messageId !== "string" || value.messageId.length === 0) {
    return err(
      a2aProtocolError("InvalidParamsError", `${path}.messageId is required`, {
        path: `${path}.messageId`,
      }),
    );
  }
  if (!isA2ARole(value.role)) {
    return err(
      a2aProtocolError("InvalidParamsError", `${path}.role must be an A2A Role`, {
        path: `${path}.role`,
      }),
    );
  }
  const parts = parseMessageParts(value.parts, path);
  if (!parts.ok) {
    return parts;
  }
  const extras = parseMessageExtras(value, path);
  if (!extras.ok) {
    return extras;
  }
  return ok({
    messageId: value.messageId,
    role: value.role,
    parts: parts.value,
    ...extras.value,
  });
}

function parseMessageParts(
  value: unknown,
  path: string,
): Result<readonly A2APart[], A2AProtocolError> {
  if (!Array.isArray(value) || value.length === 0) {
    return err(
      a2aProtocolError("InvalidParamsError", `${path}.parts must contain at least one part`, {
        path: `${path}.parts`,
      }),
    );
  }
  const parts: A2APart[] = [];
  for (const [index, part] of value.entries()) {
    const parsed = parseA2APart(part, `${path}.parts[${index}]`);
    if (!parsed.ok) {
      return parsed;
    }
    parts.push(parsed.value);
  }
  return ok(parts);
}

function parseMessageExtras(
  value: Record<string, unknown>,
  path: string,
): Result<
  Pick<A2AMessage, "contextId" | "taskId" | "metadata" | "extensions" | "referenceTaskIds">,
  A2AProtocolError
> {
  const contextId = optionalString(value, "contextId", `${path}.contextId`);
  if (!contextId.ok) {
    return contextId;
  }
  const taskId = optionalString(value, "taskId", `${path}.taskId`);
  if (!taskId.ok) {
    return taskId;
  }
  const metadata = optionalMetadata(value, `${path}.metadata`);
  if (!metadata.ok) {
    return metadata;
  }
  const extensions = optionalStringArray(value, "extensions", `${path}.extensions`);
  if (!extensions.ok) {
    return extensions;
  }
  const referenceTaskIds = optionalStringArray(
    value,
    "referenceTaskIds",
    `${path}.referenceTaskIds`,
  );
  if (!referenceTaskIds.ok) {
    return referenceTaskIds;
  }
  return ok({
    ...(contextId.value !== undefined ? { contextId: contextId.value } : {}),
    ...(taskId.value !== undefined ? { taskId: taskId.value } : {}),
    ...(metadata.value !== undefined ? { metadata: metadata.value } : {}),
    ...(extensions.value !== undefined ? { extensions: extensions.value } : {}),
    ...(referenceTaskIds.value !== undefined ? { referenceTaskIds: referenceTaskIds.value } : {}),
  });
}

function parseAuthenticationInfo(
  value: unknown,
  path: string,
): Result<A2AAuthenticationInfo | undefined, A2AProtocolError> {
  if (value === undefined) {
    return ok(undefined);
  }
  if (!isJsonObject(value) || typeof value.scheme !== "string" || value.scheme.length === 0) {
    return err(
      a2aProtocolError("InvalidParamsError", `${path}.scheme is required`, { path }),
    );
  }
  const credentials = optionalString(value, "credentials", `${path}.credentials`);
  if (!credentials.ok) {
    return credentials;
  }
  return ok({
    scheme: value.scheme,
    ...(credentials.value !== undefined ? { credentials: credentials.value } : {}),
  });
}

export function parseA2ATaskPushNotificationConfigInput(
  value: unknown,
  path = "taskPushNotificationConfig",
): Result<A2ATaskPushNotificationConfigInput, A2AProtocolError> {
  if (!isJsonObject(value) || typeof value.url !== "string" || value.url.length === 0) {
    return err(a2aProtocolError("InvalidParamsError", `${path}.url is required`, { path }));
  }
  const id = optionalString(value, "id", `${path}.id`);
  if (!id.ok) {
    return id;
  }
  const taskId = optionalString(value, "taskId", `${path}.taskId`);
  if (!taskId.ok) {
    return taskId;
  }
  const token = optionalString(value, "token", `${path}.token`);
  if (!token.ok) {
    return token;
  }
  const authentication = parseAuthenticationInfo(value.authentication, `${path}.authentication`);
  if (!authentication.ok) {
    return authentication;
  }
  return ok({
    url: value.url,
    ...(id.value !== undefined ? { id: id.value } : {}),
    ...(taskId.value !== undefined ? { taskId: taskId.value } : {}),
    ...(token.value !== undefined ? { token: token.value } : {}),
    ...(authentication.value !== undefined ? { authentication: authentication.value } : {}),
  });
}

export function parseA2ASendMessageConfiguration(
  value: unknown,
  path = "configuration",
): Result<A2ASendMessageConfiguration, A2AProtocolError> {
  if (!isJsonObject(value)) {
    return err(a2aProtocolError("InvalidParamsError", `${path} must be an object`, { path }));
  }
  const acceptedOutputModes = optionalStringArray(
    value,
    "acceptedOutputModes",
    `${path}.acceptedOutputModes`,
  );
  if (!acceptedOutputModes.ok) {
    return acceptedOutputModes;
  }
  let taskPushNotificationConfig: A2ATaskPushNotificationConfigInput | undefined;
  if (value.taskPushNotificationConfig !== undefined) {
    const parsed = parseA2ATaskPushNotificationConfigInput(
      value.taskPushNotificationConfig,
      `${path}.taskPushNotificationConfig`,
    );
    if (!parsed.ok) {
      return parsed;
    }
    taskPushNotificationConfig = parsed.value;
  }
  if (value.historyLength !== undefined && !Number.isInteger(value.historyLength)) {
    return err(
      a2aProtocolError("InvalidParamsError", `${path}.historyLength must be an integer`, {
        path: `${path}.historyLength`,
      }),
    );
  }
  if (value.returnImmediately !== undefined && typeof value.returnImmediately !== "boolean") {
    return err(
      a2aProtocolError("InvalidParamsError", `${path}.returnImmediately must be a boolean`, {
        path: `${path}.returnImmediately`,
      }),
    );
  }
  return ok({
    ...(acceptedOutputModes.value !== undefined
      ? { acceptedOutputModes: acceptedOutputModes.value }
      : {}),
    ...(taskPushNotificationConfig !== undefined ? { taskPushNotificationConfig } : {}),
    ...(typeof value.historyLength === "number" ? { historyLength: value.historyLength } : {}),
    ...(typeof value.returnImmediately === "boolean"
      ? { returnImmediately: value.returnImmediately }
      : {}),
  });
}

export function parseA2ASendMessageRequest(
  value: unknown,
): Result<A2ASendMessageRequest, A2AProtocolError> {
  if (!isJsonObject(value)) {
    return err(
      a2aProtocolError("InvalidParamsError", "SendMessageRequest must be an object", {
        path: "params",
      }),
    );
  }
  const message = parseA2AMessage(value.message);
  if (!message.ok) {
    return message;
  }
  const tenant = optionalString(value, "tenant", "tenant");
  if (!tenant.ok) {
    return tenant;
  }
  const metadata = optionalMetadata(value, "metadata");
  if (!metadata.ok) {
    return metadata;
  }
  let configuration: A2ASendMessageConfiguration | undefined;
  if (value.configuration !== undefined) {
    const parsed = parseA2ASendMessageConfiguration(value.configuration);
    if (!parsed.ok) {
      return parsed;
    }
    configuration = parsed.value;
  }
  return ok({
    message: message.value,
    ...(tenant.value !== undefined ? { tenant: tenant.value } : {}),
    ...(configuration !== undefined ? { configuration } : {}),
    ...(metadata.value !== undefined ? { metadata: metadata.value } : {}),
  });
}
