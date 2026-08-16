import { createToolSet, type ToolSet } from "../../src/createToolSet.js";
import type { ToolSetConfig } from "../../src/types.js";

/** Test helper: host spawn only. Production `createToolSet` defaults to required. */
export function createHostToolSet(config: ToolSetConfig): ToolSet {
  return createToolSet({ ...config, sandbox: "off" });
}
