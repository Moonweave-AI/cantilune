import type { ContentRef } from "@cantilune/core";
import type {
  ContentStore,
  ContentBlob,
  ContentEntry,
  ContentMetadata,
  ContentPutOptions,
} from "../../contentStore.js";
import { isContentMetadata, toBytes } from "../../contentStore.js";
import { createContentHasher } from "../../contentHasher.js";

interface StoredEntry {
  readonly bytes: Uint8Array;
  readonly metadata: ContentMetadata;
}

/**
 * In-memory content-addressed store.
 * Suitable for tests and short-lived processes.
 *
 * All content is stored as Uint8Array internally for consistency.
 * String inputs are UTF-8 encoded before hashing and storage.
 */
export function createMemoryContentStore(): ContentStore {
  const entries = new Map<ContentRef, StoredEntry>();
  const hasher = createContentHasher();

  return {
    isAvailable(ref: ContentRef): boolean {
      const entry = entries.get(ref);
      if (entry === undefined) return false;
      return (
        hasher(entry.bytes) === ref && isContentMetadata(entry.metadata, entry.bytes.byteLength)
      );
    },

    async put(content: string | Uint8Array, options?: ContentPutOptions): Promise<ContentRef> {
      // Break the alias with caller-owned Uint8Array/Buffer memory before it
      // becomes authoritative CAS state.
      const bytes = new Uint8Array(toBytes(content));
      const ref = hasher(bytes);

      if (!entries.has(ref)) {
        const metadata: ContentMetadata = {
          size: bytes.length,
          mimeType: options?.mimeType ?? "application/octet-stream",
          createdAt: new Date().toISOString(),
          createdBy: options?.createdBy,
        };
        entries.set(ref, { bytes, metadata });
      }

      return ref;
    },

    async get(ref: ContentRef): Promise<ContentBlob | undefined> {
      const entry = entries.get(ref);
      if (entry === undefined) return undefined;
      return {
        ref,
        bytes: new Uint8Array(entry.bytes),
        metadata: { ...entry.metadata },
      };
    },

    async exists(ref: ContentRef): Promise<boolean> {
      return entries.has(ref);
    },

    async metadata(ref: ContentRef): Promise<ContentMetadata | undefined> {
      const metadata = entries.get(ref)?.metadata;
      return metadata === undefined ? undefined : { ...metadata };
    },

    async count(): Promise<number> {
      return entries.size;
    },

    async list(): Promise<readonly ContentEntry[]> {
      const result: ContentEntry[] = [];
      for (const [ref, entry] of entries) {
        result.push({ ref, metadata: { ...entry.metadata } });
      }
      return result;
    },

    async remove(ref: ContentRef): Promise<boolean> {
      return entries.delete(ref);
    },
  };
}
