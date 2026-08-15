import type { ContentRef } from "@cantilune/core";

/**
 * Synchronous authority consulted at the runtime commit boundary.
 *
 * Runtime commits are synchronous, so an asynchronous existence probe cannot
 * be treated as commit evidence. Implementations must answer from the same
 * authoritative store that owns the referenced bytes. Throwing is permitted;
 * the runtime converts it to a fail-closed rejection.
 */
export interface ContentRefAuthority {
  isAvailable(ref: ContentRef): boolean;
}
