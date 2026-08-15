import { atEvent, type AtEvent } from "../../foundation/atEvent.js";
import { type EventTag } from "../../foundation/eventTag.js";
import { type EventTagIndex } from "../../foundation/eventTagIndex.js";

export type { AtEvent } from "../../foundation/atEvent.js";

export function deltasAtEvents<T extends { readonly eventTag: EventTag }>(
  index: EventTagIndex<T>,
): readonly AtEvent<T>[] {
  return [...index.entries()].map(([tag, value]) => atEvent(tag, value));
}
