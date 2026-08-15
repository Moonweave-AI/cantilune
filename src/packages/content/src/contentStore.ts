/// <reference types="node" />
import type { ContentRef } from "@cantilune/core";

/**
 * Metadata attached to stored content.
 * Immutable once written (content-addressed = append-only).
 */
export interface ContentMetadata {
  /** Byte length of the stored content. */
  readonly size: number;
  /** MIME type. Defaults to "application/octet-stream" if unspecified at put time. */
  readonly mimeType: string;
  /** ISO 8601 timestamp of first storage (e.g. "2026-08-12T05:00:00.000Z"). */
  readonly createdAt: string;
  /** Optional creator identity (actor/agent ref). */
  readonly createdBy: string | undefined;
}

/**
 * A retrieved content blob. Content is always raw bytes (Uint8Array).
 * Use {@link blobToText} for string decoding convenience.
 */
export interface ContentBlob {
  readonly ref: ContentRef;
  /** Raw bytes as stored. Always Uint8Array for consistency across adapters. */
  readonly bytes: Uint8Array;
  readonly metadata: ContentMetadata;
}

/**
 * Content-addressed store: SHA-256 of content = ContentRef.
 *
 * Invariants:
 * - put(same bytes) always returns the same ContentRef (idempotent, dedup)
 * - get(ref) returns exactly what was put (immutable, append-only)
 * - Content is never mutated or deleted by the store itself, except by the
 *   explicit, destructive remove() path which exists only for garbage
 *   collection under a human confirm boundary
 *
 * Ref format: "sha256:<64 hex chars>" — refs in other formats return undefined from get/exists.
 *
 * Environment: current implementation requires Node.js (node:crypto).
 */
export interface ContentStore {
  /**
   * Synchronous commit-time availability proof for CoordinationRuntime.
   * This is deliberately distinct from async `exists`: synchronous runtime
   * commit code must never mistake a pending Promise for positive evidence.
   */
  isAvailable(ref: ContentRef): boolean;

  /** Store content, returning its content-addressed ref. Idempotent. */
  put(content: string | Uint8Array, options?: ContentPutOptions): Promise<ContentRef>;

  /** Retrieve stored blob by ref. Returns undefined if ref unknown or invalid format. */
  get(ref: ContentRef): Promise<ContentBlob | undefined>;

  /** Check existence without loading bytes. */
  exists(ref: ContentRef): Promise<boolean>;

  /** Retrieve metadata only. Returns undefined if ref unknown. */
  metadata(ref: ContentRef): Promise<ContentMetadata | undefined>;

  /**
   * Count total stored entries. Useful for observability/debugging.
   * Implementations may return an approximation for very large stores.
   */
  count(): Promise<number>;

  /**
   * Enumerate every stored entry (ref + metadata). Read-only; used by the CLI
   * content view for `/content ls|stats|gc` and orphan scanning. The returned
   * array is a snapshot — concurrent puts are not reflected. Order is not
   * guaranteed; callers that need a stable order must sort.
   */
  list(): Promise<readonly ContentEntry[]>;

  /**
   * Destructive: permanently remove a stored blob and its metadata.
   *
   * This is the only mutating path besides put(), and it is destructive.
   * Content-addressed stores are otherwise append-only; remove() exists solely
   * for explicit garbage collection gated by a human confirm boundary. Callers
   * MUST treat removal as irreversible. Returns true if an entry was removed,
   * false if the ref was unknown. Unknown refs are not an error.
   */
  remove(ref: ContentRef): Promise<boolean>;
}

/** A listed content entry: its ref plus the immutable metadata. */
export interface ContentEntry {
  readonly ref: ContentRef;
  readonly metadata: ContentMetadata;
}

export interface ContentPutOptions {
  /** MIME type for the content. Default: "application/octet-stream". */
  readonly mimeType?: string;
  /** Creator identity for audit trail. */
  readonly createdBy?: string;
}

/**
 * Compute the ContentRef for given content without storing it.
 * Useful for checking existence before upload or computing expected refs.
 */
export type ContentHasher = (content: string | Uint8Array) => ContentRef;

/**
 * Decode a ContentBlob's bytes as UTF-8 text.
 * Convenience for callers who know the content is text.
 */
export function blobToText(blob: ContentBlob): string {
  return new TextDecoder().decode(blob.bytes);
}

/**
 * Normalize input to Uint8Array regardless of whether string or bytes were provided.
 */
export function toBytes(content: string | Uint8Array): Uint8Array {
  if (content instanceof Uint8Array) return content;
  return encoder.encode(content);
}

/** Validate metadata before treating a stored blob as commit-available. */
export function isContentMetadata(value: unknown, byteLength: number): value is ContentMetadata {
  if (value === null || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  const createdAt = record["createdAt"];
  return (
    record["size"] === byteLength &&
    typeof record["mimeType"] === "string" &&
    record["mimeType"].length > 0 &&
    typeof createdAt === "string" &&
    isCanonicalIsoTimestamp(createdAt) &&
    (record["createdBy"] === undefined || typeof record["createdBy"] === "string")
  );
}

function isCanonicalIsoTimestamp(value: string): boolean {
  const millis = Date.parse(value);
  return Number.isFinite(millis) && new Date(millis).toISOString() === value;
}

const encoder = new TextEncoder();
