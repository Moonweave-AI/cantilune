/**
 * File-backed FreshEndpointAllocator — counter persists under storeDir.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { type Result, ok } from "@cantilune/core";
import type { FreshEndpointAllocator } from "../../ports/communicationTransport.js";
import type { FreshEndpointAllocation } from "../../mobility/endpointDelegation.js";
import { channelGeneration, channelId, descriptorRef } from "../../foundation/messageId.js";
import type { CommsViolation } from "../../foundation/commsViolation.js";

export function createFileFreshAllocator(storeDir: string): FreshEndpointAllocator {
  const path = join(storeDir, "fresh-allocator.json");
  mkdirSync(storeDir, { recursive: true });

  function readCounter(): number {
    if (!existsSync(path)) return 0;
    try {
      const raw = JSON.parse(readFileSync(path, "utf8")) as { counter?: number };
      return typeof raw.counter === "number" ? raw.counter : 0;
    } catch {
      return 0;
    }
  }

  function writeCounter(counter: number): void {
    writeFileSync(path, JSON.stringify({ counter }), "utf8");
  }

  return {
    allocate(): Result<FreshEndpointAllocation, CommsViolation> {
      const counter = readCounter() + 1;
      writeCounter(counter);
      return ok({
        endpointRef: descriptorRef(`endpoint-fresh-${counter}`),
        channelId: channelId(`channel-fresh-${counter}`),
        channelGeneration: channelGeneration(1),
        allocatedAt: new Date().toISOString(),
      });
    },
  };
}
