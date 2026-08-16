/**
 * Canonical A2A JSON data model ↔ official protobuf-js objects.
 *
 * `@grpc/proto-loader` decodes `google.protobuf.Timestamp` / `Struct` / `Value`
 * as protobuf objects. JSON-RPC/REST and {@link A2AOperationEngine} use ISO
 * timestamps and plain objects. This file is the only conversion layer.
 */
import { Buffer } from "node:buffer";
import { isJsonObject } from "./a2aMessage.js";

const ONEOF_DISCRIMINATORS = new Set(["content", "payload", "scheme", "flow"]);
const PART_ONEOF = ["text", "raw", "url", "data"] as const;
const TIMESTAMP_KEYS = new Set(["timestamp", "statusTimestampAfter"]);
const STRUCT_KEYS = new Set(["metadata", "params", "header"]);
const VALUE_KEYS = new Set(["data"]);

export function isProtoTimestamp(value: unknown): value is {
  readonly seconds: string | number;
  readonly nanos?: number;
} {
  if (!isJsonObject(value) || !("seconds" in value)) {
    return false;
  }
  const keys = Object.keys(value).filter((key) => value[key] !== undefined);
  return keys.every((key) => key === "seconds" || key === "nanos");
}

export function isProtoValue(value: unknown): boolean {
  if (!isJsonObject(value)) {
    return false;
  }
  return (
    "stringValue" in value ||
    "numberValue" in value ||
    "boolValue" in value ||
    "nullValue" in value ||
    "structValue" in value ||
    "listValue" in value
  );
}

export function isProtoStruct(
  value: unknown,
): value is { readonly fields: Record<string, unknown> } {
  if (!isJsonObject(value) || !isJsonObject(value.fields)) {
    return false;
  }
  return Object.values(value.fields).every((entry) => isProtoValue(entry));
}

export function timestampToIso(value: {
  readonly seconds: string | number;
  readonly nanos?: number;
}): string {
  const seconds = typeof value.seconds === "string" ? Number(value.seconds) : value.seconds;
  const nanos = value.nanos ?? 0;
  const millis = seconds * 1000 + Math.floor(nanos / 1_000_000);
  return new Date(millis).toISOString();
}

export function isoToTimestamp(iso: string): { seconds: string; nanos: number } {
  const millis = Date.parse(iso);
  const seconds = Math.floor(millis / 1000);
  const nanos = (millis % 1000) * 1_000_000;
  return { seconds: String(seconds), nanos };
}

export function protoValueToJson(value: unknown): unknown {
  if (!isJsonObject(value)) {
    return value;
  }
  if ("stringValue" in value) return value.stringValue;
  if ("numberValue" in value) return value.numberValue;
  if ("boolValue" in value) return value.boolValue;
  if ("nullValue" in value) return null;
  if ("structValue" in value) return structToObject(value.structValue);
  if (
    "listValue" in value &&
    isJsonObject(value.listValue) &&
    Array.isArray(value.listValue.values)
  ) {
    return value.listValue.values.map((entry) => protoValueToJson(entry));
  }
  return undefined;
}

export function jsonToProtoValue(value: unknown): Record<string, unknown> {
  if (value === null || value === undefined) {
    return { nullValue: 0 };
  }
  if (typeof value === "string") {
    return { stringValue: value };
  }
  if (typeof value === "boolean") {
    return { boolValue: value };
  }
  if (typeof value === "number") {
    return { numberValue: value };
  }
  if (Array.isArray(value)) {
    return { listValue: { values: value.map((entry) => jsonToProtoValue(entry)) } };
  }
  if (isJsonObject(value)) {
    return { structValue: objectToStruct(value) };
  }
  if (typeof value === "bigint" || typeof value === "symbol") {
    return { stringValue: value.toString() };
  }
  return { stringValue: "" };
}

export function structToObject(value: unknown): Record<string, unknown> {
  if (!isJsonObject(value) || !isJsonObject(value.fields)) {
    return {};
  }
  const result: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value.fields)) {
    result[key] = protoValueToJson(entry);
  }
  return result;
}

export function objectToStruct(value: Readonly<Record<string, unknown>>): {
  fields: Record<string, unknown>;
} {
  const fields: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    fields[key] = jsonToProtoValue(entry);
  }
  return { fields };
}

function stripEmptyPartOneofs(record: Record<string, unknown>): Record<string, unknown> {
  const present = PART_ONEOF.filter((key) => {
    const value = record[key];
    return value !== undefined && value !== null && value !== "";
  });
  if (present.length === 0) {
    return record;
  }
  const next = { ...record };
  for (const key of PART_ONEOF) {
    if (!present.includes(key)) {
      delete next[key];
    }
  }
  return next;
}

export function protoMessageToJson(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }
  if (typeof value !== "object") {
    return value;
  }
  if (value instanceof Uint8Array) {
    return Buffer.from(value).toString("base64");
  }
  if (Array.isArray(value)) {
    return value.map((entry) => protoMessageToJson(entry));
  }
  if (isProtoTimestamp(value)) {
    return timestampToIso(value);
  }
  if (isProtoStruct(value)) {
    return structToObject(value);
  }
  if (isProtoValue(value) && !("messageId" in value) && !("id" in value)) {
    return protoValueToJson(value);
  }
  const record = value as Record<string, unknown>;
  const stripped = stripEmptyPartOneofs(record);
  const result: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(stripped)) {
    if (ONEOF_DISCRIMINATORS.has(key) && typeof entry === "string") {
      continue;
    }
    if (entry === undefined || entry === null || entry === "") {
      continue;
    }
    result[key] = protoMessageToJson(entry);
  }
  return result;
}

export function jsonToProtoMessage(value: unknown, key?: string): unknown {
  if (value === null || value === undefined) {
    return value;
  }
  if (typeof value === "string" && key !== undefined && TIMESTAMP_KEYS.has(key)) {
    return isoToTimestamp(value);
  }
  if (typeof value !== "object") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((entry) => jsonToProtoMessage(entry, key));
  }
  const record = value as Record<string, unknown>;
  if (key !== undefined && STRUCT_KEYS.has(key) && !isProtoStruct(record)) {
    return objectToStruct(record);
  }
  if (key !== undefined && VALUE_KEYS.has(key) && !isProtoValue(record)) {
    return jsonToProtoValue(record);
  }
  const result: Record<string, unknown> = {};
  for (const [childKey, entry] of Object.entries(record)) {
    if (entry === undefined) {
      continue;
    }
    result[childKey] = jsonToProtoMessage(entry, childKey);
  }
  return result;
}
