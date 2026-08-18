/**
 * Project a runtime `CollaborationSnapshot` to the wire shape the browser
 * renders. Reuses the CLI's `snapshotToData` so the world panel and `/world`
 * agree exactly. ADR-0030.
 */

import { snapshotToData } from "@cantilune/cli/lib";
import type { CollaborationSnapshot } from "@cantilune/core";
import type { WorldSnapshotWire } from "../../shared/protocol.js";

export function toWorldSnapshotWire(snapshot: CollaborationSnapshot): WorldSnapshotWire {
  return snapshotToData(snapshot) as unknown as WorldSnapshotWire;
}
