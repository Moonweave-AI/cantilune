import { type ChangeId } from "@cantilune/core";
import { readOnlyViolation } from "./readOnlyViolation.js";
import { type EventTag, eventTagKey, eventTagsMetadataEqual } from "./eventTag.js";

/** Cross-projection join index keyed by ChangeId (diagram 03D byEvent). */
export interface EventTagIndex<T> {
  readonly get: (tag: EventTag) => T | undefined;
  readonly getByChangeId: (changeId: ChangeId) => T | undefined;
  readonly has: (tag: EventTag) => boolean;
  readonly size: number;
  readonly entries: () => IterableIterator<readonly [EventTag, T]>;
  readonly tags: () => readonly EventTag[];
  readonly values: () => IterableIterator<T>;
}

export function createEventTagIndex<T>(
  entries: Iterable<{ readonly tag: EventTag; readonly value: T }>,
): EventTagIndex<T> {
  const byKey = new Map<string, { readonly tag: EventTag; readonly value: T }>();
  const byChangeId = new Map<ChangeId, T>();

  for (const entry of entries) {
    const key = eventTagKey(entry.tag);
    if (byKey.has(key)) {
      const existing = byKey.get(key);
      if (existing !== undefined && !eventTagsMetadataEqual(existing.tag, entry.tag)) {
        throw readOnlyViolation(
          "invalid_input",
          `duplicate EventTag metadata for changeId ${String(entry.tag.changeId)}`,
          "byEvent",
        );
      }
      throw readOnlyViolation(
        "invalid_input",
        `duplicate EventTag index entry for changeId ${String(entry.tag.changeId)}`,
        "byEvent",
      );
    }
    byKey.set(key, entry);
    byChangeId.set(entry.tag.changeId, entry.value);
  }

  const orderedTags = [...byKey.values()].map((entry) => entry.tag);

  return {
    get(tag) {
      const stored = byKey.get(eventTagKey(tag));
      if (stored === undefined) {
        return undefined;
      }
      if (!eventTagsMetadataEqual(stored.tag, tag)) {
        throw readOnlyViolation(
          "invalid_input",
          `EventTag metadata mismatch for changeId ${String(tag.changeId)}`,
          "byEvent",
        );
      }
      return stored.value;
    },
    getByChangeId(changeId) {
      return byChangeId.get(changeId);
    },
    has(tag) {
      const stored = byKey.get(eventTagKey(tag));
      return stored !== undefined && eventTagsMetadataEqual(stored.tag, tag);
    },
    get size() {
      return byKey.size;
    },
    *entries() {
      for (const entry of byKey.values()) {
        yield [entry.tag, entry.value] as const;
      }
    },
    tags() {
      return orderedTags;
    },
    *values() {
      for (const entry of byKey.values()) {
        yield entry.value;
      }
    },
  };
}

export function mapEventTagIndex<T, U>(
  index: EventTagIndex<T>,
  mapValue: (tag: EventTag, value: T) => U,
): EventTagIndex<U> {
  return createEventTagIndex(
    [...index.entries()].map(([tag, value]) => ({ tag, value: mapValue(tag, value) })),
  );
}
